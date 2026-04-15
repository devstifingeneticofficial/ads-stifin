import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendWhatsApp } from "@/lib/whatsapp"

const REQUEST_AMOUNT = 20000
const CONTENTS_PER_REQUEST = 4

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "STIFIN") {
      return NextResponse.json({ error: "Hanya Admin STIFIn yang dapat mencairkan gaji" }, { status: 403 })
    }

    const body = await req.json()
    const adRequestIds: string[] = Array.isArray(body?.adRequestIds) ? body.adRequestIds : []
    const transferProofUrl: string = typeof body?.transferProofUrl === "string" ? body.transferProofUrl.trim() : ""

    if (adRequestIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu item untuk dicairkan" }, { status: 400 })
    }

    if (!transferProofUrl) {
      return NextResponse.json({ error: "Bukti transfer wajib diunggah" }, { status: 400 })
    }

    const items = await db.adRequest.findMany({
      where: {
        id: { in: adRequestIds },
        status: "KONTEN_SELESAI",
        contentCreatorId: { not: null },
        creatorPayoutItem: null,
      },
      include: {
        contentCreator: { select: { id: true, name: true, phone: true, role: true } },
      },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: "Item tidak valid atau sudah dicairkan" }, { status: 400 })
    }

    const groupedByCreator = new Map<string, typeof items>()
    for (const item of items) {
      if (!item.contentCreatorId) continue
      if (!groupedByCreator.has(item.contentCreatorId)) {
        groupedByCreator.set(item.contentCreatorId, [])
      }
      groupedByCreator.get(item.contentCreatorId)!.push(item)
    }

    const invalidCreatorRecipients: string[] = []
    for (const creatorItems of groupedByCreator.values()) {
      const creator = creatorItems[0]?.contentCreator
      const hasValidCreator = !!creator && creator.role === "KONTEN_KREATOR"
      const hasPhone = !!creator?.phone?.trim()
      if (!hasValidCreator || !hasPhone) {
        const creatorName = creator?.name || "Tanpa Nama"
        invalidCreatorRecipients.push(creatorName)
      }
    }

    if (invalidCreatorRecipients.length > 0) {
      return NextResponse.json(
        {
          error: `Nomor WhatsApp konten kreator belum valid: ${invalidCreatorRecipients.join(", ")}. Pastikan role user = KONTEN_KREATOR dan nomor WA terisi.`,
        },
        { status: 400 }
      )
    }

    const createdBatches = []
    const waTemplate = await db.notificationTemplate.findUnique({
      where: { slug: "salary-disbursed-creator" },
    })

    for (const [creatorId, creatorItems] of groupedByCreator.entries()) {
      const batch = await db.$transaction(async (tx) => {
        const payoutBatch = await tx.creatorPayoutBatch.create({
          data: {
            creatorId,
            payoutDate: new Date(),
            totalRequests: creatorItems.length,
            totalContents: creatorItems.length * CONTENTS_PER_REQUEST,
            totalAmount: creatorItems.length * REQUEST_AMOUNT,
            transferProofUrl,
          },
        })

        await tx.creatorPayoutItem.createMany({
          data: creatorItems.map((item) => ({
            batchId: payoutBatch.id,
            adRequestId: item.id,
            requestAmount: REQUEST_AMOUNT,
            jjCount: 3,
            voCount: 1,
            contentCount: CONTENTS_PER_REQUEST,
          })),
        })

        return payoutBatch
      })

      createdBatches.push(batch)

      const creatorInfo = creatorItems[0]?.contentCreator
      if (creatorInfo?.phone && (!waTemplate || waTemplate.isActive)) {
        const payoutDate = new Date(batch.payoutDate)
        const dateStr = payoutDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        const nominalStr = `Rp ${batch.totalAmount.toLocaleString("id-ID")}`

        const defaultMsg = `Halo *${creatorInfo.name}*, gaji konten Anda telah dicairkan pada ${dateStr}. Total: *${nominalStr}* untuk *${batch.totalRequests} request* (${batch.totalContents} konten).`
        const message = waTemplate
          ? waTemplate.message
              .replace(/{creator}/g, creatorInfo.name)
              .replace(/{tanggal}/g, dateStr)
              .replace(/{nominal}/g, nominalStr)
              .replace(/{jumlah_request}/g, batch.totalRequests.toString())
              .replace(/{jumlah_konten}/g, batch.totalContents.toString())
          : defaultMsg

        await sendWhatsApp(creatorInfo.phone, message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mencairkan ${items.length} item`,
      createdBatches,
    })
  } catch (error) {
    console.error("POST creator-payouts/disburse error:", error)
    return NextResponse.json({ error: "Gagal mencairkan gaji" }, { status: 500 })
  }
}
