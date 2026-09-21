import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const approvedPlans = sqliteTable("approved_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerName: text("provider_name").notNull(),
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
  planJson: text("plan_json").notNull(),
  status: text("status").notNull().default("approved"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [index("idx_approved_plans_created_at").on(table.createdAt)]);
