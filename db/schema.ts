import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerKey: text("provider_key").notNull(),
  name: text("name").notNull(),
  division: text("division").notNull(),
  clinicalEffortBasisPoints: integer("clinical_effort_basis_points").notNull(),
  adjustedFteEnabled: integer("adjusted_fte_enabled", { mode: "boolean" }).notNull().default(false),
  adjustedFteBasisPoints: integer("adjusted_fte_basis_points").notNull().default(10000),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [uniqueIndex("idx_providers_provider_key").on(table.providerKey), index("idx_providers_division").on(table.division)]);

export const clinicalTasks = sqliteTable("clinical_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  task: text("task").notNull(),
  cu: integer("cu").notNull(),
  days: integer("days").notNull().default(50),
  serviceWeekDays: integer("service_week_days"),
  weekendOnly: integer("weekend_only", { mode: "boolean" }).notNull().default(false),
  unit: text("unit").notNull(),
  type: text("type").notNull(),
  division: text("division").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [index("idx_clinical_tasks_division").on(table.division)]);

export const approvedPlans = sqliteTable("approved_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerName: text("provider_name").notNull(),
  providerKey: text("provider_key"),
  division: text("division").notNull(),
  clinicalEffort: integer("clinical_effort").notNull(),
  targetCu: integer("target_cu").notNull(),
  plannedCu: integer("planned_cu").notNull(),
  vacationWeeks: integer("vacation_weeks").notNull().default(600),
  vacationCmeEnabled: integer("vacation_cme_enabled", { mode: "boolean" }).notNull().default(true),
  adjustedFte: integer("adjusted_fte").notNull().default(100),
  adjustedFteBasisPoints: integer("adjusted_fte_basis_points"),
  adjustedFteEnabled: integer("adjusted_fte_enabled", { mode: "boolean" }).notNull().default(false),
  adjustedFteMethod: text("adjusted_fte_method").notNull().default("direct"),
  workedStartDate: text("worked_start_date"),
  workedEndDate: text("worked_end_date"),
  weeksNotWorking: integer("weeks_not_working").notNull().default(0),
  hasOverrides: integer("has_overrides", { mode: "boolean" }).notNull().default(false),
  comment: text("comment").notNull().default(""),
  planJson: text("plan_json").notNull(),
  status: text("status").notNull().default("approved"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [index("idx_approved_plans_created_at").on(table.createdAt)]);

export const planHistory = sqliteTable("plan_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").notNull(),
  providerKey: text("provider_key"),
  providerName: text("provider_name").notNull(),
  division: text("division").notNull(),
  actor: text("actor").notNull().default("Admin"),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [index("idx_plan_history_plan_id").on(table.planId), index("idx_plan_history_created_at").on(table.createdAt)]);
