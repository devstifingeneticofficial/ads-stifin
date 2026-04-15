import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildInvoiceNumber } from "@/lib/invoice"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const batch = await db.creatorPayoutBatch.findUnique({
      where: { id },
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
    })

    if (!batch) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 })
    }

    if (session.role === "KONTEN_KREATOR" && batch.creatorId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      id: batch.id,
      invoiceNumber: buildInvoiceNumber("GAJI_KREATOR", batch.id, batch.payoutDate),
      creator: batch.creator,
      payoutDate: batch.payoutDate,
      totalRequests: batch.totalRequests,
      totalContents: batch.totalContents,
      totalAmount: batch.totalAmount,
      transferProofUrl: batch.transferProofUrl,
      items: batch.items.map((item) => ({
        id: item.id,
        adRequestId: item.adRequestId,
        city: item.adRequest.city,
        startDate: item.adRequest.startDate,
        testEndDate: item.adRequest.testEndDate,
        promotorName: item.adRequest.promotor.name,
        requestAmount: item.requestAmount,
        contentCount: item.contentCount,
        jjCount: item.jjCount,
        voCount: item.voCount,
        completedAt: item.adRequest.updatedAt,
      })),
    })
  } catch (error) {
    console.error("GET creator-payouts/[id] error:", error)
    return NextResponse.json({ error: "Gagal mengambil detail invoice" }, { status: 500 })
  }
}
