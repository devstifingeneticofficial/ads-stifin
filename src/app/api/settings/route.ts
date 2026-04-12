import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "wa_channel_link" }
    })
    return NextResponse.json({ value: setting?.value || "" })
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil pengaturan" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { value } = await req.json()
    
    if (value === undefined) {
      return NextResponse.json({ error: "Value wajib diisi" }, { status: 400 })
    }

    const setting = await prisma.systemSetting.upsert({
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
