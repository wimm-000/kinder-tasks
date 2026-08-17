CREATE TABLE `allowance_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`allowance_schedule_id` text NOT NULL,
	`period_key` text NOT NULL,
	`due_at` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`money_transaction_id` text,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`allowance_schedule_id`,`family_id`) REFERENCES `allowance_schedules`(`id`,`family_id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`money_transaction_id`,`family_id`) REFERENCES `money_transactions`(`id`,`family_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "allowance_runs_amount_check" CHECK("allowance_runs"."amount_cents" BETWEEN 1 AND 100000000),
	CONSTRAINT "allowance_runs_status_check" CHECK("allowance_runs"."status" IN ('processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allowance_runs_schedule_period_unique` ON `allowance_runs` (`allowance_schedule_id`,`period_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `allowance_runs_transaction_unique` ON `allowance_runs` (`money_transaction_id`);--> statement-breakpoint
CREATE INDEX `allowance_runs_status_due_idx` ON `allowance_runs` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `allowance_runs_family_created_idx` ON `allowance_runs` (`family_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `allowance_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`frequency` text NOT NULL,
	`weekday` integer,
	`month_day` integer,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_run_at` integer NOT NULL,
	`last_run_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "allowance_schedules_amount_check" CHECK("allowance_schedules"."amount_cents" BETWEEN 1 AND 100000000),
	CONSTRAINT "allowance_schedules_currency_check" CHECK("allowance_schedules"."currency" = 'EUR'),
	CONSTRAINT "allowance_schedules_frequency_check" CHECK("allowance_schedules"."frequency" IN ('weekly', 'monthly')),
	CONSTRAINT "allowance_schedules_period_check" CHECK(("allowance_schedules"."frequency" = 'weekly' AND "allowance_schedules"."weekday" BETWEEN 1 AND 7 AND "allowance_schedules"."month_day" IS NULL) OR ("allowance_schedules"."frequency" = 'monthly' AND "allowance_schedules"."month_day" BETWEEN 1 AND 31 AND "allowance_schedules"."weekday" IS NULL)),
	CONSTRAINT "allowance_schedules_status_check" CHECK("allowance_schedules"."status" IN ('active', 'paused', 'ended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allowance_schedules_id_family_unique` ON `allowance_schedules` (`id`,`family_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `allowance_schedules_active_child_unique` ON `allowance_schedules` (`child_id`) WHERE "allowance_schedules"."status" = 'active';--> statement-breakpoint
CREATE INDEX `allowance_schedules_due_idx` ON `allowance_schedules` (`status`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `allowance_schedules_family_child_idx` ON `allowance_schedules` (`family_id`,`child_id`);--> statement-breakpoint
CREATE TABLE `money_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`created_by_kind` text NOT NULL,
	`created_by_user_id` text,
	`task_id` text,
	`task_completion_request_id` text,
	`allowance_schedule_id` text,
	`idempotency_key` text NOT NULL,
	`effective_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`allowance_schedule_id`,`family_id`) REFERENCES `allowance_schedules`(`id`,`family_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "money_transactions_amount_check" CHECK("money_transactions"."amount_cents" BETWEEN -100000000 AND 100000000 AND "money_transactions"."amount_cents" != 0),
	CONSTRAINT "money_transactions_currency_check" CHECK("money_transactions"."currency" = 'EUR'),
	CONSTRAINT "money_transactions_type_check" CHECK("money_transactions"."type" IN ('allowance', 'task_reward', 'withdrawal', 'correction_credit', 'correction_debit')),
	CONSTRAINT "money_transactions_sign_check" CHECK(("money_transactions"."type" IN ('allowance', 'task_reward', 'correction_credit') AND "money_transactions"."amount_cents" > 0) OR ("money_transactions"."type" IN ('withdrawal', 'correction_debit') AND "money_transactions"."amount_cents" < 0)),
	CONSTRAINT "money_transactions_creator_check" CHECK(("money_transactions"."created_by_kind" = 'user' AND "money_transactions"."created_by_user_id" IS NOT NULL) OR ("money_transactions"."created_by_kind" = 'system' AND "money_transactions"."created_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `money_transactions_id_family_unique` ON `money_transactions` (`id`,`family_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `money_transactions_idempotency_unique` ON `money_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `money_transactions_child_effective_idx` ON `money_transactions` (`child_id`,`effective_at`);--> statement-breakpoint
CREATE INDEX `money_transactions_family_effective_idx` ON `money_transactions` (`family_id`,`effective_at`);--> statement-breakpoint
CREATE INDEX `money_transactions_schedule_idx` ON `money_transactions` (`allowance_schedule_id`);
--> statement-breakpoint
CREATE TRIGGER `money_transactions_no_update`
BEFORE UPDATE ON `money_transactions`
BEGIN
	SELECT RAISE(ABORT, 'money_transactions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `money_transactions_no_delete`
BEFORE DELETE ON `money_transactions`
BEGIN
	SELECT RAISE(ABORT, 'money_transactions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `allowance_runs_completed_no_update`
BEFORE UPDATE ON `allowance_runs`
WHEN OLD.status = 'completed'
BEGIN
	SELECT RAISE(ABORT, 'completed allowance runs are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `allowance_runs_no_delete`
BEFORE DELETE ON `allowance_runs`
BEGIN
	SELECT RAISE(ABORT, 'allowance runs are immutable');
END;
