CREATE TABLE `task_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`task_id` text NOT NULL,
	`child_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`task_id`,`family_id`) REFERENCES `tasks`(`id`,`family_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_assignments_status_check" CHECK("task_assignments"."status" IN ('active','paused','removed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_assignments_task_child_unique` ON `task_assignments` (`task_id`,`child_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_assignments_id_family_unique` ON `task_assignments` (`id`,`family_id`);--> statement-breakpoint
CREATE INDEX `task_assignments_child_status_idx` ON `task_assignments` (`child_id`,`status`);--> statement-breakpoint
CREATE TABLE `task_completion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`task_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`child_id` text NOT NULL,
	`period_key` text NOT NULL,
	`occurrence_number` integer DEFAULT 1 NOT NULL,
	`client_request_id` text NOT NULL,
	`status` text DEFAULT 'pending_approval' NOT NULL,
	`reward_cents_snapshot` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reviewed_at` integer,
	`reviewed_by_user_id` text,
	`rejection_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`,`family_id`) REFERENCES `tasks`(`id`,`family_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assignment_id`,`family_id`) REFERENCES `task_assignments`(`id`,`family_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "completion_requests_status_check" CHECK("task_completion_requests"."status" IN ('pending_approval','approved','rejected','cancelled')),
	CONSTRAINT "completion_requests_reward_check" CHECK("task_completion_requests"."reward_cents_snapshot" BETWEEN 0 AND 100000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completion_requests_client_unique` ON `task_completion_requests` (`client_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `completion_requests_occurrence_unique` ON `task_completion_requests` (`task_id`,`child_id`,`period_key`,`occurrence_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `completion_requests_id_family_unique` ON `task_completion_requests` (`id`,`family_id`);--> statement-breakpoint
CREATE INDEX `completion_requests_family_status_idx` ON `task_completion_requests` (`family_id`,`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `completion_requests_child_status_idx` ON `task_completion_requests` (`child_id`,`status`,`requested_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reward_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`recurrence_unit` text,
	`recurrence_interval` integer,
	`recurrence_weekday` integer,
	`recurrence_month_day` integer,
	`open_limit_count` integer,
	`open_limit_period` text,
	`starts_at` integer,
	`ends_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_type_check" CHECK("tasks"."type" IN ('one_off','recurring','open')),
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" IN ('active','paused','archived')),
	CONSTRAINT "tasks_reward_check" CHECK("tasks"."reward_cents" BETWEEN 0 AND 100000000),
	CONSTRAINT "tasks_currency_check" CHECK("tasks"."currency" = 'EUR')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_id_family_unique` ON `tasks` (`id`,`family_id`);--> statement-breakpoint
CREATE INDEX `tasks_family_status_idx` ON `tasks` (`family_id`,`status`);