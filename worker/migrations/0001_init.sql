CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  times TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  pet_count INTEGER NOT NULL,
  pets TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE
);

-- One row per booked 5-minute slot; the primary key is what stops double booking.
CREATE TABLE photo_slots (
  time TEXT PRIMARY KEY,
  photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE
);

CREATE TABLE vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  business TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  needs TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL
);

-- Filled in from the admin page; drives sold-out levels and the names on the home page.
CREATE TABLE sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  business TEXT NOT NULL,
  level TEXT NOT NULL,
  show INTEGER NOT NULL DEFAULT 1
);
