import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prompt } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const rows = await db
    .select()
    .from(prompt)
    .where(eq(prompt.userId, user.id))
    .orderBy(prompt.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { name, systemPrompt, isDefault } = await req.json();
  if (!name || !systemPrompt) {
    return NextResponse.json({ error: "name and systemPrompt required" }, { status: 400 });
  }

  if (isDefault) {
    await db.update(prompt).set({ isDefault: false }).where(eq(prompt.userId, user.id));
  }

  const [row] = await db
    .insert(prompt)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name,
      systemPrompt,
      isDefault: isDefault ?? false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
