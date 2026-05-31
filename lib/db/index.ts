import dns from "node:dns";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Neon resolves to both IPv4 and IPv6. On networks without working IPv6 routing,
// pg's connect attempts to v6 addresses hang until ETIMEDOUT. Prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

// Persistent pooled connection (same approach as lib/auth.ts). More resilient on
// a long-running Node server than the per-request HTTP fetch of neon-http, which
// was intermittently throwing "fetch failed" under network jitter.
// Singleton-guarded so Next.js hot-reload in dev doesn't spawn a new pool each time.
const globalForDb = globalThis as unknown as { __pool?: Pool };
const pool =
  globalForDb.__pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export const db = drizzle(pool, { schema });
