import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getSession()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        city: user.city,
        actorId: user.actorId || user.id,
        actorName: user.actorName || user.name,
        actorEmail: user.actorEmail || user.email,
        actorRole: user.actorRole || user.role,
        isActingAs: user.isActingAs || false,
      },
    })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
