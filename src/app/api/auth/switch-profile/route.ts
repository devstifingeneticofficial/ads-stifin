import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { attachAuthCookie } from "@/lib/auth-cookie"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const actorId = session.actorId || session.id
    const actorRole = session.actorRole || session.role
    if (actorRole !== "STIFIN") {
      return NextResponse.json({ profiles: [], canSwitch: false })
    }

    const [actor, links] = await Promise.all([
      db.user.findUnique({
        where: { id: actorId },
        select: { id: true, name: true, email: true, role: true },
      }),
      db.userProfileLink.findMany({
        where: { ownerId: actorId },
        select: {
          profile: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              city: true,
            },
          },
        },
        orderBy: { profile: { name: "asc" } },
      }),
    ])

    if (!actor) return NextResponse.json({ error: "Akun admin tidak ditemukan" }, { status: 404 })

    return NextResponse.json({
      canSwitch: true,
      activeUserId: session.id,
      actor,
      profiles: links
        .map((item) => item.profile)
        .filter((profile) => profile.role === "PROMOTOR"),
    })
  } catch (error) {
    console.error("GET auth/switch-profile error:", error)
    return NextResponse.json({ error: "Gagal mengambil data profile switch" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const actorId = session.actorId || session.id
    const actorRole = session.actorRole || session.role
    if (actorRole !== "STIFIN") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const body = await req.json()
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : ""

    const actor = await db.user.findUnique({
      where: { id: actorId },
      select: { id: true, email: true, name: true, role: true, city: true, phone: true },
    })
    if (!actor || actor.role !== "STIFIN") {
      return NextResponse.json({ error: "Akun admin tidak valid" }, { status: 400 })
    }

    if (!targetUserId || targetUserId === actor.id) {
      const response = NextResponse.json({
        success: true,
        user: {
          ...actor,
          actorId: actor.id,
          actorName: actor.name,
          actorEmail: actor.email,
          actorRole: actor.role,
          isActingAs: false,
        },
      })
      attachAuthCookie(response, {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
        city: actor.city,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        isActingAs: false,
      })
      return response
    }

    const [linked, target] = await Promise.all([
      db.userProfileLink.findUnique({
        where: {
          ownerId_profileId: {
            ownerId: actor.id,
            profileId: targetUserId,
          },
        },
      }),
      db.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, name: true, role: true, city: true, phone: true },
      }),
    ])

    if (!linked || !target || target.role !== "PROMOTOR") {
      return NextResponse.json({ error: "Profile promotor tidak terhubung ke admin ini" }, { status: 400 })
    }

    const response = NextResponse.json({
      success: true,
      user: {
        ...target,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        isActingAs: true,
      },
    })
    attachAuthCookie(response, {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      city: target.city,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      isActingAs: true,
    })
    return response
  } catch (error) {
    console.error("POST auth/switch-profile error:", error)
    return NextResponse.json({ error: "Gagal switch profile" }, { status: 500 })
  }
}

