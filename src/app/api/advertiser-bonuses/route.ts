import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildInvoiceNumber } from "@/lib/invoice"

const BONUS_PER_CLIENT = 25000

export async function GET() {
  try {
    const session = await getSession()
    if (!session || (session.role !== "STIFIN" && session.role !== "ADVERTISER")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const unpaidResults = await db.promotorResult.findMany({
      where: {
        status: "VALID",
        bonusPayoutItem: null,
      },
      include: {
        adRequest: {
          select: {
            id: true,
            city: true,
            startDate: true,
            testEndDate: true,
            promotor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "asc" },
    })

    const unpaidItems = unpaidResults.map((result) => ({
      promotorResultId: result.id,
      adRequestId: result.adRequestId,
      promotorId: result.adRequest.promotor.id,
      promotorName: result.adRequest.promotor.name,
      city: result.adRequest.city,
      startDate: result.adRequest.startDate,
      testEndDate: result.adRequest.testEndDate,
      clientCount: result.totalClients,
      amount: result.totalClients * BONUS_PER_CLIENT,
      validatedAt: result.updatedAt,
    }))

    const unpaidSummary = unpaidItems.reduce(
      (acc, item) => {
        acc.totalItems += 1
        acc.totalClients += item.clientCount
        acc.totalAmount += item.amount
        return acc
      },
      { totalItems: 0, totalClients: 0, totalAmount: 0 }
    )

    const paidBatches = await db.promotorBonusBatch.findMany({
      include: {
        promotor: { select: { id: true, name: true } },
        items: {
          include: {
            adRequest: {
              select: {
                id: true,
                city: true,
                startDate: true,
                testEndDate: true,
                promotor: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { payoutDate: "desc" },
    })

    return NextResponse.json({
      config: {
        bonusPerClient: BONUS_PER_CLIENT,
      },
      unpaidSummary,
      unpaidItems,
      paidBatches: paidBatches.map((batch) => ({
        invoiceNumber: buildInvoiceNumber("BONUS_ADVERTISER", batch.id, batch.payoutDate),
        promotorLabel: (() => {
          const names = Array.from(new Set(batch.items.map((item) => item.adRequest.promotor.name)))
          if (names.length <= 1) return names[0] || batch.promotor?.name || "-"
          return `${names.length} promotor`
        })(),
        id: batch.id,
        promotorId: batch.promotorId,
        promotorName: batch.promotor.name,
        payoutDate: batch.payoutDate,
        totalItems: batch.totalItems,
        totalClients: batch.totalClients,
        totalAmount: batch.totalAmount,
        transferProofUrl: batch.transferProofUrl,
        items: batch.items.map((item) => ({
          id: item.id,
          promotorResultId: item.promotorResultId,
          adRequestId: item.adRequestId,
          promotorName: item.adRequest.promotor.name,
          city: item.adRequest.city,
          startDate: item.adRequest.startDate,
          testEndDate: item.adRequest.testEndDate,
          clientCount: item.clientCount,
          bonusAmount: item.bonusAmount,
        })),
      })),
    })
  } catch (error) {
    console.error("GET advertiser-bonuses error:", error)
    return NextResponse.json({ error: "Gagal memuat data bonus advertiser" }, { status: 500 })
  }
}
