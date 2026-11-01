-- Free shirts now come in two designs, and "Sweatshirt" is called "Crewneck" everywhere (Nov 1).
ALTER TABLE shirts ADD COLUMN design TEXT NOT NULL DEFAULT 'Santa Paws';
UPDATE shirts SET style = 'Crewneck' WHERE style = 'Sweatshirt';
UPDATE sponsors SET shirt_style = 'Crewneck' WHERE shirt_style = 'Sweatshirt';
