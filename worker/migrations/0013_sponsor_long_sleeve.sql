-- Sponsor shirts default to Long sleeve (Josh, 2026-10-31); move sponsors still on the old T-shirt default.
UPDATE sponsors SET shirt_style = 'Long sleeve' WHERE shirt_style = 'T-shirt';
