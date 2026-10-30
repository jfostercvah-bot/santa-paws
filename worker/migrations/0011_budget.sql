-- Event costs and extra income for the admin Budget tab
CREATE TABLE budget (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL DEFAULT 'Cost',
  item TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);
