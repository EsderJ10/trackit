-- M5 phase 2: programs become a Days × Weeks roadmap. The phase-1 program tables
-- (program_exercises, exercise_training_state) never held data — the program flow
-- never ran — so we drop & recreate them in the new shape instead of preserving
-- rows. `programs` and `workout_sessions` keep their data and only gain columns.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE IF EXISTS `exercise_training_state`;--> statement-breakpoint
DROP TABLE IF EXISTS `program_exercises`;--> statement-breakpoint
CREATE TABLE `program_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`day_index` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`week_index` integer DEFAULT 1 NOT NULL,
	`name` text,
	`is_deload` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`program_day_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`scheme_type` text NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`increment_kg` real DEFAULT 2.5 NOT NULL,
	`min_reps` integer,
	`max_reps` integer,
	`fail_threshold` integer DEFAULT 3 NOT NULL,
	`deload_pct` real DEFAULT 0.1 NOT NULL,
	`tm_increment_kg` real DEFAULT 2.5 NOT NULL,
	`target_rpe` real,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_day_id`) REFERENCES `program_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_exercise_id` integer NOT NULL,
	`week_index` integer DEFAULT 1 NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer NOT NULL,
	`intensity_kind` text DEFAULT 'abs' NOT NULL,
	`intensity_value` real DEFAULT 0 NOT NULL,
	`amrap` integer DEFAULT false NOT NULL,
	`rest_sec` integer,
	FOREIGN KEY (`program_exercise_id`) REFERENCES `program_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise_training_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_exercise_id` integer NOT NULL,
	`current_weight_kg` real DEFAULT 0 NOT NULL,
	`current_reps` integer DEFAULT 5 NOT NULL,
	`success_streak` integer DEFAULT 0 NOT NULL,
	`fail_streak` integer DEFAULT 0 NOT NULL,
	`training_max_kg` real,
	`e1rm_kg` real,
	`last_reason` text,
	FOREIGN KEY (`program_exercise_id`) REFERENCES `program_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `programs` ADD `current_day_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `rounding_step_kg` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `program_day_id` integer;