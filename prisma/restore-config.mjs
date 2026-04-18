import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function usage() {
  console.log("Pemakaian: npm run db:restore:config -- <path-file-backup.json>")
}

async function main() {
  const inputPathArg = process.argv[2]
  if (!inputPathArg) {
    usage()
    process.exit(1)
  }

  const inputPath = path.resolve(process.cwd(), inputPathArg)
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File backup tidak ditemukan: ${inputPath}`)
  }

  const raw = fs.readFileSync(inputPath, "utf8")
  const parsed = JSON.parse(raw)
  const data = parsed?.data || {}

  const briefTemplates = Array.isArray(data.briefTemplates) ? data.briefTemplates : []
  const notificationTemplates = Array.isArray(data.notificationTemplates) ? data.notificationTemplates : []
  const systemSettings = Array.isArray(data.systemSettings) ? data.systemSettings : []

  await prisma.$transaction(async (tx) => {
    await tx.briefTemplate.deleteMany({})
    for (const item of briefTemplates) {
      if (!item?.type || !item?.name || typeof item.content !== "string") continue
      await tx.briefTemplate.create({
        data: {
          type: item.type,
          name: item.name,
          content: item.content,
        },
      })
    }

    for (const item of notificationTemplates) {
      if (!item?.slug || !item?.name || typeof item.message !== "string") continue
      await tx.notificationTemplate.upsert({
        where: { slug: item.slug },
        update: {
          name: item.name,
          message: item.message,
          isActive: Boolean(item.isActive),
        },
        create: {
          slug: item.slug,
          name: item.name,
          message: item.message,
          isActive: Boolean(item.isActive),
        },
      })
    }

    for (const item of systemSettings) {
      if (!item?.key || typeof item.value !== "string") continue
      await tx.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      })
    }
  })

  console.log("Restore config selesai.")
  console.log(`Sumber file: ${inputPath}`)
  console.log(`Brief templates dipulihkan: ${briefTemplates.length}`)
  console.log(`Notification templates dipulihkan: ${notificationTemplates.length}`)
  console.log(`System settings dipulihkan: ${systemSettings.length}`)
}

main()
  .catch((e) => {
    console.error("Restore gagal:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

