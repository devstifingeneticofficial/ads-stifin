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
    if (!session || session.role !== "PROMOTOR") {
      return NextResponse.json({ error: "Hanya Promotor yang dapat upload bukti" }, { status: 403 })
    }

    const { id } = await params
    const { paymentProofUrl } = await req.json()

    if (!paymentProofUrl) {
      return NextResponse.json({ error: "Bukti transfer wajib diupload" }, { status: 400 })
    }

    const adRequest = await db.adRequest.findUnique({ 
      where: { id },
      include: { promotor: true }
    })
    
    if (!adRequest || adRequest.promotorId !== session.id) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    if (adRequest.status !== "MENUNGGU_PEMBAYARAN") {
      return NextResponse.json({ error: "Status pengajuan tidak valid" }, { status: 400 })
    }

    const updated = await db.adRequest.update({
      where: { id },
      data: {
        paymentProofUrl,
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
    const templateAdvertiser = await db.notificationTemplate.findUnique({ where: { slug: "payment-confirmed-advertiser" } })

    const replaceVars = (text: string) => {
      return text
        .replace(/{promotor}/g, updated.promotor.name)
        .replace(/{kota}/g, updated.city)
        .replace(/{status}/g, "MENUNGGU KONTEN")
    }

    // 2. WhatsApp to Promotor (Check if active)
    if (updated.promotor.phone && (!templatePromotor || templatePromotor.isActive)) {
      const defaultMsg = `Halo *${updated.promotor.name}*, Pembayaran iklan Anda untuk kota *${updated.city}* telah diterima. Status: *MENUNGGU KONTEN*. Terimakasih!`
      const message = templatePromotor ? replaceVars(templatePromotor.message) : defaultMsg
      await sendWhatsApp(updated.promotor.phone, message)
    }

    // 3. WhatsApp to Advertiser(s) (Check if active)
    if (!templateAdvertiser || templateAdvertiser.isActive) {
      const advertisers = await db.user.findMany({
        where: { role: "ADVERTISER", phone: { not: null } }
      })

      for (const adv of advertisers) {
        const defaultMsg = `*NOTIFIKASI PEMBAYARAN*\n\nPromotor *${updated.promotor.name}* telah mengunggah bukti bayar untuk iklan *${updated.city}*.\n\nStatus: Menunggu Konten\nSegera cek dashboard Anda untuk detailnya.`
        const message = templateAdvertiser ? replaceVars(templateAdvertiser.message) : defaultMsg
        await sendWhatsApp(adv.phone || "", message)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Upload proof error:", error)
    return NextResponse.json({ error: "Gagal upload bukti" }, { status: 500 })
  }
}
