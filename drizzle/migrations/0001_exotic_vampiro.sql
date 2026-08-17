CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text,
	`deletion_requested_at` integer,
	`purge_after` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "families_currency_check" CHECK("families"."currency" = 'EUR'),
	CONSTRAINT "families_status_check" CHECK("families"."status" IN ('active', 'disabled', 'pending_deletion', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `families_status_idx` ON `families` (`status`);--> statement-breakpoint
CREATE INDEX `families_created_by_idx` ON `families` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `family_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`email_normalized` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text,
	`accepted_by_user_id` text,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "family_invitations_status_check" CHECK("family_invitations"."status" IN ('pending', 'accepted', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_invitations_token_hash_unique` ON `family_invitations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `family_invitations_pending_family_email_unique` ON `family_invitations` (`family_id`,`email_normalized`) WHERE "family_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `family_invitations_email_status_idx` ON `family_invitations` (`email_normalized`,`status`);--> statement-breakpoint
CREATE INDEX `family_invitations_family_status_idx` ON `family_invitations` (`family_id`,`status`);--> statement-breakpoint
CREATE INDEX `family_invitations_expires_idx` ON `family_invitations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'parent' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "family_members_role_check" CHECK("family_members"."role" = 'parent'),
	CONSTRAINT "family_members_status_check" CHECK("family_members"."status" IN ('active', 'suspended', 'left'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_family_user_unique` ON `family_members` (`family_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `family_members_family_status_idx` ON `family_members` (`family_id`,`status`);--> statement-breakpoint
CREATE INDEX `family_members_user_status_idx` ON `family_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`actor_child_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`result` text NOT NULL,
	`metadata_json` text,
	`ip_hash` text,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_logs_actor_type_check" CHECK("audit_logs"."actor_type" IN ('user', 'child', 'system', 'superadmin')),
	CONSTRAINT "audit_logs_result_check" CHECK("audit_logs"."result" IN ('success', 'denied', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `audit_logs_family_created_idx` ON `audit_logs` (`family_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_created_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_created_idx` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_result_created_idx` ON `audit_logs` (`result`,`created_at`);