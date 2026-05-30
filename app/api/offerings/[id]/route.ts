import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offering } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(offering)
    .where(and(eq(offering.id, id), eq(offering.userId, user.id)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const body = await req.json();
  const allowed = ["name", "content"] as const;
  const updates: Partial<Record<(typeof allowed)[number], string>> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];

  const [row] = await db
    .update(offering)
    .set(updates)
    .where(and(eq(offering.id, id), eq(offering.userId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  await db
    .delete(offering)
    .where(and(eq(offering.id, id), eq(offering.userId, user.id)));

  return NextResponse.json({ ok: true });
}
