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

## Not finished

1. **Catering steps 1 to 4 are not clickable yet.** This is the next job.
2. The basket drawer has not been checked on a phone width.
3. Rectangular dish photos are still cropped. The plan is to stop cropping and show the whole photo.
4. The admin ingredients editor has never been checked in the browser.
5. The big "less scrolling on every page" pass is only partly done.

## Next job: make the catering steps clickable

File: `feastfusion/frontend/src/pages/Catering.tsx`

- The four steps are at lines 250 to 281, inside `.catering-page__steps`.
- Each step is a plain `<div className="catering-step">`. Turn each into a `<button type="button">`.
- Give the four form sections these ids: `catering-job`, `catering-dishes`, `catering-where`, `catering-contact`.
  - Do not use `catering-dishes-label`, because `id="dishes-label"` already exists on the inner span.
- On click, run `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- In `Catering.css`, add `scroll-margin-top: calc(var(--header-h) + var(--sp-4))` to the four targets so the sticky header does not cover them.
- Also in `Catering.css`, add `cursor: pointer`, a hover tint, and a `:focus-visible` outline to `.catering-step`. Keep the existing `border-top` hairlines and the `display: grid`.

## Traps worth knowing

- The admin tab is labelled **Catalogue**, not Menu.
- The automation browser reports reduced motion, so every animation duration reads as `1e-05s`. That is the browser, not a bug.
- `eval-page.js` needs `$env:CDP_PORT='9335'`.
- Push to `mine`, never `origin` (origin is read only).
