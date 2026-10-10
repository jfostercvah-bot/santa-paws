-- Event shirt orders from the Event Shirts page. items is JSON: [{style, size, qty}].
CREATE TABLE shirt_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  paid INTEGER NOT NULL DEFAULT 0
);

-- Single images the admin page can set, like the shirt design.
CREATE TABLE site_images (
  key TEXT PRIMARY KEY,
  updated TEXT NOT NULL DEFAULT (datetime('now')),
  image TEXT NOT NULL
);
