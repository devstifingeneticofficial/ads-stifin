import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

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

    if (adRequestIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu item untuk dicairkan" }, { status: 400 })
    }

    const items = await db.adRequest.findMany({
      where: {
        id: { in: adRequestIds },
        status: "KONTEN_SELESAI",
        contentCreatorId: { not: null },
        creatorPayoutItem: null,
      },
      include: {
        contentCreator: { select: { id: true, name: true } },
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

    const createdBatches = []

    for (const [creatorId, creatorItems] of groupedByCreator.entries()) {
      const batch = await db.$transaction(async (tx) => {
        const payoutBatch = await tx.creatorPayoutBatch.create({
          data: {
            creatorId,
            payoutDate: new Date(),
            totalRequests: creatorItems.length,
            totalContents: creatorItems.length * CONTENTS_PER_REQUEST,
            totalAmount: creatorItems.length * REQUEST_AMOUNT,
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

