-- A dish can carry a short video as well as a photo.
--
-- The caterer uploads a clip from the add form and the dish page plays it
-- instead of the still photo. Empty means "no video", so every existing dish
-- keeps working untouched.

ALTER TABLE menu_items ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
