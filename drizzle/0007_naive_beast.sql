CREATE TABLE `clinical_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task` text NOT NULL,
	`cu` integer NOT NULL,
	`days` integer DEFAULT 50 NOT NULL,
	`service_week_days` integer,
	`weekend_only` integer DEFAULT false NOT NULL,
	`unit` text NOT NULL,
	`type` text NOT NULL,
	`division` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clinical_tasks_division` ON `clinical_tasks` (`division`);--> statement-breakpoint
INSERT INTO `clinical_tasks` (`id`,`task`,`cu`,`days`,`service_week_days`,`weekend_only`,`unit`,`type`,`division`,`updated_at`) VALUES
(1,'Inpatient consult service',550,100,500,false,'day','Inpatient service','Cardiology',''),
(2,'Outpatient clinic',350,50,NULL,false,'session','Outpatient','Cardiology',''),
(3,'Cardiac CT reads',35,50,NULL,false,'read block','Ancillary','Cardiology',''),
(4,'Cath lab coverage',650,50,NULL,false,'half-day block','Procedural','Cardiology',''),
(5,'Fellows clinic',275,50,NULL,false,'session','Outpatient','Cardiology',''),
(6,'MICU attending',750,100,500,false,'day','Inpatient service','Pulmonary',''),
(7,'Bronchoscopy',125,50,NULL,false,'half-day block','Procedural','Pulmonary',''),
(8,'Pulmonary clinic',325,50,NULL,false,'session','Outpatient','Pulmonary',''),
(9,'PFT interpretation',30,50,NULL,false,'read block','Ancillary','Pulmonary',''),
(10,'Allergy clinic',300,50,NULL,false,'session','Outpatient','Clinical Immunology',''),
(11,'Infusion supervision',225,50,NULL,false,'half-day block','Procedural','Clinical Immunology',''),
(12,'Inpatient immunology consult',500,100,500,false,'day','Inpatient service','Clinical Immunology','');--> statement-breakpoint
CREATE TABLE `plan_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`provider_key` text,
	`provider_name` text NOT NULL,
	`division` text NOT NULL,
	`actor` text DEFAULT 'Admin' NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plan_history_plan_id` ON `plan_history` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_plan_history_created_at` ON `plan_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_key` text NOT NULL,
	`name` text NOT NULL,
	`division` text NOT NULL,
	`clinical_effort_basis_points` integer NOT NULL,
	`adjusted_fte_enabled` integer DEFAULT false NOT NULL,
	`adjusted_fte_basis_points` integer DEFAULT 10000 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_providers_provider_key` ON `providers` (`provider_key`);--> statement-breakpoint
CREATE INDEX `idx_providers_division` ON `providers` (`division`);--> statement-breakpoint
INSERT INTO `providers` (`id`,`provider_key`,`name`,`division`,`clinical_effort_basis_points`,`adjusted_fte_enabled`,`adjusted_fte_basis_points`,`updated_at`) VALUES
(1,'CARD-EVASQUEZ','Dr. Elena Vasquez','Cardiology',8000,false,10000,''),
(2,'CARD-MCHEN','Dr. Marcus Chen','Cardiology',6000,false,10000,''),
(3,'CARD-PNAIR','Dr. Priya Nair','Cardiology',7000,false,10000,''),
(4,'CARD-JWILSON','Dr. James Wilson','Cardiology',5000,false,10000,''),
(5,'CARD-RKIM','Dr. Rachel Kim','Cardiology',9000,false,10000,''),
(6,'PULM-ORAHMAN','Dr. Omar Rahman','Pulmonary',7500,false,10000,''),
(7,'PULM-SBROOKS','Dr. Sarah Brooks','Pulmonary',6000,false,10000,''),
(8,'PULM-DLIN','Dr. David Lin','Pulmonary',8500,false,10000,''),
(9,'IMM-AJONES','Dr. Amara Jones','Clinical Immunology',6500,false,10000,''),
(10,'IMM-NPATEL','Dr. Noah Patel','Clinical Immunology',5500,false,10000,'');--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `provider_key` text;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `comment` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `approved_plans` ADD `updated_at` text DEFAULT '' NOT NULL;
