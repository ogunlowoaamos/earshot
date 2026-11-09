-- Some groups are not a single choice but a pile of pieces: the chops inside a
-- small chops platter, for example. Those groups ask "how many of each?" so the
-- group needs a switch, and the order needs to carry a count per choice.
ALTER TABLE item_option_groups ADD COLUMN allows_quantity INTEGER NOT NULL DEFAULT 0;
