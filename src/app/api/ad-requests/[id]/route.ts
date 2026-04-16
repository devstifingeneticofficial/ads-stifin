import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { syncScheduledAdsToRunning } from "@/lib/ad-status"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await syncScheduledAdsToRunning()

    const { id } = await params
    const isAdmin = session.role === "ADVERTISER" || session.role === "STIFIN"
    const isPromotor = session.role === "PROMOTOR"
    const isCreator = session.role === "KONTEN_KREATOR"
    if (!isAdmin && !isPromotor && !isCreator) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }
    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: {
        promotor: {
          select: isAdmin
            ? { id: true, name: true, email: true, city: true, phone: true }
            : { id: true, name: true, city: true },
        },
        contentCreator: {
          select: isAdmin
            ? { id: true, name: true, email: true }
            : { id: true, name: true },
        },
        adReport: true,
        promotorResult: true,
      },
    })

    if (!adRequest) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    if (isPromotor && adRequest.promotorId !== session.id) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    if (isCreator && adRequest.contentCreatorId !== session.id) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    return NextResponse.json(adRequest)
  } catch (error) {
    console.error("GET ad-request error:", error)
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const data = await req.json()

    const existing = await db.adRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    // Only PROMOTOR can edit, and only if status is MENUNGGU_PEMBAYARAN
    if (session.role === "PROMOTOR") {
      if (existing.status !== "MENUNGGU_PEMBAYARAN") {
        return NextResponse.json({ error: "Pengajuan tidak dapat diedit karena sudah diproses" }, { status: 403 })
      }
      if (existing.promotorId !== session.id) {
        return NextResponse.json({ error: "Anda tidak memiliki akses" }, { status: 403 })
      }

      const totalBudget = data.dailyBudget * data.durationDays
      const ppn = Math.round(totalBudget * 0.11)
      const totalPayment = totalBudget + ppn

      const updated = await db.adRequest.update({
        where: { id },
        data: {
          city: data.city,
          startDate: new Date(data.startDate),
          durationDays: data.durationDays,
          dailyBudget: data.dailyBudget,
          totalBudget,
          ppn,
          totalPayment,
        },
        include: { promotor: true, contentCreator: true, adReport: true, promotorResult: true },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
  } catch (error) {
    console.error("PUT ad-request error:", error)
    return NextResponse.json({ error: "Gagal mengupdate" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.adRequest.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    // Role check
    if (session.role === "PROMOTOR") {
      if (existing.promotorId !== session.id) {
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
      }
      if (existing.status !== "MENUNGGU_PEMBAYARAN") {
        return NextResponse.json({ error: "Hanya pengajuan yang belum dibayar yang dapat dihapus" }, { status: 403 })
      }

      await db.adRequest.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    // STIFIN or other roles could potentially delete, but for now only owner can
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
  } catch (error) {
    console.error("DELETE ad-request error:", error)
    return NextResponse.json({ error: "Gagal menghapus pengajuan" }, { status: 500 })
  }
}
