-- Shirt type (T-shirt, long sleeve, sweatshirt, hoodie), picked on the admin page only.
ALTER TABLE shirts ADD COLUMN style TEXT NOT NULL DEFAULT 'T-shirt';
ALTER TABLE sponsors ADD COLUMN shirt_style TEXT NOT NULL DEFAULT 'T-shirt';
