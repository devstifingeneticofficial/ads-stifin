import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templates = await db.notificationTemplate.findMany({
      orderBy: { name: "asc" },
    })
    
    return NextResponse.json(templates)
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Hanya Advertiser yang dapat mengubah template" }, { status: 403 })
    }

    const { slug, name, message, isActive } = await req.json()

    if (!slug) {
      return NextResponse.json({ error: "Slug wajib diisi" }, { status: 400 })
    }

    // Upsert: Update jika sudah ada, buat baru jika belum
    const updated = await db.notificationTemplate.upsert({
      where: { slug },
      update: { 
        message: message !== undefined ? message : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      create: { 
        slug, 
        name: name || slug, 
        message: message || "",
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Template update error:", error)
    return NextResponse.json({ error: "Gagal menyimpan template" }, { status: 500 })
  }
}
