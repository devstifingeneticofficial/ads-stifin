import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { findLegacyCampaignCandidatesByPromotor } from "@/lib/meta-legacy-import"

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || !["ADVERTISER", "STIFIN"].includes(session.role)) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const promotorId = typeof body.promotorId === "string" ? body.promotorId.trim() : ""
    if (!promotorId) {
      return NextResponse.json({ ok: false, error: "Promotor wajib dipilih" }, { status: 400 })
    }

    const candidates = await findLegacyCampaignCandidatesByPromotor(promotorId)
    return NextResponse.json({
      ok: true,
      count: candidates.length,
      campaigns: candidates.slice(0, 50).map((item) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        startDate: item.startDate,
        endDate: item.endDate,
        durationDays: item.durationDays,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal preview campaign historis" },
      { status: 500 }
    )
  }
}
