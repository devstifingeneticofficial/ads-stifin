import { db } from "@/lib/db"
import { buildCampaignName, formatCampaignDateID } from "@/lib/campaign-naming"

const META_TEMPLATE_SETTING_KEY = "meta_ads_text_template_v1"
const DEFAULT_WHATSAPP_FALLBACK = "628122011519"

const DEFAULT_PRIMARY_TEXTS = [
  "Tes STIFIn di {city} - {date}. Yuk amankan slot Anda sekarang.",
  "Pahami mesin kecerdasan Anda melalui Tes STIFIn di {city}.",
  "Slot terbatas untuk Tes STIFIn {city} tanggal {date}.",
  "Cari metode belajar dan kerja paling pas lewat Tes STIFIn.",
  "Daftar sekarang, pilih jadwal Tes STIFIn Anda di {city}.",
]

const DEFAULT_HEADLINES = [
  "Tes STIFIn {city}",
  "Slot Tes Terbatas",
  "Cek Mesin Kecerdasan Anda",
  "Jadwal {date}",
  "Daftar Sekarang",
]

const DEFAULT_DESCRIPTION = "Dapatkan rekomendasi belajar, karier, dan komunikasi berbasis hasil Tes STIFIn."

export type MetaDraftStatus = "NOT_CREATED" | "PENDING" | "SUCCESS" | "FAILED"
export type MetaDraftMode = "GENERATE" | "DUPLICATE"

export interface MetaAdsTemplate {
  primaryTexts: string[]
  headlines: string[]
  description: string
}

interface MetaEnvConfig {
  accessToken: string
  apiVersion: string
  adAccountId: string
  pageId: string
  instagramActorId?: string
  adDestination: "WEBSITE" | "WHATSAPP"
  whatsappNumber?: string
  bidAmount: number
  pixelId: string
  destinationUrl: string
  autoCreateAdsetWithoutWa: boolean
  placeholderImageUrl: string
  templateCampaignId: string
  chatTemplateName: string
  defaultVideoId: string
}

interface MetaAdDraftContext {
  adRequestId: string
  campaignCode?: string | null
  city: string
  startDate: Date
  testEndDate: Date | null
  durationDays: number
  totalBudget: number
  adStartDate: Date | null
  adEndDate: Date | null
  promotorName: string
  promotorPhone: string | null
}

interface MetaDraftResult {
  campaignId: string
  adSetId: string
  adIds: string[]
  partial?: boolean
  warning?: string
}

interface MetaPreflightResult {
  warnings: string[]
}

interface MetaCampaignInsightRow {
  spend?: string
  actions?: Array<{ action_type?: string; value?: string }>
  cost_per_action_type?: Array<{ action_type?: string; value?: string }>
}

function normalizeWhatsAppNumber(input: string | null | undefined): string {
  if (!input) return ""
  const digits = input.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  if (digits.startsWith("8")) return `62${digits}`
  return digits
}

function sanitizeList(values: unknown, max = 5, fallback: string[]): string[] {
  if (!Array.isArray(values)) return fallback
  const clean = values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max)
  return clean.length > 0 ? clean : fallback
}

function sanitizeTemplate(input: unknown): MetaAdsTemplate {
  if (!input || typeof input !== "object") {
    return {
      primaryTexts: [...DEFAULT_PRIMARY_TEXTS],
      headlines: [...DEFAULT_HEADLINES],
      description: DEFAULT_DESCRIPTION,
    }
  }

  const source = input as Record<string, unknown>
  const descriptionValue =
    typeof source.description === "string" && source.description.trim()
      ? source.description.trim()
      : DEFAULT_DESCRIPTION

  return {
    primaryTexts: sanitizeList(source.primaryTexts, 5, DEFAULT_PRIMARY_TEXTS),
    headlines: sanitizeList(source.headlines, 5, DEFAULT_HEADLINES),
    description: descriptionValue,
  }
}

export async function getMetaAdsTemplate(): Promise<MetaAdsTemplate> {
  const setting = await db.systemSetting.findUnique({
    where: { key: META_TEMPLATE_SETTING_KEY },
  })
  if (!setting?.value) {
    return sanitizeTemplate(null)
  }

  try {
    return sanitizeTemplate(JSON.parse(setting.value))
  } catch {
    return sanitizeTemplate(null)
  }
}

export async function saveMetaAdsTemplate(payload: MetaAdsTemplate): Promise<MetaAdsTemplate> {
  const clean = sanitizeTemplate(payload)
  await db.systemSetting.upsert({
    where: { key: META_TEMPLATE_SETTING_KEY },
    update: { value: JSON.stringify(clean) },
    create: {
      key: META_TEMPLATE_SETTING_KEY,
      value: JSON.stringify(clean),
    },
  })
  return clean
}

function getJakartaDateTokens(date: Date) {
  const day = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(date)

  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date)

  const month = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "Asia/Jakarta",
  }).format(date)

  const year = new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date)

  return {
    day,
    tanggal,
    month,
    year,
    date: `${tanggal} ${month} ${year}`,
  }
}

function formatDateForName(date: Date): string {
  return formatCampaignDateID(date)
}

function toJakartaDateAt(base: Date, hour: number, minute: number): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base)

  const year = Number(parts.find((p) => p.type === "year")?.value || "1970")
  const month = Number(parts.find((p) => p.type === "month")?.value || "1")
  const day = Number(parts.find((p) => p.type === "day")?.value || "1")

  // Asia/Jakarta = UTC+7 (without DST)
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0))
}

function resolveSchedule(ctx: MetaAdDraftContext): { startAt: Date; endAt: Date } {
  const now = new Date()
  const minStart = new Date(now.getTime() + 10 * 60 * 1000) // keep a short safety buffer

  let startAt: Date
  let endAt: Date

  if (ctx.adStartDate && ctx.adEndDate) {
    startAt = new Date(ctx.adStartDate)
    endAt = new Date(ctx.adEndDate)
  } else {
    const safeDuration = Math.max(1, ctx.durationDays || 1)
    const testReferenceDate = ctx.testEndDate ?? ctx.startDate

    // End tayang default: H-1 dari tanggal tes, jam 21:00 WIB.
    const defaultEnd = toJakartaDateAt(testReferenceDate, 21, 0)
    defaultEnd.setUTCDate(defaultEnd.getUTCDate() - 1)

    // Start tayang default: mundur sesuai durasi, jam 16:00 WIB.
    const startBaseDay = new Date(defaultEnd)
    startBaseDay.setUTCDate(startBaseDay.getUTCDate() - safeDuration)
    const defaultStart = toJakartaDateAt(startBaseDay, 16, 0)

    startAt = defaultStart
    endAt = defaultEnd
  }

  const minDurationMs = Math.max(ctx.durationDays, 1) * 24 * 60 * 60 * 1000
  let durationMs = endAt.getTime() - startAt.getTime()
  if (!Number.isFinite(durationMs) || durationMs < minDurationMs) {
    durationMs = minDurationMs
  }

  // Meta rejects schedules when start/end are in the past.
  if (startAt.getTime() < minStart.getTime()) {
    startAt = minStart
    endAt = new Date(startAt.getTime() + durationMs)
  }

  if (endAt.getTime() <= startAt.getTime()) {
    endAt = new Date(startAt.getTime() + minDurationMs)
  }

  return { startAt, endAt }
}

function replaceTemplateVariables(text: string, ctx: MetaAdDraftContext): string {
  const dateTokens = getJakartaDateTokens(ctx.startDate)
  return text
    .replaceAll("{city}", ctx.city)
    .replaceAll("{kota}", ctx.city)
    .replaceAll("{date}", dateTokens.date)
    .replaceAll("{date_full}", dateTokens.date)
    .replaceAll("{day}", dateTokens.day)
    .replaceAll("{tanggal}", dateTokens.tanggal)
    .replaceAll("{month}", dateTokens.month)
    .replaceAll("{year}", dateTokens.year)
    .replaceAll("{promotor}", ctx.promotorName)
}

function isRecoverableWhatsAppError(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("page with whatsapp business account required") ||
    value.includes("whatsapp number linked to your page is a personal account") ||
    value.includes("subcode=2446885")
  )
}

function isAttributionWindowError(message: string): boolean {
  const value = message.toLowerCase()
  return value.includes("attribution window is invalid") || value.includes("subcode=1885423")
}

function isCapabilityError(message: string): boolean {
  const value = message.toLowerCase()
  return value.includes("does not have the capability") || /\bcode=3\b/.test(value)
}

function isInvalidInstagramActorError(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("instagram_actor_id") &&
    (value.includes("must be a valid instagram account id") || value.includes("invalid"))
  )
}

function isImageDownloadError(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("image wasn't downloaded") ||
    value.includes("couldn't be downloaded") ||
    value.includes("subcode=3858258")
  )
}

function isInvalidVideoIdError(message: string): boolean {
  const value = message.toLowerCase()
  return value.includes("video_id") && value.includes("not a valid")
}

function withStep(step: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || "Unknown error")
  return new Error(`[${step}] ${message}`)
}

function runMetaPreflight(ad: {
  status: string
  contentUrl: string | null
  promotor: { phone: string | null; name: string }
}, config: MetaEnvConfig): MetaPreflightResult {
  const warnings: string[] = []

  if (ad.status !== "KONTEN_SELESAI" && ad.status !== "IKLAN_DIJADWALKAN" && ad.status !== "IKLAN_BERJALAN") {
    warnings.push(`Status saat ini ${ad.status}. Umumnya Generate Draft dijalankan saat KONTEN_SELESAI.`)
  }

  if (!ad.contentUrl || ad.contentUrl === "WA_CHANNEL") {
    warnings.push("Konten video final belum terdeteksi di sistem (placeholder). Draft tetap dibuat dengan media placeholder.")
  }

  if (config.adDestination === "WHATSAPP") {
    const normalized = normalizeWhatsAppNumber(ad.promotor.phone)
    const fallback = normalizeWhatsAppNumber(config.whatsappNumber)
    if (!normalized && !fallback) {
      warnings.push("Nomor WA promotor/fallback belum tersedia. CTWA mungkin gagal.")
    }
  }

  if (!config.chatTemplateName) {
    warnings.push("Nama chat template belum diset. Gunakan META_CHAT_TEMPLATE_NAME=DefaultStifin.")
  }

  if (!ad.contentUrl || ad.contentUrl === "WA_CHANNEL") {
    if (!config.defaultVideoId) {
      warnings.push("Video fallback belum diset. Gunakan META_DEFAULT_VIDEO_ID agar draft ad tetap bisa dibuat saat konten final belum ada.")
    }
  }

  return { warnings }
}

function getMetaConfig(requireDraftFields = true): MetaEnvConfig {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() || ""
  const apiVersion = process.env.META_API_VERSION?.trim() || "v23.0"
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim() || ""
  const pageId = process.env.META_PAGE_ID?.trim() || ""
  const instagramActorId = process.env.META_INSTAGRAM_ACTOR_ID?.trim() || ""
  const adDestinationRaw = process.env.META_AD_DESTINATION?.trim().toUpperCase() || "WEBSITE"
  const adDestination: "WEBSITE" | "WHATSAPP" =
    adDestinationRaw === "WHATSAPP" ? "WHATSAPP" : "WEBSITE"
  const whatsappNumberRaw = process.env.META_WHATSAPP_NUMBER?.trim() || DEFAULT_WHATSAPP_FALLBACK
  const whatsappNumber = normalizeWhatsAppNumber(whatsappNumberRaw)
  const bidAmountRaw = Number.parseInt(process.env.META_BID_AMOUNT || "1000", 10)
  const bidAmount = Number.isNaN(bidAmountRaw) || bidAmountRaw <= 0 ? 1000 : bidAmountRaw
  const pixelId = process.env.META_PIXEL_ID?.trim() || ""
  const destinationUrl = process.env.META_DESTINATION_URL?.trim() || "https://example.com"
  const autoCreateAdsetWithoutWa =
    (process.env.AUTO_CREATE_ADSET_WITHOUT_WA?.trim().toLowerCase() || "") === "true" ||
    process.env.AUTO_CREATE_ADSET_WITHOUT_WA?.trim() === "1"
  const placeholderImageUrl =
    process.env.META_PLACEHOLDER_IMAGE_URL?.trim() || "https://raw.githubusercontent.com/devstifingeneticofficial/ads-stifin/main/public/logo-stifin.jpg"
  const templateCampaignId = process.env.META_TEMPLATE_CAMPAIGN_ID?.trim() || ""
  const chatTemplateName = process.env.META_CHAT_TEMPLATE_NAME?.trim() || "DefaultStifin"
  const defaultVideoId = process.env.META_DEFAULT_VIDEO_ID?.trim() || ""

  const missing: string[] = []
  if (!accessToken) missing.push("META_ACCESS_TOKEN")
  if (!adAccountId) missing.push("META_AD_ACCOUNT_ID")
  if (!pageId) missing.push("META_PAGE_ID")
  if (requireDraftFields) {
    if (adDestination === "WHATSAPP") {
      // For CTWA, WhatsApp number can come from promotor profile.
      // META_WHATSAPP_NUMBER acts as optional fallback only.
    } else {
      if (!pixelId) missing.push("META_PIXEL_ID")
      if (!destinationUrl) missing.push("META_DESTINATION_URL")
    }
  }

  if (missing.length > 0) {
    throw new Error(`Konfigurasi Meta belum lengkap: ${missing.join(", ")}`)
  }

  return {
    accessToken,
    apiVersion,
    adAccountId,
    pageId,
    instagramActorId,
    adDestination,
    whatsappNumber,
    bidAmount,
    pixelId,
    destinationUrl,
    autoCreateAdsetWithoutWa,
    placeholderImageUrl,
    templateCampaignId,
    chatTemplateName,
    defaultVideoId,
  }
}

async function graphRequest<T = any>(
  config: MetaEnvConfig,
  endpoint: string,
  method: "GET" | "POST",
  params: Record<string, unknown> = {}
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${config.apiVersion}/${endpoint}`)

  if (method === "GET") {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value))
      }
    })
    url.searchParams.set("access_token", config.accessToken)
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body:
      method === "POST"
        ? JSON.stringify({
            ...params,
            access_token: config.accessToken,
          })
        : undefined,
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok || payload?.error) {
    const apiError = payload?.error
    const errParts = [
      apiError?.message,
      apiError?.error_user_title,
      apiError?.error_user_msg,
      apiError?.code ? `code=${apiError.code}` : null,
      apiError?.error_subcode ? `subcode=${apiError.error_subcode}` : null,
    ].filter(Boolean)

    const errMessage =
      errParts.length > 0
        ? errParts.join(" | ")
        : payload?.message || `Meta API gagal (${res.status})`
    throw new Error(errMessage)
  }
  return payload as T
}

async function createCampaign(config: MetaEnvConfig, ctx: MetaAdDraftContext): Promise<string> {
  const campaignName = buildCampaignName({
    city: ctx.city,
    startDate: ctx.startDate,
    promotorName: ctx.promotorName,
    campaignCode: ctx.campaignCode,
  })
  // Meta expects budget in minor unit for currencies with decimals.
  // IDR has no decimal fraction, so we send the raw integer amount.
  const lifetimeBudget = Math.max(Math.round(ctx.totalBudget), 10000)
  const objective = "OUTCOME_SALES"

  const campaign = await graphRequest<{ id: string }>(
    config,
    `${config.adAccountId}/campaigns`,
    "POST",
    {
      name: campaignName,
      objective,
      status: "PAUSED",
      buying_type: "AUCTION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      special_ad_categories: [],
      lifetime_budget: String(lifetimeBudget),
    }
  )

  return campaign.id
}

async function createAdSet(
  config: MetaEnvConfig,
  ctx: MetaAdDraftContext,
  campaignId: string,
  startAt: Date,
  endAt: Date,
  resolvedWhatsappNumber: string
): Promise<string> {
  const adSetName = `Adset ${ctx.city} ${formatDateForName(ctx.startDate)}`
  const useMessageFallback = config.adDestination === "WHATSAPP" && config.autoCreateAdsetWithoutWa
  const destinationType = useMessageFallback ? "MESSENGER" : config.adDestination

  const basePayload: Record<string, unknown> = {
    name: adSetName,
    campaign_id: campaignId,
    status: "PAUSED",
    billing_event: "IMPRESSIONS",
    optimization_goal: "CONVERSATIONS",
    destination_type: destinationType,
    start_time: Math.floor(startAt.getTime() / 1000),
    end_time: Math.floor(endAt.getTime() / 1000),
    targeting: {
      geo_locations: {
        countries: ["ID"],
      },
      publisher_platforms: ["facebook", "instagram"],
    },
    promoted_object:
      destinationType === "WHATSAPP"
        ? {
            page_id: config.pageId,
            whatsapp_phone_number: resolvedWhatsappNumber,
          }
        : destinationType === "MESSENGER"
          ? {
              page_id: config.pageId,
            }
          : {
              pixel_id: config.pixelId,
              custom_event_type: "PURCHASE",
            },
  }

  // Keep retries minimal and CTWA-oriented to reduce "invalid combination" failures.
  const variants: Record<string, unknown>[] = [
    {
      ...basePayload,
      attribution_setting: "1d_click",
    },
    {
      ...basePayload,
      attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    },
    {
      ...basePayload,
    },
  ]

  let lastError: any = null
  for (const payload of variants) {
    try {
      const adSet = await graphRequest<{ id: string }>(
        config,
        `${config.adAccountId}/adsets`,
        "POST",
        payload
      )
      return adSet.id
    } catch (error: any) {
      lastError = error
      const msg = error?.message || ""
      if (!isAttributionWindowError(msg)) {
        throw error
      }
    }
  }

  throw lastError || new Error("Gagal membuat ad set.")
}

async function createCreative(
  config: MetaEnvConfig,
  ctx: MetaAdDraftContext,
  adNumber: number,
  template: MetaAdsTemplate,
  resolvedWhatsappNumber: string,
  imageHash?: string | null
): Promise<string> {
  const useMessageFallback =
    config.adDestination === "WHATSAPP" && config.autoCreateAdsetWithoutWa
  const name = `${ctx.city} - ${adNumber}`
  const primaryText = replaceTemplateVariables(
    template.primaryTexts[(adNumber - 1) % Math.max(template.primaryTexts.length, 1)] || DEFAULT_PRIMARY_TEXTS[0],
    ctx
  )
  const headline = replaceTemplateVariables(
    template.headlines[(adNumber - 1) % Math.max(template.headlines.length, 1)] || DEFAULT_HEADLINES[0],
    ctx
  )
  const description = replaceTemplateVariables(template.description, ctx)

  const linkUrl =
    config.adDestination === "WHATSAPP" && !useMessageFallback
      ? `https://wa.me/${resolvedWhatsappNumber}`
      : useMessageFallback
        ? `https://m.me/${config.pageId}`
        : config.destinationUrl

  const callToAction =
    config.adDestination === "WHATSAPP" && !useMessageFallback
      ? {
          type: "WHATSAPP_MESSAGE",
          value: {
            app_destination: "WHATSAPP",
            link: linkUrl,
          },
        }
      : useMessageFallback
        ? {
            type: "MESSAGE_PAGE",
            value: {
              link: linkUrl,
            },
          }
        : {
            type: "LEARN_MORE",
            value: {
              link: linkUrl,
            },
          }

  const pictureCandidates = [
    config.placeholderImageUrl,
    "https://raw.githubusercontent.com/devstifingeneticofficial/ads-stifin/main/public/logo-stifin.jpg",
    "https://dummyimage.com/1080x1080/0f172a/ffffff.png&text=STIFIn",
  ].filter(Boolean)
  const hasDefaultVideo = !!config.defaultVideoId

  const buildPayload = (includeInstagramActor: boolean, pictureUrl?: string, useVideo = hasDefaultVideo) => ({
    name,
    object_story_spec: {
      page_id: config.pageId,
      ...(includeInstagramActor && config.instagramActorId
        ? { instagram_actor_id: config.instagramActorId }
        : {}),
      ...(useVideo
        ? {
            video_data: {
              video_id: config.defaultVideoId,
              message: primaryText,
              title: headline,
              call_to_action: callToAction,
            },
          }
        : {
            link_data: {
              ...(imageHash ? { image_hash: imageHash } : { picture: pictureUrl || pictureCandidates[0] }),
              link: linkUrl,
              message: primaryText,
              name: headline,
              description,
              call_to_action: callToAction,
            },
          }),
    },
    degrees_of_freedom_spec: {
      creative_features_spec: {
        standard_enhancements: {
          enroll_status: "OPT_IN",
        },
      },
    },
  })

  const createWithPayload = async (pictureUrl?: string, useVideo = hasDefaultVideo): Promise<{ id: string }> => {
    try {
      return await graphRequest<{ id: string }>(
        config,
        `${config.adAccountId}/adcreatives`,
        "POST",
        buildPayload(true, pictureUrl, useVideo)
      )
    } catch (error: any) {
      const message = error?.message || ""
      if (isInvalidInstagramActorError(message) && config.instagramActorId) {
        return await graphRequest<{ id: string }>(
          config,
          `${config.adAccountId}/adcreatives`,
          "POST",
          buildPayload(false, pictureUrl, useVideo)
        )
      }
      throw error
    }
  }

  if (hasDefaultVideo) {
    try {
      const creative = await createWithPayload(undefined, true)
      return creative.id
    } catch (error: any) {
      const message = error?.message || ""
      if (!isInvalidVideoIdError(message)) {
        throw error
      }
      // Fallback: if video ID is invalid, continue with image creative.
    }
  }

  if (imageHash) {
    const creative = await createWithPayload(undefined, false)
    return creative.id
  }

  let lastError: any = null
  for (const candidate of pictureCandidates) {
    try {
      const creative = await createWithPayload(candidate, false)
      return creative.id
    } catch (error: any) {
      lastError = error
      if (!isImageDownloadError(error?.message || "")) {
        throw error
      }
    }
  }

  throw lastError || new Error("Gagal membuat creative Meta Ads.")
}

async function ensurePlaceholderImageHash(config: MetaEnvConfig): Promise<string> {
  const response = await graphRequest<{ images?: Record<string, { hash?: string }> }>(
    config,
    `${config.adAccountId}/adimages`,
    "POST",
    {
      url: config.placeholderImageUrl,
    }
  )

  const firstImage = response.images ? Object.values(response.images)[0] : null
  const hash = firstImage?.hash
  if (!hash) {
    throw new Error("Gagal menyiapkan asset image placeholder untuk creative Meta.")
  }
  return hash
}

function buildTemplateTextOptions(ctx: MetaAdDraftContext, template: MetaAdsTemplate) {
  const bodies = template.primaryTexts.map((text) => ({ text: replaceTemplateVariables(text, ctx) }))
  const titles = template.headlines.map((text) => ({ text: replaceTemplateVariables(text, ctx) }))
  const description = replaceTemplateVariables(template.description, ctx)
  return {
    bodies,
    titles,
    descriptions: [{ text: description }],
  }
}

async function createAd(
  config: MetaEnvConfig,
  ctx: MetaAdDraftContext,
  adSetId: string,
  adNumber: number,
  creativeId: string
): Promise<string> {
  const name = `${ctx.city} - ${adNumber}`

  const ad = await graphRequest<{ id: string }>(
    config,
    `${config.adAccountId}/ads`,
    "POST",
    {
      name,
      adset_id: adSetId,
      status: "PAUSED",
      creative: { creative_id: creativeId },
    }
  )
  return ad.id
}

async function createMetaDraft(ctx: MetaAdDraftContext, template: MetaAdsTemplate): Promise<MetaDraftResult> {
  const config = getMetaConfig(true)
  const { startAt, endAt } = resolveSchedule(ctx)
  const promotorWhatsappNumber =
    config.adDestination === "WHATSAPP"
      ? normalizeWhatsAppNumber(ctx.promotorPhone)
      : ""
  const fallbackWhatsappNumber =
    config.adDestination === "WHATSAPP" ? normalizeWhatsAppNumber(config.whatsappNumber) : ""
  let resolvedWhatsappNumber =
    config.adDestination === "WHATSAPP"
      ? promotorWhatsappNumber || fallbackWhatsappNumber
      : ""

  if (config.adDestination === "WHATSAPP" && !resolvedWhatsappNumber) {
    if (config.autoCreateAdsetWithoutWa) {
      resolvedWhatsappNumber = ""
    } else {
    throw new Error("Nomor WhatsApp promotor belum tersedia/valid. Isi nomor promotor atau set fallback META_WHATSAPP_NUMBER.")
    }
  }

  const campaignId = await createCampaign(config, ctx)
  try {
    let imageHash: string | null = null
    try {
      imageHash = await ensurePlaceholderImageHash(config)
    } catch {
      // Fallback: continue without adimages capability by using picture URL on creative.
      imageHash = null
    }
    let adSetId = ""
    try {
      adSetId = await createAdSet(config, ctx, campaignId, startAt, endAt, resolvedWhatsappNumber)
    } catch (error: any) {
      const canRetryWithFallback =
        config.adDestination === "WHATSAPP" &&
        !!fallbackWhatsappNumber &&
        fallbackWhatsappNumber !== resolvedWhatsappNumber
      if (!canRetryWithFallback) throw withStep("createAdSet", error)

      resolvedWhatsappNumber = fallbackWhatsappNumber
      try {
        adSetId = await createAdSet(config, ctx, campaignId, startAt, endAt, resolvedWhatsappNumber)
      } catch (fallbackError) {
        throw withStep("createAdSetFallback", fallbackError)
      }
    }

    const adIds: string[] = []

    for (let index = 1; index <= 4; index += 1) {
      let creativeId = ""
      try {
        creativeId = await createCreative(config, ctx, index, template, resolvedWhatsappNumber, imageHash)
      } catch (error) {
        throw withStep(`createCreative#${index}`, error)
      }
      let adId = ""
      try {
        adId = await createAd(config, ctx, adSetId, index, creativeId)
      } catch (error) {
        throw withStep(`createAd#${index}`, error)
      }
      adIds.push(adId)
    }

    return { campaignId, adSetId, adIds }
  } catch (error: any) {
    const rawMessage = error?.message || "Gagal melanjutkan pembuatan ad set/ad."
    const adAccountId = config.adAccountId.replace(/^act_/, "")
    const campaignUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaignId}`
    const prefix =
      config.adDestination === "WHATSAPP" && isRecoverableWhatsAppError(rawMessage)
        ? "Draft Campaign berhasil dibuat, tetapi setup WhatsApp untuk Ad Set belum dapat diproses otomatis."
        : "Draft Campaign berhasil dibuat, tetapi pembuatan Ad Set/Ads belum tuntas otomatis."
    const capabilityHint = isCapabilityError(rawMessage)
      ? " Hint: Meta API mengembalikan code=3 (capability). Pastikan app punya use case Marketing API aktif, token System User terbaru, app/asset sudah ter-assign penuh (Ad Account + Page + WhatsApp asset), dan permission ads_management + ads_read + business_management + pages_manage_ads."
      : ""
    const warning = `${prefix} Lanjutkan manual di Ads Manager. Campaign ID: ${campaignId}. Link: ${campaignUrl}. Detail: ${rawMessage}.${capabilityHint}`

    return {
      campaignId,
      adSetId: "",
      adIds: [],
      partial: true,
      warning: `${warning} Catatan: campaign dibuat dengan status PAUSED (tidak tayang otomatis).`,
    }
  }
}

function parseDuplicatedCampaignId(payload: any): string {
  if (!payload || typeof payload !== "object") return ""
  if (typeof payload.copied_campaign_id === "string" && payload.copied_campaign_id) return payload.copied_campaign_id
  if (typeof payload.campaign_id === "string" && payload.campaign_id) return payload.campaign_id
  if (Array.isArray(payload.copied_campaigns) && payload.copied_campaigns.length > 0) {
    const first = payload.copied_campaigns[0]
    if (first && typeof first.id === "string") return first.id
  }
  if (Array.isArray(payload.copies) && payload.copies.length > 0) {
    const first = payload.copies[0]
    if (first && typeof first.id === "string") return first.id
  }
  return ""
}

async function duplicateMetaCampaignFromTemplate(ctx: MetaAdDraftContext): Promise<MetaDraftResult> {
  const template = await getMetaAdsTemplate()
  const config = getMetaConfig(true)
  if (!config.templateCampaignId) {
    throw new Error("Konfigurasi Meta belum lengkap: META_TEMPLATE_CAMPAIGN_ID")
  }

  const campaigns = await graphRequest<{ data?: Array<{ id: string; name: string }> }>(
    config,
    `${config.adAccountId}/campaigns`,
    "GET",
    {
      fields: "id,name",
      limit: 500,
    }
  )
  const campaignList = campaigns.data || []
  const templateExists = campaignList.some((c) => c.id === config.templateCampaignId)
  if (!templateExists) {
    const sample = campaignList.slice(0, 10).map((c) => `${c.id} (${c.name})`).join(" | ")
    throw new Error(
      `Template campaign ID tidak ditemukan di ad account ${config.adAccountId}. ` +
      `Pastikan ID berasal dari campaign di account yang sama dan token punya akses. ` +
      (sample ? `Contoh campaign yang terbaca: ${sample}` : "Tidak ada campaign yang terbaca oleh token ini.")
    )
  }

  const { startAt, endAt } = resolveSchedule(ctx)
  const campaignName = buildCampaignName({
    city: ctx.city,
    startDate: ctx.startDate,
    promotorName: ctx.promotorName,
    campaignCode: ctx.campaignCode,
  })
  const adSetName = `Adset ${ctx.city} ${formatDateForName(ctx.startDate)}`
  const lifetimeBudget = Math.max(Math.round(ctx.totalBudget), 10000)
  const promotorWhatsappNumber =
    config.adDestination === "WHATSAPP"
      ? normalizeWhatsAppNumber(ctx.promotorPhone)
      : ""
  const fallbackWhatsappNumber =
    config.adDestination === "WHATSAPP" ? normalizeWhatsAppNumber(config.whatsappNumber) : ""
  let resolvedWhatsappNumber =
    config.adDestination === "WHATSAPP"
      ? promotorWhatsappNumber || fallbackWhatsappNumber
      : ""

  if (config.adDestination === "WHATSAPP" && !resolvedWhatsappNumber) {
    if (config.autoCreateAdsetWithoutWa) {
      resolvedWhatsappNumber = ""
    } else {
      throw new Error("Nomor WhatsApp promotor belum tersedia/valid. Isi nomor promotor atau set fallback META_WHATSAPP_NUMBER.")
    }
  }

  const copyRes = await graphRequest<any>(
    config,
    `${config.templateCampaignId}/copies`,
    "POST",
    {
      // deep_copy=true can fail on some template setups (e.g. attribution compatibility).
      // We copy campaign shell only, then build adset/ads with current app logic.
      deep_copy: false,
    }
  )
  const campaignId = parseDuplicatedCampaignId(copyRes)
  if (!campaignId) {
    throw new Error("Gagal membaca ID campaign hasil duplicate template.")
  }

  await graphRequest(
    config,
    campaignId,
    "POST",
    {
      name: campaignName,
      status: "PAUSED",
      lifetime_budget: String(lifetimeBudget),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    }
  )

  let adSetId = ""
  const adIds: string[] = []
  let fallbackImageHash: string | null = null
  try {
    fallbackImageHash = await ensurePlaceholderImageHash(config)
  } catch {
    fallbackImageHash = null
  }
  const { bodies, titles, descriptions } = buildTemplateTextOptions(ctx, template)

  try {
    const adSets = await graphRequest<{ data?: Array<{ id: string }> }>(
      config,
      `${campaignId}/adsets`,
      "GET",
      {
        fields: "id,name",
        limit: 50,
      }
    )
    const list = adSets.data || []
    if (list.length > 0) {
      adSetId = list[0].id
      for (const adSet of list) {
        await graphRequest(
          config,
          adSet.id,
          "POST",
          {
            name: adSetName,
            status: "PAUSED",
            start_time: Math.floor(startAt.getTime() / 1000),
            end_time: Math.floor(endAt.getTime() / 1000),
          }
        )

        const ads = await graphRequest<{ data?: Array<{ id: string }> }>(
          config,
          `${adSet.id}/ads`,
          "GET",
          {
            fields: "id,name,creative{id}",
            limit: 50,
          }
        )
        const adList = ads.data || []
        if (adList.length === 0) {
          // If duplicated template contains no ads, create 4 ads from the stored app template.
          for (let index = 1; index <= 4; index += 1) {
            const creativeId = await createCreative(
              config,
              ctx,
              index,
              template,
              resolvedWhatsappNumber,
              fallbackImageHash
            )
            const adId = await createAd(config, ctx, adSet.id, index, creativeId)
            adIds.push(adId)
          }
          continue
        }

        for (let i = 0; i < adList.length; i += 1) {
          const ad = adList[i] as { id: string; creative?: { id?: string } }
          let newCreativeId = ""

          if (ad.creative?.id) {
            const sourceCreative = await graphRequest<any>(
              config,
              ad.creative.id,
              "GET",
              {
                fields: "id,object_story_spec,asset_feed_spec",
              }
            )

            const sourceAssetFeed = sourceCreative?.asset_feed_spec || {}
            const sourceStorySpec = sourceCreative?.object_story_spec || { page_id: config.pageId }
            const mergedAssetFeed: Record<string, unknown> = {
              ...sourceAssetFeed,
              bodies,
              titles,
              descriptions,
            }

            const hasAnyVisualAsset =
              (Array.isArray(sourceAssetFeed?.images) && sourceAssetFeed.images.length > 0) ||
              (Array.isArray(sourceAssetFeed?.videos) && sourceAssetFeed.videos.length > 0) ||
              (Array.isArray(sourceAssetFeed?.carousels) && sourceAssetFeed.carousels.length > 0)

            if (!hasAnyVisualAsset) {
              if (fallbackImageHash) {
                mergedAssetFeed.images = [{ hash: fallbackImageHash }]
                mergedAssetFeed.ad_formats = ["SINGLE_IMAGE"]
              }
            }

            const newCreative = await graphRequest<{ id: string }>(
              config,
              `${config.adAccountId}/adcreatives`,
              "POST",
              {
                name: `${ctx.city} - ${i + 1}`,
                object_story_spec: sourceStorySpec,
                asset_feed_spec: mergedAssetFeed,
              }
            )
            newCreativeId = newCreative.id
          }

          await graphRequest(
            config,
            ad.id,
            "POST",
            {
              name: `${ctx.city} - ${i + 1}`,
              status: "PAUSED",
              ...(newCreativeId ? { creative: { creative_id: newCreativeId } } : {}),
            }
          )
          adIds.push(ad.id)
        }
      }
    } else {
      // If duplicated template contains no adset, create one adset + 4 ads.
      let newAdSetId = ""
      try {
        newAdSetId = await createAdSet(config, ctx, campaignId, startAt, endAt, resolvedWhatsappNumber)
      } catch (error: any) {
        const canRetryWithFallback =
          config.adDestination === "WHATSAPP" &&
          !!fallbackWhatsappNumber &&
          fallbackWhatsappNumber !== resolvedWhatsappNumber
        if (!canRetryWithFallback) throw error
        resolvedWhatsappNumber = fallbackWhatsappNumber
        newAdSetId = await createAdSet(config, ctx, campaignId, startAt, endAt, resolvedWhatsappNumber)
      }

      adSetId = newAdSetId
      for (let index = 1; index <= 4; index += 1) {
        const creativeId = await createCreative(
          config,
          ctx,
          index,
          template,
          resolvedWhatsappNumber,
          fallbackImageHash
        )
        const adId = await createAd(config, ctx, newAdSetId, index, creativeId)
        adIds.push(adId)
      }
    }
  } catch (error: any) {
    const rawMessage = error?.message || "Campaign berhasil diduplikasi, tetapi update adset/ad belum tuntas."
    const adAccountId = config.adAccountId.replace(/^act_/, "")
    const campaignUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaignId}`
    return {
      campaignId,
      adSetId,
      adIds,
      partial: true,
      warning: `Template campaign berhasil diduplikasi, namun penyesuaian ad set/ad belum tuntas. Campaign ID: ${campaignId}. Link: ${campaignUrl}. Detail: ${rawMessage}`,
    }
  }

  return { campaignId, adSetId, adIds }
}

export async function generateMetaDraftForAdRequest(adRequestId: string, force = false): Promise<{
  ok: boolean
  skipped?: boolean
  partial?: boolean
  message: string
}> {
  return generateMetaDraftForAdRequestWithMode(adRequestId, force, "GENERATE")
}

export async function generateMetaDraftForAdRequestWithMode(
  adRequestId: string,
  force = false,
  mode: MetaDraftMode = "GENERATE"
): Promise<{
  ok: boolean
  skipped?: boolean
  partial?: boolean
  message: string
}> {
  const ad = await db.adRequest.findUnique({
    where: { id: adRequestId },
    include: {
      promotor: { select: { name: true, phone: true } },
    },
  })

  if (!ad) {
    throw new Error("Pengajuan iklan tidak ditemukan")
  }

  if (!force && ad.metaCampaignId) {
    return {
      ok: true,
      skipped: true,
      message: "Draft Meta sudah pernah dibuat, proses dilewati.",
    }
  }

  await db.adRequest.update({
    where: { id: adRequestId },
    data: {
      metaDraftStatus: "PENDING",
      metaDraftError: null,
      metaDraftUpdatedAt: new Date(),
    },
  })

  try {
    const preflightConfig = getMetaConfig(true)
    const preflight = runMetaPreflight(ad, preflightConfig)
    const template = await getMetaAdsTemplate()
    const ctx: MetaAdDraftContext = {
      adRequestId: ad.id,
      campaignCode: ad.campaignCode,
      city: ad.city,
      startDate: ad.startDate,
      testEndDate: ad.testEndDate,
      durationDays: ad.durationDays,
      totalBudget: ad.totalBudget,
      adStartDate: ad.adStartDate,
      adEndDate: ad.adEndDate,
      promotorName: ad.promotor.name,
      promotorPhone: ad.promotor.phone,
    }

    const result =
      mode === "DUPLICATE"
        ? await duplicateMetaCampaignFromTemplate(ctx)
        : await createMetaDraft(ctx, template)

    const warningPrefix =
      preflight.warnings.length > 0 ? `Preflight: ${preflight.warnings.join(" | ")}. ` : ""

    if (result.partial) {
      await db.adRequest.update({
        where: { id: adRequestId },
        data: {
          metaCampaignId: result.campaignId,
          metaAdSetId: result.adSetId || null,
          metaAdIds: result.adIds.length > 0 ? JSON.stringify(result.adIds) : null,
          metaDraftStatus: "PARTIAL",
          metaDraftError: result.warning || null,
          metaDraftUpdatedAt: new Date(),
        },
      })

      return {
        ok: true,
        partial: true,
        message: `${warningPrefix}${result.warning || "Draft Campaign berhasil dibuat. Lanjutkan setup manual di Ads Manager."}`,
      }
    }

    await db.adRequest.update({
      where: { id: adRequestId },
      data: {
        metaCampaignId: result.campaignId,
        metaAdSetId: result.adSetId,
        metaAdIds: JSON.stringify(result.adIds),
        metaDraftStatus: "SUCCESS",
        metaDraftError: null,
        metaDraftCreatedAt: new Date(),
        metaDraftUpdatedAt: new Date(),
      },
    })

    return {
      ok: true,
      message: `${warningPrefix}${mode === "DUPLICATE"
        ? "Template campaign berhasil diduplikasi dan disesuaikan."
        : "Draft Meta berhasil dibuat."}`,
    }
  } catch (error: any) {
    const message = error?.message || "Gagal membuat draft Meta."
    await db.adRequest.update({
      where: { id: adRequestId },
      data: {
        metaDraftStatus: "FAILED",
        metaDraftError: message,
        metaDraftUpdatedAt: new Date(),
      },
    })

    return {
      ok: false,
      message,
    }
  }
}

export async function testMetaConnection() {
  const config = getMetaConfig(false)
  const me = await graphRequest<{ id: string; name: string }>(config, "me", "GET", {
    fields: "id,name",
  })
  const account = await graphRequest<{ id: string; name?: string; account_status?: number }>(
    config,
    config.adAccountId,
    "GET",
    { fields: "id,name,account_status" }
  )
  const page = await graphRequest<{ id: string; name: string }>(config, config.pageId, "GET", {
    fields: "id,name",
  })

  return {
    me,
    account,
    page,
    apiVersion: config.apiVersion,
    adAccountId: config.adAccountId,
  }
}

function extractCampaignCodeFromName(name: string): string | null {
  const match = name.match(/\[([A-Z0-9]{4,20})\]\s*$/i)
  if (!match) return null
  return match[1].toUpperCase()
}

function normalizeNameToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function parseLegacyMetaNote(note: string | null | undefined): {
  manualDuration: number | null
  manualClients: number | null
} {
  const source = note || ""
  const durationMatch = source.match(/manual_duration=(\d+)/i)
  const clientsMatch = source.match(/manual_clients=(\d+)/i)
  const manualDuration = durationMatch ? Math.max(1, Number.parseInt(durationMatch[1], 10)) : null
  const manualClients = clientsMatch ? Math.max(0, Number.parseInt(clientsMatch[1], 10)) : null
  return {
    manualDuration: Number.isFinite(manualDuration as number) ? manualDuration : null,
    manualClients: Number.isFinite(manualClients as number) ? manualClients : null,
  }
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
    febuari: 1,
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
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    october: 9,
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

function getActionValue(
  actions: Array<{ action_type?: string; value?: string }> | undefined,
  targetTypes: string[]
): number {
  if (!actions || actions.length === 0) return 0
  for (const type of targetTypes) {
    const found = actions.find((item) => item.action_type === type)
    if (found?.value) {
      const value = Number.parseFloat(found.value)
      if (Number.isFinite(value)) return value
    }
  }
  return 0
}

function parseInsight(row: MetaCampaignInsightRow): { result: number; spend: number; cpr: number | null } {
  const spend = Number.parseFloat(row.spend || "0")
  const validSpend = Number.isFinite(spend) ? spend : 0

  const result = getActionValue(row.actions, [
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.messaging_first_reply",
    "lead",
    "offsite_conversion.fb_pixel_lead",
    "link_click",
  ])

  const cpr = result > 0 ? validSpend / result : null
  return { result: Math.round(result), spend: validSpend, cpr }
}

function getJakartaTodayISODate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function getJakartaPastISODate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.max(daysAgo, 0))
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

export async function syncMetaPerformance(): Promise<{
  linkedCount: number
  updatedCount: number
  skippedCount: number
}> {
  const config = getMetaConfig(false)

  const adRequests = await db.adRequest.findMany({
    where: {
      status: { in: ["IKLAN_DIJADWALKAN", "IKLAN_BERJALAN", "SELESAI", "FINAL"] },
    },
    select: {
      id: true,
      campaignCode: true,
      metaCampaignId: true,
      promotorNote: true,
      promotor: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  })

  const byCode = new Map<string, { id: string; metaCampaignId: string | null }>()
  const byId = new Map<string, { metaCampaignId: string | null }>()
  const usedCampaignIds = new Set<string>()
  const legacyQueue: Array<{
    id: string
    promotorName: string
    manualDuration: number | null
    manualClients: number | null
  }> = []

  for (const item of adRequests) {
    byId.set(item.id, { metaCampaignId: item.metaCampaignId })
    if (item.metaCampaignId) {
      usedCampaignIds.add(item.metaCampaignId)
    }
    if (item.campaignCode) {
      byCode.set(item.campaignCode.toUpperCase(), { id: item.id, metaCampaignId: item.metaCampaignId })
      continue
    }

    if ((item.promotorNote || "").startsWith("[LEGACY_META]") && !item.metaCampaignId) {
      const manual = parseLegacyMetaNote(item.promotorNote)
      legacyQueue.push({
        id: item.id,
        promotorName: item.promotor.name,
        manualDuration: manual.manualDuration,
        manualClients: manual.manualClients,
      })
    }
  }

  // 1) Auto-link by campaign code in campaign name.
  // Lock existing mapping: never overwrite non-null metaCampaignId during sync.
  let after: string | null = null
  let linkedCount = 0
  const candidatesByCode = new Map<
    string,
    Array<{ id: string; status?: string; effective_status?: string; updated_time?: string }>
  >()
  const parsedCampaigns: Array<{
    id: string
    status?: string
    effective_status?: string
    updated_time?: string
    parsed: {
      city: string
      startDate: Date
      endDate: Date | null
      durationDays: number
      promotorName: string
    } | null
  }> = []

  const scoreCampaignStatus = (status?: string, effectiveStatus?: string): number => {
    const normalized = `${effectiveStatus || status || ""}`.toUpperCase()
    if (normalized === "ACTIVE") return 4
    if (normalized === "PAUSED") return 3
    if (normalized === "PENDING_REVIEW") return 2
    if (normalized === "ARCHIVED") return 1
    return 0
  }

  do {
    const page = await graphRequest<{
      data?: Array<{ id: string; name?: string; status?: string; effective_status?: string; updated_time?: string }>
      paging?: { cursors?: { after?: string } }
    }>(config, `${config.adAccountId}/campaigns`, "GET", {
      fields: "id,name,status,effective_status,updated_time",
      limit: 200,
      ...(after ? { after } : {}),
    })

    const campaigns = page.data || []
    for (const campaign of campaigns) {
      const name = campaign.name || ""
      const code = extractCampaignCodeFromName(name)
      if (!code) continue
      const bucket = candidatesByCode.get(code) || []
      bucket.push({
        id: campaign.id,
        status: campaign.status,
        effective_status: campaign.effective_status,
        updated_time: campaign.updated_time,
      })
      candidatesByCode.set(code, bucket)
    }

    for (const campaign of campaigns) {
      parsedCampaigns.push({
        id: campaign.id,
        status: campaign.status,
        effective_status: campaign.effective_status,
        updated_time: campaign.updated_time,
        parsed: parseLegacyCampaignName(campaign.name || ""),
      })
    }

    after = page.paging?.cursors?.after || null
  } while (after)

  for (const [code, candidates] of candidatesByCode.entries()) {
    const local = byCode.get(code)
    if (!local) continue
    // Keep current mapping stable to avoid jumping between duplicate campaigns.
    if (local.metaCampaignId) continue

    const selected = [...candidates].sort((a, b) => {
      const statusScoreDiff =
        scoreCampaignStatus(b.status, b.effective_status) -
        scoreCampaignStatus(a.status, a.effective_status)
      if (statusScoreDiff !== 0) return statusScoreDiff
      const updatedA = a.updated_time ? new Date(a.updated_time).getTime() : 0
      const updatedB = b.updated_time ? new Date(b.updated_time).getTime() : 0
      return updatedB - updatedA
    })[0]

    if (!selected) continue

    await db.adRequest.update({
      where: { id: local.id },
      data: {
        metaCampaignId: selected.id,
        metaDraftUpdatedAt: new Date(),
      },
    })
    local.metaCampaignId = selected.id
    usedCampaignIds.add(selected.id)
    byId.set(local.id, { metaCampaignId: selected.id })
    linkedCount += 1
  }

  // 1b) Auto-link legacy import by campaign structure:
  // {city} {date} - {nama-promotor}
  for (const legacy of legacyQueue) {
    const promotorToken = normalizeNameToken(legacy.promotorName)
    if (!promotorToken) continue

    const selected = parsedCampaigns
      .filter((item) => {
        if (!item.parsed) return false
        if (usedCampaignIds.has(item.id)) return false
        const campaignPromotorToken = normalizeNameToken(item.parsed.promotorName)
        return campaignPromotorToken === promotorToken
      })
      .sort((a, b) => {
        const statusScoreDiff =
          scoreCampaignStatus(b.status, b.effective_status) -
          scoreCampaignStatus(a.status, a.effective_status)
        if (statusScoreDiff !== 0) return statusScoreDiff
        const updatedA = a.updated_time ? new Date(a.updated_time).getTime() : 0
        const updatedB = b.updated_time ? new Date(b.updated_time).getTime() : 0
        return updatedB - updatedA
      })[0]

    if (!selected || !selected.parsed) continue

    const nextDuration = legacy.manualDuration || selected.parsed.durationDays || 1

    await db.adRequest.update({
      where: { id: legacy.id },
      data: {
        city: selected.parsed.city,
        startDate: selected.parsed.startDate,
        testEndDate: selected.parsed.endDate,
        durationDays: nextDuration,
        metaCampaignId: selected.id,
        metaDraftUpdatedAt: new Date(),
      },
    })

    if (legacy.manualClients !== null) {
      await db.promotorResult.upsert({
        where: { adRequestId: legacy.id },
        update: {
          totalClients: legacy.manualClients,
          status: "VALID",
          note: "Legacy import by advertiser",
        },
        create: {
          adRequestId: legacy.id,
          totalClients: legacy.manualClients,
          status: "VALID",
          note: "Legacy import by advertiser",
        },
      })
    }

    usedCampaignIds.add(selected.id)
    byId.set(legacy.id, { metaCampaignId: selected.id })
    linkedCount += 1
  }

  // 2) Pull insights and upsert AdReport
  let updatedCount = 0
  let skippedCount = 0
  const refreshTargets = Array.from(byId.entries())
    .map(([id, value]) => ({ id, metaCampaignId: value.metaCampaignId }))
    .filter((item) => !!item.metaCampaignId)
    .slice(0, 200)

  for (const target of refreshTargets) {
    const campaignId = target.metaCampaignId!
    try {
      // Pull until "today" in Jakarta so running campaigns don't lag behind Ads Manager.
      const todayJakarta = getJakartaTodayISODate()
      const sinceJakarta = getJakartaPastISODate(1095) // ~36 months, within Meta 37-month constraint
      const insight = await graphRequest<{ data?: MetaCampaignInsightRow[] }>(
        config,
        `${campaignId}/insights`,
        "GET",
        {
          level: "campaign",
          fields: "spend,actions,cost_per_action_type",
          time_range: JSON.stringify({ since: sinceJakarta, until: todayJakarta }),
          limit: 1,
        }
      )
      const row = insight.data?.[0]
      if (!row) {
        skippedCount += 1
        continue
      }

      const parsed = parseInsight(row)
      await db.adReport.upsert({
        where: { adRequestId: target.id },
        update: {
          totalLeads: parsed.result,
          amountSpent: Math.round(parsed.spend),
          cpr: parsed.cpr,
        },
        create: {
          adRequestId: target.id,
          totalLeads: parsed.result,
          amountSpent: Math.round(parsed.spend),
          cpr: parsed.cpr,
        },
      })

      updatedCount += 1
    } catch {
      skippedCount += 1
    }
  }

  return { linkedCount, updatedCount, skippedCount }
}
