-- Replies sent from the admin Messages tab
ALTER TABLE messages ADD COLUMN replied TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN replies TEXT NOT NULL DEFAULT '';
