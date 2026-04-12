import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyStifin } from "@/lib/notifications"
import { sendWhatsApp } from "@/lib/whatsapp"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== "PROMOTOR") {
      return NextResponse.json({ error: "Hanya Promotor yang dapat input hasil" }, { status: 403 })
    }

    const { id } = await params
    const { totalClients, note } = await req.json()

    if (!totalClients) {
      return NextResponse.json({ error: "Jumlah klien wajib diisi" }, { status: 400 })
    }

    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: { promotor: true },
    })

    if (!adRequest || adRequest.promotorId !== session.id) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    const existingResult = await db.promotorResult.findUnique({
      where: { adRequestId: id },
    })

    const data = {
      totalClients,
      note,
      status: "PENDING",
      previousTotalClients: existingResult?.status === "VALID" ? existingResult.totalClients : existingResult?.previousTotalClients,
    }

    const result = await db.promotorResult.upsert({
      where: { adRequestId: id },
      update: data,
      create: { ...data, adRequestId: id },
    })

    // ── Notify Dashboard ─────────────────────────────────────────────────────
    
    await notifyStifin(
      "Hasil Promotor",
      `Promotor ${adRequest.promotor.name} dari ${adRequest.city} mendapatkan ${totalClients} klien.`,
      "PROMOTOR_RESULT"
    )

    // ── WhatsApp Notification (Respect Toggle) ──────────────────────────────
    
    const template = await db.notificationTemplate.findUnique({
      where: { slug: "client-report-stifin" }
    })

    // Send only if template is active OR doesn't exist yet (default active)
    if (!template || template.isActive) {
      const stifinAdmins = await db.user.findMany({
        where: { role: "STIFIN", phone: { not: null } }
      })

      for (const admin of stifinAdmins) {
        const defaultMsg = `Admin: *${adRequest.promotor.name}* melaporkan hasil *${totalClients}* klien untuk iklan kota *${adRequest.city}*.`
        const message = template 
          ? template.message
              .replace(/{promotor}/g, adRequest.promotor.name)
              .replace(/{city}/g, adRequest.city)
              .replace(/{kota}/g, adRequest.city)
              .replace(/{jumlah}/g, totalClients.toString())
          : defaultMsg
          
        await sendWhatsApp(admin.phone || "", message)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Promotor result error:", error)
    return NextResponse.json({ error: "Gagal input hasil" }, { status: 500 })
  }
}
