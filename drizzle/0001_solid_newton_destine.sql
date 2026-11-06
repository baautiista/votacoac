CREATE TABLE `account_moderation` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_time` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `bingo_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`session_id` text NOT NULL,
	`cells` text NOT NULL,
	`marked` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_card_user_session` ON `bingo_cards` (`user_id`,`edition_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `bingo_session` ON `bingo_cards` (`edition_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `bingo_events` (
	`edition_id` text NOT NULL,
	`session_id` text NOT NULL,
	`situation_id` text NOT NULL,
	`occurred` integer NOT NULL,
	`confirmed_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_event_unique` ON `bingo_events` (`edition_id`,`session_id`,`situation_id`);--> statement-breakpoint
CREATE TABLE `edition_catalogs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`catalog` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `forecast_scores` (
	`user_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`phase` text NOT NULL,
	`points` integer NOT NULL,
	`hits` integer NOT NULL,
	`exact_hits` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forecast_score_unique` ON `forecast_scores` (`user_id`,`edition_id`,`phase`);--> statement-breakpoint
CREATE INDEX `forecast_score_ranking` ON `forecast_scores` (`edition_id`,`phase`,`points`);--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` text NOT NULL,
	`type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integration_events_edition` ON `integration_events` (`edition_id`,`id`);--> statement-breakpoint
CREATE TABLE `integration_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_key_hash` ON `integration_keys` (`token_hash`);--> statement-breakpoint
CREATE TABLE `league_members` (
	`league_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `private_leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_members_unique` ON `league_members` (`league_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `member_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_handle_unique` ON `member_profiles` (`handle`);--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` text NOT NULL,
	`performance_id` text NOT NULL,
	`group_id` text NOT NULL,
	`phase` text NOT NULL,
	`metrics` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metric_history_group_phase` ON `metric_snapshots` (`edition_id`,`group_id`,`phase`,`created_at`);--> statement-breakpoint
CREATE TABLE `module_settings` (
	`edition_id` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `official_results` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`phase` text NOT NULL,
	`category` text NOT NULL,
	`group_id` text NOT NULL,
	`position` integer,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `official_result_unique` ON `official_results` (`edition_id`,`phase`,`group_id`);--> statement-breakpoint
CREATE INDEX `official_result_edition_phase` ON `official_results` (`edition_id`,`phase`);--> statement-breakpoint
CREATE TABLE `phase_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`phase` text NOT NULL,
	`selection` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phase_forecast_unique` ON `phase_forecasts` (`user_id`,`edition_id`,`phase`);--> statement-breakpoint
CREATE INDEX `phase_forecast_edition` ON `phase_forecasts` (`edition_id`,`phase`);--> statement-breakpoint
CREATE TABLE `precontest_support` (
	`user_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`category` text NOT NULL,
	`group_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `precontest_one_per_category` ON `precontest_support` (`user_id`,`edition_id`,`category`);--> statement-breakpoint
CREATE INDEX `precontest_public_counts` ON `precontest_support` (`edition_id`,`category`,`group_id`);--> statement-breakpoint
CREATE TABLE `private_leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`name` text NOT NULL,
	`code_hash` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_code_unique` ON `private_leagues` (`code_hash`);--> statement-breakpoint
CREATE TABLE `result_publications` (
	`edition_id` text NOT NULL,
	`phase` text NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `result_publication_unique` ON `result_publications` (`edition_id`,`phase`,`category`);--> statement-breakpoint
CREATE TABLE `support_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` text NOT NULL,
	`category` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_history_edition_time` ON `support_history` (`edition_id`,`category`,`created_at`);