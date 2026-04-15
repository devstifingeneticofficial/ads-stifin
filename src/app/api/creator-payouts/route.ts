import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const REQUEST_AMOUNT = 20000
const CONTENTS_PER_REQUEST = 4

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const creatorWhere =
      session.role === "KONTEN_KREATOR" ? { contentCreatorId: session.id } : {}

    const unpaidItemsRaw = await db.adRequest.findMany({
      where: {
        status: "KONTEN_SELESAI",
        contentCreatorId: { not: null },
        creatorPayoutItem: null,
        ...creatorWhere,
      },
      include: {
        promotor: { select: { id: true, name: true, city: true } },
        contentCreator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    })

    const unpaidItems = unpaidItemsRaw.map((item) => ({
      adRequestId: item.id,
      creatorId: item.contentCreatorId,
      creatorName: item.contentCreator?.name || "-",
      promotorId: item.promotorId,
      promotorName: item.promotor.name,
      city: item.city,
      startDate: item.startDate,
      testEndDate: item.testEndDate,
      status: item.status,
      completedAt: item.updatedAt,
      contentCount: CONTENTS_PER_REQUEST,
      amount: REQUEST_AMOUNT,
    }))

    const batchWhere =
      session.role === "KONTEN_KREATOR" ? { creatorId: session.id } : {}

    const paidBatches = await db.creatorPayoutBatch.findMany({
      where: batchWhere,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            adRequest: {
              include: {
                promotor: { select: { id: true, name: true, city: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { payoutDate: "desc" },
    })

    const unpaidSummary = {
      totalRequests: unpaidItems.length,
      totalContents: unpaidItems.length * CONTENTS_PER_REQUEST,
      totalAmount: unpaidItems.length * REQUEST_AMOUNT,
    }

    return NextResponse.json({
      config: {
        requestAmount: REQUEST_AMOUNT,
        contentsPerRequest: CONTENTS_PER_REQUEST,
        breakdown: {
          jjCount: 3,
          voCount: 1,
          unitAmount: 5000,
        },
      },
      unpaidSummary,
      unpaidItems,
      paidBatches: paidBatches.map((batch) => ({
        id: batch.id,
        creatorId: batch.creatorId,
        creatorName: batch.creator.name,
        payoutDate: batch.payoutDate,
        totalRequests: batch.totalRequests,
        totalContents: batch.totalContents,
        totalAmount: batch.totalAmount,
        transferProofUrl: batch.transferProofUrl,
        items: batch.items.map((item) => ({
          id: item.id,
          adRequestId: item.adRequestId,
          requestAmount: item.requestAmount,
          contentCount: item.contentCount,
          jjCount: item.jjCount,
          voCount: item.voCount,
          city: item.adRequest.city,
          startDate: item.adRequest.startDate,
          testEndDate: item.adRequest.testEndDate,
          promotorName: item.adRequest.promotor.name,
          completedAt: item.adRequest.updatedAt,
        })),
      })),
    })
  } catch (error) {
    console.error("GET creator-payouts error:", error)
    return NextResponse.json({ error: "Gagal mengambil data payout" }, { status: 500 })
  }
}
