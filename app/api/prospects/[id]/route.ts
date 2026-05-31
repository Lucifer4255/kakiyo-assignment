import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, prospectSource, conversation, message } from "@/lib/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
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

  const convRows = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.prospectId, id), eq(conversation.userId, user.id)))
    .orderBy(desc(conversation.createdAt));

  // Attach messages to each conversation (oldest first within a thread).
  // Drop empty conversations — a failed generation can leave a row with no
  // messages, which would otherwise render as a blank card.
  const conversations = (
    await Promise.all(
      convRows.map(async (c) => {
        const messages = await db
          .select()
          .from(message)
          .where(eq(message.conversationId, c.id))
          .orderBy(asc(message.createdAt));
        return { ...c, messages };
      })
    )
  ).filter((c) => c.messages.length > 0);

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

  // Verify ownership before cascading
  const [owned] = await db
    .select({ id: prospect.id })
    .from(prospect)
    .where(and(eq(prospect.id, id), eq(prospect.userId, user.id)));
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // No DB-level cascade (FKs are plain columns) — delete children in app code:
  // messages → conversations → sources → prospect.
  const convs = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(eq(conversation.prospectId, id));
  const convIds = convs.map((c) => c.id);
  if (convIds.length) {
    await db.delete(message).where(inArray(message.conversationId, convIds));
    await db.delete(conversation).where(eq(conversation.prospectId, id));
  }
  await db.delete(prospectSource).where(eq(prospectSource.prospectId, id));
  await db.delete(prospect).where(eq(prospect.id, id));

  return NextResponse.json({ ok: true });
}
