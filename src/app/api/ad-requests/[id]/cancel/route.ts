import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== "PROMOTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    console.log("Membatalkan ID:", id)
    
    const adRequest = await db.adRequest.findUnique({
      where: { id },
      include: { promotor: true }
    })

    console.log("Hasil DB:", adRequest ? "Ditemukan" : "Tidak Ditemukan")

    if (!adRequest) {
      return NextResponse.json({ error: "Pengajuan iklan tidak ditemukan" }, { status: 404 })
    }

    if (adRequest.promotorId !== session.id) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    // Rules for cancellation
    const cancellableStatuses = ["MENUNGGU_KONTEN", "DIPROSES", "KONTEN_SELESAI"]
    
    if (!cancellableStatuses.includes(adRequest.status)) {
      return NextResponse.json({ 
        error: "Pengajuan pada status ini sudah tidak dapat dibatalkan" 
      }, { status: 400 })
    }

    let penaltyAmount = 0
    let message = "Iklan berhasil dibatalkan."

    if (adRequest.status === "DIPROSES" || adRequest.status === "KONTEN_SELESAI") {
      penaltyAmount = 20000 // 20rb
      message = "Iklan dibatalkan. Biaya pembatalan Rp 20.000 telah dipotong dari saldo (saldo bisa menjadi minus)."
    }

    // Use transaction to ensure data integrity
    await db.$transaction(async (tx) => {
      // 1. Mark ad as BATAL
      await tx.adRequest.update({
        where: { id },
        data: {
          status: "BATAL",
          penaltyApplied: penaltyAmount,
        },
      })

      // 2. Refund pembayaran + saldo terpakai, lalu langsung kurangi denda pembatalan.
      //    Jika saldo tidak cukup, nilai saldoRefund akan menjadi negatif (utang saldo).
      const totalRefund = adRequest.totalPayment + (adRequest.saldoApplied || 0)
      
      await tx.user.update({
        where: { id: session.id },
        data: {
          saldoRefund: { increment: totalRefund - penaltyAmount },
        }
      })
      
      // 4. Clear assignments if it was assigned to Content Creator
      if (adRequest.contentCreatorId) {
        await createNotification(
           adRequest.contentCreatorId,
           "Tugas Dibatalkan",
           `Promotor membatalkan pengajuan iklan di ${adRequest.city}. Pengerjaan konten tidak lagi dilanjutkan.`,
           "SYSTEM",
           null
        )
      }
    })

    return NextResponse.json({ success: true, message })

  } catch (error) {
    console.error("Cancel Ad Error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan internal peladen" },
      { status: 500 }
    )
  }
}
