CREATE TABLE `approved_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_name` text NOT NULL,
	`division` text NOT NULL,
	`clinical_effort` integer NOT NULL,
	`target_cu` integer NOT NULL,
	`planned_cu` integer NOT NULL,
	`has_overrides` integer DEFAULT false NOT NULL,
	`plan_json` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text NOT NULL
);
