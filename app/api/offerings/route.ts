import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offering } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const rows = await db
    .select()
    .from(offering)
    .where(eq(offering.userId, user.id))
    .orderBy(offering.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { name, content, sourceUrl } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }

  const [row] = await db
    .insert(offering)
    .values({ id: crypto.randomUUID(), userId: user.id, name, content, sourceUrl: sourceUrl ?? null })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
