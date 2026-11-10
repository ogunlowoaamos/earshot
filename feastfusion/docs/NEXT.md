# Where we are

A short note so a fresh chat can pick up with no history.

## Running already

- Frontend: http://localhost:5173 (Vite, hot reloads)
- Backend: http://127.0.0.1:8080 (Rust, axum)
- Admin login: `admin` / `feastfusion123`
- Browser automation: Chrome on CDP port **9335**, probes in `feastfusion/shots/`

## Finished and checked

1. **Header** is 52px tall, one line on desktop.
2. **Container** is 1320px wide, so the side gaps are small.
3. **Page top padding** cut on every page, so content starts right under the header.
4. **Dish page** does not scroll at all on a laptop. The pairings sit in their own side rail that scrolls on its own.
5. **Dish page buttons** are normal size now, and the total sits on the same line as the quantity.
6. **Scrollbars** are themed to the site colours, and the inner rail scrollbar is hidden.
7. **Basket drawer** is compact: smaller header, smaller thumbnails, smaller steppers, smaller Checkout button.
8. **Categories** only show on the menu when the caterer switches them on. The admin Catalogue tab has an `On the menu` / `Hidden` button per category.
9. **Menu cards** are fully clickable. The Add button still works on its own.
10. **Landing ribbon** sits exactly on the fold and cycles every live dish.
11. **Ingredients** exist for all 289 dishes, and the admin can edit them.
12. **Catering page rebuilt as four collapsible step cards.** See the section below.
13. **The site footer only shows on the landing page.** Every other page is an app
    screen, so the footer was just adding scroll. `App.tsx` now checks
    `pathname === '/'` instead of the old dish-page check.
14. **"Goes well with" cards have − / + steppers.** Every card shows a stepper on
    the same line as its price, so the count is always in the same place and the
    cards never change height. Tapping the dish name still adds one. − is greyed
    out at zero, + is greyed out at 20 or when the dish is sold out. The card
    keeps a gold edge while it is in the basket. See the note below.
15. **Dishes can ask "how many of each".** A dish like the Small Chops Platter can
    ask the customer to pick individual chops and say how many of each. Works on
    the dish page, the catering page and the admin page. See the note below.
16. **Portion is the caterer's switch, not the code's.** A group can be marked
    "Let them type it", and the customer then gets a box to say the size in their
    own words. 51 dishes are Standard/Custom, 107 keep three tiers, and the
    platter has no Portion at all. See the note below.
17. **The caterer switches a dish's questions on and off.** The admin has 17
    ready-made groups (Portion, Swallow, Extras, Toppings, …) shown as on/off
    chips, both in a dish's Options editor and in the Add dish form, so a new
    dish can be created with its questions already in place. See the note below.
18. **One Media box takes pictures, videos and links together.** The old
    separate Picture and Video boxes are gone. The caterer can paste links or
    upload many files at once, and any tile can be made the cover. See the note
    below.
19. **The dashboard title shrinks when you scroll or click**, and grows back at
    the top. See the note below.
20. **The Catalogue shows two dishes per row**, so the page is about 4,000px
    shorter. See the note below.

## The catering page, as it stands

File: `feastfusion/frontend/src/pages/Catering.tsx` and `Catering.css`.

The page is one `<form>` laid out in two columns.

**Left column — four numbered steps.** Each step is a heading button plus a card
underneath it holding the real fields:

| Step | Heading | Fields inside the card |
| --- | --- | --- |
| 1 | Tell us the job | job kind, then the dark "tell us the job" panel: service toggles (only for "Something else"), occasion, guests, date, time |
| 2 | Pick the dishes | dish categories, suggestions, other dishes |
| 3 | Say where and when | state, LGA, street |
| 4 | Choose how we reach you | channel, handle, name, phone, email, details |

- Clicking a heading opens that card and closes the other three. Clicking the
  open one closes it. Only one card is open at a time.
- The caret on the right of each heading flips to show open or closed.
- Every card is `border-radius: 8px`. So are the side column, the summary and
  the deposit breakdown.
- The cards are deliberately tight: small padding, small labels, small inputs.
  The whole page is about 1090px tall on a 1440px-wide screen, down from 3160px.

**The head band folds away.** The page opens with all four cards closed, so the
first thing you see is the title, the one-line intro and the four headings. The
moment you open any step, `headCompact` flips to `true` and the header gets
`.is-compact`:

- the intro paragraph (`.lede`) is `display: none`;
- the title drops from `--step-3` to `--step-1` (28.8px → 17.6px at 1440px);
- the eyebrow drops to `0.66rem` (12.5px → 10.6px);
- the band's padding drops to `--sp-2`.

That takes the band from 145px to 61px and it stays folded for the rest of the
visit. `submitAll()` also sets it, so the compact head is in place when the
browser scrolls to the first invalid field.

**The dark espresso surface.** The parts of the form you actually fill in sit on
a dark espresso card, so they read as "this is where you answer" against the
cream page. One shared class does it: `.catering-dark` in `Catering.css`.

- It sets `background: var(--bg-inverse)`, a translucent white border, `8px`
  radius, `color-scheme: dark`, and a light `--chevron-down` override so the
  dropdown arrows stay visible.
- Everything inside it is re-coloured: labels, inputs, selects, textareas,
  placeholders, hints, `.choice` cards, `.dish-row` rows and
  `.dish-suggest__chip` chips all get light text on translucent white wells.
- Step 1 uses it on the inner `.catering-subchoices` panel. Steps 2, 3 and 4
  use it on the whole `.catering-step__card`.
- **Never** use raw colour ramp steps inside it. Use `--bg-inverse`,
  `--text-inverse` and `--text-inverse-muted` so both themes work.

**"Something else" follow-ups.** Picking "Something else" as the job kind opens
two toggle groups inside the dark panel:

1. **Which service do you need?** — Chef-at-home service, or Custom
   chef-prepared meal delivery.
2. **Who is providing the food?** — only appears for chef-at-home: ingredients
   supplied, or the chef buys them.

Each group shows a gold "Needs your answer" pill until it is answered. The
toggles are `aria-pressed` buttons, not radios, so they can be switched off by
picking the other one.

The backend only knows three job kinds (`event`, `cook_only`, `custom`), so
these two answers are not sent as their own field. `onSubmit` writes them into
`details` as `Service: … Food: …` above whatever the customer typed.

**Occasion, guests, date and time are asked for every job kind.** They used to
be hidden for "Cook only". Now all three kinds show occasion, guests, date and
time, and the chosen occasion is sent as `event_type` (it used to be hard-coded
to `cook_only`). `quote_cook_only` in `backend/src/pricing.rs` ignores
`event_type`, so the deposit maths is unchanged.

**"Private / custom" is the default occasion for "Something else".** A
"Something else" job is usually a private arrangement, not a party, so
`PRIVATE_OCCASION` (`value: 'private'`) is added to the top of the occasion
dropdown — but only while the job kind is `custom`. Picking "Something else"
selects it and blanks the guest count; picking any other job kind removes the
option, resets the occasion to `birthday` if it was private, and puts `50` back
in the guest count.

While the occasion is private the guest count is **optional**: the label gains a
muted "optional" suffix (`.field__optional`), the input loses `required`, the
hint becomes "Leave it blank if you are not sure yet. The caterer will work the
number out with you.", and the summary row reads "To be worked out" instead of
"Not given yet". `pickOccasion()` puts `50` back if a normal occasion is chosen
while the count is still blank.

No backend change was needed: `create_catering` only requires a guest count when
`job_kind == "event"`, and `quote()` sends `custom` jobs down the
"caterer will confirm the deposit" path without ever reading `event_type`, so an
occasion with no per-guest rate is safe.

**The time field.** `event_time` is a new column on `catering_requests`
(migration `0006_catering_time.sql`, `TEXT NOT NULL DEFAULT ''`). It is
required by the form and by `create_catering`, which rejects an empty value with
"What time do you need us?". The summary shows it as "2:30 pm" via `formatTime`,
and the admin request list appends it after the date.

The time is picked with three short dropdowns — hour (1–12), minutes (01–59)
and am/pm — instead of `<input type="time">`. The browser's own time spinner
scrolls forever and is awkward on a phone. The am/pm dropdown has only the two
real choices, with `am` selected by default, so there is no empty third state to
validate. `to24Hour()` in `Catering.tsx` turns the three picks into the `HH:MM`
the server stores, and the `.time-pick` grid in `Catering.css` lays them out in
three equal columns.

**The dish list is a dropdown, and each pick is removable.** The 17 dish
categories used to be a long always-open list that pushed step 2 down the page.
They now live inside `.dish-pick__menu`, which only renders while `dishesOpen` is
true.

The closed state is `.dish-pick__control`: a wrapping row of gold
`.dish-pick__chip` pills, one per chosen dish, each with its own
`.dish-pick__chip-x` × button, plus a `.dish-pick__toggle` on the right holding
the gold `.dish-pick__count` badge and the caret. Clicking a chip's × calls
`e.stopPropagation()` and then `toggleDish(slug)`, so it removes **only that
dish** and does not open the menu. Clicking anywhere else in the chips area
opens the menu. With nothing picked the row shows `.dish-pick__placeholder`
"Choose the dishes".

The menu is absolutely positioned under the control, `max-height: 420px` with
its own scroll, and closes on an outside `mousedown` or `Escape` (a `useEffect`
watching `dishPickRef`). The "Goes well with" suggestion chips and the "Switch
on as many as you need." hint stay outside the dropdown so they are always
visible.

**Inside the menu, each category shows its real dishes as small cards.** A
category row is a `.dish-cat` two-column grid: the category checkbox on the
left, and on the right a `.dish-cat__items` wrap of `.dish-card` buttons — one
per dish in that category, 8px radius, 0.7rem, gold when picked. The dish names
come from `api.menu()`, grouped by `category_slug` in the `dishesByCategory`
memo. Categories with no dishes yet simply show no cards.

Picking a dish calls `togglePickedDish(item)`, which adds the dish name to
`pickedDishes` **and** switches its category on, because the deposit is priced
on category slugs, not dish names. Picked dishes also appear as quieter
`.dish-pick__chip--dish` pills in the control row, each removable on its own.
Switching a category off drops that category's dish names too, so the two lists
cannot drift apart.

**Allergies.** Step 2 ends with "Any allergies we should know about?" — an
optional 2-row textarea. It is stored in the `allergies` column, shown in the
admin request card, and included in the notification text. The live summary
grows an "Allergies" row only when something is typed.

**Only the categories the caterer has switched on are offered.** The picker
does not use the hardcoded `DISH_CATEGORIES` list directly. An
`api.categories()` effect stores the approved slugs in `approvedSlugs`
(`null` until loaded, so the picker shows everything rather than flashing
empty), and a `visibleCategories` memo filters the list. A second effect drops
any already-picked category — and its picked dish names — if the caterer hides
it while the form is open. `GET /api/menu` was also tightened: its `VISIBLE`
const in `routes/menu.rs` now includes `c.is_approved = 1`, so a hidden
category's dishes cannot leak through the menu endpoint either. The admin
catalogue deliberately does not use `VISIBLE`, so the caterer still sees
everything.

**The dropdown opens on hover and closes on click.** `onMouseEnter` on the
`.dish-pick` wrapper opens the menu; `onMouseLeave` waits 140ms before closing,
so moving the pointer down into the menu does not shut it. Both the chips area
and the caret are plain toggles, so a click while it is open puts it away even
though the pointer is still hovering. There is no "opened by hover" guard any
more — that guard existed to stop the first click undoing the hover, which is
exactly the behaviour people wanted the click to do.

Because the menu is `position: absolute`, closing it does not change the card's
height, so the pointer stays inside `.dish-pick` and the menu does not
immediately re-open itself.

**Clicking blank space closes it.** The step-2 card carries
`onClick={closeOnBlank}`. That handler returns early if the menu is already
closed, ignores clicks that land on `.dish-row`, `.dish-card`,
`.dish-pick__chip`, `.dish-pick__toggle` or `.dish-pick__chips`, and otherwise
closes the menu. So the card's empty area — and the menu's own padding — both
dismiss it, while picking a dish does not.

**The admin side says the same thing in the same words.** The Catalogue tab's
top bar now ends with `N of M categories on the customer menu`. Each category
switch reads "On the customer menu" (solid gold) or "Hidden from customers"
(dashed outline), the category head line appends `· hidden from customers`, the
category filter marks hidden ones with ` (hidden)`, and a category with no
dishes shows a note explaining it can stay hidden. Filtering to an empty
category by name still shows it, so the caterer can add the first dish.

**Right column — the live summary.** Top to bottom:

1. **Your request so far** — a dark card listing only the things filled in so
   far: job, occasion, guests, date, time, dishes, dishes picked, extra dishes,
   allergies, venue, how to reach you, notes. Empty rows are hidden.
2. **How the deposit is worked out** — a dark espresso card (`--bg-inverse`,
   which is `#14100c` in the light theme) with a gold heading, the price lines,
   the total, and the plain-English reason underneath the total.
3. The error message, the submit button, and the agreement note.

**Submitting.** The submit button is `type="button"` and calls `submitAll()`,
which opens all four cards first and then calls `formRef.current.requestSubmit()`.
That way the browser still validates the required fields that were hidden.

## The dish page's "Goes well with" rail

Each pairing card is a two-column grid: the card body (name, then a price /
stepper row) is the add target, and a 26px arrow on the right opens that dish's
own page. The card is 56px tall and shows nothing else, so a whole category of
pairings fits in the rail.

**Every card carries a stepper, on the same line as the price.** The first
version only grew a stepper once the dish was in the basket, which meant the
count jumped around and the picked card was taller than its neighbours. Now the
price sits on the left of the foot row and − / count / + sits on the right, so
the count is always in the same place and every card is the same height whether
it is picked or not.

Tapping the dish name still calls `add(item, 1)`. `qtyOf(id)` reads the cart
line for that dish and drives the count. − calls `setQty(id, picked - 1)`, which
the cart turns into a removal at zero, and is `disabled` at zero. + calls
`setQty(id, picked + 1)` and is `disabled` at 20 (matching the main dish
stepper) or when the dish is sold out. The count is `tabular-nums` so the card
does not jitter as it changes.

**+ has to fall back to `add` at zero.** `setQty` only edits a line that already
exists — it maps over the cart and never appends — so calling it from an empty
cart silently did nothing. The + handler is therefore
`picked === 0 ? add(o, 1) : setQty(o.id, Math.min(20, picked + 1))`.

The old version flashed an "Added" tick for 1.4 seconds. That is gone — a
persistent count is a better signal, and it lets people fix a mis-tap without
opening the basket.

**The grid is `align-items: start`.** Without it, a card that grew taller
stretched its neighbour in the same row. The cards are all one height now, but
the rule stays as a guard.

At 900px and below the card becomes a single column, the body gets
`padding-right: 34px` to clear the arrow, and the arrow stays
`position: absolute` in the top-right corner so it does not eat a whole row.

## "How many of each" choices (the Small Chops case)

A dish can carry **option groups** — "Portion" (pick one), "Add-ons" (pick
many). A group can also be switched to **ask how many of each**, which turns
each choice from a tick-box into a − / count / + stepper. That is what lets the
Small Chops Platter offer "3 × Peppered Chicken, 2 × Samosa".

**Backend.** `item_option_groups.allows_quantity` (migration
`0008_chop_quantities.sql`). `item_options` already had `price_delta_kobo` and
`is_available`. `POST /api/orders` accepts
`items[].options: [{ option_id, qty }]` as well as the older flat `option_ids`;
`merge_picks` folds the two together. `price_options` caps a quantity at 99,
rejects unavailable choices, rejects a choice that belongs to another dish, and
still enforces pick-one vs pick-many and required groups.

**One-time seed.** The `allows_quantity` backfill lives in `seed.rs` behind the
`chops_count_once` settings row, because `db.rs` replays every migration on
every boot and a plain `UPDATE` would re-fire each time.

**Shared picker.** `components/OptionPicker.tsx` + `OptionPicker.css` is used by
both the dish page and the catering page. Counting groups render `.opt-row`
steppers; plain groups render `.opt-chip` tick chips. `dark` swaps it for the
always-dark catering card (`.opts--dark`).

**`onChange` takes an updater function, not a list.** It is
`(prev: OptionPick[]) => OptionPick[]`, and the handlers call
`onChange((prev) => setPickQty(prev, ...))`. The first version passed a list
computed from the `picks` prop, so three fast taps on + only counted once — the
second and third read a stale prop. Any new caller must pass a `(prev) => ...`
handler.

**All the arithmetic lives in `lib/options.ts`:** `pickedQty`, `picksKey`,
`setPickQty`, `togglePick`, `findOption`, `picksExtraKobo`, `pickLabels`,
`missingRequiredGroup`, `defaultPicks`, plus `pickText` / `setPickText` for the
"let them type it" box. A basket line's identity is
`picksKey(item.id, picks)` — `"15|3514x1,3517x3"`, sorted by option id, with
`~{text}` appended when the customer typed something — so the same dish with
different chops, or with a different custom size, is a different basket line.

**Dish page.** `ItemDetail.tsx` seeds `defaultPicks` on load so a required group
starts answered, renders `<OptionPicker>` in `.detail__options`, and disables
Add / Buy-now with the label "Choose a Portion" while `stillToAnswer`. The total
becomes `unit × qty` plus `picksExtraKobo`, with a `.detail__total-note`
breakdown line ("₦4,000 + ₦1,500 of choices") only when the choices cost extra.

**Catering page.** `Catering.tsx` keeps `dishPicks` per dish name. Only the
groups the customer has to answer are shown there, below the dish dropdown in
`.catering-picks`, because the catering flow is quote-based and never prices
anything. That means counting groups **and** "let them type it" groups — a
caterer cooking for 50 people still needs to know the size. The label reads
"How many, and how much?". The answers are folded into plain text —
`Small Chops Platter (3 × Peppered Chicken)`, or
`Peppered Goat Meat (Custom (enough for 40 guests))` — for the chip, the review
panel and the submitted `picked_dishes`, via `dishWithCounts()`.
`closeOnBlank` ignores clicks inside `.catering-picks` so the dropdown does not
close while the customer is counting or typing.

## Derived groups: the platter reads the caterer's own chop list

The first version of the platter held a **second, hand-typed copy** of the chop
names. It drifted from the catalogue immediately: the admin's Small Chops
category had fifteen dishes, the platter offered six, and the user's verdict was
"the admin logic is not correlating with the users pages". A copy of a list is
always wrong eventually, so the copy is gone.

**A group can now point at a category.** `item_option_groups.source_category_slug`
(migration `0009_derived_choices.sql`). When it is set, the group's choices are
**generated** from the switched-on dishes of that category instead of being
typed. `item_options.source_item_id` records which dish a generated choice came
from, and a partial unique index
`idx_item_options_source ON item_options (group_id, source_item_id) WHERE source_item_id > 0`
makes the sync an upsert.

**`sync_derived_groups(pool)` in `routes/menu.rs`** does the work. It runs at
the top of `with_options` (every menu read), `fetch_item` (every dish read),
`save_options` (after the admin commits) and `create_order` (before pricing, so
a chop switched off after the basket was filled is caught rather than sold).
For each derived group it:

- reads **every** dish in the category, switched-off ones included, so a paused
  chop keeps its row and its id;
- leaves out the dish that owns the group, so a platter never offers itself as
  one of its own chops;
- writes `price_delta_kobo = 0` — a chop is part of the platter, not an extra,
  and a dish price is the price of a whole portion (the first sync copied dish
  prices and put Dodo at +₦120,000);
- upserts on `(group_id, source_item_id)` so a choice keeps its id and a basket
  already holding it stays valid;
- deletes only choices whose dish has **left** the category.

**SQLite partial-index trap.** `ON CONFLICT (a, b) DO UPDATE` fails with "ON
CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint" when the
unique index is partial. The predicate has to be repeated:
`ON CONFLICT (group_id, source_item_id) WHERE source_item_id > 0 DO UPDATE SET …`.

**Admin page.** The Catalogue tab's `Options` editor has an "Ask how many of
each" checkbox per group, an "Available" checkbox per choice, and a
`.cat-opt-source` select per group: "Type the choices here" or "Use the
<Category> list". A derived group renders a read-only `.cat-opt-derived` list
with a note saying the list follows the catalogue, and `save_options` skips the
option loop for it. `counted_from(name, help, required, category)` in
`catalogue.rs` is the seed template; `CHOPS` uses
`counted_from("Chops", "Say how many of each chop you want", true, "small-chops")`.

**Verified live:** the platter lists the 14 other Small Chops dishes at ₦0 and
not itself; switching Samosa off in the admin removes it from the platter and
switching it back on restores the **same** option id; the dish page starts every
chop at 0 and the button reads "Finish your choices" until one is counted; the
basket line reads `Regular · 5 × Dodo (Fried Plantain) · 4 × Samosa · 3 ×
Peppered Chicken`; the catering page folds the same counts into its chip; and
`POST /api/orders` stored `options: ["Regular", "5 × Dodo (Fried Plantain)",
"4 × Samosa", "3 × Peppered Chicken"]`.

**Open questions for the user.** Every derived choice is ₦0, so counts never
change the total — the caterer can type a price per piece in the admin if they
want that. And there is no cap on the total number of chops in a platter.

## Portion, and the "Let them type it" switch

The user's ask was that Portion should not be the same everywhere: pizza and
some meals want three sizes, some want just Standard and Custom, and some want
no portion at all. The first instinct was to hardcode which dish gets which.
The user's better idea was to make it **the caterer's switch**, so nothing about
portion is baked into the code.

**`item_option_groups.free_text`** (migration `0010_option_free_text.sql`,
`INTEGER NOT NULL DEFAULT 0`) is that switch. It is one flag per group, and it
means "this group's choices are not enough on their own — let the customer say
the rest in their own words".

**What the customer sees.** `OptionPicker.tsx` renders a `FreeTextBox` under the
choices of any `free_text` group. It only appears once the customer picks
something **other than the first choice**, because the first choice is the house
standard and needs no explaining. The label reads "Tell us the custom size and
how much you want" and the box takes up to 120 characters.

**The words are required.** `missingRequiredGroup` in `lib/options.ts` treats a
`free_text` group as unanswered while a non-first choice is picked and the box
is empty, so the button reads "Finish your choices" and the page says "Still to
choose: Portion." A quick-add is unaffected: it takes the first choice, which
needs no words.

**The words travel with the pick.** `OptionPick.text` is carried through the
basket, and `picksKey` includes it, so two different custom amounts are two
basket lines rather than one merged line. `pickLabels` renders
`Custom (a big bowl that feeds four)`. On the server, `PickedOptionIn.text` is
merged by `merge_picks` and `price_options` appends it to the receipt label, so
the kitchen sees the customer's own words. Picks are still stored as the single
`options_text` string on `order_items` — there is no `order_item_options` table.

**The admin switch.** The Catalogue tab's `Options` editor has a "Let them type
it" checkbox in each group's head row, with a `.cat-opt-note` explaining it when
on. `addGroup` and `toDraft` carry the flag, and `save_options` writes it.

**The live data was reshaped once.** Choice seeding only runs on a dish with no
option groups, so the 159 existing Portion groups had to be fixed through the
admin API. A one-off script kept three choices where the labels were a real
three-tier portion (107 dishes: `Regular / Large / Family tray`,
`Small bowl / Large bowl / Family pot`, `Quarter / Half / Full`,
`Stack of 3 / Stack of 5 / Party tray`), converted the tub-style ones to
`Standard / Custom` with `free_text` on (51 dishes), and removed Portion from
the Small Chops Platter entirely (1 dish, because its chop counts already say
the size). The script is gone; the data is what matters.

**Verified live:** `/menu/13` hides the box on Standard, shows it on Custom,
blocks the add until words are typed, and stores
`{"option_id":4823,"qty":1,"text":"a big bowl that feeds four"}`; two different
custom amounts make two basket lines; the catering page shows the same box on
its dark card and its summary reads
`Peppered Goat Meat (Custom (enough for 40 guests))`; the admin editor shows the
checkbox ticked for those 51 dishes and the note appears and disappears with it;
and a real order `FF-36F04B` came back from `/api/admin/orders` as
`Custom (a big bowl that feeds four)`.

**Open questions for the user.** The 107 three-choice dishes still use
category-specific wording (bowl/pot for soups, stack/party tray for pancakes).
Should those become uniform? And a Custom portion is priced at ₦0 like Standard
— should a custom size cost more?

## The caterer decides what a dish asks

The user's ask: "the chef/caterer should determine the content of this part —
whether it should have portion, swallow, extras all from the admin panel by
toggling options of what it is permitted." Then, looking at the Add dish form:
"a well structured '+ add item' is the secret to the main structure of whatever
shows up."

So the questions a dish asks are now **switches the caterer flips**, not
templates baked into the code, and a new dish can be born complete.

**The library.** `catalogue.rs` holds `pub const LIBRARY: &[(&str, &GroupSpec)]`
— 17 ready-made groups: Portion, Swallow, Extras, Add-ons, Protein, Size,
Pieces, Count, Dips, Toppings, Sides, Dressing, Crust, Fillings, Style,
Sausage count, Chops. Each is a normal `GroupSpec`, so it carries the same
`kind` / `is_required` / `allows_quantity` / `free_text` / `source_category_slug`
fields the editor already understands. `GET /api/admin/group-library` serves
them (admin only) as `{ groups: [...] }`.

**The switchboard.** `GroupSwitchboard` in `Admin.tsx` draws one on/off chip per
library entry, with the group's `help` as a tooltip and its choice count as a
small number. It matches a library entry to a dish's existing group **by name,
case-insensitive** — that is why the library must never hold two entries with
the same name. Turning a switch on appends a deep copy of the library group;
turning it off filters that name out of the draft. Nothing is typed, and the
group editor below still lets the caterer rename choices or change prices.

**It appears in two places.** Above the group list in the `Options` editor, so
an existing dish can gain or lose a question; and inside `NewItemForm`, so the
caterer picks the dish's questions while creating it. `MenuPanel` loads the
library once with `api.adminGroupLibrary` and passes it to both.

**A new dish arrives complete.** `NewMenuItem` gained
`#[serde(default)] pub groups: Vec<OptionGroupIn>`, and `create_menu_item`
writes them through the same `write_groups` helper `save_options` uses (that
helper was extracted from `save_options` for exactly this). Without `groups` a
dish still starts plain, so older callers keep working.

**Verified live:** `GET /api/admin/group-library` returns 17 groups; a test dish
created with Portion + Extras came back with `Portion: 3 choices` and
`Extras: 6 choices`; `PUT /api/admin/menu/297/options` without Extras left only
`Portion`; the browser shows 17 chips on Egusi Soup with Portion/Swallow/Extras
on, flipping Extras off drops it from the group list and flipping it back
restores it, and the Add dish form shows the same 17 chips with none on. Both
light and dark themes checked. The test dish was deleted afterwards.

**Open question for the user.** The switches are per dish, so a caterer with 289
dishes clicks a lot. Should there also be a category-level default (for example
"every soup gets Portion + Swallow + Extras") that new dishes inherit?

## The Add item form, rebuilt to the caterer's own spec

The user wrote the form out field by field: Name, Category (with the right to
add a new one), Price, Tags (a dropdown of every tag ever used that also accepts
typing), Media (image URL, image upload, video), Description, Ingredients (one
per line *or* comma separated), and "What should this dish ask?" — the switch
library, now with **Centilitre (CL)** and **Litres** added for drinks.

**Two new library groups.** `LIB_CENTILITRE` (25cl / 33cl / 50cl / 75cl / 100cl)
and `LIB_LITRES` (1 / 1.5 / 2 / 3 / 5 litres), both `allows_quantity = true` so
they behave like the other counting groups. `LIBRARY` is now **19 entries**.

**Video on a dish.** Migration `0011_menu_video.sql` adds
`video_url TEXT NOT NULL DEFAULT ''` to `menu_items`; empty means no video.
`video_url` is threaded through `MenuRow`, `MenuItem`, `NewMenuItem`,
`PatchMenuItem`, `MENU_SELECT`, the create INSERT and the update UPDATE.
`ItemDetail.tsx` renders `<video poster={image_url} controls>` when the field is
set and falls back to the `<img>` when it is not, so every existing dish is
untouched.

**Three new admin endpoints.**

| Route | What it does |
| --- | --- |
| `POST /api/admin/categories` | `{ name, description? }` → the new `Category`. Slugifies the name, walks `-2`, `-3` … until the slug is free, rejects a duplicate name, puts it last in `sort_order`, and sets `is_approved = 1` so it is usable straight away. |
| `GET /api/admin/tags` | `{ tags: [...] }` — every tag across `menu_items`, split on commas, lowercased, de-duplicated, sorted. Grows by itself as the caterer types new ones. |
| `POST /api/admin/upload` | Multipart field `file`. Images `jpg/jpeg/png/webp/gif/svg/avif` up to 8MB, video `mp4/webm/mov/m4v/ogv` up to 60MB. Stores a UUID filename in `state.uploads` and returns `{ url, kind }`. |

`catalogue::slugify` was made `pub` so the category endpoint can reuse it
instead of growing a second copy.

**The form itself.** `NewItemForm` in `Admin.tsx` now holds `tags` as a
`string[]` rather than a comma string, and `video_url` alongside `image_url`.
A new `TagBox` component draws the chips, filters the suggestion list as the
caterer types, commits on Enter or comma, and removes on Backspace or the ×.
The Category field has a "+ Add a new category" link that swaps in an inline
input; adding one calls the endpoint, appends it to `MenuPanel`'s list through
the new `onCategoryAdded` prop, and selects it. Ingredients are split on
`/[\n,]/`, so both styles work.

**Verified live:** the library returns 19 groups ending in Centilitre (CL) and
Litres; `/api/admin/tags` returns 57 tags; a category was created (and a
duplicate name correctly rejected); a PNG uploaded as `kind: image` and the same
bytes renamed `.mp4` as `kind: video`, while `.exe` was refused; a test dish
created with two tags, an image, a video, three ingredients and Portion +
Centilitre came back complete and appeared on `/menu/298` with a playing
`<video>` and the image as its poster. The browser shows all seven field
groups, 19 switch chips, the tag dropdown listing real tags, and no horizontal
overflow in either theme. The test dish, category, uploads and screenshots were
all removed afterwards.

**Open questions for the user.** Should a new category start hidden instead of
live? Should the tag list stay limited to tags already in use, or should the
caterer be able to curate it? What video size cap is acceptable — 60MB today.

## The Add item form, made compact

The form was 1073px tall, which meant scrolling past it to reach the Save
button. It is now **740px** — 333px shorter, about a third — without losing a
single field.

**The media block was the main offender.** It used to be four stacked rows
(image URL, image upload, video URL, video upload), 235px tall. It is now two
columns — Picture and Video — with the link box and the upload button sharing
one line each, so it is **83px**. The file input is still a real
`<input type="file">`, just made invisible inside a `.media__btn` label, so
clicking the label opens the picker exactly as before. The button text doubles
as the progress note ("Uploading…"), which removed the separate `.media__note`
span.

**Everything else was tightened, scoped to `.admin-new` only** so no other form
on the site changed:

| What | Before | After |
| --- | --- | --- |
| Form gap | `--sp-4` (1rem) | `--sp-3` (0.75rem) |
| Form padding | `clamp(1rem, 3vw, 1.5rem)` | `--sp-4` (1rem) |
| Field gap | `--sp-2` (0.5rem) | `0.3rem` |
| Input padding | `0.8rem 1rem` | `0.5rem 0.65rem` |
| Textarea height | 96px | 72px |
| Hint text | `--step--1` | `0.72rem` |
| Switchboard padding | `--sp-3` | `--sp-2 --sp-3` |
| Switch chip | `0.35rem 0.6rem`, 0.72rem | `0.22rem 0.5rem`, 0.68rem |
| Tag box | `min-height: 2.6rem` | `min-height: 2.1rem` |

The three long hint sentences were also shortened to one line each, which is
what let the field gaps close up.

**Verified live:** the form measures 740px in both themes, the two media
columns sit side by side (same `y`, 613px each), no horizontal overflow, and a
real file upload through the new hidden input still fills the URL box and draws
the preview. The test upload was deleted afterwards.

## The dashboard uses the whole window

The admin page sat inside the same centred 1320px column as the rest of the
site, so on a wide screen the Add item form started 319px in from the left
edge and looked pushed to the right. The dashboard is a work surface, not a
reading column, so `.admin > .container` now has `max-width: none`.

Two follow-on tweaks came with it:

- **The short fields got their own row.** With the form spanning the window,
  Name and Price stretched a metre wide. At 1200px and up `.admin-new
  .panel__grid` is now four columns, so Name, Price, Category and Tags share
  one row. The form went from 708px to 630px tall.
- **The lists stayed in a column.** Orders, Catering, the menu list, the
  catalogue groups and Pairings are capped at 1100px, because a dish name at
  the far left and its price at the far right of a 1910px row is hard to read.

**Verified live:** at 1920 the form starts at x:24 (was x:319) and is 630px
tall; at 1366 it starts at x:24 and is 661px tall. All five admin tabs report
no horizontal overflow in both themes.

## The Add item form shows the dish as you type

The form now sits on the left and a live picture of the dish sits on the
right. Every keystroke updates it, so the caterer sees the finished card
before saving.

**What the preview shows**, in the same order as the real dish page:

- the picture, or the video if one is set, or a quiet "No picture yet" box
- the category in small gold capitals, then the tags
- the dish name, falling back to "Dish name"
- the price in naira, formatted the same way the shop formats it
- the description, falling back to a grey hint
- "What is in it" — the ingredients, one per line
- "What it asks" — each switched-on group with the same wording the customer
  sees ("Pick one", "Pick any", "Say how many of each", plus "· needed"),
  and either the choices with their `+₦` prices, or a note for a derived
  group ("Choices come from the small-chops list.")

**How it is laid out.** `.admin-new__cols` is a two-column grid: the fields
take whatever is left, the preview is a fixed 420px.

The four-column field row now starts at 1500px instead of 1200px, because the
preview takes 420px of the width first.

**The form is pinned, not the preview.** The whole form is
`position: sticky` at `top: calc(var(--header-h) + var(--sp-3))` with
`max-height: calc(100vh - var(--header-h) - var(--sp-5))`, so it stays put
under the header while the page behind it scrolls, and it never grows taller
than the window. Inside it, `.admin-new__fields` and `.admin-new__preview`
each get `min-height: 0; overflow-y: auto`, so the boxes and the picture
scroll on their own instead of dragging the form out of view. Both need
`min-height: 0` on `.admin-new__cols` too, or the inner scrolling does not
engage.

The error message and the Save button live in `.admin-new__foot`, a row
*below* the two scrolling columns, so Save is always reachable without
scrolling the form.

`.dish-preview__media` is capped at `max-height: 200px`. At 420px wide a 4/3
picture is 315px tall, which on a short screen ate almost the whole card and
left a sliver for the words.

Below 1100px the grid becomes one column, the preview drops underneath at
full width, and `.admin-new` goes back to `position: static` with no height
cap — on a narrow screen the form scrolls with the page like any other block.

**Verified live:** at 1920 the fields are 1392px and the preview 420px, side
by side; the form is 797px tall and sits at `y:64` both before and after
scrolling the page 1000px. At 1366 the fields are 838px and the preview
420px; the form is 573px tall, stays at `y:64`, and the fields column scrolls
inside itself (`scrollHeight 683` in a `472` box). At 900 the form is static
and 1378px tall, with the preview underneath at 808px wide. Name, price and
the switched-on groups all update as the form is filled, in both themes, with
no horizontal overflow at any of the three widths.

## One Media box: pictures, videos and links together

The Add item form used to have two separate boxes, "Picture" and "Video", each
taking one URL. Now there is **one box** that takes as many pictures, videos
and pasted links as the caterer likes.

**How it works for the caterer.** They can paste a link and press Enter, or
press Upload and pick several files at once. Each one appears as a small tile
in a strip. The first picture or video is the **cover** and wears a gold
"Cover" badge. Hovering any other tile shows "Make cover" and "×", so the
caterer can promote a different picture or remove one.

**How it is stored.** A new column `media` on `menu_items` holds the whole
list as JSON, in order. The two old columns `image_url` and `video_url` are
still written, but only as "the first picture" and "the first clip". That is
deliberate: `MenuCard`, `CartDrawer`, `Checkout` and the dish page's pairings
rail all read `image_url`, and they keep working with no changes at all.

`parse_media` in `models.rs` falls back to the two old columns when the JSON
is empty, so all 289 existing dishes render exactly as before. `store_media`
only fills `image_url` from an item whose kind is `image`, so a pasted link
never becomes the card thumbnail.

**A link is not a picture.** `MediaItem.kind` is `"image"`, `"video"` or
`"link"`. The kind is guessed from the file extension (`.jpg`, `.png`,
`.webp`, `.gif`, `.svg`, `.avif`, `.bmp`, `.heic` are pictures; `.mp4`,
`.webm`, `.mov`, `.m4v`, `.ogv`, `.avi`, `.mkv` are videos; anything else is
a link). Uploaded files get their kind from the server, which decides by
extension too.

**The preview follows.** `DishPreview` shows the cover, then a 42px strip of
the remaining tiles underneath, so the caterer sees the whole gallery before
saving.

**Verified live:** two pasted links produced two 104×72 tiles; a `.mp4` link
became a real `<video>` and took the Cover badge; the preview strip showed one
thumb; no horizontal overflow. Through the API, a dish created with four
media items came back with `image_url` set to the first picture and
`video_url` to the first clip, in order. A PATCH that reordered the list moved
the cover and cleared `video_url` when the clip was dropped. An old-style
PATCH carrying only `image_url` patched the gallery's first picture in place
and left the rest alone.

## The dashboard title shrinks as soon as you move

The "Kitchen dashboard" heading is 29px tall with a small gold eyebrow above
it. As soon as the page scrolls past 8px — or the caterer clicks or types
anywhere — the eyebrow hides, the title drops to 15px, and the gaps tighten,
so the head goes from 66px to 34px. Scrolling back to the very top brings it
back.

It listens to three things: `scroll` on the window, `pointerdown` and
`keydown` on the document. The click and key listeners are there because the
caterer often starts working without scrolling, and the heading should get out
of the way then too.

**Verified live** with real wheel gestures: 29px → 15px → 29px, head 66px →
34px → 66px.

## The Catalogue shows two dishes per row

`.cat-group` is a two-column grid capped at 1500px. Each card is 746px wide at
1920 and 650px at 1366. The group heading and the "nothing here" message span
both columns.

To make a card fit in half the width, `.cat-row__main` changed from
`48px 1fr auto` to `48px minmax(0,1fr)`, and the row's buttons moved to their
own full-width line under a top border. When a card's Options or Ingredients
editor is open it gets `grid-column: 1 / -1`, so the editor still has the
whole width to work in.

Below 900px the grid collapses to one column.

**Verified live:** at 1920 the grid is `746px 746px` and two cards sit on the
same row; at 1366 it is `650px 650px`. The Catalogue page dropped from
25,432px to about 21,400px. No horizontal overflow at either width, in both
themes.

## The Catalogue card's buttons sit on the dish name's line

The price, On, Options, Ingredients and Delete controls used to take a second
line under the name, which made every card two rows tall. They now sit on the
same line, right-aligned, so a card is one row.

To make five controls fit in half the width, each one was shrunk a little:
`.cat-row__actions .status-btn` (0.3rem/0.55rem padding, 0.68rem text),
`.admin-menu__del` (0.3rem/0.4rem, 0.68rem), `.cat-price` (0.2rem/0.4rem) and
`.cat-price input` (3.6rem wide, 0.7rem). The price badge was also removed from
the meta line, because the price is already in the editable box beside it.

Below 720px the buttons drop back under the name, because five controls will
not fit on one line on a phone.

**Verified live:** a card went from 124px to 74px tall and the Catalogue page
from 21,432px to 13,952px.

## Orders, catering requests and the deposit calculator show two per row

`.admin-orders` and `.admin-catering` are two-column grids capped at 1500px,
and each `.pricing-group` inside the deposit calculator is too. The count-and-
refresh bar and each group's heading span both columns, so they still read as
one list.

Each order card's inner grid went from four columns to two, because four
columns of customer details will not fit in half the width. The card padding
also dropped from a clamp to a flat `var(--sp-4)`.

Below 1100px all three collapse to one column.

**Verified live at 1920 and 1366:** two cards per row on all three tabs, no
horizontal overflow, both themes. Orders page 3,105px → 2,113px.

## Pairings shows three per row

`.pairings__list` is a three-column grid capped at 1500px, so each category is
about 495px wide at 1920 and 430px at 1366. An open category gets
`grid-column: 1 / -1`, so its chips still have the whole width.

Below 900px it collapses to one column.

**Verified live:** 17 categories lay out three per row; opening one gives it
1308px and 16 chips at 153px each.

## The dashboard header is tighter

The gap above the title, the gap under it and the gap under the tab strip were
all reduced, and the tabs themselves are shorter. The title no longer carries a
top margin. The whole header block is about 20px shorter before scrolling and
about 10px shorter once it has shrunk.

**Verified live:** head 58px → 34px, tabs 39px, first card starts at 177px
instead of 197px.

## The deposit calculator's rate cards are compact

Each rate card was tall and roomy. It is now a small card: less padding, a
tighter gap between the title and the fields, a smaller title, a smaller amount,
smaller field labels and shorter inputs. The Save button is 34px instead of
44px. The card is 111px tall instead of about 150px.

The text above the cards was shrunk too, and the gaps between the intro, the
group heading, the group hint and the first card were all closed up.

**Verified live:** card 111px tall, title 13px, amount 14px, labels 10px,
inputs 13px, Save 34px. Deposit calculator page 2,451px → 1,733px. Two cards
per row at 1920 and 1366, no sideways scroll, both themes.

## The order and catering cards are compact, with lines between the facts

Each card used to be a loose stack of labelled facts. Now the facts sit in a
two-column grid with a thin line between them, so the eye can find each one
without extra spacing doing the work. The reference number and the date share
one line instead of stacking, and the card's own padding and gaps were reduced.

The status buttons inside an order card, the payment dropdown, the small
uppercase labels and the "Sign out" and "Refresh" buttons were all shrunk to
match — they are utility controls, not page actions.

**Verified live:** order card 298px → 272px, catering card 311px → 222px.
Status buttons 27px tall with 10.5px text, payment dropdown 28px, "Sign out"
and "Refresh" both 23px tall with 11px text. Orders page 1,761px → 1,651px.
Two cards per row at 1366 and 1920, no sideways scroll, both themes.

## The cards sit closer together, with a thinner edge

The rate cards on the deposit calculator were 8px apart with a full-strength
border. They are now 4px apart, the border is a soft hairline (the same colour
at 55% strength), the corners are 8px instead of 16px, and the padding is
tighter top and bottom. The page went from 1,733px to 1,577px.

The same treatment was then applied to the customer pages so they match:

- **Menu** — the dish cards are 12px apart instead of 16px, with the soft
  hairline and 8px corners.
- **Landing** — the "ways" cards are 12px apart instead of 16px, the
  testimonials 16px instead of 24px, both with the soft hairline and 8px
  corners.
- **Catering** — the step cards, the side panel, the summary and the "done"
  panel all use the soft hairline. The gap between the form and the side panel
  is 32px instead of 48px, and the rail gap is 12px instead of 16px.

**Verified live:** rate cards 4px apart, 8px corners, 8px/12px padding, page
1,733px → 1,577px. Menu cards 12px apart with 8px corners. Landing "ways" 12px
apart, testimonials 16px apart. Catering side panel 12px gap. No sideways
scroll on any page, both themes, at 1920 and 1366.

## Every outline is a hairline now

The user kept saying the borders were still too thick. The cards had been
softened, but the **controls** had not: the category chips and the search box on
the menu page were still drawn with `--border-strong`, a darker colour than the
cards used, so they read as heavy frames next to the light card edges.

Rather than repeat the same `color-mix(...)` expression in forty places, there
are now two tokens in `tokens.css`:

```css
--border-hair:        color-mix(in srgb, var(--border) 55%, transparent);
--border-hair-strong: color-mix(in srgb, var(--border-strong) 55%, transparent);
```

Every outline in the app now points at one of them. That covers the chips, the
search box, the toolbar rule, the form fields, the ghost buttons, the basket
drawer, the option picker, the checkout panels, the catering inputs and
checkboxes, the item detail page, the static pages, the catering agreement, and
all seventeen admin controls. The few `1.5px` and `2px` outlines were brought
down to `1px` at the same time, so nothing is thicker than anything else.

One-sided rules (`border-bottom` on a list row, `border-top` on a footer) were
left alone — those are dividers, not frames, and thinning them makes the page
look unfinished.

**Verified live:** the idle chip, the search box and the toolbar rule all
compute to `1px` at 55% strength, in both themes, at 1920 and 1366. The deposit
calculator is still 1,577px, the Orders tab still 1,651px, and no page scrolls
sideways.

## Not finished

1. The basket drawer has not been checked on a phone width.
2. Rectangular dish photos are still cropped. The plan is to stop cropping and show the whole photo.
3. The admin ingredients editor has never been checked in the browser.
4. The big "less scrolling on every page" pass is only partly done.
5. The catering page has only been checked at 1440px wide. 980px and 520px are untested.

## Page heights at 1440 x 900 (the scroll budget)

The user wants every page except the landing page to fit the screen like an app.

| Page | Height | Scrolls? |
| --- | --- | --- |
| `/` landing | 5614px | yes, on purpose |
| `/menu` | 1937px | yes, about 1000px too tall |
| `/catering` | 900px | no |
| `/checkout` | 1641px | yes, about 740px too tall |
| `/track` | 900px | no |
| `/admin` | 900px | no |

The deposit calculator tab is 1,577px tall (it was 2,451px before the compact
pass).

So `/menu` and `/checkout` are the two pages left to squeeze.

## Next job

The user is still sending small UI edits for the catering page, one at a time.
Wait for the next one. When the page is signed off, check it at 980px and 520px
wide, then move on to the phone-width basket drawer.

Open question the user has not answered: should the two "Something else"
services (chef-at-home, meal delivery) become their own `job_kind` values with
their own pricing rules in the Rust backend, instead of being folded into
`details`? Right now they are only text for the caterer to read.

## Traps worth knowing

- The admin tab is labelled **Catalogue**, not Menu.
- The automation browser reports reduced motion, so every animation duration reads as `1e-05s`. That is the browser, not a bug.
- Because of that, a `getComputedStyle` read taken right after a class change can still return the **old** value — the transition is technically running. If a style change looks like it did not apply, inject `*{transition:none!important}` and read again before touching the CSS.
- `eval-page.js` needs `$env:CDP_PORT='9335'`.
- Push to `mine`, never `origin` (origin is read only).
- **Choice seeding only runs on a dish with zero option groups** (`group_count == 0` in `seed_catalogue`). A new template in `catalogue.rs` therefore only reaches a fresh database; an existing dish has to be fixed through the admin API. That is why the Portion reshape needed a one-off script.
- **Option ids change on every admin save** for hand-typed groups, because `PUT /api/admin/menu/:id/options` deletes and re-inserts them. Derived groups are the exception. Never reuse an id across saves — re-read `/api/menu` first.
- **`/api/menu/:id` does not exist** (404). Read the dish from `/api/menu` and filter by id.
- **`/api/menu` only returns the switched-on categories**, so a dish missing from it is hidden, not deleted. Use `/api/admin/catalogue` to see all 289.
- **`POST /api/orders` requires `payment_method`** and `delivery_state` (not `state`). Active delivery zones are FCT Abuja, Nasarawa and Niger only.
- **There is no `order_item_options` table.** Picks are one `options_text` string on `order_items`, joined with `" | "`. That is why a typed size is appended to the label rather than stored in its own column.
- **`POST /api/admin/upload` takes the file in a field named `file`.** It returns `{ url, kind }`; the URL is already the `/uploads/…` path the frontend can store directly.
- **The Add item form's upload button is a `<label>` wrapping a hidden file input.** Do not "fix" it into a visible `<input type="file">` — that is what made the media block 235px tall. The input is `opacity: 0` and absolutely positioned over the label, so it stays clickable and keyboard-reachable.
- **`.admin-new` overrides are scoped on purpose.** The compact input padding and 72px textarea live under `.admin-new`, not in `global.css`, because the global `.field` rules are shared with checkout, catering and the admin options editor.
- **A new category is created approved.** `POST /api/admin/categories` sets `is_approved = 1`, so it shows on the customer menu immediately. Flip it off from the Catalogue tab if that is wrong.
- **`Stop-Process` is blocked inside a `ForEach-Object` pipeline.** Use a `foreach` loop or a standalone call. The running exe locks `target\debug\feastfusion-api.exe`, so it must be stopped before `cargo build`.
- **`window.scrollTo()` does not fire a scroll event in the CDP harness.** The
  page really does move (`window.scrollY` changes) but no `scroll` listener
  runs, so any scroll-driven UI looks broken when it is not. Test it with real
  gestures instead: `Input.dispatchMouseEvent` with `type: 'mouseWheel'`,
  `deltaY: 120`, `pointerType: 'mouse'`, repeated in a loop with ~120ms gaps.
  See `shots/probe-wheel.js`.
- **`Input.dispatchMouseEvent` clicks do not reach the page.** Use
  `element.click()` from `Runtime.evaluate`. A click fired right after
  `Page.navigate` is also lost, so poll for the element first.
- **The backend takes longer than 40s to boot.** Poll `/api/menu` with retries; there is no `/api/health`.
