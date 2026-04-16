import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: "wa_channel_link" }
    })
    return NextResponse.json({ value: setting?.value || "" })
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil pengaturan" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { value } = await req.json()
    
    if (value === undefined) {
      return NextResponse.json({ error: "Value wajib diisi" }, { status: 400 })
    }

    const setting = await db.systemSetting.upsert({
      where: { key: "wa_channel_link" },
      update: { value },
      create: {
        key: "wa_channel_link",
        value: value
      }
    })

    return NextResponse.json(setting)
  } catch (error) {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 })
  }
}
