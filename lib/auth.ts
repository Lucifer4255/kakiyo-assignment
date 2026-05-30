import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { dash } from "@better-auth/infra";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./auth-schema";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
  schema,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "",
  ].filter(Boolean),
  emailAndPassword: { enabled: true },
  plugins: [dash({ apiKey: process.env.BETTER_AUTH_API_KEY })],
});
