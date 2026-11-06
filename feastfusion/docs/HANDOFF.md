# FeastFusion handoff

Written for whoever picks this up next, including future me. Plain language first,
technical detail after.

---

## 1. What this project is

FeastFusion is a food ordering website for Abuja. Customers browse the menu, pick
dishes, pay a deposit, and place an order. There are two sides:

- **The shop** (what customers see).
- **The admin area** (what the caterer sees, behind a login).

The caterer decides what is on sale. A dish only appears in the shop when the
caterer switches it on. That single rule is the spine of the whole catalogue work.

**Stack:** async Rust (axum + sqlx + SQLite) for the backend, React + Vite +
TypeScript for the frontend.

**Live branch:** `ogunlowoaamos-feastfusion-shop`
**Pushed to:** `https://github.com/ogunlowoaamos/earshot` (the fork, remote name `mine`)
**Not pushed to:** `Leonxlnx/earshot` (remote `origin`) because this account has read only access there.

---

## 2. How to run it

Two processes. Both need to be running.

### Backend

```powershell
cd feastfusion\backend
cargo run
```

Listens on `http://127.0.0.1:8080`. Creates `feastfusion.db` on first run and seeds
it. Migrations in `migrations/` are applied automatically at startup.

Build is slow on this machine (around 8 minutes for a cold `cargo check`). That is
the hardware, not the code.

### Frontend

```powershell
cd feastfusion\frontend
npm install
npm run dev
```

Listens on `http://127.0.0.1:5173` and proxies `/api` to port 8080.

### Admin login

- Username: `admin`
- Password: `feastfusion123`

Open `http://127.0.0.1:5173/admin`.

---

## 3. Where things live

```
feastfusion/
  backend/
    migrations/          database changes, applied in order
      0001_init.sql
      0002_catering.sql
      0003_catalogue_and_options.sql   <-- new, part of the catalogue work
    src/
      main.rs            router and startup
      seed.rs            first run data (zones, 7 starter dishes, rates)
      catalogue.rs       <-- new, the big Nigerian catalogue
      models.rs          all the request and response shapes
      pricing.rs         deposit maths
      routes/
        menu.rs          public menu, categories, zones
        orders.rs        placing and reading orders
        catering.rs      catering requests and quotes
        admin.rs         everything behind the admin login
  frontend/
    src/
      pages/             Home, MenuPage, ItemDetail, Cart, Checkout, Admin, Catering
      components/        MenuCard, CartDrawer, Select, Switch, and so on
      lib/api.ts         typed calls to the backend
      lib/cart.tsx       cart state, saved in localStorage
      styles/            tokens.css (radius and colour), global.css
  docs/                  this file and the catering agreement
  shots/                 screenshot and browser probe helper scripts
```

---

## 4. What is finished and verified

These were built, run, and checked on a real phone and on desktop:

1. **The whole shop front.** Landing page, Abuja zones, a three.js map, menu grid,
   item detail, cart, checkout, order confirmation.
2. **Corner radius system.** Buttons and controls 8px, cards 16px, pills fully round.
   Defined once in `tokens.css`.
3. **Dropdown arrows.** One shared select chevron, properly positioned, with an 8px
   dropdown panel.
4. **Catering form.** Event details, dish selection with toggles, ingredients,
   and a working deposit calculator.
5. **Deposit maths** in `pricing.rs`, driven by per category rates the caterer can edit.
6. **The catalogue.** 237 dishes across 16 categories, each with priced choices, all
   hidden until the caterer switches them on. Admin screen verified in a real browser.
7. **The landing page.** Rebuilt so the first screen fits without scrolling, the menu
   moved out to its own page, and the old "Our Kitchen" page folded into the landing
   page. Details below.

Commit `b1e9aa5` is the last verified good state before the catalogue work. If anything
goes wrong with the catalogue, that is the safe place to return to.

### The landing page

The landing page is now the only home page. It has nine blocks, in this order:

1. **Hero.** Headline, one short line of supporting text, and two buttons. It fits
   inside the first screen at every size from a small phone up to a wide desktop, so
   the buttons are always reachable without scrolling.
2. **Numbers band.** Three figures, moved out of the hero so the hero stays short.
3. **Dish ribbon.** A dark strip of dish names scrolling sideways. It sits directly
   under the numbers band.
4. **Three ways to eat.** Delivered, pickup, catering.
5. **The kitchen wall.** A moving wall of food photos and short cooking clips. Three
   columns, the middle one drifting the other way, and it pauses when you hover. This
   replaced the old row of menu cards, so the landing page shows food rather than a
   menu. The menu lives at `/menu`.
6. **Delivery map.** The Abuja zones map, loaded only when it scrolls into view.
7. **Catering band.** The dark full width block that leads to the catering form.
8. **Our kitchen.** The old About page, folded in here. Photo on one side, the story
   and four short values on the other. It carries the `#kitchen` anchor.
9. **Testimonials.** Three short quotes.
10. **Closing call to action.**

**What changed and why**

- **The type scale was too big.** The largest heading size was 80px, which pushed the
  hero to about 980px tall and hid the buttons below the fold on a laptop. The scale in
  `tokens.css` now tops out at 56px. This is a global change, so every page benefits.
- **The hero copy was cut** from 27 words to 17, and the three statistics moved into
  their own band underneath.
- **`/about` no longer exists.** It redirects to `/#kitchen`. The header link and the
  footer link both point there. `About.tsx` was deleted.
- **The header link is a plain link, not a router link**, for hash targets, so it does
  not get marked as the current page.
- **`ScrollToTop` was rewritten.** It used `requestAnimationFrame`, which never fires in
  a background browser tab, so the jump to `#kitchen` silently did nothing. It now does
  the scroll immediately and retries once after 80ms in case the section has not
  mounted yet.
- **Eyebrows were cut from six to three.** The small uppercase labels above section
  headings are limited to one per three sections. The hero, the catering band and Our
  Kitchen keep theirs; the other three were removed.
- **The first screen now holds the hero, the numbers band and the dish ribbon.** The
  hero used to be 706px tall on a 1366x768 laptop, which pushed both strips off the
  bottom of the screen. The hero padding, the gaps between the hero pieces, the height
  of the hero photo and the padding inside both strips were all trimmed, and the
  headline now shrinks a little on narrow laptops so it stops wrapping to a fourth
  line. The hero is 466px at that size now, and the ribbon finishes at 707px, so
  everything is visible without scrolling.

**How it was checked.** A browser was driven directly and the page was reloaded at each
of eleven screen sizes, from 360x740 up to 1920x1080. At every size the hero buttons sat
above the fold and there was no sideways scrolling. The bottom edge of the dish ribbon
was measured at each desktop size and it lands inside the screen every time: 796px of
1080, 717 of 900, 707 of 768, 704 of 800, and 674 of 768 on a 1024px laptop. On a phone
the hero photo drops below the text, so the two strips sit one scroll down; that is
deliberate, because squeezing a photo and two strips into a phone screen would leave no
room for the food. The kitchen wall was measured with motion switched on: 558px tall
window, three columns, tiles scrolling inside it, and a static grid of all fifteen
photos for anyone who has asked their device to reduce motion.

---

## 5. The catalogue: what was built

Read this section before touching anything catalogue related.

**Build state:** the backend compiles and runs. The database is seeded with the full
catalogue and the seeder is safe to re-run: it will not duplicate dishes or overwrite
prices the caterer has already set.

### The goal

The caterer wants 237 Nigerian dishes loaded into the admin area, covering
swallows, soups, rice, puddings, salads, desserts, drinks, grills, small chops,
proteins, sauces, fast food, pastries, sides, breakfast and cakes.

Two rules from the caterer, word for word:

> if the chef.caterer does not toggle it availbility, then it should not show up on
> the customer side and be intelligent about it

> each size and add-on has its own price

So every dish starts **switched off and unpriced**. It cannot appear in the shop until
the caterer turns it on and gives it a price. And every size, every count, every
add-on carries its own price rather than sharing one.

### What is done

| Piece | File | State |
|---|---|---|
| Database tables for options | `migrations/0003_catalogue_and_options.sql` | Done, applied |
| All 237 dishes, 16 categories | `src/catalogue.rs` | Done |
| Option templates | `src/catalogue.rs` | Done, 21 templates |
| Seeder (safe to re-run) | `src/catalogue.rs` `seed_catalogue()` | Done |
| Response shapes for options | `src/models.rs` | Done |
| Availability gate on the shop | `src/routes/menu.rs` | Done |
| Admin catalogue endpoint | `src/routes/admin.rs` | Done |
| Reading options back on an order | `src/routes/orders.rs` | Done |
| Admin catalogue screen | `frontend/src/pages/Admin.tsx` | Done |

`catalogue.rs` holds:

- **16 categories** with their display order.
- **21 option templates** (`Shape`), each a fixed set of choice groups.
- **237 dishes** spread across all 16 categories.

### What the database actually contains

Verified by reading the database directly:

| Measure | Count |
|---|---|
| Categories | 16 |
| Dishes | 237 |
| Dishes switched on and priced | 24 |
| Dishes hidden and unpriced | 213 |
| Option groups | 501 |
| Individual choices | 2197 |
| Duplicate dish names | 0 |

The 24 live dishes are the original menu. Everything else waits for the caterer.

`Tea and Bread` is the only dish with no option groups. That is deliberate, because
there is nothing to choose.

### What is not started

- **Customer side of options.** The shop still shows a dish as a single price. It
  does not yet let a customer pick a size or an add-on, and the cart does not carry
  those choices.
- **Checkout does not price options.** `routes/orders.rs` stores the chosen option
  text but the server-side price check for options still needs confirming.
- **Catering form still lists 7 categories.** `Catering.tsx` has a hardcoded list of
  7 slugs; it should offer all 16.

### What you can see today

The admin area has a **Catalogue** tab. It lists all 237 dishes grouped by category,
with a search box, a category filter, a price box per dish, an on/off switch, an
options editor and a delete button. Only dishes that are switched on **and** priced
appear in the shop.

### The admin Catalogue screen

Open `/admin`, sign in, and click **Catalogue**. From top to bottom:

- **Header bar.** Shows how many dishes are switched on, how many still need a price,
  and a **+ Add dish** button.
- **Search box.** Type part of a dish name and the list narrows as you type.
- **Category filter.** A dropdown that shows one category at a time, or all of them.
- **One section per category.** Each has the category name, a count of how many of its
  dishes are on, and a **Turn all on / Turn all off** button for the whole section.
- **One row per dish.** A small photo, the dish name, a badge, the number of choices it
  offers, a price box, an on/off switch, an **Options** button and a delete button.
- **The badge** reads **Needs a price** in a warning colour until a price is typed, then
  turns into the naira amount in a calm colour. That badge is the caterer's to-do list.
- **The price box** saves when you click away or press Enter. No save button to forget.
- **The Options button** opens the editor for that dish: each group of choices, each
  choice with its own price, and a Save button.

### How it was checked

Every one of these was tested in a real browser, not assumed:

| Check | Result |
|---|---|
| All 16 category sections render with the right names and counts | Pass |
| 237 dish rows listed | Pass |
| Search "jollof" narrows to 2 dishes | Pass |
| Category filter "cakes" shows 11 cakes | Pass |
| Typing a price saves it and the badge flips to naira | Pass, confirmed in the database |
| The on/off switch round trips and the counters update | Pass |
| The options editor opens with groups, choices and Save | Pass |
| No sideways scrolling at desktop 1440 wide | Pass |
| No sideways scrolling at phone 390 wide | Pass |

The test scripts live in `feastfusion/shots/` and can be re-run after any change:
`admin-catalogue.js`, `cat-test.js`, `cat-price.js` and `cat-shots.js`. They need the
admin token in `feastfusion/shots/.token`. That whole folder is gitignored on purpose,
because it holds a live login token and scratch screenshots, so it exists only on the
machine that made it. Recreate the scripts if you work from a fresh clone.



---

## 6. The catalogue design, in plain terms

### Categories

Sixteen, each with a stable slug. The slug is the key the rest of the app uses, so
**never rename a slug** without updating the database and the frontend together.

| Order | Slug | Name |
|---|---|---|
| 1 | `rice-grains` | Rice Dishes |
| 2 | `soups-swallow` | Soups & Stews |
| 3 | `swallows` | Swallows |
| 4 | `grills` | Grills |
| 5 | `small-chops` | Small Chops |
| 6 | `proteins` | Protein Dishes |
| 7 | `sauces` | Sauces & Dips |
| 8 | `fast-food` | Fast Food |
| 9 | `pastries` | Pastries |
| 10 | `breakfast` | Breakfast |
| 11 | `puddings` | Puddings & Porridges |
| 12 | `salads` | Salads |
| 13 | `sides` | Sides & Extras |
| 14 | `desserts` | Desserts & Sweets |
| 15 | `cakes` | Cakes |
| 16 | `drinks` | Drinks |

The first seven already existed and are used by the deposit calculator. **They must
keep their exact slugs.** The other nine are new and safe to add.

### Option templates

Rather than write choices per dish, dishes borrow a template. A dish that uses the
`Shape::Swallow` template gets portion, extras and note choices. This keeps 237
dishes from becoming 237 blocks of copy.

The templates cover the caterer's order checklist: pizza sizes from 6 inch to 18 inch,
burger single, double and triple, quantity counts, sausage counts, hot dog combos,
fries sizes and types, and the rest.

Two details worth knowing:

- **Sausage roll count** is labelled "Number of sausage rolls in the pack", because
  the caterer asked that it be unmistakable.
- **Cakes** have four groups: size, icing, flavour, and finish. Icing is a choice on
  the cake rather than its own category, because that is how a cake is actually ordered.

### How availability works

Three states matter:

1. `menu_items.is_available` is `0` or `1`. `0` means invisible in the shop.
2. `item_options.is_available` is the same idea, one level down. An option can be
   switched off without touching the dish.
3. `menu_items.price_kobo` is `0` for anything not yet priced. Zero is used as the
   "no price set" marker. A dish with no price must not reach the customer even if it
   is switched on, otherwise you sell food for nothing.

The gate belongs on the server, not the browser. A hidden dish must be rejected at
checkout, not merely hidden from the list. Anything else is a hole someone can walk through.

---

## 7. Rules that must not be broken

These were learned the hard way. Breaking one causes a bug that is hard to see.

### Money and pricing

- All money is stored in **kobo**, as an integer. Never floats. `naira()` on the
  frontend does the display conversion.
- The deposit calculator keys rates on **category slug**. An unknown slug contributes
  zero, so adding categories is safe, but renaming one silently drops its rate.
- Prices are worked out **on the server** when an order is placed. Never trust a price
  sent by the browser.

### Database

- `menu_items.name` is **not unique**. Insert dishes with
  `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = ?)` or you get
  duplicates on every restart.
- `categories.slug` and `categories.name` **are** unique, so `ON CONFLICT (slug) DO UPDATE`
  is safe there.
- `menu_items.price_kobo` has `CHECK (price_kobo >= 0)`, so zero is legal and negative is not.
- SQLite only honours `ON DELETE CASCADE` when `PRAGMA foreign_keys = ON`. The app does
  not rely on this, so **delete child rows explicitly** when replacing options.

### Design

- Buttons and controls 8px, cards 16px, pills and badges fully round. The scale lives
  in `styles/tokens.css`.
- No em-dashes or en-dashes anywhere the customer can see them.
- Fonts are Newsreader and Onest only.
- The theme lives in `localStorage['feastfusion.theme']` and `data-theme` on `<html>`.
- Use `background-color:` rather than the `background:` shorthand on anything with a
  chevron, because the shorthand wipes the background image the chevron is drawn with.
- Billboard copy stays Abuja. No Lagos references.

---

## 8. How to resume

Steps 1 to 7 are done. What remains is the customer side.

### Done

1. ~~Finish the dish list~~ in `src/catalogue.rs`. All 16 categories, 237 dishes.
2. ~~Write `seed_catalogue`~~ in the same file. It upserts categories, inserts only
   dishes whose names are new, sets `is_available = 0` and `price_kobo = 0`, moves
   existing dishes to their correct category, and creates option groups only when a
   dish has none, so the caterer's later edits are never overwritten on restart.
3. ~~Call it~~ from `seed.rs` `run()`, with `mod catalogue;` in `main.rs`.
4. ~~Gate the menu~~ in `routes/menu.rs`. `list_menu` returns only available and priced
   dishes with their available options attached. `list_categories` returns only
   categories that still hold at least one visible dish.
5. ~~Add admin endpoints~~ in `routes/admin.rs`: list everything for the admin, replace
   a dish's options, and switch availability.
6. ~~Admin catalogue panel~~ in `frontend/src/pages/Admin.tsx`. Search, category filter,
   price box, on/off switch, bulk on/off per category, options editor, delete.
7. ~~`api.ts` types~~ for options and the catalogue.
8. ~~Landing page rebuild~~. Hero fits every screen, menu moved to `/menu`, kitchen wall
   added, About folded in, `/about` retired, type scale reduced.

### Still to do

1. **Confirm option pricing at checkout** in `routes/orders.rs`. Check each chosen
   option belongs to that dish and is available, refuse if a required group has no
   choice, add the option prices on the server, and store the readable summary plus
   the customer note. The storage half is written; the price check needs confirming.
2. **Item detail page.** Choice groups with a live total, so the customer sees the
   price change as they pick a size or an add-on.
3. **Cart keyed by dish plus chosen options.** Two of the same dish with different
   sizes are two lines, not one.
4. **Menu card shows "from" the cheapest price**, not a single flat price.
5. **Checkout sends the chosen options and the note.**
6. **Catering form** in `Catering.tsx` still has a hardcoded list of 7 category slugs
   at line 36. Extend it to all 16.
7. **Verify** with `cargo check` and `npm run build`, then on the real phone.

The order matters. Gating availability before the admin existed would have hidden the
whole menu, because every new dish starts switched off. That is why the admin came first.


---

## 9. Assumptions I made that the caterer should confirm

These were reasonable guesses, not instructions. Correct any that are wrong.

1. **New dishes start at zero naira** with a "Needs a price" flag in admin, rather than
   inventing prices.
2. **Sausage counts are an option on the dish**, not a separate paid line item.
3. **Placeholder photos** use `https://picsum.photos/seed/ff-<name>/800/600`. The caterer
   replaces them with real photos.
4. **Icing is a cake option**, not its own category.

Earlier questions still unanswered from before this work:

- Real delivery fees per state.
- Which of the four "coming soon" zones should go live.
- Paystack or Flutterwave, and the WhatsApp or email details.
- Whether the catering agreement should hard-code naira figures.
- Whether Lagos stays in the catering state list.

---

## 10. Customising later

**Change a dish price.** Admin, catalogue, price box. Prices are per dish and per option.

**Change what a dish offers.** Admin, options editor. Groups can be added, renamed,
reordered, marked required, or priced individually.

**Hide a whole category.** One switch in admin flips every dish in it. The shop drops
the category chip automatically because the chip list is built from visible dishes only.

**Add a category.** Add a row to `CATEGORIES` in `catalogue.rs`, add its slug to
`DISH_CATEGORIES` in `pages/Catering.tsx` if it should appear in the catering form, and
give it a rate in admin pricing if it should affect the deposit.

**Change the deposit.** Admin, pricing. Rates are per event type and per dish category.

**Change the kitchen wall photos or clips.** In `pages/Landing.tsx`, the `WALL_COLUMNS`
list holds the tiles. Each entry is either `photo('<unsplash id>')` or `clip('<video
url>')`. Add, remove or reorder freely; the columns rebalance themselves. Keep the count
per column equal or the loop will jump.

**Change how fast the wall scrolls.** In `pages/Landing.css`, the `wall-rise` and
`wall-fall` animations. The `64s` is the time for one full pass. A smaller number is
faster.

**Change the wall height.** Same file, `.wall__cols`. It is currently
`clamp(420px, 62vh, 620px)`, meaning it grows with the screen but never goes below 420px
or above 620px.

**Change the biggest heading size.** `styles/tokens.css`, the `--step-5` line. It is
`clamp(2.3rem, 1.7rem + 3vw, 3.5rem)`, which means 37px on a small phone and 56px on a
desktop. Raising the last number makes every large heading on the site bigger, so check
the hero still fits afterwards. The hero headline has its own slightly smaller version
of the same formula in `Landing.css` (`.hero__title`) so it does not wrap to a fourth
line on a 1024px laptop. If you change one, change the other.

**Make the first screen taller or shorter.** Three numbers control it, all in
`Landing.css`. `.hero` `padding-block` sets the space above and below the hero content.
`.hero__media` `min-height` and `.hero__frame--main` `max-height` set how tall the hero
photo is allowed to be; they are both `clamp(300px, 44vh, 480px)`, so the photo grows
with the screen. `.stats-band__inner` and `.marquee` `padding-block` set the thickness
of the two strips. If you make the hero photo taller, the dish ribbon will drop below
the fold on a 768px-tall laptop, so re-measure after any change.

---

## 11. Traps worth knowing

- **The build is slow.** `cargo check` around 8 minutes on this machine. Use a long wait
  rather than assuming it hung.
- **`view` may not show images.** Use numeric browser probes instead of screenshots when
  you need to know what is actually on screen.
- **Synthetic clicks lie on the phone.** Label wrapped inputs double fire. Use real touch
  events, as `shots/tap-row.js` does.
- **PowerShell has no heredoc.** Pipe a here string instead, and use
  `git commit -F <file>` for multi line commit messages.
- **Push to `mine`, not `origin`.** `origin` rejects this account.
- **The automation browser lies about motion.** It reports that the visitor has asked
  for reduced motion, so every animated section silently shows its still fallback. The
  kitchen wall looked like a broken 3000px stack for several rounds of testing because
  of this. Any screenshot or measurement of an animated section must first tell the
  browser to pretend motion is welcome. `shots/shot-section.js` now does this.
- **The automation browser also lies about zoom.** One profile had a permanent 75% zoom,
  so every measurement came back a third too large. Use a fresh profile with
  `--force-device-scale-factor=1` and check that the reported pixel ratio is exactly 1
  before trusting any number.
- **Sizes based on screen width are frozen at page load.** If you resize the browser
  after the page has loaded, headings keep the size they were given at load. Reload the
  page after every resize, or the numbers are wrong.
- **`requestAnimationFrame` never fires in a background tab.** Anything that waits for
  the next frame will silently do nothing. Use `setTimeout` in test scripts, and prefer
  doing the work immediately in app code.
