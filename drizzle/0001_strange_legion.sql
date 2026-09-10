CREATE INDEX `idx_approved_plans_created_at` ON `approved_plans` (`created_at`);
--> statement-breakpoint
PRAGMA optimize;
