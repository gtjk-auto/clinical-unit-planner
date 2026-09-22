import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clinicalTasks } from "../../../db/schema";

const serialize = (row: typeof clinicalTasks.$inferSelect) => ({ ...row, cu: row.cu / 100, days: row.days / 100, serviceWeekDays: row.serviceWeekDays == null ? undefined : row.serviceWeekDays / 100 });

export async function GET() {
  try { return Response.json({tasks:(await getDb().select().from(clinicalTasks)).map(serialize)}); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load tasks" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body=await request.json() as { id?: number; task?: string; cu?: number; days?: number; serviceWeekDays?: number; weekendOnly?: boolean; unit?: string; type?: string; division?: string };
    const task=body.task?.trim(), unit=body.unit?.trim(), type=body.type?.trim(), division=body.division?.trim(), cu=Math.max(.01,body.cu ?? 0), inpatient=type?.toLowerCase().includes("inpatient");
    if (!task || !unit || !type || !division || !cu) return Response.json({error:"Task, CU, unit, type, and division are required"},{status:400});
    const values={task,cu:Math.round(cu*100),days:Math.round((inpatient ? 1 : body.days ?? .5)*100),serviceWeekDays:inpatient ? Math.round(Math.min(7,Math.max(1,body.serviceWeekDays ?? 5))*100) : null,weekendOnly:false,unit:inpatient ? "day" : unit,type,division,updatedAt:new Date().toISOString()};
    const [row]=body.id ? await getDb().update(clinicalTasks).set(values).where(eq(clinicalTasks.id,body.id)).returning() : await getDb().insert(clinicalTasks).values(values).returning();
    return Response.json({task:serialize(row)},{status:201});
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to save task" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const id=Number(new URL(request.url).searchParams.get("id")); if (!id) return Response.json({error:"Task id is required"},{status:400}); await getDb().delete(clinicalTasks).where(eq(clinicalTasks.id,id)); return Response.json({ok:true}); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to delete task" }, { status: 500 }); }
}
