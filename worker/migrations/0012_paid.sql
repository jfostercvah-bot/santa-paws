-- Track who has paid their vendor fee or sponsorship
ALTER TABLE vendors ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsors ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
