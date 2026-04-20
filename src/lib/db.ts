import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma for serverless environments (Vercel, Cloudflare)
const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {}

// Add connection pooling for serverless if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  // Prisma automatically uses connection pooling when needed
  // But we can tune it for serverless with shorter timeouts
  if (process.env.DATABASE_URL.includes("postgresql") || process.env.DATABASE_URL.includes("mysql")) {
    // For TCP databases, the URL might already include connection params
    // Prisma handles pooling automatically
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...prismaClientOptions,
    log:
      process.env.NODE_ENV === "development"
        ? [
            {
              emit: "stdout",
              level: "query",
            },
          ]
        : undefined,
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
