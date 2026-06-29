CREATE INDEX `exercise_training_state_program_exercise_id_idx` ON `exercise_training_state` (`program_exercise_id`);--> statement-breakpoint
CREATE INDEX `program_days_program_id_idx` ON `program_days` (`program_id`);--> statement-breakpoint
CREATE INDEX `program_exercises_program_day_id_idx` ON `program_exercises` (`program_day_id`);--> statement-breakpoint
CREATE INDEX `program_exercises_program_id_idx` ON `program_exercises` (`program_id`);--> statement-breakpoint
CREATE INDEX `program_sets_program_exercise_id_idx` ON `program_sets` (`program_exercise_id`);--> statement-breakpoint
CREATE INDEX `program_weeks_program_id_idx` ON `program_weeks` (`program_id`);--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_id_idx` ON `routine_exercises` (`routine_id`);--> statement-breakpoint
CREATE INDEX `set_logs_session_id_idx` ON `set_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `set_logs_exercise_set_type_completed_idx` ON `set_logs` (`exercise_id`,`set_type`,`completed_at`);--> statement-breakpoint
CREATE INDEX `workout_sessions_finished_at_idx` ON `workout_sessions` (`finished_at`);--> statement-breakpoint
CREATE INDEX `workout_sessions_started_at_idx` ON `workout_sessions` (`started_at`);