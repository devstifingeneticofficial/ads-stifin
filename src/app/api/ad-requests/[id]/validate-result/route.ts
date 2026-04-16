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

    if (adRequest.status !== "SELESAI") {
      return NextResponse.json(
        { error: "Pengajuan harus berstatus SELESAI sebelum divalidasi" },
        { status: 400 }
      )
    }

    if (adRequest.promotorResult.status !== "PENDING") {
      return NextResponse.json(
        { error: "Laporan sudah divalidasi atau tidak dalam status PENDING" },
        { status: 400 }
      )
    }

    const updatedResult = await db.$transaction(async (tx) => {
      const resultUpdated = await tx.promotorResult.updateMany({
        where: { adRequestId: id, status: "PENDING" },
        data: { status: "VALID" },
      })

      const adUpdated = await tx.adRequest.updateMany({
        where: { id, status: "SELESAI" },
        data: { status: "FINAL" },
      })

      if (resultUpdated.count === 0 || adUpdated.count === 0) {
        throw new Error("STATUS_CONFLICT")
      }

      return tx.promotorResult.findUnique({
        where: { adRequestId: id },
      })
    })

    if (!updatedResult) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

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
    if (error instanceof Error && error.message === "STATUS_CONFLICT") {
      return NextResponse.json(
        { error: "Status pengajuan/laporan berubah. Muat ulang data lalu coba lagi." },
        { status: 409 }
      )
    }
    console.error("Validation error:", error)
    return NextResponse.json({ error: "Gagal memvalidasi laporan" }, { status: 500 })
  }
}
