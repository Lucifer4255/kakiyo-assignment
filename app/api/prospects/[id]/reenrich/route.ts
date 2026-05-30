import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { runEnrichment } from "@/lib/enrichment/run";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(prospect)
    .where(and(eq(prospect.id, id), eq(prospect.userId, user.id)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  runEnrichment(id).catch(console.error);

  return NextResponse.json({ ok: true });
}
