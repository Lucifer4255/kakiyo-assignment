import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospect, prospectSource } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { runEnrichment } from "@/lib/enrichment/run";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const rows = await db
    .select()
    .from(prospect)
    .where(eq(prospect.userId, user.id))
    .orderBy(prospect.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { name, sources = [], screenshots = [] } = body as {
    name: string;
    sources?: { type: string; value?: string }[];
    screenshots?: string[];
  };

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const prospectId = crypto.randomUUID();

  const [row] = await db
    .insert(prospect)
    .values({ id: prospectId, userId: user.id, name, enrichmentStatus: "pending" })
    .returning();

  const dbSources = sources.map((s) => ({
    id: crypto.randomUUID(),
    prospectId,
    type: s.type,
    value: s.value ?? null,
    rawExtracted: null,
  }));

  const screenshotSources = screenshots.map(() => ({
    id: crypto.randomUUID(),
    prospectId,
    type: "linkedin_screenshot" as const,
    value: null,
    rawExtracted: null,
  }));

  const allSources = [...dbSources, ...screenshotSources];
  if (allSources.length > 0) {
    await db.insert(prospectSource).values(allSources);
  }

  // Fire-and-forget enrichment
  runEnrichment(prospectId, screenshots).catch(console.error);

  return NextResponse.json(row, { status: 201 });
}
