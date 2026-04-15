import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  FORCE_PASSWORD_CHANGE_KEY,
  parseForcePasswordChangeMap,
} from "@/lib/force-password-change"

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const newPassword: string = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 })
    }

    const bcrypt = await import("bcryptjs")
    const hashedPassword = await bcrypt.default.hash(newPassword, 10)

    await db.user.update({
      where: { id: session.id },
      data: { password: hashedPassword },
    })

    const forceSetting = await db.systemSetting.findUnique({
      where: { key: FORCE_PASSWORD_CHANGE_KEY },
    })
    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)
    if (forceMap[session.id]) {
      forceMap[session.id] = false
      await db.systemSetting.upsert({
        where: { key: FORCE_PASSWORD_CHANGE_KEY },
        update: { value: JSON.stringify(forceMap) },
        create: { key: FORCE_PASSWORD_CHANGE_KEY, value: JSON.stringify(forceMap) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST auth/change-password error:", error)
    return NextResponse.json({ error: "Gagal mengganti password" }, { status: 500 })
  }
}

