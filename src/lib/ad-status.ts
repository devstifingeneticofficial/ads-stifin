import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

export async function syncScheduledAdsToRunning() {
  const now = new Date()

  const scheduledAds = await db.adRequest.findMany({
    where: {
      status: "IKLAN_DIJADWALKAN",
      adStartDate: { lte: now },
    },
    select: {
      id: true,
      city: true,
      promotorId: true,
    },
  })

  if (scheduledAds.length === 0) return

  for (const ad of scheduledAds) {
    const updated = await db.adRequest.updateMany({
      where: {
        id: ad.id,
        status: "IKLAN_DIJADWALKAN",
      },
      data: { status: "IKLAN_BERJALAN" },
    })

    if (updated.count === 0) continue

    await createNotification(
      ad.promotorId,
      "Iklan Sedang Berjalan",
      `Iklan Anda untuk ${ad.city} kini telah aktif dan sedang berjalan.`,
      "AD_RUNNING",
      ad.id
    )
  }

  // Auto-close ads that have passed end date, even if Meta toggle still looks ON.
  const finishedAds = await db.adRequest.findMany({
    where: {
      status: "IKLAN_BERJALAN",
      adEndDate: { lte: now },
    },
    select: {
      id: true,
      city: true,
      promotorId: true,
    },
  })

  if (finishedAds.length === 0) return

  for (const ad of finishedAds) {
    const updated = await db.adRequest.updateMany({
      where: {
        id: ad.id,
        status: "IKLAN_BERJALAN",
      },
      data: { status: "SELESAI" },
    })

    if (updated.count === 0) continue

    await createNotification(
      ad.promotorId,
      "Iklan Selesai",
      `Periode iklan ${ad.city} sudah berakhir sesuai jadwal. Silakan input jumlah klien yang didapat.`,
      "AD_COMPLETE",
      ad.id
    )
  }
}
