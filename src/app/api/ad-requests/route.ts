import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { autoSelectBriefType, generateBriefContent, generateBriefs } from "@/lib/brief-templates"
import { createNotification, notifyRole, notifyStifin } from "@/lib/notifications"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"
import { syncScheduledAdsToRunning } from "@/lib/ad-status"
import { buildCampaignCode, buildCampaignName } from "@/lib/campaign-naming"

const CREATOR_ROTATION_KEY = "content_creator_rotation_index"
const MIN_AUTO_SALDO_APPLY = 100_000
const AD_REQUESTS_CACHE_TTL_MS = 20_000

type AdRequestsCacheEntry = {
  expiresAt: number
  payload: unknown
}

const adRequestsCache = new Map<string, AdRequestsCacheEntry>()

function clearAdRequestsCache() {
  adRequestsCache.clear()
}

function readAdRequestsCache(key: string) {
  const hit = adRequestsCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    adRequestsCache.delete(key)
    return null
  }
  return hit.payload
}

function writeAdRequestsCache(key: string, payload: unknown) {
  adRequestsCache.set(key, {
    expiresAt: Date.now() + AD_REQUESTS_CACHE_TTL_MS,
    payload,
  })
}

async function generateUniqueCampaignCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildCampaignCode(6)
    const exists = await db.adRequest.findFirst({
      where: { campaignCode: code },
      select: { id: true },
    })
    if (!exists) return code
  }
  // extremely rare fallback
  return `${Date.now().toString(36).toUpperCase()}`
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const city = searchParams.get("city")
    const queryText = (searchParams.get("q") || "").trim()
    const status = searchParams.get("status")
    const scope = searchParams.get("scope") // "all" for global historical data
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("pageSize")
    const sortByParam = (searchParams.get("sortBy") || "createdAt").trim()
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").trim().toLowerCase()
    const isAdmin = session.role === "ADVERTISER" || session.role === "STIFIN"
    const isPromotorGlobalScope = scope === "all" && session.role === "PROMOTOR"

    if (scope === "all" && !isAdmin && !isPromotorGlobalScope) {
      return NextResponse.json({ error: "Akses scope global ditolak" }, { status: 403 })
    }

    const where: any = {}

    if (session.role === "PROMOTOR" && !isPromotorGlobalScope) {
      where.promotorId = session.id
    }

    if (session.role === "KONTEN_KREATOR" && scope !== "all") {
      where.contentCreatorId = session.id
      where.status = { not: "MENUNGGU_PEMBAYARAN" }
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }

    if (queryText) {
      where.OR = [
        { city: { contains: queryText, mode: "insensitive" } },
        { promotor: { name: { contains: queryText, mode: "insensitive" } } },
      ]
    }

    if (status) {
      where.status = status
    }

    // Auto-repair legacy data: MENUNGGU_KONTEN without assigned creator
    // (historically created by old upload-proof flow).
    const unassignedContentQueue = await db.adRequest.findMany({
      where: {
        status: "MENUNGGU_KONTEN",
        contentCreatorId: null,
      },
      include: {
        promotor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    })

    if (unassignedContentQueue.length > 0) {
      for (const legacyAd of unassignedContentQueue) {
        try {
          const assigned = await db.$transaction(async (tx) => {
            const creators = await tx.user.findMany({
              where: { role: "KONTEN_KREATOR" },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            })
            if (creators.length === 0) return null

            const enabledSetting = await tx.systemSetting.findUnique({
              where: { key: USER_ENABLED_SETTING_KEY },
            })
            const enabledMap = parseUserEnabledMap(enabledSetting?.value)
            const availableCreators = creators.filter((creator) => isUserEnabled(enabledMap, creator.id))
            if (availableCreators.length === 0) return null

            const rotation = await tx.systemSetting.findUnique({
              where: { key: CREATOR_ROTATION_KEY },
            })
            const lastIndexRaw = Number.parseInt(rotation?.value || "-1", 10)
            const lastIndex = Number.isNaN(lastIndexRaw) ? -1 : lastIndexRaw
            const nextIndex = (lastIndex + 1) % availableCreators.length
            const assignedCreator = availableCreators[nextIndex]

            const updated = await tx.adRequest.updateMany({
              where: { id: legacyAd.id, contentCreatorId: null },
              data: { contentCreatorId: assignedCreator.id },
            })

            if (updated.count === 0) return null

            await tx.systemSetting.upsert({
              where: { key: CREATOR_ROTATION_KEY },
              update: { value: String(nextIndex) },
              create: {
                key: CREATOR_ROTATION_KEY,
                value: String(nextIndex),
              },
            })

            return assignedCreator
          })

          if (assigned) {
            await createNotification(
              assigned.id,
              "Pengajuan Iklan Baru",
              `${legacyAd.promotor.name} dari ${legacyAd.city} mengajukan iklan baru. Ditugaskan untuk Anda.`,
              "AD_REQUEST",
              legacyAd.id
            )
          }
        } catch (repairError) {
          console.error("Auto-repair assignment warning:", repairError)
        }
      }
    }

    // Keep running-state synchronized even when background scheduler is not available.
    try {
      await syncScheduledAdsToRunning()
    } catch (syncError) {
      console.error("Sync scheduled ads warning:", syncError)
    }

    const usePagination = pageParam !== null || pageSizeParam !== null
    const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)
    const pageSizeRaw = Number.parseInt(pageSizeParam || "40", 10) || 40
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200)
    const skip = (page - 1) * pageSize
    const sortOrder: "asc" | "desc" = sortOrderParam === "asc" ? "asc" : "desc"

    const sortableFields = new Set(["createdAt", "city", "dailyBudget", "durationDays", "totalPayment"])
    const sortBy = sortableFields.has(sortByParam) ? sortByParam : "createdAt"
    const orderBy = { [sortBy]: sortOrder } as Record<string, "asc" | "desc">

    const cacheKey = JSON.stringify({
      userId: session.id,
      role: session.role,
      city: city || "",
      q: queryText,
      status: status || "",
      scope: scope || "",
      page,
      pageSize,
      usePagination,
      sortBy,
      sortOrder,
    })
    const cachedPayload = readAdRequestsCache(cacheKey)
    if (cachedPayload) {
      return NextResponse.json(cachedPayload)
    }

    const [adRequests, totalCount] = await Promise.all([
      db.adRequest.findMany({
        where,
        include: {
          promotor: {
            select: isAdmin
              ? { id: true, name: true, email: true, city: true, phone: true }
              : { id: true, name: true, city: true },
          },
          contentCreator: { select: { id: true, name: true, email: true } },
          adReport: true,
          promotorResult: true,
        },
        orderBy,
        ...(usePagination ? { skip, take: pageSize } : {}),
      }),
      db.adRequest.count({ where }),
    ])

    if (!usePagination) {
      writeAdRequestsCache(cacheKey, adRequests)
      return NextResponse.json(adRequests)
    }

    const whereForCounts = { ...where }
    delete (whereForCounts as any).status
    const statusGrouped = await db.adRequest.groupBy({
      where: whereForCounts,
      by: ["status"],
      _count: { _all: true },
    })

    const statusCounts = {
      all: await db.adRequest.count({ where: whereForCounts }),
      MENUNGGU_PEMBAYARAN: 0,
      MENUNGGU_KONTEN: 0,
      KONTEN_SELESAI: 0,
      IKLAN_DIJADWALKAN: 0,
      IKLAN_BERJALAN: 0,
      SELESAI: 0,
      FINAL: 0,
    }

    for (const item of statusGrouped) {
      if (item.status === "MENUNGGU_VERIFIKASI_PEMBAYARAN") {
        statusCounts.MENUNGGU_PEMBAYARAN += item._count._all
      } else if (item.status in statusCounts) {
        ;(statusCounts as any)[item.status] += item._count._all
      }
    }

    const payload = {
      items: adRequests,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        hasMore: skip + adRequests.length < totalCount,
      },
      statusCounts,
    }

    writeAdRequestsCache(cacheKey, payload)
    return NextResponse.json(payload)
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
    const grossPayment = totalBudget + ppn

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

    const completedAds = await db.adRequest.findMany({
      where: {
        promotorId: session.id,
        status: { in: ["SELESAI", "FINAL"] },
        adReport: { isNot: null },
      },
      select: {
        totalBudget: true,
        adReport: { select: { amountSpent: true } },
      },
    })
    const totalLeftover = completedAds.reduce((sum, item) => {
      const spent = item.adReport?.amountSpent ?? null
      if (spent === null || spent === undefined) return sum
      return sum + Math.max(item.totalBudget - spent, 0)
    }, 0)
    const usedSaldoAgg = await db.adRequest.aggregate({
      where: { promotorId: session.id },
      _sum: { saldoApplied: true },
    })
    const usedSaldo = usedSaldoAgg._sum.saldoApplied || 0
    const availableSaldo = Math.max(totalLeftover - usedSaldo, 0)
    const saldoApplied =
      availableSaldo >= MIN_AUTO_SALDO_APPLY ? Math.min(availableSaldo, grossPayment) : 0
    const totalPayment = Math.max(grossPayment - saldoApplied, 0)

    const campaignCode = await generateUniqueCampaignCode()
    const adRequest = await db.adRequest.create({
      data: {
        campaignCode,
        city,
        startDate: startDateObj,
        testEndDate: testEndDateObj,
        durationDays,
        dailyBudget,
        totalBudget,
        ppn,
        totalPayment,
        saldoApplied,
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

    const campaignName = buildCampaignName({
      city,
      startDate: startDateObj,
      promotorName: adRequest.promotor.name,
      campaignCode,
    })



    // Notify advertiser
    await notifyRole(
      "ADVERTISER",
      "Pengajuan Iklan Baru",
      `${adRequest.promotor.name} dari ${city} mengajukan iklan. Campaign: ${campaignName}. Menunggu pembayaran & konten.`,
      "AD_REQUEST",
      adRequest.id
    )

    await notifyStifin(
      "Pengajuan Iklan Baru",
      `Promotor ${adRequest.promotor.name} dari ${city} mengajukan iklan senilai Rp ${totalPayment.toLocaleString("id-ID")}${saldoApplied > 0 ? ` (saldo terpakai Rp ${saldoApplied.toLocaleString("id-ID")})` : ""}`,
      "AD_REQUEST"
    )
    clearAdRequestsCache()

    return NextResponse.json(adRequest, { status: 201 })
  } catch (error) {
    console.error("POST ad-requests error:", error)
    return NextResponse.json({ error: "Gagal membuat pengajuan" }, { status: 500 })
  }
}
