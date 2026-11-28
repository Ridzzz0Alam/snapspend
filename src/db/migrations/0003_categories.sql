CREATE TABLE `categories` (
	`name` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `categories` (`name`, `position`) VALUES
	('Dairy & Eggs', 0),
	('Bakery', 1),
	('Fruit & Veg', 2),
	('Meat & Fish', 3),
	('Pantry', 4),
	('Snacks & Sweets', 5),
	('Drinks & Coffee', 6),
	('Frozen', 7),
	('Household & Cleaning', 8),
	('Personal care', 9),
	('Eating out', 10),
	('Phone & Top-ups', 11),
	('Other', 12);
--> statement-breakpoint
INSERT OR IGNORE INTO `store_aliases` (`raw`, `canonical`) VALUES ('INTERSPAR', 'SPAR (Interspar)');
