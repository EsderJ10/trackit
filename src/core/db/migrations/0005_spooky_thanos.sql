CREATE TABLE `exercise_training_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`current_weight_kg` real DEFAULT 0 NOT NULL,
	`current_reps` integer DEFAULT 5 NOT NULL,
	`success_streak` integer DEFAULT 0 NOT NULL,
	`fail_streak` integer DEFAULT 0 NOT NULL,
	`training_max_kg` real,
	`last_reason` text,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`day_index` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`scheme_type` text NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`increment_kg` real DEFAULT 2.5 NOT NULL,
	`min_reps` integer,
	`max_reps` integer,
	`fail_threshold` integer DEFAULT 3 NOT NULL,
	`deload_pct` real DEFAULT 0.1 NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`length_weeks` integer DEFAULT 1 NOT NULL,
	`current_week` integer DEFAULT 1 NOT NULL,
	`current_cycle` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `program_id` integer REFERENCES programs(id);--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `program_week_index` integer;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `program_day_index` integer;