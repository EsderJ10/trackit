CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `module_seed_state` (
	`module_id` text PRIMARY KEY NOT NULL,
	`seeded_at` integer NOT NULL
);
