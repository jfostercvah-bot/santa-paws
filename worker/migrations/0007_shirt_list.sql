-- Event shirts for staff, event help and anyone else (sponsors' shirts come from the sponsors table).
CREATE TABLE shirts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
