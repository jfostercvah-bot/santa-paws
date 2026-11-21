-- When the "your free shirt is ready" email went out to each sponsor (blank = not yet).
ALTER TABLE sponsors ADD COLUMN ready_emailed TEXT NOT NULL DEFAULT '';
