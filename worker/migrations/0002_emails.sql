-- History of announcement emails sent from the admin page.
CREATE TABLE emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  audience TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);
