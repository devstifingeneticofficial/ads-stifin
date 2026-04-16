import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

export async function syncScheduledAdsToRunning() {
  const scheduledAds = await db.adRequest.findMany({
    where: {
      status: "IKLAN_DIJADWALKAN",
      adStartDate: { lte: new Date() },
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
}
