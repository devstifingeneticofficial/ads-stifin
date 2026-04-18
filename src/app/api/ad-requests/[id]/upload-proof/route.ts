import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification, notifyRole } from "@/lib/notifications"
import { sendWhatsApp } from "@/lib/whatsapp"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

const CREATOR_ROTATION_KEY = "content_creator_rotation_index"

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

    if (!["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(adRequest.status)) {
      return NextResponse.json({ error: "Status pengajuan tidak valid" }, { status: 400 })
    }

    const updated = await db.$transaction(async (tx) => {
      const creators = await tx.user.findMany({
        where: { role: "KONTEN_KREATOR" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
      if (creators.length === 0) {
        throw new Error("Kreator tidak tersedia")
      }

      const enabledSetting = await tx.systemSetting.findUnique({
        where: { key: USER_ENABLED_SETTING_KEY },
      })
      const enabledMap = parseUserEnabledMap(enabledSetting?.value)
      const availableCreators = creators.filter((creator) => isUserEnabled(enabledMap, creator.id))
      if (availableCreators.length === 0) {
        throw new Error("Kreator aktif tidak tersedia")
      }

      const rotation = await tx.systemSetting.findUnique({
        where: { key: CREATOR_ROTATION_KEY },
      })
      const lastIndexRaw = Number.parseInt(rotation?.value || "-1", 10)
      const lastIndex = Number.isNaN(lastIndexRaw) ? -1 : lastIndexRaw
      const nextIndex = (lastIndex + 1) % availableCreators.length
      const assignedCreator = availableCreators[nextIndex]

      const ad = await tx.adRequest.update({
        where: { id },
        data: {
          paymentProofUrl,
          status: "MENUNGGU_KONTEN",
          contentCreatorId: assignedCreator.id,
        },
        include: { promotor: true, contentCreator: true },
      })

      await tx.systemSetting.upsert({
        where: { key: CREATOR_ROTATION_KEY },
        update: { value: String(nextIndex) },
        create: {
          key: CREATOR_ROTATION_KEY,
          value: String(nextIndex),
        },
      })

      return ad
    })

    if (updated.contentCreatorId) {
      await createNotification(
        updated.contentCreatorId,
        "Pengajuan Iklan Baru",
        `${updated.promotor.name} dari ${updated.city} mengajukan iklan baru. Ditugaskan untuk Anda.`,
        "AD_REQUEST",
        id
      )
    }

    await notifyRole(
      "ADVERTISER",
      "Pembayaran Diproses Otomatis",
      `${updated.promotor.name} dari ${updated.city} sudah upload bukti bayar. Status otomatis lanjut ke Menunggu Konten.`,
      "PAYMENT_PROCESSED_AUTO",
      id
    )

    // ── Send WhatsApp Notifications ──────────────────────────────────────────
    
    // Ambil template dari DB
    const templatePromotor = await db.notificationTemplate.findUnique({ where: { slug: "payment-confirmed-promotor" } })
    const templateAdvertiser = await db.notificationTemplate.findUnique({ where: { slug: "payment-confirmed-advertiser" } })

    const replaceVars = (text: string) => {
      return text
        .replace(/{promotor}/g, updated.promotor.name)
        .replace(/{city}/g, updated.city)
        .replace(/{kota}/g, updated.city)
        .replace(/{status}/g, "MENUNGGU KONTEN")
    }

    // 2. WhatsApp to Promotor
    if (updated.promotor.phone && (!templatePromotor || templatePromotor.isActive)) {
      const defaultMsg = `Halo *${updated.promotor.name}*, bukti pembayaran iklan untuk kota *${updated.city}* sudah kami terima. Status sekarang: *MENUNGGU KONTEN* dan sedang diproses oleh tim kreator.`
      const message = templatePromotor ? replaceVars(templatePromotor.message) : defaultMsg
      await sendWhatsApp(updated.promotor.phone, message)
    }

    // 3. WhatsApp to Advertiser(s) (Check if active)
    if (!templateAdvertiser || templateAdvertiser.isActive) {
      const advertisers = await db.user.findMany({
        where: { role: "ADVERTISER", phone: { not: null } }
      })

      for (const adv of advertisers) {
        const defaultMsg = `*NOTIFIKASI PEMBAYARAN*\n\nPromotor *${updated.promotor.name}* telah mengunggah bukti bayar untuk iklan *${updated.city}*.\n\nStatus: Menunggu Konten (diproses otomatis)\nSegera cek dashboard untuk monitoring.`
        const message = templateAdvertiser ? replaceVars(templateAdvertiser.message) : defaultMsg
        await sendWhatsApp(adv.phone || "", message)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === "Kreator tidak tersedia") {
      return NextResponse.json({ error: "Belum ada Konten Kreator aktif. Tambahkan kreator terlebih dahulu." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "Kreator aktif tidak tersedia") {
      return NextResponse.json({ error: "Semua Konten Kreator sedang OFF. Aktifkan dari tab User terlebih dahulu." }, { status: 400 })
    }

    console.error("Upload proof error:", error)
    return NextResponse.json({ error: "Gagal upload bukti" }, { status: 500 })
  }
}
