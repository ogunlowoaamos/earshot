-- The caterer needs to know what time to arrive, not just the day.
-- Existing rows keep an empty string so nothing has to be backfilled.
ALTER TABLE catering_requests ADD COLUMN event_time TEXT NOT NULL DEFAULT '';
