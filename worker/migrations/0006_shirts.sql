-- Each sponsor gets one event shirt; this is the size they asked for.
ALTER TABLE sponsors ADD COLUMN shirt_size TEXT NOT NULL DEFAULT '';
