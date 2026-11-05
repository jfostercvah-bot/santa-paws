-- Small admin settings, like the shirt printer's price per shirt type for the Budget tab (Nov 5).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL DEFAULT (datetime('now'))
);
