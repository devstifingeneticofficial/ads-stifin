import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS, createToken, getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  mustChangePassword,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Selalu ambil data terbaru dari DB agar perubahan profil (seperti nomor WA) 
    // langsung terlihat tanpa perlu login ulang.
    const [user, forceSetting] = await Promise.all([
      db.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          city: true,
          phone: true,
        },
      }),
      db.systemSetting.findUnique({
        where: { key: FORCE_PASSWORD_CHANGE_KEY },
      }),
    ])

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)

    const response = NextResponse.json({
      user: {
        ...user,
        mustChangePassword: mustChangePassword(forceMap, user.id),
      },
    })

    const refreshedToken = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
    })

    response.cookies.set(AUTH_COOKIE_NAME, refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error("[SESSION] Error:", error)
    return NextResponse.json({ user: null })
  }
}
