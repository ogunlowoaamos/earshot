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
