import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const key = url.searchParams.get("key")
    const expected = process.env.DB_CHECK_KEY

    if (!expected || key !== expected) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const { db } = await import("@/lib/db")

    const nowRows = await db.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`
    const usersRows = await db.$queryRaw<Array<{ count: bigint | number }>>`SELECT COUNT(*)::bigint as count FROM "User"`

    const usersCountRaw = usersRows[0]?.count ?? 0
    const usersCount = typeof usersCountRaw === "bigint" ? Number(usersCountRaw) : Number(usersCountRaw)

    return NextResponse.json({
      ok: true,
      dbConnected: true,
      serverTime: nowRows[0]?.now ?? null,
      usersCount,
      workerTime: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        dbConnected: false,
        error: error?.message || "DB check gagal",
        code: error?.code || null,
      },
      { status: 500 },
    )
  }
}
