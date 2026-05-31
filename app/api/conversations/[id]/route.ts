import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversation, message } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, user.id)));

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, id))
    .orderBy(asc(message.createdAt));

  return NextResponse.json({ ...conv, messages });
}
