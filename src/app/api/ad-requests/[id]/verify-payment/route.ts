import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { sendWhatsApp } from "@/lib/whatsapp"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { id } = await params

    const adRequest = await db.adRequest.findUnique({ 
      where: { id },
      include: { promotor: true }
    })
    
    if (!adRequest) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    if (adRequest.status !== "MENUNGGU_PEMBAYARAN") {
      return NextResponse.json({ error: "Status pengajuan tidak valid" }, { status: 400 })
    }

    const updated = await db.adRequest.update({
      where: { id },
      data: {
        status: "MENUNGGU_KONTEN",
      },
      include: { promotor: true },
    })

    // 1. Notify konten kreator via Dashboard
    const creators = await db.user.findMany({ where: { role: "KONTEN_KREATOR" } })
    for (const creator of creators) {
      await createNotification(
        creator.id,
        "Pengajuan Iklan Baru",
        `${updated.promotor.name} dari ${updated.city} mengajukan iklan baru. Siap diproses!`,
        "AD_REQUEST",
        id
      )
    }

    // ── Send WhatsApp Notifications ──────────────────────────────────────────
    
    // Ambil template dari DB
    const templatePromotor = await db.notificationTemplate.findUnique({ where: { slug: "payment-confirmed-promotor" } })

    const replaceVars = (text: string) => {
      return text
        .replace(/{promotor}/g, updated.promotor.name)
        .replace(/{city}/g, updated.city)
        .replace(/{kota}/g, updated.city)
        .replace(/{status}/g, "MENUNGGU KONTEN")
    }

    // 2. WhatsApp to Promotor (Check if active)
    if (updated.promotor.phone && (!templatePromotor || templatePromotor.isActive)) {
      const defaultMsg = `Halo *${updated.promotor.name}*, Pembayaran iklan Anda untuk kota *${updated.city}* telah divalidasi oleh Advertiser. Status: *MENUNGGU KONTEN*. Terimakasih!`
      const message = templatePromotor ? replaceVars(templatePromotor.message) : defaultMsg
      await sendWhatsApp(updated.promotor.phone || "", message)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Verify payment error:", error)
    return NextResponse.json({ error: "Gagal memverifikasi pembayaran" }, { status: 500 })
  }
}
