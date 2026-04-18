import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS, createToken } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  mustChangePassword,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    // Password check: plain text for demo, or bcrypt hash
    let isValid = false
    if (user.password.startsWith("$2")) {
      const bcrypt = await import("bcryptjs")
      isValid = await bcrypt.default.compare(password, user.password)
    } else {
      isValid = user.password === password
    }

    if (!isValid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    if (["PROMOTOR", "KONTEN_KREATOR", "STIFIN"].includes(user.role)) {
      const enabledSetting = await db.systemSetting.findUnique({
        where: { key: USER_ENABLED_SETTING_KEY },
      })
      const enabledMap = parseUserEnabledMap(enabledSetting?.value)
      if (!isUserEnabled(enabledMap, user.id)) {
        return NextResponse.json({ error: "Akun Anda sedang dinonaktifkan. Hubungi Advertiser." }, { status: 403 })
      }
    }

    const forceSetting = await db.systemSetting.findUnique({
      where: { key: FORCE_PASSWORD_CHANGE_KEY },
    })
    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)
    const shouldForcePasswordChange = mustChangePassword(forceMap, user.id)

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        city: user.city,
        mustChangePassword: shouldForcePasswordChange,
      },
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error("[LOGIN] Error:", error)
    return NextResponse.json({ error: "Gagal login" }, { status: 500 })
  }
}
