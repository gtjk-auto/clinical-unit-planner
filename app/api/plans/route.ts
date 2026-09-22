import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { approvedPlans, planHistory } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(approvedPlans).orderBy(desc(approvedPlans.createdAt), desc(approvedPlans.id)).limit(100);
    return Response.json({ plans: rows.map(row => ({ ...row, plannedCu: row.plannedCu / 100, vacationWeeks: row.vacationWeeks / 100, adjustedFte: row.adjustedFteBasisPoints == null ? row.adjustedFte / 100 : row.adjustedFteBasisPoints / 10000, weeksNotWorking: row.weeksNotWorking / 100, lines: JSON.parse(row.planJson) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: number; providerKey?: string; providerName?: string; division?: string; clinicalEffort?: number; adjustedFte?: number; adjustedFteEnabled?: boolean; adjustedFteMethod?: "direct" | "dates" | "leave"; workedStartDate?: string | null; workedEndDate?: string | null; weeksNotWorking?: number; vacationCmeEnabled?: boolean; vacationWeeks?: number; targetCu?: number; plannedCu?: number; hasOverrides?: boolean; comment?: string; changeSummary?: string; lines?: unknown[] };
    if (!body.providerName || !body.division || !body.targetCu || !Array.isArray(body.lines)) return Response.json({ error: "Provider, target, and plan lines are required" }, { status: 400 });
    const method=body.adjustedFteMethod ?? "direct";
    let adjustedFte=Math.min(1,Math.max(0,body.adjustedFte ?? 1));
    if (method === "dates") {
      if (!body.workedStartDate || !body.workedEndDate) return Response.json({ error: "Both worked dates are required" }, { status: 400 });
      const start=Date.parse(`${body.workedStartDate}T00:00:00Z`), end=Date.parse(`${body.workedEndDate}T00:00:00Z`);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return Response.json({ error: "The worked date range is invalid" }, { status: 400 });
      adjustedFte=Math.min(1,((end-start)/86400000+1)/364);
    } else if (method === "leave") {
      const weeks=Math.min(52,Math.max(0,body.weeksNotWorking ?? 0)); adjustedFte=(52-weeks)/52;
    }
    const calculatedTarget=Math.round(460*(body.clinicalEffort ?? 0)/100*adjustedFte);
    if (calculatedTarget !== body.targetCu) return Response.json({ error: "The CU target does not match the adjusted FTE" }, { status: 400 });
    const vacationWeeks=Math.min(52,Math.max(0,body.vacationWeeks ?? 6));
    const status=(body.plannedCu ?? 0) >= body.targetCu ? "complete" : "below_target", now=new Date().toISOString();
    const values = { providerKey:body.providerKey ?? null, providerName: body.providerName, division: body.division, clinicalEffort: body.clinicalEffort ?? 0, targetCu: body.targetCu, plannedCu: Math.round((body.plannedCu ?? 0) * 100), vacationWeeks: Math.round(vacationWeeks * 100), vacationCmeEnabled: body.vacationCmeEnabled ?? true, adjustedFte: Math.round(adjustedFte * 100), adjustedFteBasisPoints: Math.round(adjustedFte * 10000), adjustedFteEnabled: Boolean(body.adjustedFteEnabled), adjustedFteMethod: method, workedStartDate: body.workedStartDate ?? null, workedEndDate: body.workedEndDate ?? null, weeksNotWorking: Math.round((body.weeksNotWorking ?? 0) * 100), hasOverrides: Boolean(body.hasOverrides), comment:(body.comment ?? "").trim(), planJson: JSON.stringify(body.lines), status, updatedAt:now };
    const [plan] = body.id
      ? await getDb().update(approvedPlans).set(values).where(eq(approvedPlans.id, body.id)).returning()
      : await getDb().insert(approvedPlans).values({...values,createdAt:now}).returning();
    const snapshot={plannedCu:body.plannedCu ?? 0,targetCu:body.targetCu,status,comment:body.comment ?? "",lines:body.lines,adjustedFte,vacationWeeks};
    await getDb().insert(planHistory).values({planId:plan.id,providerKey:body.providerKey ?? null,providerName:body.providerName,division:body.division,actor:"Admin",action:body.id ? "Plan updated" : "Plan created",summary:body.changeSummary ?? (body.id ? "Plan values were revised" : "Plan was saved"),snapshotJson:JSON.stringify(snapshot),createdAt:now});
    return Response.json({ plan: { ...plan, plannedCu: body.plannedCu, vacationWeeks, vacationCmeEnabled: body.vacationCmeEnabled ?? true, adjustedFte, adjustedFteEnabled: Boolean(body.adjustedFteEnabled), adjustedFteMethod: method, workedStartDate: body.workedStartDate ?? null, workedEndDate: body.workedEndDate ?? null, weeksNotWorking: body.weeksNotWorking ?? 0, lines: body.lines } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save plan" }, { status: 500 });
  }
}
