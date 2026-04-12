import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Selalu ambil data terbaru dari DB agar perubahan profil (seperti nomor WA) 
    // langsung terlihat tanpa perlu login ulang.
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        city: true,
        phone: true,
      }
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: user,
    })
  } catch (error) {
    console.error("[SESSION] Error:", error)
    return NextResponse.json({ user: null })
  }
}
