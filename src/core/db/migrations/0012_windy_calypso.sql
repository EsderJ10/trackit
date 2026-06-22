ALTER TABLE `exercises` ADD `measurement_kind` text DEFAULT 'weight_reps' NOT NULL;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `set_type` text DEFAULT 'working' NOT NULL;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `duration_sec` integer;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `distance_m` real;