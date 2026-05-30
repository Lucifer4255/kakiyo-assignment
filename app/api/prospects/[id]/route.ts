import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, prospectSource, conversation, message } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(prospect)
    .where(and(eq(prospect.id, id), eq(prospect.userId, user.id)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sources = await db
    .select()
    .from(prospectSource)
    .where(eq(prospectSource.prospectId, id));

  const conversations = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.prospectId, id), eq(conversation.userId, user.id)));

  return NextResponse.json({ ...row, sources, conversations });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.profile !== undefined) updates.profile = body.profile;

  const [row] = await db
    .update(prospect)
    .set(updates)
    .where(and(eq(prospect.id, id), eq(prospect.userId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  await db
    .delete(prospect)
    .where(and(eq(prospect.id, id), eq(prospect.userId, user.id)));

  return NextResponse.json({ ok: true });
}
