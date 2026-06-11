PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_set_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight` real DEFAULT 0 NOT NULL,
	`rpe` real,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_set_logs`("id", "session_id", "exercise_id", "set_number", "reps", "weight", "rpe", "completed_at") SELECT "id", "session_id", "exercise_id", "set_number", "reps", "weight", "rpe", "completed_at" FROM `set_logs`;--> statement-breakpoint
DROP TABLE `set_logs`;--> statement-breakpoint
ALTER TABLE `__new_set_logs` RENAME TO `set_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;