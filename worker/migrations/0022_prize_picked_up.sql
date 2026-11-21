-- When a raffle winner picked up their prize (blank = not yet).
ALTER TABLE raffle_tickets ADD COLUMN picked_up TEXT NOT NULL DEFAULT '';
