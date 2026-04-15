import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, phone, city } = await req.json()

    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: session.id },
      data: {
        name,
        phone: phone || null,
        city: city || null,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        phone: updated.phone,
        city: updated.city,
      }
    })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 })
  }
}
