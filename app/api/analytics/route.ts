import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, offering, conversation, message } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  // Data volume per user is small — fetch the scoped rows and aggregate in JS
  // for clarity over a pile of SQL aggregates.
  const [prospects, offerings, convs, msgs] = await Promise.all([
    db.select({ id: prospect.id }).from(prospect).where(eq(prospect.userId, user.id)),
    db.select({ id: offering.id, name: offering.name }).from(offering).where(eq(offering.userId, user.id)),
    db
      .select({ id: conversation.id, offeringId: conversation.offeringId })
      .from(conversation)
      .where(eq(conversation.userId, user.id)),
    db
      .select({
        conversationId: message.conversationId,
        role: message.role,
        rating: message.rating,
        isFavorite: message.isFavorite,
      })
      .from(message)
      .innerJoin(conversation, eq(message.conversationId, conversation.id))
      .where(eq(conversation.userId, user.id)),
  ]);

  const assistantMsgs = msgs.filter((m) => m.role === "assistant");
  const ratings = assistantMsgs.map((m) => m.rating).filter((r): r is number => r != null);

  // Conversations that received at least one prospect reply
  const repliedConvIds = new Set(
    msgs.filter((m) => m.role === "prospect").map((m) => m.conversationId)
  );

  // Messages generated per offering, for the bar chart
  const convOffering = new Map(convs.map((c) => [c.id, c.offeringId]));
  const usageByOffering = new Map<string, number>();
  for (const m of assistantMsgs) {
    const offId = convOffering.get(m.conversationId);
    if (offId) usageByOffering.set(offId, (usageByOffering.get(offId) ?? 0) + 1);
  }
  const offeringName = new Map(offerings.map((o) => [o.id, o.name]));
  const offeringUsage = [...usageByOffering.entries()]
    .map(([id, count]) => ({ name: offeringName.get(id) ?? "Deleted offering", count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    prospects: prospects.length,
    messages: assistantMsgs.length,
    conversations: convs.length,
    replies: repliedConvIds.size,
    favorites: assistantMsgs.filter((m) => m.isFavorite).length,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    offeringUsage,
  });
}
