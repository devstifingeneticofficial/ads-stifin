import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== "KONTEN_KREATOR") {
      return NextResponse.json({ error: "Hanya Konten Kreator yang dapat memproses" }, { status: 403 })
    }

    const { id } = await params

    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: { promotor: true },
    })

    if (!adRequest) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 })
    }

    if (adRequest.status !== "MENUNGGU_KONTEN") {
      return NextResponse.json({ error: "Pengajuan belum siap diproses" }, { status: 400 })
    }

    const updated = await db.adRequest.update({
      where: { id },
      data: {
        status: "DIPROSES",
        contentCreatorId: session.id,
      },
      include: { promotor: true },
    })

    // Notify promotor
    await createNotification(
      adRequest.promotorId,
      "Konten Sedang Diproses",
      `Konten kreator sedang memproses konten iklan Anda untuk ${adRequest.city}.`,
      "AD_REQUEST",
      id
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Process content error:", error)
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 })
  }
}
