-- Ingredients on dishes, and a caterer-owned deposit calculator.
--
-- The deposit is no longer one fixed number. It is worked out from the kind of
-- job, the headcount and the dishes chosen, using rates the caterer sets in the
-- dashboard. Three kinds of job are supported:
--
--   event      a party, wedding, naming and so on. Priced per guest.
--   cook_only  someone wants a cook to make a dish for them, no event.
--   custom     anything the caterer prices by hand.

-- Free-text ingredient list, one per line. Kept as text rather than a child
-- table because it is only ever read back whole and shown as a list.
ALTER TABLE menu_items ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';

-- Per-guest rate for each kind of event, set by the caterer.
CREATE TABLE IF NOT EXISTS catering_rates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT NOT NULL UNIQUE,
    rate_kobo   INTEGER NOT NULL DEFAULT 0 CHECK (rate_kobo >= 0),
    -- Shown to the customer as the reason for the deposit figure.
    note        TEXT NOT NULL DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- How much a dish adds to (or takes off) the per-guest rate. A grill costs more
-- per head than a rice dish, so the caterer can express that here.
CREATE TABLE IF NOT EXISTS catering_dish_rates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_slug TEXT NOT NULL UNIQUE,
    uplift_kobo  INTEGER NOT NULL DEFAULT 0,
    note         TEXT NOT NULL DEFAULT ''
);

-- Cook-only jobs are priced per dish rather than per guest.
CREATE TABLE IF NOT EXISTS catering_cook_rates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_slug TEXT NOT NULL UNIQUE,
    rate_kobo    INTEGER NOT NULL DEFAULT 0 CHECK (rate_kobo >= 0),
    note         TEXT NOT NULL DEFAULT ''
);

-- Extra columns on the request so the caterer sees exactly what was asked for.
ALTER TABLE catering_requests ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN lga TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN street_address TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN dishes TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN other_dishes TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN contact_channel TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE catering_requests ADD COLUMN contact_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN job_kind TEXT NOT NULL DEFAULT 'event';
ALTER TABLE catering_requests ADD COLUMN deposit_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_catering_rates_order ON catering_rates(sort_order);
