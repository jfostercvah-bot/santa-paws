-- Past-event photos for the Gallery page, uploaded from the admin page (resized in the browser).
CREATE TABLE gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  year TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  thumb TEXT NOT NULL,
  image TEXT NOT NULL
);
