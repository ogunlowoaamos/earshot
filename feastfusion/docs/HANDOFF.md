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

Commit `b1e9aa5` is the last verified good state. If anything goes wrong, that is the
safe place to return to.

---

## 5. What is half built right now: the catalogue

This is the work in progress. Read this section before touching anything.

**Build state:** the backend compiles as of this handoff (`cargo check` passes in about
3 minutes). It produces 9 warnings, all of them "never used" on the new option types,
which is expected because none of that plumbing is wired up yet. The warnings disappear
as step 4 onwards in section 8 gets done.

### The goal

The caterer wants roughly 220 Nigerian dishes loaded into the admin area, covering
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
| Database tables for options | `migrations/0003_catalogue_and_options.sql` | Done |
| Some dish data | `src/catalogue.rs` | Partial, see below |
| Option templates | `src/catalogue.rs` | Done, 21 templates |
| Response shapes for options | `src/models.rs` | Done |
| Reading options back on an order | `src/routes/orders.rs` | Done |

`catalogue.rs` currently holds:

- **16 categories** with their display order.
- **21 option templates** (`Shape`), each a fixed set of choice groups.
- **Dish data for 3 of the 16 categories**: rice dishes (10), soups and stews (23),
  swallows (26). That is 59 dishes written.

Still missing from `catalogue.rs`:

- The other 13 categories of dishes (roughly 160 more).
- The function that actually writes them into the database (`seed_catalogue`).

### What is not started

- **Menu endpoint has no availability gate.** `routes/menu.rs` still returns every
  dish to the customer. This is the single most important piece of the caterer's
  rule and it is not written yet.
- **No option handling at checkout.** `routes/orders.rs` accepts a dish but ignores
  `option_ids`, does not validate them, and does not add their prices.
- **No admin endpoint** for turning dishes on and off in bulk, or for editing options.
- **No frontend at all** for any of this. Nothing about the catalogue is visible in
  the browser yet.

### So nothing shows on screen

That is expected. All of the above is backend data and plumbing. Until the menu
endpoint gates on availability and the admin panel exists, the site looks exactly
as it did at `b1e9aa5`. Do not be surprised.

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
`Shape::Swallow` template gets portion, extras and note choices. This keeps 220
dishes from becoming 220 blocks of copy.

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

Do these in order. Each step keeps the app working.

1. **Finish the dish list** in `src/catalogue.rs`. Add the remaining 13 categories to
   the `DISHES` array. Descriptions are written to read like menu copy, so keep them short.
2. **Write `seed_catalogue`** in the same file. It should upsert categories, insert only
   dishes whose names are new, set `is_available = 0` and `price_kobo = 0`, move existing
   dishes to their correct category, and create option groups only when a dish has none
   (so the caterer's later edits are never overwritten on restart).
3. **Call it** from `seed.rs` `run()`, and add `mod catalogue;` to `main.rs`.
4. **Gate the menu** in `routes/menu.rs`. `list_menu` returns only available and priced
   dishes, with their available options attached. `list_categories` returns only
   categories that still hold at least one visible dish, so the shop never shows an empty shelf.
5. **Handle options at checkout** in `routes/orders.rs`. Check each chosen option belongs
   to that dish and is available, refuse if a required group has no choice, add the option
   prices on the server, and store the readable summary plus the customer note.
6. **Add admin endpoints** in `routes/admin.rs`: list everything for the admin, replace a
   dish's options, and switch availability for a whole category at once.
7. **Then the frontend.** `api.ts` types, then the admin catalogue panel (search, filter,
   on/off switch, price box, "Needs a price" badge), then the item detail page with its
   choice groups and live total, then the cart and checkout carrying the chosen options.
8. **Verify** with `cargo check` and `npm run build`, then on the real phone.

The order matters. Gating availability before the admin exists would hide the whole
menu, because every new dish starts switched off.

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
