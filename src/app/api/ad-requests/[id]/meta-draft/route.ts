import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { generateMetaDraftForAdRequestWithMode, type MetaDraftMode } from "@/lib/meta-ads"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const force = Boolean(body?.force)
    const modeRaw = typeof body?.mode === "string" ? body.mode.toUpperCase() : "GENERATE"
    const mode: MetaDraftMode = modeRaw === "DUPLICATE" ? "DUPLICATE" : "GENERATE"
    const result = await generateMetaDraftForAdRequestWithMode(id, force, mode)

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Gagal generate draft Meta" },
      { status: 500 }
    )
  }
}
