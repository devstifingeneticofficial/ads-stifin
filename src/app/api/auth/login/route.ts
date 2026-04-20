import { NextResponse } from "next/server"
import { attachAuthCookie } from "@/lib/auth-cookie"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  mustChangePassword,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

async function safeFindSystemSetting(key: string) {
  try {
    return await db.systemSetting.findUnique({ where: { key } })
  } catch (error) {
    console.warn(`[LOGIN] SystemSetting read failed for key="${key}"`, error)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim() : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 })
    }

    let user
    try {
      user = await db.user.findUnique({ where: { email } })
    } catch (dbError) {
      console.error("[LOGIN] Database connection failed:", {
        error: String(dbError),
        message: dbError instanceof Error ? dbError.message : "Unknown DB error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
        databaseUrl: process.env.DATABASE_URL ? "configured" : "NOT SET",
        nodeEnv: process.env.NODE_ENV,
      })
      return NextResponse.json({ error: "Database connection error" }, { status: 503 })
    }

    if (!user || typeof user.password !== "string") {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    // Password check: plain text for demo, or bcrypt hash
    let isValid = false
    if (user.password.startsWith("$2")) {
      isValid = await bcrypt.compare(password, user.password)
    } else {
      isValid = user.password === password
    }

    if (!isValid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    if (["PROMOTOR", "KONTEN_KREATOR", "STIFIN"].includes(user.role)) {
      const enabledSetting = await safeFindSystemSetting(USER_ENABLED_SETTING_KEY)
      const enabledMap = parseUserEnabledMap(enabledSetting?.value)
      if (!isUserEnabled(enabledMap, user.id)) {
        return NextResponse.json({ error: "Akun Anda sedang dinonaktifkan. Hubungi Advertiser." }, { status: 403 })
      }
    }

    const forceSetting = await safeFindSystemSetting(FORCE_PASSWORD_CHANGE_KEY)
    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)
    const shouldForcePasswordChange = mustChangePassword(forceMap, user.id)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        city: user.city,
        phone: user.phone,
        mustChangePassword: shouldForcePasswordChange,
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        actorRole: user.role,
        isActingAs: false,
      },
    })

    attachAuthCookie(response, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      isActingAs: false,
    })

    return response
  } catch (error) {
    console.error("[LOGIN] Error:", error)
    return NextResponse.json({ error: "Gagal login" }, { status: 500 })
  }
}
