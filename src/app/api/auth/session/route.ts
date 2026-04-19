import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { attachAuthCookie } from "@/lib/auth-cookie"
import { db } from "@/lib/db"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  mustChangePassword,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"

async function safeFindForceSetting() {
  try {
    return await db.systemSetting.findUnique({
      where: { key: FORCE_PASSWORD_CHANGE_KEY },
    })
  } catch (error) {
    console.warn("[SESSION] SystemSetting read failed for force password map", error)
    return null
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Selalu ambil data terbaru dari DB agar perubahan profil (seperti nomor WA) 
    // langsung terlihat tanpa perlu login ulang.
    const actorId = session.actorId || session.id

    const [user, actorUser, forceSetting] = await Promise.all([
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
      db.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      }),
      safeFindForceSetting(),
    ])

    if (!user || !actorUser) {
      return NextResponse.json({ user: null })
    }

    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)

    const response = NextResponse.json({
      user: {
        ...user,
        mustChangePassword: mustChangePassword(forceMap, user.id),
        actorId: actorUser.id,
        actorName: actorUser.name,
        actorEmail: actorUser.email,
        actorRole: actorUser.role,
        isActingAs: actorUser.id !== user.id,
      },
    })

    attachAuthCookie(response, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
      actorId: actorUser.id,
      actorName: actorUser.name,
      actorEmail: actorUser.email,
      actorRole: actorUser.role,
      isActingAs: actorUser.id !== user.id,
    })

    return response
  } catch (error) {
    console.error("[SESSION] Error:", error)
    return NextResponse.json({ user: null })
  }
}
