import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const INCLUDED_SYSTEM_SETTING_KEYS = ["meta_ads_text_template_v1", "wa_channel_link"]

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const [briefTemplates, notificationTemplates, systemSettings] = await Promise.all([
      db.briefTemplate.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
      db.notificationTemplate.findMany({ orderBy: [{ slug: "asc" }] }),
      db.systemSetting.findMany({
        where: { key: { in: INCLUDED_SYSTEM_SETTING_KEYS } },
        orderBy: [{ key: "asc" }],
      }),
    ])

    const payload = {
      createdAt: new Date().toISOString(),
      source: {
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

    return NextResponse.json(payload)
  } catch (error) {
    console.error("GET system/config-backup error:", error)
    return NextResponse.json({ error: "Gagal membuat backup config" }, { status: 500 })
  }
}

