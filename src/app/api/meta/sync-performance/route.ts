import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { syncMetaPerformance } from "@/lib/meta-ads"
import { db } from "@/lib/db"

const META_SYNC_LAST_SUCCESS_KEY = "meta_sync_last_success_v1"
const META_SYNC_LAST_ERROR_KEY = "meta_sync_last_error_v1"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !["ADVERTISER", "STIFIN", "PROMOTOR"].includes(session.role)) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const [lastSuccess, lastError] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: META_SYNC_LAST_SUCCESS_KEY } }),
      db.systemSetting.findUnique({ where: { key: META_SYNC_LAST_ERROR_KEY } }),
    ])

    return NextResponse.json({
      ok: true,
      lastSuccess: lastSuccess?.value ? JSON.parse(lastSuccess.value) : null,
      lastError: lastError?.value ? JSON.parse(lastError.value) : null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal mengambil status sinkron Meta" },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session || !["ADVERTISER", "STIFIN", "PROMOTOR"].includes(session.role)) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const result = await syncMetaPerformance()
    await db.systemSetting.upsert({
      where: { key: META_SYNC_LAST_SUCCESS_KEY },
      update: {
        value: JSON.stringify({
          at: new Date().toISOString(),
          ...result,
        }),
      },
      create: {
        key: META_SYNC_LAST_SUCCESS_KEY,
        value: JSON.stringify({
          at: new Date().toISOString(),
          ...result,
        }),
      },
    })
    await db.systemSetting.upsert({
      where: { key: META_SYNC_LAST_ERROR_KEY },
      update: { value: JSON.stringify({ at: new Date().toISOString(), error: null }) },
      create: { key: META_SYNC_LAST_ERROR_KEY, value: JSON.stringify({ at: new Date().toISOString(), error: null }) },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    await db.systemSetting.upsert({
      where: { key: META_SYNC_LAST_ERROR_KEY },
      update: {
        value: JSON.stringify({
          at: new Date().toISOString(),
          error: error?.message || "Gagal sinkron performa Meta",
        }),
      },
      create: {
        key: META_SYNC_LAST_ERROR_KEY,
        value: JSON.stringify({
          at: new Date().toISOString(),
          error: error?.message || "Gagal sinkron performa Meta",
        }),
      },
    })

    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal sinkron performa Meta" },
      { status: 500 }
    )
  }
}
