import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { executeLegacyImportByPromotor } from "@/lib/meta-legacy-import"

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || !["ADVERTISER", "STIFIN"].includes(session.role)) {
      return NextResponse.json({ ok: false, error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const promotorId = typeof body.promotorId === "string" ? body.promotorId.trim() : ""
    const durationDaysRaw = Number.parseInt(String(body.durationDays ?? ""), 10)
    const totalClientsRaw = Number.parseInt(String(body.totalClients ?? ""), 10)

    if (!promotorId) {
      return NextResponse.json({ ok: false, error: "Promotor wajib dipilih" }, { status: 400 })
    }

    const result = await executeLegacyImportByPromotor({
      promotorId,
      durationDays: Number.isFinite(durationDaysRaw) && durationDaysRaw > 0 ? durationDaysRaw : null,
      totalClients: Number.isFinite(totalClientsRaw) && totalClientsRaw >= 0 ? totalClientsRaw : null,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal eksekusi import historis" },
      { status: 500 }
    )
  }
}
