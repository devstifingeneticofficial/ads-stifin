import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { autoSelectBriefType, generateBriefContent, generateBriefs } from "@/lib/brief-templates"
import { createNotification, notifyRole, notifyStifin } from "@/lib/notifications"

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const city = searchParams.get("city")
    const status = searchParams.get("status")
    const scope = searchParams.get("scope") // "all" for global historical data

    const where: any = {}

    if (session.role === "PROMOTOR" && scope !== "all") {
      where.promotorId = session.id
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }

    if (status) {
      where.status = status
    }

    // Auto-update scheduled ads to running if time is up
    const scheduledAds = await db.adRequest.findMany({
      where: {
        status: "IKLAN_DIJADWALKAN",
        adStartDate: { lte: new Date() },
      },
    })

    if (scheduledAds.length > 0) {
      for (const ad of scheduledAds) {
        await db.adRequest.update({
          where: { id: ad.id },
          data: { status: "IKLAN_BERJALAN" },
        })
        
        // Notify promotor that ad is now running
        await createNotification(
          ad.promotorId,
          "Iklan Sedang Berjalan",
          `Iklan Anda untuk ${ad.city} kini telah aktif dan sedang berjalan.`,
          "AD_RUNNING",
          ad.id
        )
      }
    }

    const adRequests = await db.adRequest.findMany({
      where,
      include: {
        promotor: { select: { id: true, name: true, email: true, city: true, phone: true } },
        adReport: true,
        promotorResult: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(adRequests)
  } catch (error) {
    console.error("GET ad-requests error:", error)
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "PROMOTOR") {
      return NextResponse.json({ error: "Hanya Promotor yang dapat membuat pengajuan" }, { status: 403 })
    }

    const { city, startDate, testEndDate, durationDays, dailyBudget, promotorNote } = await req.json()

    if (!city || !startDate || !durationDays || !dailyBudget) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 })
    }

    const totalBudget = dailyBudget * durationDays
    const ppn = Math.round(totalBudget * 0.11)
    const totalPayment = totalBudget + ppn

    const startDateObj = new Date(startDate)
    const testEndDateObj = testEndDate ? new Date(testEndDate) : null

    // Generate date string for placeholders
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    
    let dayStr = dayNames[startDateObj.getDay()]
    let dateStr = `${startDateObj.getDate()} ${months[startDateObj.getMonth()]} ${startDateObj.getFullYear()}`

    if (testEndDateObj) {
      dayStr = `${dayNames[startDateObj.getDay()]} & ${dayNames[testEndDateObj.getDay()]}`
      // If same month and year
      if (startDateObj.getMonth() === testEndDateObj.getMonth() && startDateObj.getFullYear() === testEndDateObj.getFullYear()) {
         dateStr = `${startDateObj.getDate()} - ${testEndDateObj.getDate()} ${months[startDateObj.getMonth()]} ${startDateObj.getFullYear()}`
      } else {
         dateStr = `${startDateObj.getDate()} ${months[startDateObj.getMonth()]} - ${testEndDateObj.getDate()} ${months[testEndDateObj.getMonth()]} ${testEndDateObj.getFullYear()}`
      }
    }

    // Fetch dynamic templates from master database
    const masterVO = await db.briefTemplate.findMany({ where: { type: "VO" }, orderBy: { createdAt: "asc" } })
    const masterJJ = await db.briefTemplate.findMany({ where: { type: "JJ" }, orderBy: { createdAt: "asc" } })

    // Count previous requests for rotation index
    const promotorCount = await db.adRequest.count({ where: { promotorId: session.id } })

    let finalVO = ""
    let finalJJ = ""

    const replacePlaceholders = (text: string) => {
      return text
        .replace(/{city}/g, city)
        .replace(/{day}/g, dayStr)
        .replace(/{date}/g, dateStr)
    }

    if (masterVO.length > 0) {
      const selectedVO = masterVO[promotorCount % masterVO.length]
      finalVO = replacePlaceholders(selectedVO.content)
    } else {
      // Fallback
      finalVO = `Tes STIFIn di ${city} pada hari ${dayStr} tanggal ${dateStr}. Daftarkan diri Anda sekarang!`
    }

    if (masterJJ.length > 0) {
      const selectedJJ = masterJJ[promotorCount % masterJJ.length]
      finalJJ = replacePlaceholders(selectedJJ.content)
    } else {
      // Fallback
      finalJJ = `STIFIn ${city}! ${dayStr}, ${dateStr}. Klik link di bio!`
    }

    const briefType = "JJ & VO"
    const briefContent = `[ BRIEF JEDAG-JEDUG (JJ) ]\n${finalJJ}\n\n------------------------------------------------------------\n\n[ BRIEF VOICE OVER (VO) ]\n${finalVO}`

    const adRequest = await db.adRequest.create({
      data: {
        city,
        startDate: startDateObj,
        testEndDate: testEndDateObj,
        durationDays,
        dailyBudget,
        totalBudget,
        ppn,
        totalPayment,
        briefType,
        briefContent,
        briefVO: finalVO,
        briefJJ: finalJJ,
        promotorNote,
        promotorId: session.id,
      },
      include: {
        promotor: { select: { name: true } },
      },
    })



    // Notify advertiser
    await notifyRole(
      "ADVERTISER",
      "Pengajuan Iklan Baru",
      `${adRequest.promotor.name} dari ${city} mengajukan iklan. Menunggu pembayaran & konten.`,
      "AD_REQUEST",
      adRequest.id
    )

    await notifyStifin(
      "Pengajuan Iklan Baru",
      `Promotor ${adRequest.promotor.name} dari ${city} mengajukan iklan senilai Rp ${totalPayment.toLocaleString("id-ID")}`,
      "AD_REQUEST"
    )

    return NextResponse.json(adRequest, { status: 201 })
  } catch (error) {
    console.error("POST ad-requests error:", error)
    return NextResponse.json({ error: "Gagal membuat pengajuan" }, { status: 500 })
  }
}
