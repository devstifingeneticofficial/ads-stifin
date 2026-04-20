import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"
import { FORCE_PASSWORD_CHANGE_KEY, parseForcePasswordChangeMap } from "@/lib/force-password-change"

const TOGGLABLE_ROLES = new Set(["KONTEN_KREATOR", "STIFIN", "PROMOTOR"])
const DELETABLE_ROLES = new Set(["PROMOTOR", "KONTEN_KREATOR", "STIFIN"])

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
        canDelete: DELETABLE_ROLES.has(user.role),
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

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId") || ""
    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 })
    }
    if (userId === session.id) {
      return NextResponse.json({ error: "Akun Anda sendiri tidak dapat dihapus" }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }
    if (!DELETABLE_ROLES.has(user.role)) {
      return NextResponse.json({ error: "Role user ini tidak dapat dihapus" }, { status: 400 })
    }

    // Keep historical operational data intact.
    // If a user already has transactional records, force ON/OFF instead of hard delete.
    if (user.role === "PROMOTOR") {
      const hasAdRequests = await db.adRequest.count({
        where: { promotorId: user.id },
      })
      if (hasAdRequests > 0) {
        return NextResponse.json(
          { error: "Promotor ini sudah memiliki data iklan. Gunakan ON/OFF untuk menonaktifkan." },
          { status: 400 }
        )
      }
    }

    if (user.role === "KONTEN_KREATOR") {
      const [assignedCount, payoutBatchCount] = await Promise.all([
        db.adRequest.count({ where: { contentCreatorId: user.id } }),
        db.creatorPayoutBatch.count({ where: { creatorId: user.id } }),
      ])
      if (assignedCount > 0 || payoutBatchCount > 0) {
        return NextResponse.json(
          { error: "Kreator ini sudah memiliki riwayat assignment/pencairan. Gunakan ON/OFF untuk menonaktifkan." },
          { status: 400 }
        )
      }
    }

    const [enabledSetting, forceSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: USER_ENABLED_SETTING_KEY } }),
      db.systemSetting.findUnique({ where: { key: FORCE_PASSWORD_CHANGE_KEY } }),
    ])
    const enabledMap = parseUserEnabledMap(enabledSetting?.value)
    const forceMap = parseForcePasswordChangeMap(forceSetting?.value)
    delete enabledMap[user.id]
    delete forceMap[user.id]

    await db.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: user.id } })
      await tx.systemSetting.upsert({
        where: { key: USER_ENABLED_SETTING_KEY },
        update: { value: JSON.stringify(enabledMap) },
        create: { key: USER_ENABLED_SETTING_KEY, value: JSON.stringify(enabledMap) },
      })
      await tx.systemSetting.upsert({
        where: { key: FORCE_PASSWORD_CHANGE_KEY },
        update: { value: JSON.stringify(forceMap) },
        create: { key: FORCE_PASSWORD_CHANGE_KEY, value: JSON.stringify(forceMap) },
      })
    })

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    console.error("DELETE users/manage error:", error)
    return NextResponse.json({ error: "Gagal menghapus user" }, { status: 500 })
  }
}
