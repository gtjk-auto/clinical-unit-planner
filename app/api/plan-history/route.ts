import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { planHistory } from "../../../db/schema";

export async function GET(request: Request) {
  try { const planId=Number(new URL(request.url).searchParams.get("planId")), db=getDb(); const rows=planId ? await db.select().from(planHistory).where(eq(planHistory.planId,planId)).orderBy(desc(planHistory.createdAt),desc(planHistory.id)).limit(100) : await db.select().from(planHistory).orderBy(desc(planHistory.createdAt),desc(planHistory.id)).limit(1000); return Response.json({history:rows.map(row => ({...row,snapshot:JSON.parse(row.snapshotJson)}))}); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load plan history" }, { status: 500 }); }
}
