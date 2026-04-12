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
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Hanya Advertiser yang dapat menjadwalkan" }, { status: 403 })
    }

    const { id } = await params
    const { adStartDate, adEndDate } = await req.json()

    if (!adStartDate || !adEndDate) {
      return NextResponse.json({ error: "Tanggal mulai dan selesai wajib diisi" }, { status: 400 })
    }

    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: { promotor: true },
    })

    if (!adRequest) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    if (adRequest.status !== "KONTEN_SELESAI") {
      return NextResponse.json({ error: "Konten belum selesai, tidak dapat dijadwalkan" }, { status: 400 })
    }

    const updated = await db.adRequest.update({
      where: { id },
      data: { 
        status: "IKLAN_DIJADWALKAN",
        adStartDate: new Date(adStartDate),
        adEndDate: new Date(adEndDate),
      },
      include: { promotor: true },
    })

    // ── Notify Dashboard ─────────────────────────────────────────────────────
    
    await createNotification(
      adRequest.promotorId,
      "Iklan Telah Dijadwalkan",
      `Iklan Anda untuk ${adRequest.city} telah dijadwalkan tayang pada ${new Date(adStartDate).toLocaleDateString("id-ID")}.`,
      "AD_SCHEDULED",
      id
    )

    // ── WhatsApp Notification (Respect Toggle) ──────────────────────────────
    
    const template = await db.notificationTemplate.findUnique({
      where: { slug: "ad-scheduled-promotor" }
    })

    if (updated.promotor.phone && (!template || template.isActive)) {
      const defaultMsg = `Kabar gembira *${updated.promotor.name}*! Iklan Anda untuk kota *${updated.city}* telah dijadwalkan tayang. Silakan pantau perkembangannya!`
      const message = template 
        ? template.message
            .replace(/{promotor}/g, updated.promotor.name)
            .replace(/{city}/g, updated.city)
            .replace(/{kota}/g, updated.city)
            .replace(/{status}/g, "IKLAN DIJADWALKAN")
        : defaultMsg
        
      await sendWhatsApp(updated.promotor.phone, message)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Schedule error:", error)
    return NextResponse.json({ error: "Gagal menjadwalkan" }, { status: 500 })
  }
}
