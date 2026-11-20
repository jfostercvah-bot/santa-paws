-- When the "your shirt is ready" email went out for each shirt order (blank = not yet).
ALTER TABLE shirt_orders ADD COLUMN ready_emailed TEXT NOT NULL DEFAULT '';
