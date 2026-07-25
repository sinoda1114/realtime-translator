CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`mode` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_device_started_idx` ON `conversations` (`device_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`device_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_device_hash_uidx` ON `devices` (`device_hash`);--> statement-breakpoint
CREATE TABLE `utterances` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`source_language` text NOT NULL,
	`target_language` text NOT NULL,
	`source_text` text NOT NULL,
	`translated_text` text NOT NULL,
	`started_offset_ms` integer NOT NULL,
	`ended_offset_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `utterances_conversation_created_idx` ON `utterances` (`conversation_id`,`created_at`);