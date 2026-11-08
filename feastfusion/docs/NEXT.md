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

## The catering page, as it stands

File: `feastfusion/frontend/src/pages/Catering.tsx` and `Catering.css`.

The page is one `<form>` laid out in two columns.

**Left column — four numbered steps.** Each step is a heading button plus a card
underneath it holding the real fields:

| Step | Heading | Fields inside the card |
| --- | --- | --- |
| 1 | Tell us the job | job kind, occasion, guests, date |
| 2 | Pick the dishes | dish categories, suggestions, other dishes |
| 3 | Say where and when | state, LGA, street |
| 4 | Choose how we reach you | channel, handle, name, phone, email, details |

- Clicking a heading opens that card and closes the other three. Clicking the
  open one closes it. Only one card is open at a time.
- The caret on the right of each heading flips to show open or closed.
- Every card is `border-radius: 8px`. So are the side column, the summary and
  the deposit breakdown.
- The cards are deliberately tight: small padding, small labels, small inputs.
  The whole page is about 1330px tall on a 1440px-wide screen, down from 3160px.

**Right column — the live summary.** Top to bottom:

1. **Your request so far** — a dark card listing only the things filled in so
   far: job, occasion, guests, date, dishes, extra dishes, venue, how to reach
   you, notes. Empty rows are hidden.
2. **How the deposit is worked out** — a dark espresso card (`--bg-inverse`,
   which is `#14100c` in the light theme) with a gold heading, the price lines,
   the total, and the plain-English reason underneath the total.
3. The error message, the submit button, and the agreement note.

**Submitting.** The submit button is `type="button"` and calls `submitAll()`,
which opens all four cards first and then calls `formRef.current.requestSubmit()`.
That way the browser still validates the required fields that were hidden.

## Not finished

1. The basket drawer has not been checked on a phone width.
2. Rectangular dish photos are still cropped. The plan is to stop cropping and show the whole photo.
3. The admin ingredients editor has never been checked in the browser.
4. The big "less scrolling on every page" pass is only partly done.
5. The catering page has only been checked at 1440px wide. 980px and 520px are untested.

## Next job

The user is still sending small UI edits for the catering page, one at a time.
Wait for the next one. When the page is signed off, check it at 980px and 520px
wide, then move on to the phone-width basket drawer.

## Traps worth knowing

- The admin tab is labelled **Catalogue**, not Menu.
- The automation browser reports reduced motion, so every animation duration reads as `1e-05s`. That is the browser, not a bug.
- `eval-page.js` needs `$env:CDP_PORT='9335'`.
- Push to `mine`, never `origin` (origin is read only).
