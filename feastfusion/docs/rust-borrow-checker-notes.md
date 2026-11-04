# Rust Borrow Checker — Errors & Corrections Log

This is a running log of every time the Rust compiler refused to accept the
FeastFusion backend, why it refused, and how it was fixed. It exists so the same
mistake is never made twice.

**How to use this file**

When a `cargo build` / `cargo check` fails, add an entry using the template at
the bottom. Each entry has four mandatory parts:

1. **The error** — the exact compiler output, not a paraphrase.
2. **Why the compiler refused** — in plain words, what rule was broken.
3. **The fix** — the actual change that worked.
4. **The rule to remember** — one sentence that prevents the mistake next time.

---

## Build record

| Date | Command | Result | Duration |
|---|---|---|---|
| First full build | `cargo build` | ✅ Success, exit 0 | 30m 44s |

**Borrow-checker errors on the initial build: 0.**

That result is not luck — it is the outcome of writing the code in a specific
style from the start. Section 2 below records that style so it can be repeated.
Section 3 is a blank template waiting for the first real failure.

---

## 1. Errors that actually occurred

### 1.1 `#[serde(flatten)]` requires the inner type to be `Serialize`

**The error (paraphrased — this was caught while writing, before `cargo build`):**

```
error[E0277]: the trait bound `OrderRow: Serialize` is not satisfied
   --> src/models.rs
    |
    |     #[serde(flatten)]
    |     row: OrderRow,
```

**Why the compiler refused**

`Order` is a struct that flattens `OrderRow` into itself when turned into JSON:

```rust
#[derive(Serialize)]
pub struct Order {
    #[serde(flatten)]
    row: OrderRow,
    items: Vec<OrderItem>,
}
```

`flatten` works by asking `OrderRow` to serialise itself directly into the parent
object. So `OrderRow` must be able to serialise — it needs `Serialize`. It only
had `FromRow` (which lets sqlx build it from a database row). The compiler cannot
invent that trait, so it stopped.

This is not strictly a *borrow checker* error — it is a *trait bound* error. But
it belongs in this log because it is the same experience: the compiler refuses to
compile and the message is about a hidden requirement rather than a visible bug.

**The fix**

Add `Serialize` alongside `FromRow`:

```rust
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct OrderRow { /* ... */ }
```

**Rule to remember**

Any struct used with `#[serde(flatten)]` must derive `Serialize` itself. The
parent does not pass its own `Serialize` down.

---

### 1.2 A different column name in the database than in the JSON

**Not a compiler error** — this one compiled fine and would have failed at
runtime, silently returning the wrong JSON keys. Recorded here because it is the
same category of "the type system did not catch it" problem.

**The situation**

The database column is `customer_name`. The frontend expects the JSON key
`name`. Without help, `serde` would emit `"customer_name"` and the React checkout
page would show a blank name.

**The fix**

Two renames, one for each direction of travel:

```rust
#[sqlx(rename = "customer_name")]
#[serde(rename = "name")]
pub name: String,
```

`sqlx(rename)` = "read this struct field from that database column".
`serde(rename)` = "write this struct field as that JSON key".

**Rule to remember**

When a database column and a JSON key differ, you need *both* renames. One
handles reading from SQLite, the other handles writing JSON. Forgetting either
one produces a mismatch that compiles happily.

---

## 2. Patterns used to avoid fighting the borrow checker

These are the real techniques used throughout the FeastFusion backend. Follow
them and most borrow errors never happen.

### 2.1 Take ownership of query results, then borrow locally

`sqlx` returns tuples or rows by value. Doing the query first and *then* working
with the values avoids holding a borrow across an `.await`.

```rust
// Good: the row is owned, then used.
let row = sqlx::query_as::<_, (i64, i64)>("SELECT COUNT(*), SUM(x) FROM t")
    .fetch_one(&self.pool)
    .await?;
let (count, total) = row;
```

**Why it matters:** a reference borrowed across an `.await` point is the single
most common source of borrow errors in async Rust. Own the data instead.

### 2.2 Clone the cheap handle, not the expensive data

`sqlx::SqlitePool` is a cheap handle — cloning it clones a reference-counted
pointer, not the connection pool.

```rust
// Good: clone the pool (cheap) so the spawned task is 'static.
let pool = state.pool.clone();
tokio::spawn(async move {
    let _ = do_work(&pool).await;
});
```

**Why it matters:** `tokio::spawn` requires `'static`, which means no borrowed
references into `state`. Cloning the pool is the standard answer, and it is
nearly free.

### 2.3 Do the mutation while you have exclusive access, then release it

In the order-creation handler the transaction is opened, used, and committed
before anything else touches the data:

```rust
let mut tx = state.pool.begin().await?;
// ... inserts, reads ...
tx.commit().await?;
// Only now is it safe to read from the pool again.
```

**Why it matters:** a transaction holds a connection. Reading from the pool while
the transaction is still alive can deadlock under load, and holding `tx` across
later code keeps it borrowed longer than needed. Commit early, then move on.

### 2.4 Build the response value, return it — do not return a borrow of it

Handlers return owned values:

```rust
async fn get_order(...) -> AppResult<Json<Order>> {
    let order = fetch_by_reference(&state.pool, &reference).await?;
    Ok(Json(order))   // order is moved into Json, fully owned
}
```

**Why it matters:** axum handlers cannot return references to stack data. Owned
return values sidestep the entire problem.

### 2.5 Prefer `&str` for input, `String` for storage

Function parameters take `&str` so callers do not have to hand over ownership.
Structs store `String` so they can outlive the call.

```rust
fn naira(kobo: i64) -> String { /* ... */ }        // returns owned
fn validate(name: &str) -> AppResult<()> { /* */ } // borrows, does not keep
```

**Rule to remember:** borrow on the way in, own on the way out.

### 2.6 Let `?` do the error conversion

Every fallible function returns `AppResult<T>`. The `From` impls in `error.rs`
mean `?` converts each error type automatically, so no manual `match` is needed:

```rust
let item = sqlx::query_as::<_, MenuRow>(MENU_SELECT)
    .fetch_one(pool)
    .await?;                 // sqlx::Error -> AppError automatically
```

**Why it matters:** `match`/`map_err` chains are where temporary values and
borrows pile up. `?` keeps each expression short enough that borrows end
immediately.

---

## 3. Template for the next error

Copy this when something fails.

```markdown
### N. <short name of the problem>

**The error**

```
<paste the exact cargo output>
```

**Why the compiler refused**

<plain-language explanation of which rule was broken>

**The fix**

```rust
<the code that works>
```

**Rule to remember**

<one sentence>
```

---

## 4. Quick reference: the errors you will actually meet

| Compiler says | What it really means | Usual fix |
|---|---|---|
| `cannot borrow X as mutable more than once` | Two `&mut` alive at the same time | Narrow the scope with `{ }`, or finish using the first borrow before starting the second |
| `cannot borrow X as immutable because it is also borrowed as mutable` | Reading while writing | Read into an owned `let` first, then write |
| `borrowed value does not live long enough` | A reference outlives its owner | Take ownership (`.clone()` or `move`) |
| `value moved here, in previous iteration of loop` | Moved inside a loop | Borrow (`&value`) or clone before the loop |
| `cannot move out of X which is behind a shared reference` | Trying to take ownership of borrowed data | Clone it, or restructure so you own it |
| `future cannot be sent between threads safely` | A non-`Send` value held across `.await` | Drop it before the `.await`, or scope it in a block |
| the trait bound `T: Trait` is not satisfied | A hidden requirement | Derive or implement the trait (`Serialize`, `Clone`, `Send`) |

---

## 5. Why this backend avoided the classic traps

Three deliberate choices removed most borrow-checker friction before a single
line was compiled:

1. **Runtime `query_as::<_, T>` with `#[derive(FromRow)]` instead of the `query!`
   macros.** The macros need a live database at compile time and generate
   hidden types that are awkward to hold across `.await`. Runtime queries return
   plain owned structs.

2. **Integer `i64` IDs instead of UUID strings.** `i64` is `Copy`. No cloning, no
   ownership questions, no lifetime annotations when passing an ID around.

3. **All money as `i64` kobo.** Also `Copy`. Arithmetic on owned integers cannot
   produce a borrow error.

Choosing `Copy` types for the things that travel through the most code removes an
entire class of error.

---

## 6. Non-Rust errors, same discipline

The rule the user set — *write down the error, the cause and the correction* —
was applied to every layer, not just the borrow checker. These are the ones that
cost the most time.

### 6.1 `TS18047: 'x' is possibly 'null'`

**Cause.** A `useRef`/`getElementById` result is typed nullable, and TypeScript
cannot see the `if` that guarded it a few lines earlier once a callback or an
`.await` sits in between.

**Correction.** Capture the narrowed value in a `const` immediately after the
guard and use that const. Narrowing survives only while the variable cannot be
reassigned. Never use `!` unless the element is genuinely always present.

### 6.2 Assigning `LineDashedMaterial` to a `Mesh`

**Cause.** A three.js `Mesh` created without a generic type parameter is typed to
its default material. Swapping the material later is a real type error, not a
false positive — `LineDashedMaterial` is not a `MeshBasicMaterial`.

**Correction.** Type the mesh for the material it actually carries
(`new THREE.Mesh<BufferGeometry, LineDashedMaterial>()`), or build the mesh with
that material from the start. Also remember `computeLineDistances()` is required,
or the dashes silently render as a solid line.

### 6.3 `TS6133: 'systemTheme' is declared but never read`

**Cause.** The original design read the OS colour preference on every render.

**Correction.** The final design reads the OS preference **once**, to choose the
initial theme, and stores the user's explicit choice afterwards. Unused variable
deleted. The design rule is now binding: only the token layer branches on theme,
the OS is consulted exactly once.

### 6.4 CSS cascade order — the single most repeated bug (six times)

**Cause.** Two selectors of **equal specificity**; the later one in the
stylesheet wins. A mobile media query that *looks* more specific because it is
written inside `@media` is not more specific at all.

**Correction.** Either double the selector (`.site-nav .site-nav__cta`) or move
the rule. Bit us with `.btn--sm` vs `.site-nav__cta`, `.eyebrow--light`,
`.way--dark p` and `.brand__word span`.

### 6.5 A column flex item's width is its max-content width

**Cause.** `min-width: 0` is a **row-axis** fix. In a `flex-direction: column`
container it does nothing, so the child refuses to shrink and overflows the
screen.

**Correction.** `align-self: stretch` with an explicit `width`/`max-width`.

Related: a full-bleed strip built with negative inline margins also needs
`width: calc(100% + 2 * <margin>)`, or it stops short on the right.

### 6.6 `Illegal invocation` when calling a setter on the wrong reference

**Cause.** A DOM method or React setter was captured or called detached from its
owner, so the browser rejected the `this` binding.

**Correction.** Call it through the object (`el.setInput(...)`), or bind/capture
inside the effect where the reference is live.

### 6.7 A frozen CSS transition — the worst bug of the phone test

**Symptom.** On a real Android phone in light mode the sticky header stayed dark
glass (`rgba(16,14,11,.82)`) while the logo text was near-black — roughly 1.6:1,
effectively invisible. Every design token and every CSS rule was *correct*.

**Cause.** A colour transition that began while the tab was not painting froze
part-way. `getComputedStyle` then keeps returning the pre-toggle colour, so the
DOM looks right and the screen looks wrong.

**Proof that it was not the CSS.** Setting `transition: none` and forcing a
reflow snapped the value straight to the correct token.

**Correction.** A `theme-switching` class on `<html>` that disables transitions
on the element, all descendants and pseudo-elements (`transition: none
!important`), applied **synchronously** around the swap:

1. add `theme-switching`
2. set `data-theme`
3. update `<meta name="theme-color">`
4. `void root.offsetHeight` — force the recalculation to commit with transitions off
5. remove the class, same task

A `requestAnimationFrame` or `setTimeout` release is **not** reliable — it
produced the same freeze in the opposite direction on a rapid double toggle.
Stress-tested with six toggles at alternating 60/250 ms: zero mismatches.

**Lesson.** Never leave a visual state transition in flight across a moment when
the page might stop painting. Swap theme synchronously.

### 6.8 Background-tab timer throttling

**Symptom.** An automated audit script appeared to hang for minutes on the phone.

**Cause.** Chrome throttles `setTimeout` in a hidden tab to roughly once a
minute. Not a slow device — throttling. Additionally, Chrome for Android only
lays out the **visible** tab, so a background tab reports `innerWidth === 0`.

**Correction.** Check `document.visibilityState === 'visible'` (and a non-zero
`innerWidth`) before measuring anything, and bring the tab to the front first.
An audit run on a tab that is not painting produces meaningless colour numbers.

### 6.9 Growing a tap target without moving the text

WCAG 2.5.8 AA asks for 24×24 CSS px; 44×44 is the comfortable thumb size.

```css
/* text stays exactly where it was */
display: inline-block;
padding-block: 14px;
margin-block: -14px;

/* inline link in a row */
display: inline-flex;
align-items: center;
min-height: 44px;
padding-inline: var(--sp-1);
margin-inline: calc(var(--sp-1) * -1);
```

### 6.10 An audit that reports the invisible

**Cause.** Children of a closed drawer report their own `opacity: 1`, so an
automated contrast check flags links nobody can see.

**Correction.** Walk up the ancestor chain and skip anything with
`opacity < 0.05`, `visibility: hidden` or `display: none`. Also skip elements
under an ancestor with a gradient background — the composite colour cannot be
known. Compare overflow against `documentElement.clientWidth`, not
`innerWidth`.

### 6.11 Gold text contrast

`--gold-400` is 3.3:1 on cream: legal only for large text (18.66 px bold or
24 px). A mobile media query that shrinks the text silently breaks the rule.
`--gold-500` is safe at every size in both themes. Use `--gold-500` for text and
save `--gold-400` for decoration.

### 6.12 A passing audit hid two content defects

**The error.** Nothing failed. All nine routes reported
`ovf=ok tgtFAIL=0 nameless=0 contrast=0`, the purchase flow passed 20/20, and the
product still shipped two kinds of wrong text: 32 en/em dashes (about 18 of them
in visible copy) and three leftover references to Lagos, Yaba and Ikeja after the
business had been repositioned to Abuja.

**What actually caused it.** Every automated check measured *geometry* — does it
overflow, is the target big enough, is the contrast legal — and none of them read
the words. A layout engine cannot tell that `Kitchen pickup — Yaba` contradicts a
decision the owner made three conversations earlier. Machine checks pass
silently over copy, because copy is not a number.

**The correction.** Geometry audits and content audits are separate instruments
and both must run. Wrote `shots/text-lint.js`, which navigates a route the same
way the audit does, then counts banned glyphs and stale place names in
`document.body.innerText`. It reports `dash=`, `stale=`, `words=` and `CLEAN`.
Two rules came out of it and are now part of the build:

1. No `—` or `–` in any user-visible string. Rewrite with a full stop, a comma,
   or the word "and". CSS comments may keep them; they are never rendered.
2. No `Lagos`, `Yaba`, `Ikeja`, `Surulere` or `Lekki` anywhere. The brand is
   Abuja-first, and expansion states are listed explicitly instead.

Editing `seed.rs` is not enough for rule 2: it only runs on an empty database, so
the existing row had to be rewritten in `backend/data/feastfusion.db` as well.
A content fix is not done until the *stored* copy is fixed.

### 6.13 42 px looked fine and was a near-miss

**The error.** The tap-target audit reported `tgtFAIL=0` on every route, so the
targets were declared done, while `tgtSOFT` quietly listed ten controls: chips at
40 px, quantity steppers at 40 px, buttons at 42 px, cart steppers at 36 px. All
of them passed WCAG AA (which only asks for 24 px) and all of them were below the
44 px touch guidance.

**What actually caused it.** Height was never set. It fell out of padding:
`padding: 0.85rem 1.6rem` plus a `line-height: 1` font gives 42 px by accident,
and any later change to font size or padding would move it again. A dimension you
did not declare is a dimension nobody controls.

**The correction.** Declare the floor instead of hoping the box adds up. One
mobile rule in `global.css`:

```css
@media (max-width: 720px) {
  .btn,
  .chip {
    min-height: 44px;
  }
}
```

plus explicit `width`/`height: 44px` on both stepper variants. The soft count on
the phone fell from `4/10/3/3/3/2/2` to `4/2/1/2/1/1/1`, and the remainder are
wide links (243 to 278 px) and the logo, which are easy to hit. Note that
`min-height` also leaves the text optically centred, which is why 6.9's
padding trick is not needed for these.

**Lesson.** "Zero failures" only means the bar was set at zero. Always print the
soft list and read it: it is the difference between legal and comfortable.

---

## 7. The standing rule

Every error gets three lines: **the error**, **what actually caused it**, **the
correction**. Fixing a bug without writing those three lines means paying for the
same lesson twice.
