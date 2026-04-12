import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const templates = await db.briefTemplate.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error("GET Master Brief error:", error)
    return NextResponse.json({ error: "Gagal mengambil template" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { type, name, content } = await req.json()
    if (!type || !name || !content) {
      return NextResponse.json({ error: "Field wajib diisi" }, { status: 400 })
    }

    const template = await db.briefTemplate.create({
      data: { type, name, content },
    })

    return NextResponse.json(template)
  } catch (error) {
    return NextResponse.json({ error: "Gagal membuat template" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id, type, name, content } = await req.json()
    if (!id || !type || !name || !content) {
      return NextResponse.json({ error: "Field wajib diisi" }, { status: 400 })
    }

    const template = await db.briefTemplate.update({
      where: { id },
      data: { type, name, content },
    })

    return NextResponse.json(template)
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengupdate template" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 })
    }

    await db.briefTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Gagal menghapus template" }, { status: 500 })
  }
}
