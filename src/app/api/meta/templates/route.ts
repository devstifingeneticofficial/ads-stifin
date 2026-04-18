import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getMetaAdsTemplate, saveMetaAdsTemplate } from "@/lib/meta-ads"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || (session.role !== "ADVERTISER" && session.role !== "STIFIN")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
    }

    const template = await getMetaAdsTemplate()
    return NextResponse.json(template)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Gagal mengambil template Meta Ads" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "ADVERTISER") {
      return NextResponse.json({ error: "Hanya Advertiser yang dapat mengubah template Meta Ads" }, { status: 403 })
    }

    const payload = await req.json()
    const saved = await saveMetaAdsTemplate(payload)
    return NextResponse.json(saved)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Gagal menyimpan template Meta Ads" },
      { status: 500 }
    )
  }
}

