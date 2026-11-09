-- Sponsors who don't want their free shirt (Josh, Nov 9): left off the shirt list, designer sheet and shirt printing cost.
ALTER TABLE sponsors ADD COLUMN no_shirt INTEGER NOT NULL DEFAULT 0;
