-- A dish can carry a whole gallery: several photos, several clips, or links
-- pasted from anywhere, in the order the caterer arranged them.
--
-- The list is stored as JSON in one column. `image_url` and `video_url` stay
-- exactly as they were and are kept in step with the first picture and the
-- first clip, so the menu card, the basket and the dish page keep working
-- without knowing the list exists. Empty means "no gallery yet", and the two
-- old columns are read instead, so every existing dish is untouched.

ALTER TABLE menu_items ADD COLUMN media TEXT NOT NULL DEFAULT '';
