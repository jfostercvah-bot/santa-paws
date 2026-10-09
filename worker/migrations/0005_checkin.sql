-- Event-day check-in and walk-ups, both handled from the admin page.
ALTER TABLE photos ADD COLUMN checked_in TEXT NOT NULL DEFAULT '';
ALTER TABLE photos ADD COLUMN walkup INTEGER NOT NULL DEFAULT 0;
