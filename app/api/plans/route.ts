import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { approvedPlans } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(approvedPlans).orderBy(desc(approvedPlans.createdAt), desc(approvedPlans.id)).limit(100);
    return Response.json({ plans: rows.map(row => ({ ...row, plannedCu: row.plannedCu / 100, vacationWeeks: row.vacationWeeks / 100, adjustedFte: row.adjustedFte / 100, lines: JSON.parse(row.planJson) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: number; providerName?: string; division?: string; clinicalEffort?: number; adjustedFte?: number; targetCu?: number; plannedCu?: number; hasOverrides?: boolean; lines?: unknown[] };
    if (!body.providerName || !body.division || !body.targetCu || !Array.isArray(body.lines) || !body.lines.length) return Response.json({ error: "A complete provider plan is required" }, { status: 400 });
    if ((body.plannedCu ?? 0) < body.targetCu) return Response.json({ error: "The plan must meet the CU target" }, { status: 400 });
    const values = { providerName: body.providerName, division: body.division, clinicalEffort: body.clinicalEffort ?? 0, targetCu: body.targetCu, plannedCu: Math.round((body.plannedCu ?? 0) * 100), adjustedFte: Math.round((body.adjustedFte ?? 1) * 100), hasOverrides: Boolean(body.hasOverrides), planJson: JSON.stringify(body.lines), createdAt: new Date().toISOString() };
    const [plan] = body.id
      ? await getDb().update(approvedPlans).set(values).where(eq(approvedPlans.id, body.id)).returning()
      : await getDb().insert(approvedPlans).values(values).returning();
    return Response.json({ plan: { ...plan, plannedCu: body.plannedCu, adjustedFte: body.adjustedFte ?? 1, lines: body.lines } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save plan" }, { status: 500 });
  }
}
