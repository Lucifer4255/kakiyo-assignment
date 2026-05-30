import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      user: null as never,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: session.user, error: null };
}
