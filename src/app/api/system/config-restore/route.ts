import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

interface BackupPayload {
  data?: {
    briefTemplates?: Array<{ type?: string; name?: string; content?: string }>
    notificationTemplates?: Array<{ slug?: string; name?: string; message?: string; isActive?: boolean }>
    systemSettings?: Array<{ key?: string; value?: string }>
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const parsed = (await req.json()) as BackupPayload
    const data = parsed?.data || {}

    const briefTemplates = Array.isArray(data.briefTemplates) ? data.briefTemplates : []
    const notificationTemplates = Array.isArray(data.notificationTemplates) ? data.notificationTemplates : []
    const systemSettings = Array.isArray(data.systemSettings) ? data.systemSettings : []

    await db.$transaction(async (tx) => {
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

    return NextResponse.json({
      success: true,
      restored: {
        briefTemplates: briefTemplates.length,
        notificationTemplates: notificationTemplates.length,
        systemSettings: systemSettings.length,
      },
    })
  } catch (error) {
    console.error("POST system/config-restore error:", error)
    return NextResponse.json({ error: "Gagal restore config" }, { status: 500 })
  }
}

