ALTER TABLE `exercises` ADD `description` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `cues` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `primary_muscles` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `secondary_muscles` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `is_favorite` integer DEFAULT false NOT NULL;