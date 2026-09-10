import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const approvedPlans = sqliteTable("approved_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerName: text("provider_name").notNull(),
  division: text("division").notNull(),
  clinicalEffort: integer("clinical_effort").notNull(),
  targetCu: integer("target_cu").notNull(),
  plannedCu: integer("planned_cu").notNull(),
  hasOverrides: integer("has_overrides", { mode: "boolean" }).notNull().default(false),
  planJson: text("plan_json").notNull(),
  status: text("status").notNull().default("approved"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [index("idx_approved_plans_created_at").on(table.createdAt)]);
