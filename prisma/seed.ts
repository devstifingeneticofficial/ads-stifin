import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  const hashedPassword = await bcrypt.hash("password123", 10)

  // 1. Create Default Users
  const users = [
    { email: "roy@stifin.com", name: "Roy", role: "PROMOTOR", city: "Jakarta" },
    { email: "sari@stifin.com", name: "Sari", role: "PROMOTOR", city: "Bandung" },
    { email: "creator@stifin.com", name: "Admin Creator", role: "KONTEN_KREATOR" },
    { email: "ads@stifin.com", name: "Admin Ads", role: "ADVERTISER" },
    { email: "admin@stifin.com", name: "STIFIn Admin", role: "STIFIN" },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password: hashedPassword,
        role: u.role as any,
        city: u.city,
      },
    })
  }

  // 2. Create Default WhatsApp Notification Templates
  const notifTemplates = [
    {
      slug: "payment-confirmed-promotor",
      name: "Pembayaran Valid (Promotor)",
      message: "Halo *{promotor}*, Pembayaran iklan Anda untuk kota *{city}* telah diterima. Terimakasih!",
    },
    {
      slug: "payment-confirmed-advertiser",
      name: "Pembayaran Masuk (Advertiser)",
      message: "*NOTIFIKASI*: Promotor *{promotor}* telah bayar untuk *{city}*.",
    },
    {
      slug: "content-finished-promotor",
      name: "Konten Selesai (Promotor)",
      message: "Halo *{promotor}*, Konten iklan *{city}* sudah selesai! Silakan cek dashboard.",
    },
    {
      slug: "ad-scheduled-promotor",
      name: "Iklan Dijadwalkan (Promotor)",
      message: "Kabar gembira *{promotor}*! Iklan *{city}* telah dijadwalkan tayang.",
    },
    {
      slug: "client-report-stifin",
      name: "Laporan Klien (Admin STIFIn)",
      message: "Admin: *{promotor}* melaporkan hasil *{jumlah}* klien untuk iklan kota *{city}*.",
    },
  ]

  for (const t of notifTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { slug: t.slug },
      update: {}, // Don't overwrite if user already customized it
      create: {
        slug: t.slug,
        name: t.name,
        message: t.message,
        isActive: true,
      },
    })
  }

  // 3. Create Default Master Brief Templates
  const briefTemplates = [
    {
      type: "VO",
      name: "Default VO Script",
      content: "Halo warga {city}! Hari ini hari {day} tanggal {date}, ada info menarik buat kamu...",
    },
    {
      type: "JJ",
      name: "Default Jedag Jedug Style",
      content: "Vibe asik di {city}! Cocok banget buat nemenin hari {day} kamu. Cek {date}!",
    },
  ]

  for (const b of briefTemplates) {
    // We use name as a pseudo-identifier for seeding brief templates
    const existing = await prisma.briefTemplate.findFirst({ where: { name: b.name } })
    if (!existing) {
      await prisma.briefTemplate.create({
        data: {
          type: b.type,
          name: b.name,
          content: b.content,
        },
      })
    }
  }

  console.log("✅ Seed completed successfully!")
  console.log("   - Users: Created/Verified")
  console.log("   - WA Templates: 5 Created/Verified")
  console.log("   - Brief Templates: 2 Created/Verified")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
