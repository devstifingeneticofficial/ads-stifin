import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyRole } from "@/lib/notifications"
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
      },
      include: { promotor: true },
    })

    // 1. Notify advertiser: bukti pembayaran sudah diupload, menunggu verifikasi.
    await notifyRole(
      "ADVERTISER",
      "Bukti Pembayaran Masuk",
      `${updated.promotor.name} dari ${updated.city} sudah upload bukti bayar. Mohon verifikasi pembayaran.`,
      "PAYMENT_PROOF_UPLOADED",
      id
    )

    // ── Send WhatsApp Notifications ──────────────────────────────────────────
    
    // Ambil template dari DB
    const templateAdvertiser = await db.notificationTemplate.findUnique({ where: { slug: "payment-confirmed-advertiser" } })

    const replaceVars = (text: string) => {
      return text
        .replace(/{promotor}/g, updated.promotor.name)
        .replace(/{city}/g, updated.city)
        .replace(/{kota}/g, updated.city)
        .replace(/{status}/g, "MENUNGGU VERIFIKASI PEMBAYARAN")
    }

    // 2. WhatsApp to Promotor
    if (updated.promotor.phone) {
      const message = `Halo *${updated.promotor.name}*, bukti pembayaran iklan untuk kota *${updated.city}* sudah kami terima. Saat ini status: *MENUNGGU VERIFIKASI PEMBAYARAN* oleh Advertiser.`
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
