CREATE TABLE `child_credentials` (
	`child_id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`pin_hash` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_failed_at` integer,
	`pin_changed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "child_credentials_failed_attempts_check" CHECK("child_credentials"."failed_attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX `child_credentials_family_idx` ON `child_credentials` (`family_id`);--> statement-breakpoint
CREATE TABLE `child_device_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text,
	`offline_enabled` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`authorized_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`authorized_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_devices_token_hash_unique` ON `child_device_authorizations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `child_devices_id_family_unique` ON `child_device_authorizations` (`id`,`family_id`);--> statement-breakpoint
CREATE INDEX `child_devices_family_revoked_idx` ON `child_device_authorizations` (`family_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `child_devices_expires_idx` ON `child_device_authorizations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `child_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`alias` text NOT NULL,
	`avatar_key` text NOT NULL,
	`profile_color` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "child_profiles_status_check" CHECK("child_profiles"."status" IN ('active', 'disabled', 'pending_deletion')),
	CONSTRAINT "child_profiles_avatar_check" CHECK("child_profiles"."avatar_key" IN ('bear', 'cat', 'fox', 'owl', 'rabbit', 'star')),
	CONSTRAINT "child_profiles_color_check" CHECK("child_profiles"."profile_color" IN ('teal', 'coral', 'yellow', 'blue', 'violet', 'green'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_profiles_id_family_unique` ON `child_profiles` (`id`,`family_id`);--> statement-breakpoint
CREATE INDEX `child_profiles_family_status_idx` ON `child_profiles` (`family_id`,`status`);--> statement-breakpoint
CREATE TABLE `child_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`device_authorization_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`csrf_secret_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`,`family_id`) REFERENCES `child_profiles`(`id`,`family_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`device_authorization_id`,`family_id`) REFERENCES `child_device_authorizations`(`id`,`family_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_sessions_token_hash_unique` ON `child_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `child_sessions_child_revoked_idx` ON `child_sessions` (`child_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `child_sessions_device_revoked_idx` ON `child_sessions` (`device_authorization_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `child_sessions_family_revoked_idx` ON `child_sessions` (`family_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `child_sessions_expires_idx` ON `child_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "rate_limit_buckets_count_check" CHECK("rate_limit_buckets"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_expires_idx` ON `rate_limit_buckets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_scope_blocked_idx` ON `rate_limit_buckets` (`scope`,`blocked_until`);