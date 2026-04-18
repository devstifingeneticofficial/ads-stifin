import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const INCLUDED_SYSTEM_SETTING_KEYS = ["meta_ads_text_template_v1", "wa_channel_link"]

function pad(n) {
  return String(n).padStart(2, "0")
}

function timestamp() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function main() {
  const customOutput = process.argv[2]
  const outputDir = path.resolve(process.cwd(), "backups")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = customOutput
    ? path.resolve(process.cwd(), customOutput)
    : path.join(outputDir, `config-backup-${timestamp()}.json`)

  const [briefTemplates, notificationTemplates, systemSettings] = await Promise.all([
    prisma.briefTemplate.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.notificationTemplate.findMany({ orderBy: [{ slug: "asc" }] }),
    prisma.systemSetting.findMany({
      where: { key: { in: INCLUDED_SYSTEM_SETTING_KEYS } },
      orderBy: [{ key: "asc" }],
    }),
  ])

  const payload = {
    createdAt: new Date().toISOString(),
    source: {
      databaseUrl: process.env.DATABASE_URL || null,
      app: "ads-stifin",
    },
    data: {
      briefTemplates: briefTemplates.map((item) => ({
        type: item.type,
        name: item.name,
        content: item.content,
      })),
      notificationTemplates: notificationTemplates.map((item) => ({
        slug: item.slug,
        name: item.name,
        message: item.message,
        isActive: item.isActive,
      })),
      systemSettings: systemSettings.map((item) => ({
        key: item.key,
        value: item.value,
      })),
    },
  }

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8")

  console.log("Backup config selesai.")
  console.log(`File: ${outputPath}`)
  console.log(`Brief templates: ${payload.data.briefTemplates.length}`)
  console.log(`Notification templates: ${payload.data.notificationTemplates.length}`)
  console.log(`System settings: ${payload.data.systemSettings.length}`)
}

main()
  .catch((e) => {
    console.error("Backup gagal:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

