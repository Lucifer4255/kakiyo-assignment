import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, offering, prompt, conversation, message } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { generateOutreach } from "@/lib/ai/generate";
import type { ProspectProfile } from "@/lib/ai/schema";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { prospectId, offeringId, promptId, tone } = await req.json();
  if (!prospectId || !offeringId || !promptId) {
    return NextResponse.json(
      { error: "prospectId, offeringId, promptId required" },
      { status: 400 }
    );
  }

  // Fetch all three, scoped to the user
  const [[pros], [off], [prm]] = await Promise.all([
    db.select().from(prospect).where(and(eq(prospect.id, prospectId), eq(prospect.userId, user.id))),
    db.select().from(offering).where(and(eq(offering.id, offeringId), eq(offering.userId, user.id))),
    db.select().from(prompt).where(and(eq(prompt.id, promptId), eq(prompt.userId, user.id))),
  ]);

  if (!pros || !off || !prm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!pros.profile) {
    return NextResponse.json({ error: "Prospect not enriched yet" }, { status: 409 });
  }

  // Create the conversation up front so we can return its id
  const conversationId = crypto.randomUUID();
  await db.insert(conversation).values({
    id: conversationId,
    userId: user.id,
    prospectId,
    offeringId,
    promptId,
  });

  const result = generateOutreach({
    systemPrompt: prm.systemPrompt,
    offeringContent: off.content,
    profile: pros.profile as ProspectProfile,
    tone: tone ?? null,
    // Persist the final message server-side after the stream completes (§5.3)
    onFinish: async (text) => {
      await db.insert(message).values({
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: text,
        tone: tone ?? null,
      });
    },
    // If generation fails, drop the empty conversation we created up front so it
    // doesn't linger as a blank card.
    onError: async () => {
      await db.delete(conversation).where(eq(conversation.id, conversationId));
    },
  });

  return result.toTextStreamResponse({
    headers: { "X-Conversation-Id": conversationId },
  });
}
