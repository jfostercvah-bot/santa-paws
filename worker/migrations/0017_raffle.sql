-- Raffle prizes for the scavenger hunt (Nov 9). Added on the admin page's Raffle tab and listed on hunt.html.
CREATE TABLE raffle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  updated TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  donor TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  winner TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT ''
);
