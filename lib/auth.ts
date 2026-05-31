import dns from "node:dns";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { dash } from "@better-auth/infra";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./auth-schema";

// Neon resolves to IPv4 + IPv6; prefer IPv4 to avoid ETIMEDOUT on networks
// without working IPv6 routing. (See lib/db/index.ts.)
dns.setDefaultResultOrder("ipv4first");

// Singleton-guarded so dev hot-reload doesn't spawn a new pool each time.
const globalForAuth = globalThis as unknown as { __authPool?: Pool };
const pool =
  globalForAuth.__authPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalForAuth.__authPool = pool;

const db = drizzle(pool, { schema });

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
