CREATE TABLE `adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`applies_to` text,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `adjustments_receipt_id_idx` ON `adjustments` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`position` integer NOT NULL,
	`name_en` text NOT NULL,
	`name_original` text,
	`size_label` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` integer,
	`line_total` integer NOT NULL,
	`category` text NOT NULL,
	`normalized_key` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_receipt_id_idx` ON `items` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `items_normalized_key_idx` ON `items` (`normalized_key`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`store` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`printed_total` integer NOT NULL,
	`computed_total` integer NOT NULL,
	`card_last4` text,
	`payment_method` text,
	`image_paths` text,
	`raw_gemini_json` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipts_date_idx` ON `receipts` (`date`);--> statement-breakpoint
CREATE TABLE `store_aliases` (
	`raw` text PRIMARY KEY NOT NULL,
	`canonical` text NOT NULL
);
