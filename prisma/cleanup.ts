import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🧹 Memulai pembersihan data latihan...")

  // Menghapus data transaksi (urutan penting untuk foreign key jika tidak cascade, 
  // tapi di schema sudah ada onDelete: Cascade)
  
  const deletedReports = await prisma.adReport.deleteMany({})
  console.log(`✅ Terhapus ${deletedReports.count} data laporan iklan.`)

  const deletedResults = await prisma.promotorResult.deleteMany({})
  console.log(`✅ Terhapus ${deletedResults.count} data hasil promotor.`)

  const deletedRequests = await prisma.adRequest.deleteMany({})
  console.log(`✅ Terhapus ${deletedRequests.count} data pengajuan iklan.`)

  const deletedNotifications = await prisma.notification.deleteMany({})
  console.log(`✅ Terhapus ${deletedNotifications.count} data notifikasi.`)

  const deletedTemplates = await prisma.briefTemplate.deleteMany({})
  console.log(`✅ Terhapus ${deletedTemplates.count} data template brief.`)

  console.log("✨ Pembersihan selesai! User tetap dipertahankan.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
