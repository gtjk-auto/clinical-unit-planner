import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { providers } from "../../../db/schema";

const serialize = (row: typeof providers.$inferSelect) => ({ ...row, effort: row.clinicalEffortBasisPoints / 100, adjustedFte: row.adjustedFteBasisPoints / 10000 });

export async function GET() {
  try { return Response.json({ providers: (await getDb().select().from(providers)).map(serialize) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load providers" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body=await request.json() as { id?: number; providerKey?: string; name?: string; division?: string; effort?: number; adjustedFteEnabled?: boolean; adjustedFte?: number };
    const providerKey=body.providerKey?.trim(), name=body.name?.trim(), division=body.division?.trim(), effort=Math.min(100,Math.max(0,body.effort ?? 0)), adjustedFte=Math.min(1,Math.max(0,body.adjustedFte ?? 1));
    if (!providerKey || !name || !division || body.effort == null || !Number.isFinite(body.effort)) return Response.json({ error: "Provider ID, name, division, and clinical effort are required" },{status:400});
    const values={providerKey,name,division,clinicalEffortBasisPoints:Math.round(effort*100),adjustedFteEnabled:Boolean(body.adjustedFteEnabled),adjustedFteBasisPoints:Math.round(adjustedFte*10000),updatedAt:new Date().toISOString()};
    const [row]=body.id ? await getDb().update(providers).set(values).where(eq(providers.id,body.id)).returning() : await getDb().insert(providers).values(values).onConflictDoUpdate({target:providers.providerKey,set:values}).returning();
    return Response.json({provider:serialize(row)},{status:201});
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to save provider" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const id=Number(new URL(request.url).searchParams.get("id")); if (!id) return Response.json({error:"Provider id is required"},{status:400}); await getDb().delete(providers).where(eq(providers.id,id)); return Response.json({ok:true}); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to delete provider" }, { status: 500 }); }
}
