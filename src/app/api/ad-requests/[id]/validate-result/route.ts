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
    if (!session || session.role !== "STIFIN") {
      return NextResponse.json({ error: "Hanya Admin STIFIn yang dapat memvalidasi laporan" }, { status: 403 })
    }

    const { id } = await params

    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: { promotorResult: true, promotor: true },
    })

    if (!adRequest || !adRequest.promotorResult) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

    const updatedResult = await db.promotorResult.update({
      where: { adRequestId: id },
      data: { status: "VALID" },
    })

    await db.adRequest.update({
      where: { id },
      data: { status: "FINAL" },
    })

    // Notify promotor
    await createNotification(
      adRequest.promotorId,
      "Laporan Valid",
      `Laporan klien untuk iklan di ${adRequest.city} telah divalidasi oleh STIFIn.`,
      "RESULT_VALIDATED",
      id
    )

    return NextResponse.json(updatedResult)
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json({ error: "Gagal memvalidasi laporan" }, { status: 500 })
  }
}
