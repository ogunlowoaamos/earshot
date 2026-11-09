-- Allergies the kitchen must plan around, and the exact dishes picked
-- inside each category (e.g. "Akara & Pap" rather than just "Breakfast").
ALTER TABLE catering_requests ADD COLUMN allergies TEXT NOT NULL DEFAULT '';
ALTER TABLE catering_requests ADD COLUMN picked_dishes TEXT NOT NULL DEFAULT '';
