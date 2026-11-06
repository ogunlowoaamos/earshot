-- Priced choices on a dish, and the caterer's power to hide what they do not cook.
--
-- A dish is no longer one price. It has groups of choices: a size group where
-- the customer picks one, an add-on group where they pick any number. Each
-- choice carries its own price difference, which the server adds to the dish
-- price when the order comes in. The customer is never trusted to send a price.

CREATE TABLE IF NOT EXISTS item_option_groups (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    -- Shown above the choices, for example "Size" or "Icing".
    name         TEXT NOT NULL,
    -- single  the customer picks exactly one
    -- multi   the customer picks any number, including none
    kind         TEXT NOT NULL DEFAULT 'single' CHECK (kind IN ('single', 'multi')),
    -- Small grey line under the group name.
    help         TEXT NOT NULL DEFAULT '',
    -- A required group blocks adding to the cart until a choice is made.
    is_required  INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_option_groups_item
    ON item_option_groups(menu_item_id, sort_order);

CREATE TABLE IF NOT EXISTS item_options (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id         INTEGER NOT NULL REFERENCES item_option_groups(id) ON DELETE CASCADE,
    label            TEXT NOT NULL,
    -- Added to the dish price. May be zero, and may be negative for a saving.
    price_delta_kobo INTEGER NOT NULL DEFAULT 0,
    is_default       INTEGER NOT NULL DEFAULT 0,
    is_available     INTEGER NOT NULL DEFAULT 1,
    sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_options_group ON item_options(group_id, sort_order);

-- What the customer picked, written out for the kitchen to read at a glance.
ALTER TABLE order_items ADD COLUMN options_text TEXT NOT NULL DEFAULT '';
-- The customer's own words for this line, for example a cake message.
ALTER TABLE order_items ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- The catalogue is sorted by hand inside a category, so the caterer's own
-- ordering survives a page reload.
ALTER TABLE menu_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
