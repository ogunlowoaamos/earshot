-- A group of choices can also let the customer type their own answer.
--
-- "Portion" is the reason. Some dishes only need "Standard" or "Custom", and
-- for "Custom" the customer says what they actually want: "a big bowl for
-- four". The typed words ride along with the pick, so the kitchen sees them on
-- the receipt and the basket keeps two different custom amounts apart.

ALTER TABLE item_option_groups ADD COLUMN free_text INTEGER NOT NULL DEFAULT 0;
