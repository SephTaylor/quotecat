-- 033_quote_work_dates.sql
-- Adds optional work dates to quotes for the v1.2.15 "Add to Calendar"
-- feature. Same schema shape as Contract's existing start_date /
-- completion_date so quote→contract conversion carries the fields cleanly.
--
-- Nullable, no default. Existing quotes read as NULL.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS completion_date DATE;
