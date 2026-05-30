import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prompt } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.userId, user.id)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const body = await req.json();

  if (body.isDefault) {
    await db.update(prompt).set({ isDefault: false }).where(eq(prompt.userId, user.id));
  }

  const allowed = ["name", "systemPrompt", "isDefault"] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];

  const [row] = await db
    .update(prompt)
    .set(updates)
    .where(and(eq(prompt.id, id), eq(prompt.userId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  await db.delete(prompt).where(and(eq(prompt.id, id), eq(prompt.userId, user.id)));
  return NextResponse.json({ ok: true });
}
