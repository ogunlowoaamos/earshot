-- What goes with what.
--
-- A Nigerian plate is rarely one thing. Soup wants a swallow. Rice wants a
-- grill and a drink. The caterer decides those pairings, not the code, so this
-- is a plain two column table they edit from the admin page.
--
-- Each row means "when the customer picks category_id, offer them
-- accompanies_id as a companion". The pairing is one way on purpose: a drink
-- goes with rice, but rice is not the first thing you offer with a drink.

CREATE TABLE IF NOT EXISTS category_pairings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    accompanies_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (category_id, accompanies_id)
);

CREATE INDEX IF NOT EXISTS idx_pairings_category
    ON category_pairings(category_id, sort_order);
