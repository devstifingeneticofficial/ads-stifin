import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"

const ALLOWED_ROLES = new Set(["KONTEN_KREATOR", "STIFIN", "PROMOTOR"])

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { name, email, phone, city, password, role } = await req.json()

    if (!name || !email || !phone || !city || !password || !role) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 })
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 })
    }

    const bcrypt = await import("bcryptjs")
    const hashedPassword = await bcrypt.default.hash(password, 10)

    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        city,
        role,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        city: true,
        phone: true,
      },
    })

    const forceSetting = await db.systemSetting.findUnique({
      where: { key: FORCE_PASSWORD_CHANGE_KEY },
    })
    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)
    forceMap[user.id] = true
    await db.systemSetting.upsert({
      where: { key: FORCE_PASSWORD_CHANGE_KEY },
      update: { value: JSON.stringify(forceMap) },
      create: { key: FORCE_PASSWORD_CHANGE_KEY, value: JSON.stringify(forceMap) },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("POST users/manage/create error:", error)
    return NextResponse.json({ error: "Gagal menambahkan user" }, { status: 500 })
  }
}
