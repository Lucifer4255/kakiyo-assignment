import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { message, conversation } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

// Ensure the message belongs to a conversation owned by the user
async function ownedMessage(messageId: string, userId: string) {
  const [row] = await db
    .select({ id: message.id, conversationId: message.conversationId })
    .from(message)
    .innerJoin(conversation, eq(message.conversationId, conversation.id))
    .where(and(eq(message.id, messageId), eq(conversation.userId, userId)));
  return row;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  if (!(await ownedMessage(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.rating !== undefined) updates.rating = body.rating;
  if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;

  const [row] = await db.update(message).set(updates).where(eq(message.id, id)).returning();
  return NextResponse.json(row);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const owned = await ownedMessage(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(message).where(eq(message.id, id));

  // If no real (non-inherited) messages remain, remove the now-empty conversation
  // so it doesn't linger as a blank card. Inherited branch-prefix copies don't count.
  const remaining = await db
    .select({ id: message.id })
    .from(message)
    .where(and(eq(message.conversationId, owned.conversationId), eq(message.inherited, false)));
  if (remaining.length === 0) {
    await db.delete(message).where(eq(message.conversationId, owned.conversationId));
    await db.delete(conversation).where(eq(conversation.id, owned.conversationId));
  }

  return NextResponse.json({ ok: true });
}
