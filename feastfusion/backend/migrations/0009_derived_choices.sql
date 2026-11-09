-- A group of choices can be filled from a whole category instead of typed by
-- hand.
--
-- The small chops platter is the reason. The caterer already keeps the chop
-- list in the catalogue, so the platter reads that list instead of holding a
-- second copy that drifts out of step. Add a chop once, in the catalogue, and
-- the platter follows.

ALTER TABLE item_option_groups ADD COLUMN source_category_slug TEXT NOT NULL DEFAULT '';

-- Which dish a filled-in choice came from, so a rename or a switch-off in the
-- catalogue reaches the platter on the next read.
ALTER TABLE item_options ADD COLUMN source_item_id INTEGER NOT NULL DEFAULT 0;

-- One row per dish per group, so a refresh updates the row in place and the
-- choice keeps its id. A basket holding that id stays valid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_options_source
    ON item_options (group_id, source_item_id)
    WHERE source_item_id > 0;
