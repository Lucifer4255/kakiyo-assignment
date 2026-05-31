import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, offering, prompt, conversation, message } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { generateReply } from "@/lib/ai/generate";
import type { ProspectProfile } from "@/lib/ai/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { reply } = await req.json();
  if (!reply?.trim()) {
    return NextResponse.json({ error: "reply text required" }, { status: 400 });
  }

  // Load the conversation (scoped to the user) — it carries the offering/prompt/prospect.
  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, user.id)));
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [[pros], [off], [prm], existing] = await Promise.all([
    db.select().from(prospect).where(eq(prospect.id, conv.prospectId)),
    db.select().from(offering).where(eq(offering.id, conv.offeringId)),
    db.select().from(prompt).where(eq(prompt.id, conv.promptId)),
    db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(asc(message.createdAt)),
  ]);

  if (!pros?.profile || !off || !prm) {
    return NextResponse.json({ error: "Conversation context missing" }, { status: 409 });
  }

  // Persist the prospect's pasted reply as part of the thread.
  await db.insert(message).values({
    id: crypto.randomUUID(),
    conversationId: id,
    role: "prospect",
    content: reply.trim(),
  });

  // Full thread (history + the new reply) becomes the message history for the model.
  const thread = [
    ...existing.map((m) => ({
      role: m.role as "assistant" | "prospect",
      content: m.content,
    })),
    { role: "prospect" as const, content: reply.trim() },
  ];

  const result = generateReply({
    systemPrompt: prm.systemPrompt,
    offeringContent: off.content,
    profile: pros.profile as ProspectProfile,
    thread,
    onFinish: async (text) => {
      await db.insert(message).values({
        id: crypto.randomUUID(),
        conversationId: id,
        role: "assistant",
        content: text,
      });
    },
  });

  return result.toTextStreamResponse();
}
