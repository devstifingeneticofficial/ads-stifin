import { db } from "@/lib/db"
import { syncMetaPerformance } from "@/lib/meta-ads"

const LEGACY_NOTE_PREFIX = "[LEGACY_META]"

interface MetaConfig {
  accessToken: string
  apiVersion: string
  adAccountId: string
}

interface ParsedCampaign {
  id: string
  name: string
  city: string
  startDate: Date
  endDate: Date | null
  durationDays: number
  promotorName: string
  status?: string
  effectiveStatus?: string
  updatedTime?: string
}

function normalizeNameToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function getMetaConfig(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() || ""
  const apiVersion = process.env.META_API_VERSION?.trim() || "v23.0"
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim() || ""

  if (!accessToken || !adAccountId) {
    throw new Error("Konfigurasi Meta belum lengkap: META_ACCESS_TOKEN dan META_AD_ACCOUNT_ID wajib diisi")
  }

  return { accessToken, apiVersion, adAccountId }
}

async function graphRequest<T>(
  config: MetaConfig,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const query = new URLSearchParams({
    access_token: config.accessToken,
    ...params,
  })

  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${path}?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  })

  const data = await response.json()
  if (!response.ok || data?.error) {
    const message = data?.error?.message || "Meta API request failed"
    throw new Error(message)
  }

  return data as T
}

function parseLegacyCampaignName(name: string): {
  city: string
  startDate: Date
  endDate: Date | null
  durationDays: number
  promotorName: string
} | null {
  const cleanName = name.replace(/\[[A-Z0-9]{4,20}\]\s*$/i, "").trim()
  const match = cleanName.match(/^(.+?)\s+(\d{1,2}(?:-\d{1,2})?\s+[A-Za-z]+(?:\s+\d{4}))\s*-\s*(.+)$/i)
  if (!match) return null

  const city = match[1].trim()
  const datePart = match[2].trim()
  const promotorName = match[3].trim()

  const dateMatch = datePart.match(/^(\d{1,2})(?:-(\d{1,2}))?\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!dateMatch) return null

  const dayStart = Number.parseInt(dateMatch[1], 10)
  const dayEndRaw = dateMatch[2]
  const monthName = dateMatch[3].toLowerCase()
  const year = Number.parseInt(dateMatch[4], 10)

  const monthMap: Record<string, number> = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  }

  const month = monthMap[monthName]
  if (month === undefined || Number.isNaN(dayStart) || Number.isNaN(year)) return null

  const startDate = new Date(Date.UTC(year, month, dayStart, 0, 0, 0))
  const dayEnd = dayEndRaw ? Number.parseInt(dayEndRaw, 10) : null
  const endDate = dayEnd ? new Date(Date.UTC(year, month, dayEnd, 0, 0, 0)) : null
  const durationDays = dayEnd ? Math.max(dayEnd - dayStart + 1, 1) : 1

  return { city, startDate, endDate, durationDays, promotorName }
}

function scoreStatus(status?: string, effectiveStatus?: string): number {
  const normalized = `${effectiveStatus || status || ""}`.toUpperCase()
  if (normalized === "ACTIVE") return 4
  if (normalized === "PAUSED") return 3
  if (normalized === "PENDING_REVIEW") return 2
  if (normalized === "ARCHIVED") return 1
  return 0
}

export async function findLegacyCampaignCandidatesByPromotor(promotorId: string): Promise<ParsedCampaign[]> {
  const promotor = await db.user.findUnique({
    where: { id: promotorId },
    select: { id: true, name: true, role: true },
  })
  if (!promotor || promotor.role !== "PROMOTOR") {
    throw new Error("Promotor tidak valid")
  }

  const config = getMetaConfig()
  const existing = await db.adRequest.findMany({
    where: { metaCampaignId: { not: null } },
    select: { metaCampaignId: true },
  })
  const linkedIds = new Set(existing.map((row) => row.metaCampaignId).filter(Boolean) as string[])

  const targetToken = normalizeNameToken(promotor.name)
  let after: string | null = null
  const candidates: ParsedCampaign[] = []

  do {
    const page = await graphRequest<{
      data?: Array<{ id: string; name?: string; status?: string; effective_status?: string; updated_time?: string }>
      paging?: { cursors?: { after?: string } }
    }>(config, `${config.adAccountId}/campaigns`, {
      fields: "id,name,status,effective_status,updated_time",
      limit: "200",
      ...(after ? { after } : {}),
    })

    for (const item of page.data || []) {
      if (!item.id || linkedIds.has(item.id)) continue
      const parsed = parseLegacyCampaignName(item.name || "")
      if (!parsed) continue

      if (normalizeNameToken(parsed.promotorName) !== targetToken) continue

      candidates.push({
        id: item.id,
        name: item.name || "",
        city: parsed.city,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        durationDays: parsed.durationDays,
        promotorName: parsed.promotorName,
        status: item.status,
        effectiveStatus: item.effective_status,
        updatedTime: item.updated_time,
      })
    }

    after = page.paging?.cursors?.after || null
  } while (after)

  return candidates.sort((a, b) => {
    const scoreDiff = scoreStatus(b.status, b.effectiveStatus) - scoreStatus(a.status, a.effectiveStatus)
    if (scoreDiff !== 0) return scoreDiff
    const aUpdated = a.updatedTime ? new Date(a.updatedTime).getTime() : 0
    const bUpdated = b.updatedTime ? new Date(b.updatedTime).getTime() : 0
    return bUpdated - aUpdated
  })
}

export async function executeLegacyImportByPromotor(input: {
  promotorId: string
  durationDays?: number | null
  totalClients?: number | null
}) {
  const promotor = await db.user.findUnique({
    where: { id: input.promotorId },
    select: { id: true, name: true, role: true },
  })
  if (!promotor || promotor.role !== "PROMOTOR") {
    throw new Error("Promotor tidak valid")
  }

  const candidates = await findLegacyCampaignCandidatesByPromotor(promotor.id)
  const durationOverride = input.durationDays && input.durationDays > 0 ? input.durationDays : null
  const clientsOverride = input.totalClients !== null && input.totalClients !== undefined && input.totalClients >= 0
    ? input.totalClients
    : null

  let createdCount = 0
  let skippedCount = 0

  for (const campaign of candidates) {
    const exists = await db.adRequest.findFirst({
      where: { metaCampaignId: campaign.id },
      select: { id: true },
    })

    if (exists) {
      skippedCount += 1
      continue
    }

    const nextDuration = durationOverride || campaign.durationDays || 1
    const created = await db.adRequest.create({
      data: {
        city: campaign.city,
        startDate: campaign.startDate,
        testEndDate: campaign.endDate,
        durationDays: nextDuration,
        dailyBudget: 0,
        totalBudget: 0,
        ppn: 0,
        totalPayment: 0,
        status: "FINAL",
        briefType: "LEGACY_IMPORT",
        briefContent: "Imported historical campaign from advertiser dashboard (bulk)",
        promotorNote: `${LEGACY_NOTE_PREFIX} imported_bulk=1 imported_at=${new Date().toISOString()} source_campaign=${campaign.id} manual_duration=${durationOverride ?? ""} manual_clients=${clientsOverride ?? ""}`,
        promotorId: promotor.id,
        metaCampaignId: campaign.id,
      },
      select: { id: true },
    })

    if (clientsOverride !== null) {
      await db.promotorResult.upsert({
        where: { adRequestId: created.id },
        update: {
          totalClients: clientsOverride,
          status: "VALID",
          note: "Legacy import by advertiser (bulk)",
        },
        create: {
          adRequestId: created.id,
          totalClients: clientsOverride,
          status: "VALID",
          note: "Legacy import by advertiser (bulk)",
        },
      })
    }

    createdCount += 1
  }

  const syncResult = await syncMetaPerformance()

  return {
    createdCount,
    skippedCount,
    totalCandidates: candidates.length,
    syncResult,
  }
}
