CREATE TABLE `affiliate_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`provider` text NOT NULL,
	`target_url` text NOT NULL,
	`user_hash` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_clicks_provider` ON `affiliate_clicks` (`provider`,`created_at`);--> statement-breakpoint
CREATE TABLE `match_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`vote` text NOT NULL,
	`user_hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_votes_event_user` ON `match_votes` (`event_id`,`user_hash`);--> statement-breakpoint
CREATE INDEX `idx_votes_event` ON `match_votes` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_votes_user` ON `match_votes` (`user_hash`);--> statement-breakpoint
CREATE TABLE `public_accumulators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`user_name` text NOT NULL,
	`selections` text NOT NULL,
	`total_odds` real NOT NULL,
	`stake` real DEFAULT 10,
	`potential_return` real NOT NULL,
	`status` text DEFAULT 'pending',
	`views` integer DEFAULT 0,
	`copies` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_accas_code` ON `public_accumulators` (`code`);--> statement-breakpoint
CREATE INDEX `idx_accas_status` ON `public_accumulators` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_accas_created` ON `public_accumulators` (`created_at`);--> statement-breakpoint
CREATE TABLE `stream_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stream_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`country` text DEFAULT 'GH',
	`url` text,
	`priority` integer DEFAULT 100,
	`affiliate` integer DEFAULT false,
	`active` integer DEFAULT true,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_stream_map_comp` ON `stream_map` (`competition`,`active`);