import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const LEGACY_NOTE_PREFIX = "[LEGACY_META]"

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

    const promotor = await db.user.findUnique({
      where: { id: promotorId },
      select: { id: true, name: true, role: true, city: true },
    })

    if (!promotor || promotor.role !== "PROMOTOR") {
      return NextResponse.json({ ok: false, error: "Promotor tidak valid" }, { status: 400 })
    }

    const hasManualDuration = Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
    const hasManualClients = Number.isFinite(totalClientsRaw) && totalClientsRaw >= 0

    const durationDays = hasManualDuration ? Math.max(1, durationDaysRaw) : 1
    const manualClients = hasManualClients ? Math.max(0, totalClientsRaw) : null

    const created = await db.adRequest.create({
      data: {
        city: promotor.city || "Pending Meta Sync",
        startDate: new Date(),
        testEndDate: null,
        durationDays,
        dailyBudget: 0,
        totalBudget: 0,
        ppn: 0,
        totalPayment: 0,
        status: "FINAL",
        briefType: "LEGACY_IMPORT",
        briefContent: "Imported historical campaign from advertiser dashboard",
        promotorNote: `${LEGACY_NOTE_PREFIX} imported_at=${new Date().toISOString()} manual_duration=${hasManualDuration ? durationDays : ""} manual_clients=${manualClients ?? ""}`,
        promotorId: promotor.id,
      },
      select: {
        id: true,
        city: true,
        startDate: true,
        promotor: { select: { name: true } },
      },
    })

    if (manualClients !== null) {
      await db.promotorResult.upsert({
        where: { adRequestId: created.id },
        update: {
          totalClients: manualClients,
          status: "VALID",
          note: "Legacy import by advertiser",
        },
        create: {
          adRequestId: created.id,
          totalClients: manualClients,
          status: "VALID",
          note: "Legacy import by advertiser",
        },
      })
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        promotorName: created.promotor.name,
        city: created.city,
        startDate: created.startDate,
        manualDuration: hasManualDuration ? durationDays : null,
        manualClients,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal membuat item import historis" },
      { status: 500 }
    )
  }
}
