import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyRole } from "@/lib/notifications"
import { sendWhatsApp } from "@/lib/whatsapp"
import { buildInvoiceNumber } from "@/lib/invoice"

const BONUS_PER_CLIENT = 25000

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "STIFIN") {
      return NextResponse.json({ error: "Hanya Admin STIFIn yang dapat mencairkan bonus" }, { status: 403 })
    }

    const body = await req.json()
    const promotorResultIds: string[] = Array.isArray(body?.promotorResultIds) ? body.promotorResultIds : []
    const transferProofUrl: string = typeof body?.transferProofUrl === "string" ? body.transferProofUrl.trim() : ""

    if (promotorResultIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu item bonus" }, { status: 400 })
    }

    if (!transferProofUrl) {
      return NextResponse.json({ error: "Bukti transfer wajib diunggah" }, { status: 400 })
    }

    const items = await db.promotorResult.findMany({
      where: {
        id: { in: promotorResultIds },
        status: "VALID",
        bonusPayoutItem: null,
      },
      include: {
        adRequest: {
          select: {
            id: true,
            promotorId: true,
            promotor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: "Item bonus tidak valid atau sudah dicairkan" }, { status: 400 })
    }

    const totalClients = items.reduce((sum, item) => sum + item.totalClients, 0)
    const totalAmount = totalClients * BONUS_PER_CLIENT
    const firstPromotorId = items[0].adRequest.promotorId
    const payoutDate = new Date()

    const batch = await db.$transaction(async (tx) => {
      const bonusBatch = await tx.promotorBonusBatch.create({
        data: {
          // Tetap isi untuk kompatibilitas schema, namun 1 batch bisa berisi banyak promotor.
          promotorId: firstPromotorId,
          payoutDate,
          totalItems: items.length,
          totalClients,
          totalAmount,
          transferProofUrl,
        },
      })

      await tx.promotorBonusItem.createMany({
        data: items.map((item) => ({
          batchId: bonusBatch.id,
          promotorResultId: item.id,
          adRequestId: item.adRequest.id,
          clientCount: item.totalClients,
          bonusAmount: item.totalClients * BONUS_PER_CLIENT,
        })),
      })

      return bonusBatch
    })

    const promotorNames = Array.from(new Set(items.map((item) => item.adRequest.promotor.name)))
    const promotorLabel = promotorNames.length > 1 ? `${promotorNames.length} promotor` : (promotorNames[0] || "-")
    const dateStr = payoutDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    const nominalStr = `Rp ${totalAmount.toLocaleString("id-ID")}`
    const invoiceNumber = buildInvoiceNumber("BONUS_ADVERTISER", batch.id, batch.payoutDate)

    await notifyRole(
      "ADVERTISER",
      "Bonus Advertiser Dicairkan",
      `Bonus berhasil dicairkan pada ${dateStr}. Invoice: ${invoiceNumber}. ${totalClients.toLocaleString("id-ID")} klien (${items.length} item) dengan total ${nominalStr}.`,
      "BONUS_DISBURSED"
    )

    const waTemplate = await db.notificationTemplate.findUnique({
      where: { slug: "bonus-disbursed-advertiser" },
    })

    if (!waTemplate || waTemplate.isActive) {
      const advertisers = await db.user.findMany({
        where: { role: "ADVERTISER", phone: { not: null } },
        select: { name: true, phone: true },
      })

      for (const advertiser of advertisers) {
        if (!advertiser.phone) continue
        const defaultMsg = `Halo *${advertiser.name}*, bonus advertiser telah dicairkan pada ${dateStr}. Invoice: *${invoiceNumber}*. Total: *${nominalStr}* untuk *${totalClients} klien* (${items.length} item) dari ${promotorLabel}.`
        const rawMessage = waTemplate
          ? waTemplate.message
              .replace(/{advertiser}/g, advertiser.name)
              .replace(/{tanggal}/g, dateStr)
              .replace(/{invoice}/g, invoiceNumber)
              .replace(/{nominal}/g, nominalStr)
              .replace(/{jumlah_klien}/g, totalClients.toString())
              .replace(/{jumlah_item}/g, items.length.toString())
              .replace(/{promotor}/g, promotorLabel)
          : defaultMsg
        const message = rawMessage.includes(invoiceNumber)
          ? rawMessage
          : `${rawMessage}\nInvoice: *${invoiceNumber}*`

        await sendWhatsApp(advertiser.phone, message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mencairkan ${items.length} item bonus`,
      createdBatches: [batch],
    })
  } catch (error) {
    console.error("POST advertiser-bonuses/disburse error:", error)
    return NextResponse.json({ error: "Gagal mencairkan bonus" }, { status: 500 })
  }
}
