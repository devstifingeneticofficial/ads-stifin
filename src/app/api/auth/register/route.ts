import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    const { email, name, password, role, city, phone } = await req.json()

    if (!email || !name || !password || !role || !phone || !city) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 })
    }

    if (role !== "PROMOTOR") {
      return NextResponse.json({ error: "Pendaftaran mandiri hanya untuk role Promotor" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        city,
        phone,
      },
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Gagal mendaftar" }, { status: 500 })
  }
}
