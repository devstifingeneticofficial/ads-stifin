import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const ANNOUNCEMENTS_KEY = "global_announcements"

type AnnouncementVariant = "info" | "success" | "warning" | "danger"
type AnnouncementPriority = "pinned" | "high" | "normal"

type Announcement = {
  id: string
  title: string
  message: string
  variant: AnnouncementVariant
  priority: AnnouncementPriority
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

const parseAnnouncements = (raw: string | null | undefined): Announcement[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => ({
      id: item?.id,
      title: item?.title || "",
      message: item?.message || "",
      variant:
        item?.variant === "success" || item?.variant === "warning" || item?.variant === "danger"
          ? item.variant
          : "info",
      priority:
        item?.priority === "pinned" || item?.priority === "high"
          ? item.priority
          : "normal",
      isActive: item?.isActive !== false,
      startsAt: item?.startsAt || null,
      endsAt: item?.endsAt || null,
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: item?.updatedAt || new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

const getPriorityRank = (priority: AnnouncementPriority) => {
  if (priority === "pinned") return 3
  if (priority === "high") return 2
  return 1
}

const isAnnouncementLive = (item: Announcement) => {
  if (!item.isActive) return false
  const now = new Date()
  const startsAt = item.startsAt ? new Date(item.startsAt) : null
  const endsAt = item.endsAt ? new Date(item.endsAt) : null
  if (startsAt && now < startsAt) return false
  if (endsAt && now > endsAt) return false
  return true
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: ANNOUNCEMENTS_KEY },
    })
    const allItems = parseAnnouncements(setting?.value).sort((a, b) => {
      const rankDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority)
      if (rankDiff !== 0) return rankDiff
      return +new Date(b.updatedAt) - +new Date(a.updatedAt)
    })

    const canManage = session.role === "ADVERTISER"
    return NextResponse.json({
      announcements: canManage ? allItems : allItems.filter(isAnnouncementLive),
      canManage,
    })
  } catch (error) {
    console.error("GET announcements error:", error)
    return NextResponse.json({ error: "Gagal mengambil pengumuman" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Hanya Advertiser yang dapat mengelola pengumuman" }, { status: 403 })
    }

    const body = await req.json()
    const id: string = typeof body?.id === "string" ? body.id : randomUUID()
    const title: string = typeof body?.title === "string" ? body.title.trim() : ""
    const message: string = typeof body?.message === "string" ? body.message.trim() : ""
    const variant: AnnouncementVariant =
      body?.variant === "success" || body?.variant === "warning" || body?.variant === "danger"
        ? body.variant
        : "info"
    const priority: AnnouncementPriority =
      body?.priority === "pinned" || body?.priority === "high"
        ? body.priority
        : "normal"
    const isActive: boolean = typeof body?.isActive === "boolean" ? body.isActive : true
    const startsAt: string | null = typeof body?.startsAt === "string" && body.startsAt ? body.startsAt : null
    const endsAt: string | null = typeof body?.endsAt === "string" && body.endsAt ? body.endsAt : null

    if (!title || !message) {
      return NextResponse.json({ error: "Judul dan isi pengumuman wajib diisi" }, { status: 400 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: ANNOUNCEMENTS_KEY },
    })
    const items = parseAnnouncements(setting?.value)

    const nowIso = new Date().toISOString()
    const existingIndex = items.findIndex((item) => item.id === id)
    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        title,
        message,
        variant,
        priority,
        isActive,
        startsAt,
        endsAt,
        updatedAt: nowIso,
      }
    } else {
      items.push({
        id,
        title,
        message,
        variant,
        priority,
        isActive,
        startsAt,
        endsAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }

    await db.systemSetting.upsert({
      where: { key: ANNOUNCEMENTS_KEY },
      update: { value: JSON.stringify(items) },
      create: { key: ANNOUNCEMENTS_KEY, value: JSON.stringify(items) },
    })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("POST announcements error:", error)
    return NextResponse.json({ error: "Gagal menyimpan pengumuman" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Hanya Advertiser yang dapat menghapus pengumuman" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: ANNOUNCEMENTS_KEY },
    })
    const items = parseAnnouncements(setting?.value)
    const filtered = items.filter((item) => item.id !== id)

    await db.systemSetting.upsert({
      where: { key: ANNOUNCEMENTS_KEY },
      update: { value: JSON.stringify(filtered) },
      create: { key: ANNOUNCEMENTS_KEY, value: JSON.stringify(filtered) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE announcements error:", error)
    return NextResponse.json({ error: "Gagal menghapus pengumuman" }, { status: 500 })
  }
}
