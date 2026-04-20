import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * Database health check endpoint
 * GET /api/health/db
 *
 * Returns:
 * - 200: Database is healthy
 * - 503: Database connection failed
 */
export async function GET() {
  try {
    const envCheck = {
      databaseUrlSet: !!process.env.DATABASE_URL,
      databaseUrlProvided: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "NOT SET",
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }

    console.log("[HEALTH] Database health check started", envCheck)

    // Try to query the database with a simple count
    const userCount = await db.user.count()

    console.log("[HEALTH] Database query successful. User count:", userCount)

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      userCount,
      environment: envCheck,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL ? "configured" : "NOT SET",
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }

    console.error("[HEALTH] Database health check failed", errorDetails)

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: "Database connection failed",
        details: errorDetails,
      },
      { status: 503 }
    )
  }
}
