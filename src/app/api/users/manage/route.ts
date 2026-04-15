import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

const TOGGLABLE_ROLES = new Set(["KONTEN_KREATOR", "STIFIN"])

export async function GET() {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const [users, setting] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          city: true,
          phone: true,
          createdAt: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      db.systemSetting.findUnique({
        where: { key: USER_ENABLED_SETTING_KEY },
      }),
    ])

    const enabledMap = parseUserEnabledMap(setting?.value)

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        canToggle: TOGGLABLE_ROLES.has(user.role),
        isEnabled: isUserEnabled(enabledMap, user.id),
      })),
    })
  } catch (error) {
    console.error("GET users/manage error:", error)
    return NextResponse.json({ error: "Gagal mengambil daftar user" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json()
    const userId: string = typeof body?.userId === "string" ? body.userId : ""
    const isEnabled: boolean = typeof body?.isEnabled === "boolean" ? body.isEnabled : true

    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }

    if (!TOGGLABLE_ROLES.has(user.role)) {
      return NextResponse.json({ error: "Role user ini tidak dapat diubah statusnya" }, { status: 400 })
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: USER_ENABLED_SETTING_KEY },
    })
    const enabledMap = parseUserEnabledMap(setting?.value)
    enabledMap[user.id] = isEnabled

    await db.systemSetting.upsert({
      where: { key: USER_ENABLED_SETTING_KEY },
      update: { value: JSON.stringify(enabledMap) },
      create: {
        key: USER_ENABLED_SETTING_KEY,
        value: JSON.stringify(enabledMap),
      },
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      isEnabled,
    })
  } catch (error) {
    console.error("POST users/manage error:", error)
    return NextResponse.json({ error: "Gagal memperbarui status user" }, { status: 500 })
  }
}

