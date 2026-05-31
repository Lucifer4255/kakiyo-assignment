import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, offering, prompt, conversation, message } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { generateOutreach, generateReply } from "@/lib/ai/generate";
import type { ProspectProfile } from "@/lib/ai/schema";

// Branch a conversation from a chosen assistant message, re-toned.
// Copies every message BEFORE the chosen one into a new conversation, then
// regenerates that message with the requested tone — opener via generateOutreach,
// mid-thread via generateReply (the copied prefix becomes the history).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { fromMessageId, tone, toneLabel } = await req.json();
  if (!fromMessageId || !tone) {
    return NextResponse.json({ error: "fromMessageId and tone required" }, { status: 400 });
  }

  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, user.id)));
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [[pros], [off], [prm], msgs] = await Promise.all([
    db.select().from(prospect).where(eq(prospect.id, conv.prospectId)),
    db.select().from(offering).where(eq(offering.id, conv.offeringId)),
    db.select().from(prompt).where(eq(prompt.id, conv.promptId)),
    db.select().from(message).where(eq(message.conversationId, id)).orderBy(asc(message.createdAt)),
  ]);
  if (!pros?.profile || !off || !prm) {
    return NextResponse.json({ error: "Conversation context missing" }, { status: 409 });
  }

  const idx = msgs.findIndex((m) => m.id === fromMessageId);
  if (idx === -1) return NextResponse.json({ error: "Message not in conversation" }, { status: 404 });
  if (msgs[idx].role !== "assistant") {
    return NextResponse.json({ error: "Can only branch from an assistant message" }, { status: 400 });
  }

  const prefix = msgs.slice(0, idx); // everything before the message being re-toned

  // Create the branch conversation up front so we can stream into it.
  const branchId = crypto.randomUUID();
  await db.insert(conversation).values({
    id: branchId,
    userId: user.id,
    prospectId: conv.prospectId,
    offeringId: conv.offeringId,
    promptId: conv.promptId,
    parentId: conv.id,
    branchFromMessageId: fromMessageId,
    branchTone: toneLabel ?? tone,
  });

  // Copy the prefix verbatim, preserving order via original timestamps.
  if (prefix.length) {
    await db.insert(message).values(
      prefix.map((m) => ({
        id: crypto.randomUUID(),
        conversationId: branchId,
        role: m.role,
        content: m.content,
        tone: m.tone,
        inherited: true,
        createdAt: m.createdAt,
      }))
    );
  }

  const profile = pros.profile as ProspectProfile;
  const onFinish = async (text: string) => {
    await db.insert(message).values({
      id: crypto.randomUUID(),
      conversationId: branchId,
      role: "assistant",
      content: text,
      tone: toneLabel ?? tone,
    });
  };
  const onError = async () => {
    await db.delete(message).where(eq(message.conversationId, branchId));
    await db.delete(conversation).where(eq(conversation.id, branchId));
  };

  // Opener (nothing before it) → cold generation; otherwise continue the prefix.
  const result =
    prefix.length === 0
      ? generateOutreach({
          systemPrompt: prm.systemPrompt,
          offeringContent: off.content,
          profile,
          tone,
          onFinish,
          onError,
        })
      : generateReply({
          systemPrompt: prm.systemPrompt,
          offeringContent: off.content,
          profile,
          thread: prefix.map((m) => ({
            role: m.role as "assistant" | "prospect",
            content: m.content,
          })),
          tone,
          onFinish,
          onError,
        });

  return result.toTextStreamResponse({ headers: { "X-Conversation-Id": branchId } });
}
