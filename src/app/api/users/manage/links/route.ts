import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const ADMIN_ROLE = "STIFIN"
const PROMOTOR_ROLE = "PROMOTOR"
const MAX_PROMOTOR_LINKS_PER_ADMIN = 2

export async function GET() {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const [admins, promotors, links] = await Promise.all([
      db.user.findMany({
        where: { role: ADMIN_ROLE },
        select: { id: true, name: true, email: true, city: true, phone: true },
        orderBy: { name: "asc" },
      }),
      db.user.findMany({
        where: { role: PROMOTOR_ROLE },
        select: { id: true, name: true, email: true, city: true, phone: true },
        orderBy: { name: "asc" },
      }),
      db.userProfileLink.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          profile: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ owner: { name: "asc" } }, { profile: { name: "asc" } }],
      }),
    ])

    return NextResponse.json({ admins, promotors, links })
  } catch (error) {
    console.error("GET users/manage/links error:", error)
    return NextResponse.json({ error: "Gagal mengambil data relasi akun" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json()
    const adminId = typeof body?.adminId === "string" ? body.adminId : ""
    const promotorId = typeof body?.promotorId === "string" ? body.promotorId : ""
    if (!adminId || !promotorId) {
      return NextResponse.json({ error: "adminId dan promotorId wajib diisi" }, { status: 400 })
    }

    const [admin, promotor] = await Promise.all([
      db.user.findUnique({ where: { id: adminId }, select: { id: true, role: true, name: true } }),
      db.user.findUnique({ where: { id: promotorId }, select: { id: true, role: true, name: true } }),
    ])

    if (!admin || admin.role !== ADMIN_ROLE) {
      return NextResponse.json({ error: "Akun admin STIFIn tidak valid" }, { status: 400 })
    }
    if (!promotor || promotor.role !== PROMOTOR_ROLE) {
      return NextResponse.json({ error: "Akun promotor tidak valid" }, { status: 400 })
    }

    const existingLink = await db.userProfileLink.findUnique({
      where: { ownerId_profileId: { ownerId: admin.id, profileId: promotor.id } },
      select: { id: true },
    })

    if (!existingLink) {
      const currentLinkCount = await db.userProfileLink.count({
        where: { ownerId: admin.id },
      })
      if (currentLinkCount >= MAX_PROMOTOR_LINKS_PER_ADMIN) {
        return NextResponse.json(
          { error: `Maksimal ${MAX_PROMOTOR_LINKS_PER_ADMIN} akun promotor per admin STIFIn` },
          { status: 400 }
        )
      }
    }

    await db.userProfileLink.upsert({
      where: { ownerId_profileId: { ownerId: admin.id, profileId: promotor.id } },
      update: {},
      create: {
        ownerId: admin.id,
        profileId: promotor.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST users/manage/links error:", error)
    return NextResponse.json({ error: "Gagal menghubungkan akun admin-promotor" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const adminId = searchParams.get("adminId") || ""
    const promotorId = searchParams.get("promotorId") || ""
    if (!adminId || !promotorId) {
      return NextResponse.json({ error: "adminId dan promotorId wajib diisi" }, { status: 400 })
    }

    await db.userProfileLink.deleteMany({
      where: { ownerId: adminId, profileId: promotorId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE users/manage/links error:", error)
    return NextResponse.json({ error: "Gagal melepas relasi akun admin-promotor" }, { status: 500 })
  }
}
