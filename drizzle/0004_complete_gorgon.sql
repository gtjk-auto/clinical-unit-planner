ALTER TABLE `approved_plans` ADD `adjusted_fte_basis_points` integer;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `adjusted_fte_method` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `worked_start_date` text;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `worked_end_date` text;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `weeks_not_working` integer DEFAULT 0 NOT NULL;