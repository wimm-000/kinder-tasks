CREATE TABLE `account_recovery_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_recovery_token_hash_unique` ON `account_recovery_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `account_recovery_user_idx` ON `account_recovery_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_recovery_expires_idx` ON `account_recovery_tokens` (`expires_at`);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `deletion_requested_at` integer;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `purge_after` integer;--> statement-breakpoint
CREATE INDEX `user_profiles_purge_idx` ON `user_profiles` (`status`,`purge_after`);--> statement-breakpoint
ALTER TABLE `families` ADD `disabled_at` integer;--> statement-breakpoint
ALTER TABLE `families` ADD `disabled_reason` text;--> statement-breakpoint
CREATE INDEX `families_purge_idx` ON `families` (`status`,`purge_after`);
--> statement-breakpoint
DROP TRIGGER `money_transactions_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `money_transactions_no_delete`
BEFORE DELETE ON `money_transactions`
WHEN NOT EXISTS (
	SELECT 1 FROM `families`
	WHERE `id` = OLD.`family_id`
	AND `status` = 'pending_deletion'
	AND `purge_after` <= (unixepoch() * 1000)
)
BEGIN
	SELECT RAISE(ABORT, 'money_transactions are immutable');
END;
--> statement-breakpoint
DROP TRIGGER `allowance_runs_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `allowance_runs_no_delete`
BEFORE DELETE ON `allowance_runs`
WHEN NOT EXISTS (
	SELECT 1 FROM `families`
	WHERE `id` = OLD.`family_id`
	AND `status` = 'pending_deletion'
	AND `purge_after` <= (unixepoch() * 1000)
)
BEGIN
	SELECT RAISE(ABORT, 'allowance runs are immutable');
END;
