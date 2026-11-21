-- The order prizes are given out in the drawing (1 = first). 0 = not set yet (goes after, oldest first).
ALTER TABLE raffle ADD COLUMN draw_order INTEGER NOT NULL DEFAULT 0;
