-- Logos (small data: URLs, resized in the browser) and approval to show on the website.
ALTER TABLE vendors ADD COLUMN logo TEXT NOT NULL DEFAULT '';
ALTER TABLE vendors ADD COLUMN show INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsors ADD COLUMN contact TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN logo TEXT NOT NULL DEFAULT '';
