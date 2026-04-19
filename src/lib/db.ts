import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  const effectiveConnectionString =
    connectionString || "postgresql://build:build@127.0.0.1:5432/build_db?connect_timeout=1"

  // Important for Cloudflare Workers Builds:
  // build-time page data collection may import this module before secrets are injected.
  // For engineType="client", Prisma still requires an adapter at init time.
  // So when DATABASE_URL is missing during build, we initialize a dummy adapter
  // and avoid failing at import time.

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: effectiveConnectionString,
      ssl: effectiveConnectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool
  }

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
