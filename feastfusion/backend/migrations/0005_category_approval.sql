-- A category only reaches the customer menu once the caterer approves it.
-- The column starts at 0 so a brand new category stays hidden until someone
-- deliberately puts it on the menu.
ALTER TABLE categories ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 0;
