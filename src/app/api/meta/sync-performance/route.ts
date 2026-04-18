import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { syncMetaPerformance } from "@/lib/meta-ads"

export async function POST() {
  try {
    const session = await getSession()
    if (!session || !["ADVERTISER", "STIFIN", "PROMOTOR"].includes(session.role)) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const result = await syncMetaPerformance()
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal sinkron performa Meta" },
      { status: 500 }
    )
  }
}
