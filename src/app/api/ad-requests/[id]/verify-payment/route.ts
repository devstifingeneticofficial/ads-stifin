import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { sendWhatsApp } from "@/lib/whatsapp"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

const CREATOR_ROTATION_KEY = "content_creator_rotation_index"

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

    // 1. Notify assigned konten kreator via Dashboard
    if (updated.contentCreatorId) {
      await createNotification(
        updated.contentCreatorId,
        "Pengajuan Iklan Baru",
        `${updated.promotor.name} dari ${updated.city} mengajukan iklan baru. Ditugaskan untuk Anda.`,
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
    if (error instanceof Error && error.message === "Kreator tidak tersedia") {
      return NextResponse.json({ error: "Belum ada Konten Kreator aktif. Tambahkan kreator terlebih dahulu." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "Kreator aktif tidak tersedia") {
      return NextResponse.json({ error: "Semua Konten Kreator sedang OFF. Aktifkan dari tab User terlebih dahulu." }, { status: 400 })
    }

    console.error("Verify payment error:", error)
    return NextResponse.json({ error: "Gagal memverifikasi pembayaran" }, { status: 500 })
  }
}
