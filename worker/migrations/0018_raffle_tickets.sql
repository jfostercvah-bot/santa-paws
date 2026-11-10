-- Raffle tickets entered on the admin page (Nov 10): who holds each ticket, and which ones won.
-- One win per family is checked on the admin page (same phone, email or name), not enforced here.
CREATE TABLE raffle_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  ticket TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  won INTEGER NOT NULL DEFAULT 0,
  won_at TEXT NOT NULL DEFAULT '',
  prize_id INTEGER,
  prize TEXT NOT NULL DEFAULT ''
);
