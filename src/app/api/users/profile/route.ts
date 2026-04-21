import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        city: true,
        saldoRefund: true,
        unpaidPenalty: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Fetch profile error:", error)
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 })
  }
}

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

    const currentUser = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, role: true, phone: true, city: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }

    const nextName = String(name).trim()
    const incomingPhone = typeof phone === "string" ? phone.trim() : undefined
    const incomingCity = typeof city === "string" ? city.trim() : undefined

    const nextPhone =
      incomingPhone === undefined || incomingPhone === ""
        ? currentUser.phone
        : incomingPhone

    const nextCity =
      incomingCity === undefined || incomingCity === ""
        ? currentUser.city
        : incomingCity

    if (currentUser.role === "PROMOTOR" && !nextPhone) {
      return NextResponse.json({ error: "Nomor WhatsApp promotor wajib diisi" }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: session.id },
      data: {
        name: nextName,
        phone: nextPhone || null,
        city: nextCity || null,
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
