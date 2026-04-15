import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const CREATOR_AVAILABILITY_KEY = "content_creator_availability_map"

const parseAvailabilityMap = (raw: string | null | undefined): Record<string, boolean> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "KONTEN_KREATOR") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: CREATOR_AVAILABILITY_KEY },
    })

    const availabilityMap = parseAvailabilityMap(setting?.value)
    const isOnline = availabilityMap[session.id] !== false

    return NextResponse.json({ isOnline })
  } catch (error) {
    console.error("GET creator-availability error:", error)
    return NextResponse.json({ error: "Gagal mengambil status ketersediaan kreator" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "KONTEN_KREATOR") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json()
    if (typeof body?.isOnline !== "boolean") {
      return NextResponse.json({ error: "Status online wajib boolean" }, { status: 400 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: CREATOR_AVAILABILITY_KEY },
    })
    const availabilityMap = parseAvailabilityMap(setting?.value)
    availabilityMap[session.id] = body.isOnline

    await db.systemSetting.upsert({
      where: { key: CREATOR_AVAILABILITY_KEY },
      update: { value: JSON.stringify(availabilityMap) },
      create: {
        key: CREATOR_AVAILABILITY_KEY,
        value: JSON.stringify(availabilityMap),
      },
    })

    return NextResponse.json({ success: true, isOnline: body.isOnline })
  } catch (error) {
    console.error("POST creator-availability error:", error)
    return NextResponse.json({ error: "Gagal menyimpan status ketersediaan kreator" }, { status: 500 })
  }
}

