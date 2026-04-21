"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  CalendarCheck,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Settings,
  Plus,
  ArrowRight,
  Download,
  Upload,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Megaphone,
  Users,
  Wallet,
  ReceiptText,
  ChevronDown,
  RefreshCcw,
  PlugZap,
  Trash2,
  Link2,
  Unlink2,
} from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { buildCampaignName } from "@/lib/campaign-naming"
import { fetchWithTimeout } from "@/lib/fetch-timeout"
import { handleRequestError } from "@/lib/request-feedback"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdReport {
  id: string
  cpr: number | null
  totalLeads: number | null
  amountSpent: number | null
}

interface BriefTemplate {
  id: string
  type: string
  name: string
  content: string
}

interface NotificationTemplate {
  id: string
  slug: string
  name: string
  message: string
  isActive?: boolean
}

interface PromotorResult {
  totalClients: number
  status: string
}

interface AdRequest {
  id: string
  campaignCode?: string | null
  promotor: { id: string; name: string; email: string; city: string; phone?: string | null }
  city: string
  startDate: string
  testEndDate: string | null
  durationDays: number
  dailyBudget: number
  totalBudget: number
  ppn: number
  totalPayment: number
  status: string
  contentUrl: string | null
  paymentProofUrl: string | null
  adStartDate: string | null
  adEndDate: string | null
  adReport: AdReport | null
  promotorResult: PromotorResult | null
  promotorNote: string | null
  metaCampaignId?: string | null
  metaAdSetId?: string | null
  metaAdIds?: string | null
  metaDraftStatus?: string | null
  metaDraftError?: string | null
  metaDraftUpdatedAt?: string | null
  createdAt: string
}

interface MetaAdsTemplate {
  primaryTexts: string[]
  headlines: string[]
  description: string
}

interface LegacyImportGeneratedItem {
  promotorName: string
  count: number
  campaigns: Array<{
    id: string
    name: string
    city: string
    startDate: string
    endDate: string | null
    durationDays: number
  }>
}

interface LegacyImportExecutionResult {
  createdCount: number
  skippedCount: number
  totalCandidates: number
  syncResult?: {
    linkedCount: number
    updatedCount: number
    skippedCount: number
  }
}

type MetaDraftMode = "GENERATE" | "DUPLICATE"
const META_DRAFT_MODE_STORAGE_KEY = "meta_draft_mode_preference_v1"
const CONFIG_BACKUP_LAST_AT_STORAGE_KEY = "config_backup_last_at_v1"
const CONFIG_BACKUP_LAST_ACTION_STORAGE_KEY = "config_backup_last_action_v1"

interface PayoutBatchMonitor {
  id: string
  invoiceNumber?: string
  creatorName: string
  payoutDate: string
  totalRequests: number
  totalContents: number
  totalAmount: number
  transferProofUrl?: string | null
  items: Array<{
    id: string
    city: string
    startDate: string
    testEndDate: string | null
    promotorName: string
    contentCount: number
    requestAmount: number
  }>
}

interface PayoutMonitorData {
  unpaidSummary: {
    totalRequests: number
    totalContents: number
    totalAmount: number
  }
  unpaidItems: Array<{
    adRequestId: string
    creatorName: string
    city: string
    startDate: string
    testEndDate: string | null
    promotorName: string
    amount: number
    contentCount: number
  }>
  paidBatches: PayoutBatchMonitor[]
}

interface BonusBatchMonitor {
  id: string
  invoiceNumber?: string
  promotorName: string
  promotorLabel?: string
  payoutDate: string
  totalItems: number
  totalClients: number
  totalAmount: number
  transferProofUrl?: string | null
  items: Array<{
    id: string
    promotorName: string
    city: string
    startDate: string
    testEndDate: string | null
    clientCount: number
    bonusAmount: number
  }>
}

interface BonusMonitorData {
  unpaidSummary: {
    totalItems: number
    totalClients: number
    totalAmount: number
  }
  unpaidItems: Array<{
    promotorResultId: string
    adRequestId: string
    promotorName: string
    city: string
    startDate: string
    testEndDate: string | null
    clientCount: number
    amount: number
  }>
  paidBatches: BonusBatchMonitor[]
}

interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  city: string | null
  phone: string | null
  canToggle: boolean
  canDelete?: boolean
  isEnabled: boolean
}

interface LinkedAccountItem {
  owner: { id: string; name: string; email: string }
  profile: { id: string; name: string; email: string }
}

interface LinkableAccountUser {
  id: string
  name: string
  email: string
  city: string | null
  phone: string | null
}

type CreateManagedUserRole = "KONTEN_KREATOR" | "STIFIN" | "PROMOTOR"

interface GlobalAnnouncement {
  id: string
  title: string
  message: string
  variant: "info" | "success" | "warning" | "danger"
  priority: "pinned" | "high" | "normal"
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

interface MetaSyncStatus {
  lastSuccess: {
    at: string
    linkedCount: number
    updatedCount: number
    skippedCount: number
  } | null
  lastError: {
    at: string
    error: string | null
  } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRupiah = (value: number): string =>
  `Rp ${value.toLocaleString("id-ID")}`

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatDateTimeFromDate = (date: Date): string =>
  date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const computeDefaultAdSchedule = (testStartDateStr: string, testEndDateStr: string | null, durationDays: number) => {
  const testReferenceDate = new Date(testEndDateStr || testStartDateStr)
  const safeDuration = Math.max(1, Number(durationDays) || 1)

  // End date ad: H-1 dari tanggal tes, jam 21:00.
  const end = new Date(testReferenceDate)
  end.setDate(testReferenceDate.getDate() - 1)
  end.setHours(21, 0, 0, 0)

  // Start date ad: mundur sesuai durasi, jam 16:00.
  const start = new Date(end)
  start.setDate(end.getDate() - safeDuration)
  start.setHours(16, 0, 0, 0)

  // Deadline konten: H-1 dari start date, jam 23:59.
  const contentDeadline = new Date(start)
  contentDeadline.setDate(start.getDate() - 1)
  contentDeadline.setHours(23, 59, 0, 0)

  // Deadline pembayaran: H-2 dari start date, jam 23:59.
  const paymentDeadline = new Date(start)
  paymentDeadline.setDate(start.getDate() - 2)
  paymentDeadline.setHours(23, 59, 0, 0)

  return { start, end, contentDeadline, paymentDeadline }
}

const computeMaxAllowedAdEndDate = (testStartDateStr: string, testEndDateStr: string | null) => {
  const testReferenceDate = new Date(testEndDateStr || testStartDateStr)
  const maxEnd = new Date(testReferenceDate)
  maxEnd.setDate(testReferenceDate.getDate() - 1)
  maxEnd.setHours(21, 0, 0, 0)
  return maxEnd
}

const formatCampaignLabel = (ad: AdRequest): string =>
  buildCampaignName({
    city: ad.city,
    startDate: new Date(ad.startDate),
    promotorName: ad.promotor.name,
    campaignCode: ad.campaignCode || undefined,
  })

const buildCalendarCopyText = (ad: AdRequest): string => {
  const targetDate = new Date(ad.startDate)
  const day = targetDate.toLocaleDateString("id-ID", { weekday: "long" })
  const date = targetDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return `📅 ${day}, ${date} di Kota ${ad.city}!`
}

const formatPromotorNoteHuman = (
  note: string
): { title: string; lines: string[]; variant: "legacy" | "default" } => {
  if (!note.startsWith("[LEGACY_META]")) {
    return {
      title: "Catatan Promotor",
      lines: [note],
      variant: "default",
    }
  }

  const payload = note.replace("[LEGACY_META]", "").trim()
  const pairs = Array.from(payload.matchAll(/([a-zA-Z_]+)=([^\s]+)/g))
  const map = new Map<string, string>()
  for (const [, key, value] of pairs) {
    map.set(key, value === "null" ? "" : value)
  }

  const lines: string[] = []
  const importedAt = map.get("imported_at")
  if (importedAt) {
    const parsed = new Date(importedAt)
    if (!Number.isNaN(parsed.getTime())) {
      lines.push(`Data historis diimpor pada ${formatDateTimeFromDate(parsed)}.`)
    } else {
      lines.push("Data historis diimpor dari Meta Ads.")
    }
  } else {
    lines.push("Data historis diimpor dari Meta Ads.")
  }

  const sourceCampaign = map.get("source_campaign")
  if (sourceCampaign) {
    lines.push(`Sumber campaign ID: ${sourceCampaign}.`)
  }

  const manualDuration = map.get("manual_duration")
  if (manualDuration) {
    lines.push(`Durasi diatur manual: ${manualDuration} hari.`)
  }

  const manualClients = map.get("manual_clients")
  if (manualClients) {
    lines.push(`Jumlah klien awal diisi manual: ${manualClients}.`)
  }

  if (map.get("imported_bulk") === "1") {
    lines.push("Metode import: Massal per promotor.")
  }

  return {
    title: "Catatan Sinkron Meta",
    lines,
    variant: "legacy",
  }
}

const formatTestDate = (start: string, end?: string | null) => {
  const s = new Date(start)
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

  if (!end) {
    return `${s.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`
  }

  const e = new Date(end)
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} - ${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`
  }
  return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`
}

const getCvrColor = (cvr: number) => {
  if (cvr === 0) return "bg-slate-100 text-slate-600 border-slate-200"
  if (cvr <= 5) return "bg-red-100 text-red-700 border-red-200"
  if (cvr <= 10) return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-emerald-100 text-emerald-700 border-emerald-200"
}

const getCprFinalAccentClass = (cpr: number | null | undefined) => {
  if (!cpr || !Number.isFinite(cpr)) return "border-l-slate-300"
  if (cpr <= 2000) return "border-l-emerald-500"
  if (cpr <= 4000) return "border-l-amber-500"
  return "border-l-rose-500"
}

const getCprFinalPanelClass = (cpr: number | null | undefined) => {
  if (!cpr || !Number.isFinite(cpr)) return "bg-slate-50/50 border-slate-100"
  if (cpr <= 2000) return "bg-emerald-50/60 border-emerald-100"
  if (cpr <= 4000) return "bg-amber-50/60 border-amber-100"
  return "bg-rose-50/60 border-rose-100"
}

const formatToDateTimeLocal = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const toDateTimeLocalInput = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

const getJakartaDatePreviewTokens = (dateStr: string) => {
  const date = new Date(dateStr)
  const day = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(date)
  const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: "Asia/Jakarta" }).format(date)
  const month = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "Asia/Jakarta" }).format(date)
  const year = new Intl.DateTimeFormat("id-ID", { year: "numeric", timeZone: "Asia/Jakarta" }).format(date)
  return {
    day,
    tanggal,
    month,
    year,
    date: `${tanggal} ${month} ${year}`,
  }
}

const applyMetaTemplatePreview = (
  text: string,
  sample: { city: string; date: string; day: string; tanggal: string; month: string; year: string; promotor: string }
) =>
  text
    .replaceAll("{city}", sample.city)
    .replaceAll("{kota}", sample.city)
    .replaceAll("{date}", sample.date)
    .replaceAll("{date_full}", sample.date)
    .replaceAll("{day}", sample.day)
    .replaceAll("{tanggal}", sample.tanggal)
    .replaceAll("{month}", sample.month)
    .replaceAll("{year}", sample.year)
    .replaceAll("{promotor}", sample.promotor)

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  MENUNGGU_PEMBAYARAN: { label: "Menunggu Pembayaran", variant: "outline", className: "border-amber-500 text-amber-700 bg-amber-50" },
  MENUNGGU_VERIFIKASI_PEMBAYARAN: { label: "Menunggu Verifikasi Pembayaran", variant: "outline", className: "border-amber-600 text-amber-800 bg-amber-100" },
  MENUNGGU_KONTEN: { label: "Menunggu Konten", variant: "outline", className: "border-orange-500 text-orange-700 bg-orange-50" },
  DIPROSES: { label: "Diproses", variant: "outline", className: "border-blue-500 text-blue-700 bg-blue-50" },
  KONTEN_SELESAI: { label: "Konten Selesai", variant: "outline", className: "border-green-500 text-green-700 bg-green-50" },
  IKLAN_DIJADWALKAN: { label: "Iklan Dijadwalkan", variant: "outline", className: "border-blue-500 text-blue-700 bg-blue-50" },
  IKLAN_BERJALAN: { label: "Iklan Berjalan", variant: "outline", className: "border-purple-500 text-purple-700 bg-purple-50" },
  SELESAI: { label: "Selesai (Menunggu Hasil)", variant: "secondary", className: "border-gray-400 text-gray-600 bg-gray-100" },
  FINAL: { label: "Iklan Final", variant: "default", className: "bg-slate-900 text-white border-slate-900" },
}

const getStatusBadge = (status: string) => {
  const config = statusConfig[status] || { label: status, variant: "outline", className: "" }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

const getRoleLabel = (role: string) => {
  if (role === "PROMOTOR") return "Promotor"
  if (role === "KONTEN_KREATOR") return "Kreator"
  if (role === "ADVERTISER") return "Advertiser"
  if (role === "STIFIN") return "Admin STIFIn"
  return role
}

const getRoleBadgeClass = (role: string) => {
  if (role === "PROMOTOR") return "bg-amber-100 text-amber-800 border-amber-200"
  if (role === "KONTEN_KREATOR") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (role === "ADVERTISER") return "bg-blue-100 text-blue-800 border-blue-200"
  if (role === "STIFIN") return "bg-rose-100 text-rose-800 border-rose-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

const ADVERTISER_TAB_TO_ROUTE: Record<string, string> = {
  overview: "overview",
  master: "master-brief",
  meta_ads: "meta-ads",
  whatsapp: "notifikasi-wa",
  alerts: "alert-center",
  payouts: "pencairan-kreator",
  bonus_payouts: "bonus-advertiser",
  promotors: "promotor",
  users: "user",
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdvertiserDashboard({
  initialTab = "overview",
  routeBasePath,
}: {
  initialTab?: string
  routeBasePath?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [statusTab, setStatusTab] = useState("all")
  const [overviewSearch, setOverviewSearch] = useState("")
  const [debouncedOverviewSearch, setDebouncedOverviewSearch] = useState("")
  const [overviewSortBy, setOverviewSortBy] = useState<"createdAt" | "city" | "dailyBudget" | "durationDays" | "totalPayment">("createdAt")
  const [overviewSortOrder, setOverviewSortOrder] = useState<"asc" | "desc">("desc")
  const [overviewPage, setOverviewPage] = useState(1)
  const [overviewTotal, setOverviewTotal] = useState(0)
  const [overviewHasMore, setOverviewHasMore] = useState(false)
  const [loadingMoreOverview, setLoadingMoreOverview] = useState(false)
  const [hasLoadedFullAdRequests, setHasLoadedFullAdRequests] = useState(false)
  const [serverStatusCounts, setServerStatusCounts] = useState<{
    all: number
    MENUNGGU_PEMBAYARAN: number
    MENUNGGU_KONTEN: number
    KONTEN_SELESAI: number
    IKLAN_DIJADWALKAN: number
    IKLAN_BERJALAN: number
    SELESAI: number
    FINAL: number
  } | null>(null)

  // Master Brief states
  const [briefTemplates, setBriefTemplates] = useState<BriefTemplate[]>([])
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<BriefTemplate | null>(null)
  const [templateType, setTemplateType] = useState<"VO" | "JJ">("VO")
  const [templateName, setTemplateName] = useState("")
  const [templateContent, setTemplateContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // WhatsApp Template states
  const [notifTemplates, setNotifTemplates] = useState<NotificationTemplate[]>([])
  const [editingNotifTemplate, setEditingNotifTemplate] = useState<NotificationTemplate | null>(null)
  const [waChannelLink, setWaChannelLink] = useState("")

  // Action States
  const [selectedAd, setSelectedAd] = useState<AdRequest | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [adStartDate, setAdStartDate] = useState("")
  const [adEndDate, setAdEndDate] = useState("")
  const [scheduleMode, setScheduleMode] = useState<"DEFAULT" | "CUSTOM">("DEFAULT")
  const [inputAmountSpent, setInputAmountSpent] = useState("")
  const [inputTotalLeads, setInputTotalLeads] = useState("")
  const [inputCPR, setInputCPR] = useState("")
  const [payoutMonitor, setPayoutMonitor] = useState<PayoutMonitorData | null>(null)
  const [bonusMonitor, setBonusMonitor] = useState<BonusMonitorData | null>(null)
  const [payoutUnpaidPage, setPayoutUnpaidPage] = useState(1)
  const [payoutPaidPage, setPayoutPaidPage] = useState(1)
  const [bonusUnpaidPage, setBonusUnpaidPage] = useState(1)
  const [bonusPaidPage, setBonusPaidPage] = useState(1)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountItem[]>([])
  const [stifinAdmins, setStifinAdmins] = useState<LinkableAccountUser[]>([])
  const [promotorUsers, setPromotorUsers] = useState<LinkableAccountUser[]>([])
  const [selectedLinkAdminId, setSelectedLinkAdminId] = useState("")
  const [selectedLinkPromotorId, setSelectedLinkPromotorId] = useState("")
  const [linkingAccount, setLinkingAccount] = useState(false)
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [backingUpConfig, setBackingUpConfig] = useState(false)
  const [restoringConfig, setRestoringConfig] = useState(false)
  const [configLastBackupAt, setConfigLastBackupAt] = useState<string | null>(null)
  const [configLastAction, setConfigLastAction] = useState<"backup" | "restore" | null>(null)
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false)
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [createUserName, setCreateUserName] = useState("")
  const [createUserEmail, setCreateUserEmail] = useState("")
  const [createUserPhone, setCreateUserPhone] = useState("")
  const [createUserCity, setCreateUserCity] = useState("")
  const [createUserPassword, setCreateUserPassword] = useState("")
  const [createUserPasswordConfirm, setCreateUserPasswordConfirm] = useState("")
  const [createUserRole, setCreateUserRole] = useState<CreateManagedUserRole>("KONTEN_KREATOR")
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<GlobalAnnouncement | null>(null)
  const [announcementTitle, setAnnouncementTitle] = useState("")
  const [announcementMessage, setAnnouncementMessage] = useState("")
  const [announcementVariant, setAnnouncementVariant] = useState<"info" | "success" | "warning" | "danger">("info")
  const [announcementPriority, setAnnouncementPriority] = useState<"pinned" | "high" | "normal">("normal")
  const [announcementIsActive, setAnnouncementIsActive] = useState(true)
  const [announcementStartsAt, setAnnouncementStartsAt] = useState("")
  const [announcementEndsAt, setAnnouncementEndsAt] = useState("")
  const [metaTemplate, setMetaTemplate] = useState<MetaAdsTemplate>({
    primaryTexts: ["", "", "", "", ""],
    headlines: ["", "", "", "", ""],
    description: "",
  })
  const [metaTestResult, setMetaTestResult] = useState<string | null>(null)
  const [metaTesting, setMetaTesting] = useState(false)
  const [metaSyncingPerformance, setMetaSyncingPerformance] = useState(false)
  const [metaSyncStatus, setMetaSyncStatus] = useState<MetaSyncStatus | null>(null)
  const [metaSavingTemplate, setMetaSavingTemplate] = useState(false)
  const [legacyPromotorId, setLegacyPromotorId] = useState("")
  const [legacyDurationDays, setLegacyDurationDays] = useState("")
  const [legacyTotalClients, setLegacyTotalClients] = useState("")
  const [legacyPreviewing, setLegacyPreviewing] = useState(false)
  const [legacyExecuting, setLegacyExecuting] = useState(false)
  const [legacyGeneratedItem, setLegacyGeneratedItem] = useState<LegacyImportGeneratedItem | null>(null)
  const [legacyExecutionResult, setLegacyExecutionResult] = useState<LegacyImportExecutionResult | null>(null)
  const [proofPreviewOpen, setProofPreviewOpen] = useState(false)
  const [proofPreviewUrl, setProofPreviewUrl] = useState("")
  const [proofPreviewTitle, setProofPreviewTitle] = useState("Bukti Transfer")
  const [metaRetryingAdId, setMetaRetryingAdId] = useState<string | null>(null)
  const [metaDraftMode, setMetaDraftMode] = useState<MetaDraftMode>("GENERATE")
  const restoreConfigInputRef = useRef<HTMLInputElement | null>(null)
  const loadedTabsRef = useRef(new Set<string>())
  const adRequestsAbortRef = useRef<AbortController | null>(null)
  const metaSyncStatusAbortRef = useRef<AbortController | null>(null)
  const metaSyncPostAbortRef = useRef<AbortController | null>(null)
  const metaSyncBusyRef = useRef(false)
  const manualMetaSyncClickedAtRef = useRef(0)

  useEffect(() => {
    if (!initialTab) return
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(META_DRAFT_MODE_STORAGE_KEY)
      if (saved === "DUPLICATE" || saved === "GENERATE") {
        setMetaDraftMode(saved)
      }
    } catch {
      // ignore localStorage errors
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(META_DRAFT_MODE_STORAGE_KEY, metaDraftMode)
    } catch {
      // ignore localStorage errors
    }
  }, [metaDraftMode])

  useEffect(() => {
    try {
      const lastAt = window.localStorage.getItem(CONFIG_BACKUP_LAST_AT_STORAGE_KEY)
      const lastAction = window.localStorage.getItem(CONFIG_BACKUP_LAST_ACTION_STORAGE_KEY)
      if (lastAt) setConfigLastBackupAt(lastAt)
      if (lastAction === "backup" || lastAction === "restore") {
        setConfigLastAction(lastAction)
      }
    } catch {
      // ignore localStorage errors
    }
  }, [])

  // ── Promotor aggregation ───────────────────────────────────────────────────
  const promotorStats = (adRequests: AdRequest[]) => {
    const stats: Record<string, {
      id: string,
      name: string,
      phone: string,
      totalConfirmed: number,
      totalClients: number,
      totalSpent: number,
      totalLeads: number,
      totalDailyBudget: number,
      adCountForBudget: number
    }> = {}

    adRequests.forEach(ad => {
      const p = ad.promotor
      if (!stats[p.id]) {
        stats[p.id] = {
          id: p.id,
          name: p.name,
          phone: p.phone || "-",
          totalConfirmed: 0,
          totalClients: 0,
          totalSpent: 0,
          totalLeads: 0,
          totalDailyBudget: 0,
          adCountForBudget: 0
        }
      }

      if (!["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(ad.status)) {
        stats[p.id].totalConfirmed++
        stats[p.id].totalDailyBudget += ad.dailyBudget
        stats[p.id].adCountForBudget++
      }

      if (ad.promotorResult && ad.promotorResult.status === "VALID") {
        stats[p.id].totalClients += ad.promotorResult.totalClients
      }

      if (ad.adReport) {
        stats[p.id].totalSpent += (ad.adReport.amountSpent || 0)
        stats[p.id].totalLeads += (ad.adReport.totalLeads || 0)
      }
    })

    return Object.values(stats)
  }

  const promotorData = promotorStats(adRequests)
  const promotorUsersForLegacy = managedUsers.filter((item) => item.role === "PROMOTOR")
  const legacyImportedRequests = adRequests.filter((item) =>
    (item.promotorNote || "").startsWith("[LEGACY_META]")
  )
  const creatorUsers = managedUsers.filter((u) => u.role === "KONTEN_KREATOR")
  const activeCreatorCount = creatorUsers.filter((u) => u.isEnabled).length
  const inactiveCreatorCount = Math.max(creatorUsers.length - activeCreatorCount, 0)
  const stifinLinkCounts = linkedAccounts.reduce<Record<string, number>>((acc, link) => {
    acc[link.owner.id] = (acc[link.owner.id] || 0) + 1
    return acc
  }, {})
  const selectedAdminLinkCount = selectedLinkAdminId ? stifinLinkCounts[selectedLinkAdminId] || 0 : 0
  const canAddSelectedAdminLink = selectedAdminLinkCount < 2
  const metaPreviewSample = (() => {
    const latest = adRequests[0]
    if (!latest) {
      return {
        city: "Gresik",
        day: "Minggu",
        tanggal: "26",
        month: "April",
        year: "2026",
        date: "26 April 2026",
        promotor: "Roy",
      }
    }
    const tokens = getJakartaDatePreviewTokens(latest.startDate)
    return {
      city: latest.city,
      day: tokens.day,
      tanggal: tokens.tanggal,
      month: tokens.month,
      year: tokens.year,
      date: tokens.date,
      promotor: latest.promotor.name,
    }
  })()
  const MONITOR_PAGE_SIZE = 10
  const payoutUnpaidItems = payoutMonitor?.unpaidItems || []
  const payoutPaidBatches = payoutMonitor?.paidBatches || []
  const bonusUnpaidItems = bonusMonitor?.unpaidItems || []
  const bonusPaidBatches = bonusMonitor?.paidBatches || []

  const payoutUnpaidTotalPages = Math.max(1, Math.ceil(payoutUnpaidItems.length / MONITOR_PAGE_SIZE))
  const payoutPaidTotalPages = Math.max(1, Math.ceil(payoutPaidBatches.length / MONITOR_PAGE_SIZE))
  const bonusUnpaidTotalPages = Math.max(1, Math.ceil(bonusUnpaidItems.length / MONITOR_PAGE_SIZE))
  const bonusPaidTotalPages = Math.max(1, Math.ceil(bonusPaidBatches.length / MONITOR_PAGE_SIZE))

  const paginatedPayoutUnpaidItems = useMemo(() => {
    const safePage = Math.min(payoutUnpaidPage, payoutUnpaidTotalPages)
    const start = (safePage - 1) * MONITOR_PAGE_SIZE
    return payoutUnpaidItems.slice(start, start + MONITOR_PAGE_SIZE)
  }, [payoutUnpaidItems, payoutUnpaidPage, payoutUnpaidTotalPages])

  const paginatedPayoutPaidBatches = useMemo(() => {
    const safePage = Math.min(payoutPaidPage, payoutPaidTotalPages)
    const start = (safePage - 1) * MONITOR_PAGE_SIZE
    return payoutPaidBatches.slice(start, start + MONITOR_PAGE_SIZE)
  }, [payoutPaidBatches, payoutPaidPage, payoutPaidTotalPages])

  const paginatedBonusUnpaidItems = useMemo(() => {
    const safePage = Math.min(bonusUnpaidPage, bonusUnpaidTotalPages)
    const start = (safePage - 1) * MONITOR_PAGE_SIZE
    return bonusUnpaidItems.slice(start, start + MONITOR_PAGE_SIZE)
  }, [bonusUnpaidItems, bonusUnpaidPage, bonusUnpaidTotalPages])

  const paginatedBonusPaidBatches = useMemo(() => {
    const safePage = Math.min(bonusPaidPage, bonusPaidTotalPages)
    const start = (safePage - 1) * MONITOR_PAGE_SIZE
    return bonusPaidBatches.slice(start, start + MONITOR_PAGE_SIZE)
  }, [bonusPaidBatches, bonusPaidPage, bonusPaidTotalPages])

  useEffect(() => {
    setPayoutUnpaidPage(1)
    setPayoutPaidPage(1)
  }, [payoutUnpaidItems.length, payoutPaidBatches.length])

  useEffect(() => {
    setBonusUnpaidPage(1)
    setBonusPaidPage(1)
  }, [bonusUnpaidItems.length, bonusPaidBatches.length])

  const fetchMetaSyncStatus = useCallback(async () => {
    try {
      metaSyncStatusAbortRef.current?.abort()
      const controller = new AbortController()
      metaSyncStatusAbortRef.current = controller
      const res = await fetchWithTimeout("/api/meta/sync-performance", { signal: controller.signal }, 12000)
      if (!res.ok) return
      const data = await res.json()
      if (data?.ok) {
        setMetaSyncStatus({
          lastSuccess: data.lastSuccess || null,
          lastError: data.lastError || null,
        })
      }
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Sinkron Meta timeout, coba lagi.",
        showErrorToast: false,
      })
      if (handled !== "error") return
      // silent
    }
  }, [])

  const syncMetaPerformanceData = useCallback(async (showToast = false) => {
    if (metaSyncBusyRef.current) return
    metaSyncBusyRef.current = true
    setMetaSyncingPerformance(true)
    try {
      metaSyncPostAbortRef.current?.abort()
      const controller = new AbortController()
      metaSyncPostAbortRef.current = controller
      const res = await fetchWithTimeout("/api/meta/sync-performance", {
        method: "POST",
        signal: controller.signal,
      }, 20000)
      if (!res.ok) return
      const data = await res.json()
      if (showToast && data?.ok) {
        toast.success(`Sinkron Meta: ${data.linkedCount} mapping, ${data.updatedCount} data terbarui`)
      }
      await fetchMetaSyncStatus()
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Sinkron Meta timeout, coba lagi.",
        showErrorToast: false,
      })
      if (handled !== "error") return
      // silent fail; advertiser can still work with existing data
    } finally {
      metaSyncBusyRef.current = false
      setMetaSyncingPerformance(false)
    }
  }, [fetchMetaSyncStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedOverviewSearch(overviewSearch.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [overviewSearch])

  const fetchAdRequests = useCallback(async (
    runSync = false,
    options?: { page?: number; append?: boolean; forceFull?: boolean }
  ) => {
    if (runSync) {
      await syncMetaPerformanceData(false)
    }

    const page = options?.page || 1
    const append = options?.append || false
    const forceFull = options?.forceFull || false
    const shouldUseOverviewPaging = activeTab === "overview" && !forceFull

    try {
      adRequestsAbortRef.current?.abort()
      const controller = new AbortController()
      adRequestsAbortRef.current = controller

      if (shouldUseOverviewPaging) setLoadingMoreOverview(true)
      const query = new URLSearchParams()
      query.set("lite", "1")
      query.set("view", `advertiser:${activeTab}`)
      let url = "/api/ad-requests"
      if (shouldUseOverviewPaging) {
        query.set("page", String(page))
        query.set("pageSize", "15")
        query.set("sortBy", overviewSortBy)
        query.set("sortOrder", overviewSortOrder)
        if (debouncedOverviewSearch) {
          query.set("q", debouncedOverviewSearch)
        }
        if (statusTab !== "all" && statusTab !== "MENUNGGU_PEMBAYARAN") {
          query.set("status", statusTab)
        }
        url = `/api/ad-requests?${query.toString()}`
      } else {
        url = `/api/ad-requests?${query.toString()}`
      }

      const res = await fetchWithTimeout(url, { signal: controller.signal }, 20000)
      if (!res.ok) throw new Error("Gagal mengambil data")
      const data = await res.json()
      if (shouldUseOverviewPaging) {
        const items: AdRequest[] = data.items || []
        if (append) {
          setAdRequests((prev) => [...prev, ...items])
        } else {
          setAdRequests(items)
        }
        setOverviewPage(data.pagination?.page || page)
        setOverviewTotal(data.pagination?.total || items.length)
        setOverviewHasMore(Boolean(data.pagination?.hasMore))
        if (data.statusCounts) {
          setServerStatusCounts(data.statusCounts)
        }
        setHasLoadedFullAdRequests(false)
      } else {
        setAdRequests(data)
        setOverviewPage(1)
        setOverviewTotal(Array.isArray(data) ? data.length : 0)
        setOverviewHasMore(false)
        setServerStatusCounts(null)
        setHasLoadedFullAdRequests(true)
      }
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Muat data pengajuan timeout, coba lagi.",
        errorMessage: "Gagal memuat data pengajuan iklan",
      })
      if (handled !== "error") return
    } finally {
      setLoadingMoreOverview(false)
      setLoading(false)
    }
  }, [activeTab, debouncedOverviewSearch, overviewSortBy, overviewSortOrder, statusTab, syncMetaPerformanceData])

  const overviewTotalPages = Math.max(1, Math.ceil((overviewTotal || 0) / 15))
  const overviewFirstItemNumber = overviewTotal === 0 ? 0 : (overviewPage - 1) * 15 + 1
  const overviewLastItemNumber = Math.min(overviewPage * 15, overviewTotal)

  const handleManualMetaSync = useCallback(async () => {
    const now = Date.now()
    if (now - manualMetaSyncClickedAtRef.current < 1200) return
    manualMetaSyncClickedAtRef.current = now
    if (metaSyncingPerformance || metaSyncBusyRef.current) return
    await syncMetaPerformanceData(true)
    await fetchAdRequests(false, { page: 1, append: false })
  }, [metaSyncingPerformance, syncMetaPerformanceData, fetchAdRequests])

  useEffect(() => {
    return () => {
      adRequestsAbortRef.current?.abort()
      metaSyncStatusAbortRef.current?.abort()
      metaSyncPostAbortRef.current?.abort()
    }
  }, [])

  const fetchBriefTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/brief-templates")
      if (!res.ok) throw new Error("Gagal mengambil data")
      const data = await res.json()
      setBriefTemplates(data)
    } catch { /* silent */ }
  }, [])

  const fetchNotifTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-templates")
      if (!res.ok) throw new Error("Gagal mengambil data")
      const data = await res.json()
      setNotifTemplates(data)
    } catch { /* silent */ }
  }, [])

  const fetchWaChannelLink = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setWaChannelLink(data.value || "")
    } catch { /* silent */ }
  }, [])

  const fetchPayoutMonitor = useCallback(async () => {
    try {
      const res = await fetch("/api/creator-payouts")
      if (!res.ok) throw new Error("Gagal mengambil data payout")
      const data: PayoutMonitorData = await res.json()
      setPayoutMonitor(data)
    } catch {
      // silent fail
    }
  }, [])

  const fetchBonusMonitor = useCallback(async () => {
    try {
      const res = await fetch("/api/advertiser-bonuses")
      if (!res.ok) throw new Error("Gagal mengambil data bonus")
      const data: BonusMonitorData = await res.json()
      setBonusMonitor(data)
    } catch {
      // silent fail
    }
  }, [])

  const fetchManagedUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/users/manage")
      if (!res.ok) throw new Error("Gagal mengambil daftar user")
      const data = await res.json()
      setManagedUsers(data.users || [])
    } catch {
      // silent fail
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const fetchManagedLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/users/manage/links")
      if (!res.ok) throw new Error("Gagal mengambil relasi akun")
      const data = await res.json()
      setLinkedAccounts(data.links || [])
      setStifinAdmins(data.admins || [])
      setPromotorUsers(data.promotors || [])
      if (!selectedLinkAdminId && data.admins?.[0]?.id) {
        setSelectedLinkAdminId(data.admins[0].id)
      }
      if (!selectedLinkPromotorId && data.promotors?.[0]?.id) {
        setSelectedLinkPromotorId(data.promotors[0].id)
      }
    } catch {
      // silent fail
    }
  }, [selectedLinkAdminId, selectedLinkPromotorId])

  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true)
    try {
      const res = await fetch("/api/announcements")
      if (!res.ok) throw new Error("Gagal mengambil pengumuman")
      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch {
      // silent fail
    } finally {
      setAnnouncementsLoading(false)
    }
  }, [])

  const fetchMetaTemplate = useCallback(async () => {
    try {
      const res = await fetch("/api/meta/templates")
      if (!res.ok) throw new Error("Gagal mengambil template Meta Ads")
      const data = await res.json()
      setMetaTemplate({
        primaryTexts: Array.from({ length: 5 }).map((_, idx) => data.primaryTexts?.[idx] || ""),
        headlines: Array.from({ length: 5 }).map((_, idx) => data.headlines?.[idx] || ""),
        description: data.description || "",
      })
    } catch {
      // silent fail
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadedTabsRef.current.clear()
    setActiveTab(initialTab || "overview")
    setStatusTab("all")
    setOverviewSearch("")
    setDebouncedOverviewSearch("")
    setHasLoadedFullAdRequests(false)
    // Load awal route-aware: hanya fetch data yang diperlukan oleh halaman aktif.
    if ((initialTab || "overview") === "overview") {
      fetchAdRequests(false, { page: 1, append: false })
    } else if ((initialTab || "overview") === "promotors") {
      fetchAdRequests(false, { forceFull: true })
    } else {
      setAdRequests([])
      setServerStatusCounts(null)
      setOverviewPage(1)
      setOverviewHasMore(false)
      setLoading(false)
    }
    fetchMetaSyncStatus()
  }, [user, initialTab])

  useEffect(() => {
    if (!user || !activeTab) return
    if (loadedTabsRef.current.has(activeTab)) return

    loadedTabsRef.current.add(activeTab)
    if (activeTab === "master") {
      fetchBriefTemplates()
      return
    }
    if (activeTab === "meta_ads") {
      fetchMetaTemplate()
      return
    }
    if (activeTab === "whatsapp") {
      fetchNotifTemplates()
      fetchWaChannelLink()
      return
    }
    if (activeTab === "alerts") {
      fetchAnnouncements()
      return
    }
    if (activeTab === "payouts") {
      fetchPayoutMonitor()
      return
    }
    if (activeTab === "bonus_payouts") {
      fetchBonusMonitor()
      return
    }
    if (activeTab === "users") {
      fetchManagedUsers()
      fetchManagedLinks()
      return
    }

    if (activeTab === "promotors" && !hasLoadedFullAdRequests) {
      fetchAdRequests(false, { forceFull: true })
    }
  }, [
    user,
    activeTab,
    hasLoadedFullAdRequests,
    fetchBriefTemplates,
    fetchMetaTemplate,
    fetchNotifTemplates,
    fetchWaChannelLink,
    fetchAnnouncements,
    fetchPayoutMonitor,
    fetchBonusMonitor,
    fetchManagedUsers,
    fetchManagedLinks,
    fetchAdRequests,
  ])

  useEffect(() => {
    if (!user || activeTab !== "overview") return
    fetchAdRequests(false, { page: 1, append: false })
  }, [statusTab, activeTab, overviewSortBy, overviewSortOrder, debouncedOverviewSearch, user, fetchAdRequests])

  useEffect(() => {
    if (selectedAd && scheduleMode === "DEFAULT") {
      const { start, end } = computeDefaultAdSchedule(selectedAd.startDate, selectedAd.testEndDate, selectedAd.durationDays)

      setAdStartDate(formatToDateTimeLocal(start))
      setAdEndDate(formatToDateTimeLocal(end))
    }
  }, [selectedAd, scheduleMode])

  const refreshAdRequestsForActiveTab = useCallback(async () => {
    if (activeTab === "overview") {
      await fetchAdRequests(false, { page: 1, append: false })
      return
    }
    if (activeTab === "promotors") {
      await fetchAdRequests(false, { forceFull: true })
      return
    }
    if (hasLoadedFullAdRequests) {
      await fetchAdRequests(false, { forceFull: true })
    }
  }, [activeTab, hasLoadedFullAdRequests, fetchAdRequests])

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/brief-templates", {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplate?.id,
          type: templateType,
          name: templateName,
          content: templateContent,
        }),
      })
      if (!res.ok) throw new Error("Gagal menyimpan template")
      toast.success(editingTemplate ? "Template berhasil diupdate" : "Template berhasil dibuat")
      fetchBriefTemplates()
      setIsTemplateDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Hapus template ini?")) return
    try {
      const res = await fetch(`/api/brief-templates?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Template dihapus")
      fetchBriefTemplates()
    } catch { toast.error("Gagal menghapus") }
  }

  const openProofPreview = (url: string, title = "Bukti Transfer") => {
    setProofPreviewUrl(url)
    setProofPreviewTitle(title)
    setProofPreviewOpen(true)
  }

  const isPdfProof = proofPreviewUrl.toLowerCase().includes(".pdf")

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAd) return
    const startDate = new Date(adStartDate)
    const endDate = new Date(adEndDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      toast.error("Format waktu jadwal tidak valid")
      return
    }

    if (startDate.getTime() > endDate.getTime()) {
      toast.error("Waktu mulai tayang tidak boleh melebihi waktu berakhir")
      return
    }

    if (scheduleMode === "DEFAULT") {
      const maxAllowedEndDate = computeMaxAllowedAdEndDate(selectedAd.startDate, selectedAd.testEndDate)
      if (endDate.getTime() > maxAllowedEndDate.getTime()) {
        toast.error(`Waktu berakhir melebihi batas. Maksimal ${formatDateTimeFromDate(maxAllowedEndDate)} (H-1 jam 21:00).`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/ad-requests/${selectedAd.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adStartDate, adEndDate, mode: scheduleMode }),
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Iklan berhasil dijadwalkan!")
      setScheduleDialogOpen(false)
      await refreshAdRequestsForActiveTab()
    } catch { toast.error("Gagal menjadwalkan iklan") }
    finally { setIsSubmitting(false) }
  }

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAd) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/ad-requests/${selectedAd.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountSpent: parseInt(inputAmountSpent),
          totalLeads: parseInt(inputTotalLeads),
          cpr: parseFloat(inputCPR)
        }),
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Laporan berhasil diunggah!")
      setReportDialogOpen(false)
      await refreshAdRequestsForActiveTab()
    } catch { toast.error("Gagal mengunggah laporan") }
    finally { setIsSubmitting(false) }
  }

  const handleVerifyPayment = async (adId: string) => {
    if (!confirm("Tandai pengajuan ini sebagai 'Sudah Terbayar'?")) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/ad-requests/${adId}/verify-payment`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Pembayaran berhasil dikonfirmasi!")
      await refreshAdRequestsForActiveTab()
    } catch { toast.error("Gagal mengonfirmasi pembayaran") }
    finally { setIsSubmitting(false) }
  }

  const handleUpdateNotifTemplate = async (e: React.FormEvent | null, slug: string, isActive?: boolean, message?: string) => {
    if (e) e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/notification-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, isActive, message }),
      })
      if (!res.ok) throw new Error("Gagal")
      if (message !== undefined) toast.success("Pesan WA diperbarui")
      fetchNotifTemplates()
      setEditingNotifTemplate(null)
    } catch { toast.error("Gagal mengupdate") }
    finally { setIsSubmitting(false) }
  }

  const handleSaveWaChannelLink = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: waChannelLink }),
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Link Channel WA diperbarui")
    } catch { toast.error("Gagal menyimpan link") }
    finally { setIsSubmitting(false) }
  }

  const handleToggleManagedUser = async (userId: string, nextEnabled: boolean) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isEnabled: nextEnabled }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal memperbarui status user")
      }
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isEnabled: nextEnabled } : u))
      )
      toast.success(`Status user berhasil diubah menjadi ${nextEnabled ? "ON" : "OFF"}`)
    } catch (error: any) {
      toast.error(error?.message || "Gagal memperbarui status user")
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleDeleteManagedUser = async (userId: string) => {
    const targetUser = managedUsers.find((u) => u.id === userId)
    const roleLabel = targetUser ? getRoleLabel(targetUser.role) : "user"
    if (!confirm(`Hapus user ${roleLabel} ini? Aksi ini tidak bisa dibatalkan.`)) return
    setDeletingUserId(userId)
    try {
      const res = await fetch(`/api/users/manage?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghapus user")
      setManagedUsers((prev) => prev.filter((u) => u.id !== userId))
      setLinkedAccounts((prev) =>
        prev.filter((item) => item.owner.id !== userId && item.profile.id !== userId)
      )
      toast.success("User berhasil dihapus")
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghapus user")
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleLinkAdminPromotor = async () => {
    if (!selectedLinkAdminId || !selectedLinkPromotorId) {
      toast.error("Pilih admin STIFIn dan promotor terlebih dahulu")
      return
    }
    if (!canAddSelectedAdminLink) {
      toast.error("Admin terpilih sudah memiliki 2 relasi promotor")
      return
    }
    setLinkingAccount(true)
    try {
      const res = await fetch("/api/users/manage/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: selectedLinkAdminId,
          promotorId: selectedLinkPromotorId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghubungkan akun")
      toast.success("Akun admin dan promotor berhasil dihubungkan")
      fetchManagedLinks()
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghubungkan akun")
    } finally {
      setLinkingAccount(false)
    }
  }

  const handleUnlinkAdminPromotor = async (adminId: string, promotorId: string) => {
    const key = `${adminId}:${promotorId}`
    setUnlinkingKey(key)
    try {
      const res = await fetch(
        `/api/users/manage/links?adminId=${encodeURIComponent(adminId)}&promotorId=${encodeURIComponent(promotorId)}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal melepas relasi akun")
      toast.success("Relasi akun admin-promotor berhasil dilepas")
      fetchManagedLinks()
    } catch (error: any) {
      toast.error(error?.message || "Gagal melepas relasi akun")
    } finally {
      setUnlinkingKey(null)
    }
  }

  const handleBackupConfig = async () => {
    setBackingUpConfig(true)
    try {
      const res = await fetch("/api/system/config-backup")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal backup config")

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19)
      const filename = `config-backup-${stamp}.json`
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      const nowIso = new Date().toISOString()
      setConfigLastBackupAt(nowIso)
      setConfigLastAction("backup")
      try {
        window.localStorage.setItem(CONFIG_BACKUP_LAST_AT_STORAGE_KEY, nowIso)
        window.localStorage.setItem(CONFIG_BACKUP_LAST_ACTION_STORAGE_KEY, "backup")
      } catch {
        // ignore localStorage errors
      }

      toast.success("Backup config berhasil diunduh")
    } catch (error: any) {
      toast.error(error?.message || "Gagal backup config")
    } finally {
      setBackingUpConfig(false)
    }
  }

  const handleRestoreConfigClick = () => {
    restoreConfigInputRef.current?.click()
  }

  const handleRestoreConfigFile = async (file: File | null) => {
    if (!file) return
    if (!confirm("Restore config akan menimpa Master Brief, Notifikasi WA, dan setting Meta Ads. Lanjutkan?")) {
      return
    }

    setRestoringConfig(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const res = await fetch("/api/system/config-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal restore config")

      const nowIso = new Date().toISOString()
      setConfigLastBackupAt(nowIso)
      setConfigLastAction("restore")
      try {
        window.localStorage.setItem(CONFIG_BACKUP_LAST_AT_STORAGE_KEY, nowIso)
        window.localStorage.setItem(CONFIG_BACKUP_LAST_ACTION_STORAGE_KEY, "restore")
      } catch {
        // ignore localStorage errors
      }

      toast.success("Restore config berhasil")
      await Promise.all([fetchBriefTemplates(), fetchNotifTemplates(), fetchMetaTemplate(), fetchWaChannelLink()])
    } catch (error: any) {
      toast.error(error?.message || "Gagal restore config")
    } finally {
      setRestoringConfig(false)
      if (restoreConfigInputRef.current) {
        restoreConfigInputRef.current.value = ""
      }
    }
  }

  const resetCreateUserForm = () => {
    setCreateUserName("")
    setCreateUserEmail("")
    setCreateUserPhone("")
    setCreateUserCity("")
    setCreateUserPassword("")
    setCreateUserPasswordConfirm("")
    setCreateUserRole("KONTEN_KREATOR")
  }

  const handleCreateManagedUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (createUserPassword !== createUserPasswordConfirm) {
      toast.error("Konfirmasi password tidak sama")
      return
    }

    setCreateUserLoading(true)
    try {
      const res = await fetch("/api/users/manage/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createUserName,
          email: createUserEmail,
          phone: createUserPhone,
          city: createUserCity,
          password: createUserPassword,
          role: createUserRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan user")

      toast.success("User baru berhasil ditambahkan")
      setCreateUserDialogOpen(false)
      resetCreateUserForm()
      fetchManagedUsers()
      fetchManagedLinks()
    } catch (error: any) {
      toast.error(error?.message || "Gagal menambahkan user")
    } finally {
      setCreateUserLoading(false)
    }
  }

  const openCreateAnnouncementDialog = () => {
    setEditingAnnouncement(null)
    setAnnouncementTitle("")
    setAnnouncementMessage("")
    setAnnouncementVariant("info")
    setAnnouncementPriority("normal")
    setAnnouncementIsActive(true)
    setAnnouncementStartsAt("")
    setAnnouncementEndsAt("")
    setAnnouncementDialogOpen(true)
  }

  const openEditAnnouncementDialog = (item: GlobalAnnouncement) => {
    setEditingAnnouncement(item)
    setAnnouncementTitle(item.title)
    setAnnouncementMessage(item.message)
    setAnnouncementVariant(item.variant)
    setAnnouncementPriority(item.priority || "normal")
    setAnnouncementIsActive(item.isActive)
    setAnnouncementStartsAt(toDateTimeLocalInput(item.startsAt))
    setAnnouncementEndsAt(toDateTimeLocalInput(item.endsAt))
    setAnnouncementDialogOpen(true)
  }

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const startsAtIso = announcementStartsAt ? new Date(announcementStartsAt).toISOString() : null
      const endsAtIso = announcementEndsAt ? new Date(announcementEndsAt).toISOString() : null

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAnnouncement?.id,
          title: announcementTitle,
          message: announcementMessage,
          variant: announcementVariant,
          priority: announcementPriority,
          isActive: announcementIsActive,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengumuman")

      toast.success(editingAnnouncement ? "Pengumuman berhasil diperbarui" : "Pengumuman berhasil dibuat")
      setAnnouncementDialogOpen(false)
      fetchAnnouncements()
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan pengumuman")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Hapus pengumuman ini?")) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pengumuman")
      toast.success("Pengumuman berhasil dihapus")
      fetchAnnouncements()
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghapus pengumuman")
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateMetaTemplateList = (type: "primaryTexts" | "headlines", index: number, value: string) => {
    setMetaTemplate((prev) => {
      const next = [...prev[type]]
      next[index] = value
      return { ...prev, [type]: next }
    })
  }

  const handleSaveMetaTemplate = async () => {
    setMetaSavingTemplate(true)
    try {
      const payload = {
        primaryTexts: metaTemplate.primaryTexts.filter((item) => item.trim()),
        headlines: metaTemplate.headlines.filter((item) => item.trim()),
        description: metaTemplate.description,
      }
      const res = await fetch("/api/meta/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan template Meta Ads")
      toast.success("Template Meta Ads berhasil disimpan")
      fetchMetaTemplate()
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan template Meta Ads")
    } finally {
      setMetaSavingTemplate(false)
    }
  }

  const handleMetaConnectionTest = async () => {
    setMetaTesting(true)
    setMetaTestResult(null)
    try {
      const res = await fetch("/api/meta/test")
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Koneksi Meta gagal")
      const accountName = data.result?.account?.name || data.result?.account?.id || "-"
      setMetaTestResult(`Terhubung: ${data.result?.me?.name || "-"} • Ad Account: ${accountName}`)
      toast.success("Koneksi Meta Ads berhasil")
    } catch (error: any) {
      setMetaTestResult(error?.message || "Koneksi Meta gagal")
      toast.error(error?.message || "Koneksi Meta gagal")
    } finally {
      setMetaTesting(false)
    }
  }

  const handleRetryMetaDraft = async (adId: string) => {
    setMetaRetryingAdId(adId)
    try {
      const res = await fetch("/api/meta/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adRequestId: adId, force: true, mode: metaDraftMode }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || "Gagal generate ulang draft Meta")
      if (data.partial) {
        toast.warning(data.message || "Draft Campaign berhasil dibuat, namun Ad Set/Ads belum tuntas otomatis.")
      } else {
        toast.success(data.message || "Draft Meta berhasil digenerate ulang")
      }
      await refreshAdRequestsForActiveTab()
    } catch (error: any) {
      toast.error(error?.message || "Gagal generate ulang draft Meta")
    } finally {
      setMetaRetryingAdId(null)
    }
  }

  const handlePreviewLegacyCampaigns = async () => {
    if (!legacyPromotorId) {
      toast.error("Pilih promotor terlebih dahulu")
      return
    }

    setLegacyPreviewing(true)
    setLegacyExecutionResult(null)
    try {
      const res = await fetch("/api/meta/legacy-import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotorId: legacyPromotorId,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal sinkron campaign promotor")
      }

      const selectedPromotor = promotorUsersForLegacy.find((item) => item.id === legacyPromotorId)
      setLegacyGeneratedItem({
        promotorName: selectedPromotor?.name || "-",
        count: data.count || 0,
        campaigns: data.campaigns || [],
      })
      toast.success(`Ditemukan ${data.count || 0} campaign untuk promotor ini`)
    } catch (error: any) {
      toast.error(error?.message || "Gagal sinkron campaign promotor")
    } finally {
      setLegacyPreviewing(false)
    }
  }

  const handleExecuteLegacyCampaigns = async () => {
    if (!legacyPromotorId) {
      toast.error("Pilih promotor terlebih dahulu")
      return
    }

    setLegacyExecuting(true)
    try {
      const res = await fetch("/api/meta/legacy-import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotorId: legacyPromotorId,
          durationDays: legacyDurationDays ? Number.parseInt(legacyDurationDays, 10) : undefined,
          totalClients: legacyTotalClients ? Number.parseInt(legacyTotalClients, 10) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal eksekusi import campaign historis")
      }

      setLegacyExecutionResult({
        createdCount: data.createdCount || 0,
        skippedCount: data.skippedCount || 0,
        totalCandidates: data.totalCandidates || 0,
        syncResult: data.syncResult,
      })
      toast.success(`Import selesai: ${data.createdCount || 0} dibuat, ${data.skippedCount || 0} dilewati`)
      await refreshAdRequestsForActiveTab()
    } catch (error: any) {
      toast.error(error?.message || "Gagal eksekusi import campaign historis")
    } finally {
      setLegacyExecuting(false)
    }
  }

  const handleCopyText = async (text: string, label: string) => {
    if (!text.trim()) {
      toast.error(`${label} masih kosong`)
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} berhasil disalin`)
    } catch {
      toast.error(`Gagal menyalin ${label}`)
    }
  }

  const handleToggleAnnouncement = async (item: GlobalAnnouncement, nextActive: boolean) => {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          message: item.message,
          variant: item.variant,
          priority: item.priority,
          isActive: nextActive,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pengumuman")
      setAnnouncements((prev) => prev.map((a) => (a.id === item.id ? { ...a, isActive: nextActive } : a)))
      toast.success(`Pengumuman ${nextActive ? "diaktifkan" : "dinonaktifkan"}`)
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengubah status pengumuman")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalSpentAmount = useMemo(
    () => adRequests.reduce((acc, curr) => acc + (curr.adReport?.amountSpent || 0), 0),
    [adRequests]
  )
  const totalLeadsCount = useMemo(
    () => adRequests.reduce((acc, curr) => acc + (curr.adReport?.totalLeads || 0), 0),
    [adRequests]
  )

  const computedStatusCounts = useMemo(() => {
    const counts = {
      all: adRequests.length,
      MENUNGGU_PEMBAYARAN: 0,
      MENUNGGU_KONTEN: 0,
      KONTEN_SELESAI: 0,
      IKLAN_DIJADWALKAN: 0,
      IKLAN_BERJALAN: 0,
      SELESAI: 0,
      FINAL: 0,
    }
    for (const req of adRequests) {
      if (["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(req.status)) {
        counts.MENUNGGU_PEMBAYARAN += 1
      } else if (req.status in counts) {
        ;(counts as any)[req.status] += 1
      }
    }
    return counts
  }, [adRequests])

  const statusCounts = serverStatusCounts || computedStatusCounts

  const filteredRequests = useMemo(() => {
    if (statusTab === "all") return adRequests
    if (statusTab === "MENUNGGU_PEMBAYARAN") {
      return adRequests.filter((r) => ["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(r.status))
    }
    return adRequests.filter((r) => r.status === statusTab)
  }, [adRequests, statusTab])

  if (loading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Advertiser</h1>
        <p className="text-sm text-muted-foreground font-medium">Monitoring performa iklan dan kelola notifikasi</p>
      </div>

      {/* ── Stats Cards (Standard Style) ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-none border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Budget
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">
              {formatRupiah(totalSpentAmount)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Akumulasi anggaran iklan terpakai
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Leads
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-600">
              {totalLeadsCount.toLocaleString("id-ID")}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Total calon klien yang didapat
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          setActiveTab(nextTab)
          if (routeBasePath) {
            const routeSegment = ADVERTISER_TAB_TO_ROUTE[nextTab] || ADVERTISER_TAB_TO_ROUTE.overview
            router.push(`${routeBasePath}/${routeSegment}`)
          }
        }}
        className="w-full space-y-4"
      >
        <TabsList className="w-full bg-slate-100/50 p-1 border h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="gap-2 text-xs sm:text-sm"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="master" className="gap-2 text-xs sm:text-sm"><FileText className="h-4 w-4" /> Master Brief</TabsTrigger>
          <TabsTrigger value="meta_ads" className="gap-2 text-xs sm:text-sm"><PlugZap className="h-4 w-4" /> Meta Ads</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 text-xs sm:text-sm"><MessageSquare className="h-4 w-4" /> Notifikasi WA</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 text-xs sm:text-sm"><AlertCircle className="h-4 w-4" /> Alert Center</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2 text-xs sm:text-sm"><Wallet className="h-4 w-4" /> Pencairan Kreator</TabsTrigger>
          <TabsTrigger value="bonus_payouts" className="gap-2 text-xs sm:text-sm"><DollarSign className="h-4 w-4" /> Bonus Advertiser</TabsTrigger>
          <TabsTrigger value="promotors" className="gap-2 text-xs sm:text-sm"><Users className="h-4 w-4" /> Promotor</TabsTrigger>
          <TabsTrigger value="users" className="gap-2 text-xs sm:text-sm"><Users className="h-4 w-4" /> User</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Daftar Pengajuan Iklan</h2>
                <p className="text-xs text-muted-foreground">Kelola pengajuan iklan Anda</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={overviewSortBy}
                  onChange={(e) => setOverviewSortBy(e.target.value as "createdAt" | "city" | "dailyBudget" | "durationDays" | "totalPayment")}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="createdAt">Urut: Terbaru</option>
                  <option value="city">Urut: Kota</option>
                  <option value="dailyBudget">Urut: Budget/Hari</option>
                  <option value="durationDays">Urut: Durasi</option>
                  <option value="totalPayment">Urut: Total Bayar</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => setOverviewSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  {overviewSortOrder === "asc" ? "A-Z / Kecil-Besar" : "Z-A / Besar-Kecil"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2"
                  onClick={handleManualMetaSync}
                  disabled={metaSyncingPerformance}
                >
                  <RefreshCcw className={`h-4 w-4 ${metaSyncingPerformance ? "animate-spin" : ""}`} />
                  {metaSyncingPerformance ? "Sinkron..." : "Sinkron Meta"}
                </Button>
              </div>
            </div>
            {metaSyncStatus?.lastSuccess?.at && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                Terakhir sinkron: {new Date(metaSyncStatus.lastSuccess.at).toLocaleString("id-ID")} • update {metaSyncStatus.lastSuccess.updatedCount} data
              </p>
            )}

            <div className="w-full">
              <Input
                value={overviewSearch}
                onChange={(e) => setOverviewSearch(e.target.value)}
                placeholder="Cari kota atau promotor..."
                className="h-9 text-sm"
              />
            </div>

            <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
              <TabsList className="w-full bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
                <TabsTrigger value="all" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Semua
                  {statusCounts.all > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white font-bold">{statusCounts.all}</span>}
                </TabsTrigger>
                <TabsTrigger value="MENUNGGU_PEMBAYARAN" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Menunggu Pembayaran
                  {statusCounts.MENUNGGU_PEMBAYARAN > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white font-bold">{statusCounts.MENUNGGU_PEMBAYARAN}</span>}
                </TabsTrigger>
                <TabsTrigger value="MENUNGGU_KONTEN" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Menunggu Konten
                  {statusCounts.MENUNGGU_KONTEN > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-orange-500 text-[9px] text-white font-bold">{statusCounts.MENUNGGU_KONTEN}</span>}
                </TabsTrigger>
                <TabsTrigger value="KONTEN_SELESAI" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Konten Selesai
                  {statusCounts.KONTEN_SELESAI > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white font-bold">{statusCounts.KONTEN_SELESAI}</span>}
                </TabsTrigger>
                <TabsTrigger value="IKLAN_DIJADWALKAN" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Iklan Dijadwalkan
                  {statusCounts.IKLAN_DIJADWALKAN > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white font-bold">{statusCounts.IKLAN_DIJADWALKAN}</span>}
                </TabsTrigger>
                <TabsTrigger value="IKLAN_BERJALAN" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Iklan Berjalan
                  {statusCounts.IKLAN_BERJALAN > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-violet-500 text-[9px] text-white font-bold">{statusCounts.IKLAN_BERJALAN}</span>}
                </TabsTrigger>
                <TabsTrigger value="SELESAI" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Selesai
                  {statusCounts.SELESAI > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-500 text-[9px] text-white font-bold">{statusCounts.SELESAI}</span>}
                </TabsTrigger>
                <TabsTrigger value="FINAL" className="relative text-[11px] sm:text-xs h-8 px-2 sm:px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Iklan Final
                  {statusCounts.FINAL > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white font-bold">{statusCounts.FINAL}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-3">
              {filteredRequests.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground italic border-dashed border-2">
                  <p>Belum ada pengajuan iklan dalam kategori ini.</p>
                </Card>
              ) : (
                filteredRequests.map((ad) => (
                  <Card
                    key={ad.id}
                    className={`shadow-none hover:border-slate-300 transition-all overflow-hidden ${
                      statusTab === "FINAL" ? `border-l-4 ${getCprFinalAccentClass(ad.adReport?.cpr)}` : ""
                    }`}
                  >
                    <CardHeader className="px-4 py-3 pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <CardTitle className="text-base font-bold flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {ad.city}
                          </CardTitle>
                          <p className="text-[10px] text-muted-foreground font-medium italic">Dibuat {formatDate(ad.createdAt)} • Promotor: {ad.promotor.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {ad.campaignCode || "NO-CODE"}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground">{formatCampaignLabel(ad)}</p>
                            {ad.metaCampaignId && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                ID: {ad.metaCampaignId}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleCopyText(formatCampaignLabel(ad), "Nama campaign")}
                            >
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleCopyText(buildCalendarCopyText(ad), "Teks tanggal")}
                            >
                              Copy Teks Tanggal
                            </Button>
                          </div>
                        </div>
                        <div className="shrink-0 space-y-1">
                          {getStatusBadge(ad.status)}
                          {(ad.metaDraftStatus && ad.metaDraftStatus !== "NOT_CREATED") && (
                            <Badge
                              variant="outline"
                              className={
                                ad.metaDraftStatus === "SUCCESS"
                                  ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                  : ad.metaDraftStatus === "PARTIAL"
                                    ? "border-amber-200 text-amber-700 bg-amber-50"
                                  : ad.metaDraftStatus === "FAILED"
                                    ? "border-rose-200 text-rose-700 bg-rose-50"
                                    : "border-amber-200 text-amber-700 bg-amber-50"
                              }
                            >
                              Meta: {ad.metaDraftStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 py-2 text-sm border-t border-slate-50 mt-1">
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium uppercase tracking-tight"><Calendar className="h-3 w-3" /> Tanggal Tes STIFIn</p>
                          <p className="font-bold text-slate-800 text-[13px]">{formatTestDate(ad.startDate, ad.testEndDate)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium uppercase tracking-tight"><Clock className="h-3 w-3" /> Durasi</p>
                          <p className="font-bold text-slate-800 text-[13px]">{ad.durationDays} hari</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium uppercase tracking-tight"><DollarSign className="h-3 w-3" /> Budget/Hari</p>
                          <p className="font-bold text-slate-800 text-[13px]">{formatRupiah(ad.dailyBudget)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium uppercase tracking-tight"><DollarSign className="h-3 w-3" /> Total Bayar</p>
                          <p className="font-bold text-slate-800 text-[13px]">{formatRupiah(ad.totalPayment)}</p>
                        </div>
                      </div>

                      {ad.adReport && (
                        <div
                          className={`grid ${ad.promotorResult ? "grid-cols-4" : "grid-cols-3"} gap-2 py-2 rounded-lg px-2 mb-2 border ${
                            statusTab === "FINAL" ? getCprFinalPanelClass(ad.adReport.cpr) : "bg-slate-50/50 border-slate-100"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center border-r">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider">Leads</p>
                            <p className="text-sm font-bold text-emerald-700 leading-none mt-1">{ad.adReport.totalLeads}</p>
                          </div>
                          <div className="flex flex-col items-center justify-center border-r">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider">CPR</p>
                            <p className="text-sm font-bold text-blue-700 leading-none mt-1">{ad.adReport.cpr ? formatRupiah(Math.round(ad.adReport.cpr)) : "-"}</p>
                          </div>
                          <div className="flex flex-col items-center justify-center border-r last:border-r-0">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider">Spent</p>
                            <p className="text-sm font-bold text-rose-700 leading-none mt-1">{formatRupiah(ad.adReport.amountSpent || 0)}</p>
                          </div>
                          {ad.promotorResult && (
                            <div className="flex flex-col items-center justify-center">
                              <p className="text-[8px] uppercase font-bold text-purple-600 tracking-wider">Klien</p>
                              <p className="text-sm font-bold text-purple-700 leading-none mt-1">{ad.promotorResult.totalClients}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {ad.promotorNote && (() => {
                        const noteInfo = formatPromotorNoteHuman(ad.promotorNote)
                        return (
                          <div
                            className={`rounded-lg px-3 py-2 mb-1 border ${
                              noteInfo.variant === "legacy"
                                ? "bg-amber-50 border-amber-100"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <p
                              className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${
                                noteInfo.variant === "legacy" ? "text-amber-600" : "text-slate-600"
                              }`}
                            >
                              {noteInfo.title}
                            </p>
                            <div className="space-y-0.5">
                              {noteInfo.lines.map((line, index) => (
                                <p
                                  key={`${ad.id}-note-${index}`}
                                  className={`text-xs font-medium ${
                                    noteInfo.variant === "legacy" ? "text-amber-900" : "text-slate-800"
                                  }`}
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      <div className="pt-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" asChild className="h-8 w-full sm:w-auto font-semibold text-xs gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                            <a href={waChannelLink || "#"} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> DOWNLOAD KONTEN</a>
                          </Button>
                          {ad.paymentProofUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-full sm:w-auto font-medium text-xs gap-2 text-muted-foreground hover:text-slate-900"
                              onClick={() => openProofPreview(ad.paymentProofUrl!, `Bukti Bayar - ${ad.city}`)}
                            >
                              <ExternalLink className="h-4 w-4" /> Bukti Bayar
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(ad.status) && (
                            <Button size="sm" className="h-8 w-full sm:w-auto font-semibold text-xs gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleVerifyPayment(ad.id)} disabled={isSubmitting}>
                              <DollarSign className="h-4 w-4" /> Konfirmasi Pembayaran
                            </Button>
                          )}
                          {ad.status === "KONTEN_SELESAI" && (
                            <Button size="sm" className="h-8 w-full sm:w-auto font-semibold text-xs gap-2" onClick={() => { setSelectedAd(ad); setScheduleDialogOpen(true); setScheduleMode("DEFAULT"); }}>
                              <CalendarCheck className="h-4 w-4" /> Jadwalkan Iklan
                            </Button>
                          )}
                          {ad.status === "IKLAN_BERJALAN" && (
                            <Button size="sm" variant="secondary" className="h-8 w-full sm:w-auto font-semibold text-xs gap-2" onClick={() => { setSelectedAd(ad); setReportDialogOpen(true); }}>
                              <Upload className="h-4 w-4" /> Upload Laporan
                            </Button>
                          )}
                          {(ad.status === "KONTEN_SELESAI" || ad.metaDraftStatus === "FAILED" || ad.metaDraftStatus === "PARTIAL") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full sm:w-auto font-semibold text-xs gap-2"
                              onClick={() => handleRetryMetaDraft(ad.id)}
                              disabled={metaRetryingAdId === ad.id}
                            >
                              <RefreshCcw className={`h-4 w-4 ${metaRetryingAdId === ad.id ? "animate-spin" : ""}`} />
                              {metaRetryingAdId === ad.id ? "Memproses..." : "Generate Draft Meta"}
                            </Button>
                          )}

                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              {activeTab === "overview" && overviewTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan {overviewFirstItemNumber}-{overviewLastItemNumber} dari {overviewTotal} data
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchAdRequests(false, {
                          page: Math.max(1, overviewPage - 1),
                          append: false,
                        })
                      }
                      disabled={loadingMoreOverview || overviewPage <= 1}
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-semibold text-slate-700">
                      Hal {overviewPage}/{overviewTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchAdRequests(false, {
                          page: overviewPage + 1,
                          append: false,
                        })
                      }
                      disabled={loadingMoreOverview || !overviewHasMore}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Master Template Brief</h2>
              <p className="text-xs text-muted-foreground">Kelola format narasi video otomatis</p>
            </div>
            <Button onClick={() => { setEditingTemplate(null); setTemplateName(""); setTemplateContent(""); setIsTemplateDialogOpen(true); }} size="sm" className="font-semibold h-9 gap-2">
              <Plus className="h-4 w-4" /> Tambah Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {briefTemplates.map((t) => (
              <Card key={t.id} className="relative group hover:border-slate-300 transition-all shadow-none">
                <div className={`h-1 w-full absolute top-0 left-0 ${t.type === "VO" ? "bg-blue-500" : "bg-purple-500"}`} />
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] font-semibold ${t.type === "VO" ? "text-blue-600 border-blue-100 bg-blue-50/50" : "text-purple-600 border-purple-100 bg-purple-50/50"}`}>{t.type}</Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingTemplate(t); setTemplateType(t.type as "VO" | "JJ"); setTemplateName(t.name); setTemplateContent(t.content); setIsTemplateDialogOpen(true); }}><Settings className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500" onClick={() => handleDeleteTemplate(t.id)}><AlertCircle className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">{t.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-600 h-24 overflow-hidden border">
                    {t.content}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="meta_ads" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Integrasi Meta Ads</h2>
              <p className="text-xs text-muted-foreground">Template caption/headline iklan dan monitoring draft otomatis saat status Konten Selesai.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="inline-flex rounded-md border bg-white p-1">
                <Button
                  size="sm"
                  variant={metaDraftMode === "GENERATE" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setMetaDraftMode("GENERATE")}
                >
                  Generate Draft
                </Button>
                <Button
                  size="sm"
                  variant={metaDraftMode === "DUPLICATE" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setMetaDraftMode("DUPLICATE")}
                >
                  Duplicate Campaign
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2"
                onClick={handleMetaConnectionTest}
                disabled={metaTesting}
              >
                <RefreshCcw className={`h-4 w-4 ${metaTesting ? "animate-spin" : ""}`} />
                {metaTesting ? "Mengecek..." : "Tes Koneksi Meta"}
              </Button>
            </div>
          </div>

          {metaTestResult && (
            <Card className="shadow-none border-slate-100">
              <CardContent className="p-3">
                <p className="text-xs text-slate-700">{metaTestResult}</p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none border-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Import Iklan Lama (Sebelum Aplikasi)</CardTitle>
              <CardDescription>
                Cukup pilih promotor. Durasi dan jumlah klien boleh kosong. Sistem akan identifikasi otomatis dari format nama campaign Meta: {"{city} {date} - {nama-promotor}"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Promotor</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={legacyPromotorId}
                    onChange={(e) => setLegacyPromotorId(e.target.value)}
                  >
                    <option value="">Pilih promotor</option>
                    {promotorUsersForLegacy.map((promotor) => (
                      <option key={promotor.id} value={promotor.id}>
                        {promotor.name} ({promotor.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Durasi (opsional)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={legacyDurationDays}
                    onChange={(e) => setLegacyDurationDays(e.target.value)}
                    placeholder="Contoh: 3"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Jumlah Klien (opsional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={legacyTotalClients}
                    onChange={(e) => setLegacyTotalClients(e.target.value)}
                    placeholder="Contoh: 45"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={handlePreviewLegacyCampaigns}
                  disabled={legacyPreviewing}
                >
                  {legacyPreviewing ? "Sinkron..." : "Sinkron Campaign Promotor"}
                </Button>
                {legacyGeneratedItem && legacyGeneratedItem.count > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-full sm:w-auto gap-2"
                    onClick={handleExecuteLegacyCampaigns}
                    disabled={legacyExecuting}
                  >
                    <RefreshCcw className={`h-4 w-4 ${legacyExecuting ? "animate-spin" : ""}`} />
                    {legacyExecuting ? "Eksekusi..." : `Eksekusi Import (${legacyGeneratedItem.count})`}
                  </Button>
                )}
              </div>

              {legacyGeneratedItem && (
                <div className="rounded-md border bg-slate-50 p-3 space-y-2">
                  <p className="text-xs text-slate-700">
                    Preview campaign historis untuk promotor <span className="font-semibold">{legacyGeneratedItem.promotorName}</span>.
                  </p>
                  <p className="text-xs text-slate-600">
                    Klik Eksekusi Import untuk memasukkan semua campaign terdeteksi ke dashboard.
                  </p>
                  <p className="text-xs text-slate-700">
                    Jumlah campaign terdeteksi: <span className="font-semibold">{legacyGeneratedItem.count}</span>
                  </p>
                  {legacyGeneratedItem.campaigns.length > 0 && (
                    <div className="max-h-44 overflow-y-auto rounded border bg-white p-2 space-y-1">
                      {legacyGeneratedItem.campaigns.slice(0, 20).map((campaign) => (
                        <p key={campaign.id} className="text-[11px] text-slate-700 break-all">
                          {campaign.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {legacyExecutionResult && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                  <p className="text-xs text-emerald-800">
                    Eksekusi selesai: {legacyExecutionResult.createdCount} dibuat, {legacyExecutionResult.skippedCount} dilewati.
                  </p>
                  {legacyExecutionResult.syncResult && (
                    <p className="text-xs text-emerald-800">
                      Sinkron Meta: {legacyExecutionResult.syncResult.linkedCount} mapping, {legacyExecutionResult.syncResult.updatedCount} report diperbarui.
                    </p>
                  )}
                </div>
              )}

              {legacyImportedRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Daftar Import Historis Terbaru</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {legacyImportedRequests.slice(0, 20).map((item) => (
                      <div key={item.id} className="rounded-md border p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.campaignCode || "NO-CODE"}
                          </Badge>
                          <p className="text-xs font-medium">
                            {item.city} - {formatDate(item.startDate)} - {item.promotor.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={
                              item.metaCampaignId
                                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                : "border-amber-200 text-amber-700 bg-amber-50"
                            }
                          >
                            {item.metaCampaignId ? "Tersambung ke Meta" : "Belum tersambung"}
                          </Badge>
                        </div>
                        {item.metaCampaignId && (
                          <p className="text-[11px] text-muted-foreground mt-1">Campaign ID: {item.metaCampaignId}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Template Teks Ads</CardTitle>
              <CardDescription>
                Setiap Ad menggunakan 5 Primary Text, 5 Headline, dan 1 Description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Primary Text (5)</Label>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Textarea
                      key={`primary-${index}`}
                      value={metaTemplate.primaryTexts[index] || ""}
                      onChange={(e) => updateMetaTemplateList("primaryTexts", index, e.target.value)}
                      placeholder={`Primary text ${index + 1}`}
                      className="text-xs min-h-[110px] resize-y"
                      rows={5}
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Headline (5)</Label>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Input
                      key={`headline-${index}`}
                      value={metaTemplate.headlines[index] || ""}
                      onChange={(e) => updateMetaTemplateList("headlines", index, e.target.value)}
                      placeholder={`Headline ${index + 1}`}
                      className="text-xs"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Description</Label>
                <Textarea
                  value={metaTemplate.description}
                  onChange={(e) => setMetaTemplate((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="text-xs"
                  placeholder="Description Ads"
                />
              </div>

              <div className="text-[11px] text-muted-foreground bg-slate-50 border rounded-md p-3">
                Variabel yang bisa dipakai: {"{city}"}, {"{day}"}, {"{tanggal}"}, {"{month}"}, {"{year}"}, {"{date}"}, {"{promotor}"}
              </div>

              <div className="space-y-3 rounded-md border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase text-slate-700">Preview Hasil Final</p>
                  <p className="text-[10px] text-muted-foreground">
                    Simulasi: {metaPreviewSample.day}, {metaPreviewSample.tanggal} {metaPreviewSample.month} {metaPreviewSample.year} • {metaPreviewSample.city} • {metaPreviewSample.promotor}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-700">Primary Text</p>
                  {metaTemplate.primaryTexts.map((item, index) =>
                    item.trim() ? (
                      <div key={`preview-primary-${index}`} className="rounded-md border bg-white p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] font-semibold text-slate-600">Primary Text {index + 1}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              handleCopyText(
                                applyMetaTemplatePreview(item, metaPreviewSample),
                                `Primary Text ${index + 1}`
                              )
                            }
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs whitespace-pre-wrap break-words text-slate-700">
                          {applyMetaTemplatePreview(item, metaPreviewSample)}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-700">Headline</p>
                  <div className="flex flex-wrap gap-2">
                    {metaTemplate.headlines.map((item, index) =>
                      item.trim() ? (
                        <div key={`preview-headline-${index}`} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
                          <Badge variant="outline" className="bg-white text-[11px] font-medium border-none px-0 py-0">
                            {applyMetaTemplatePreview(item, metaPreviewSample)}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() =>
                              handleCopyText(
                                applyMetaTemplatePreview(item, metaPreviewSample),
                                `Headline ${index + 1}`
                              )
                            }
                          >
                            Copy
                          </Button>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-700">Description</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        handleCopyText(
                          applyMetaTemplatePreview(metaTemplate.description, metaPreviewSample),
                          "Description"
                        )
                      }
                    >
                      Copy
                    </Button>
                  </div>
                  <div className="rounded-md border bg-white p-2 text-xs whitespace-pre-wrap break-words text-slate-700">
                    {metaTemplate.description.trim()
                      ? applyMetaTemplatePreview(metaTemplate.description, metaPreviewSample)
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" className="h-9 font-semibold" onClick={handleSaveMetaTemplate} disabled={metaSavingTemplate}>
                  {metaSavingTemplate ? "Menyimpan..." : "Simpan Template Meta Ads"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Status Draft Meta per Pengajuan</CardTitle>
              <CardDescription>
                Draft otomatis dibuat saat konten selesai. Mode aktif: {metaDraftMode === "GENERATE" ? "Generate Draft" : "Duplicate Campaign Template"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {adRequests.filter((item) => item.status === "KONTEN_SELESAI" || item.metaCampaignId || item.metaDraftStatus === "FAILED" || item.metaDraftStatus === "PARTIAL").length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data draft Meta.</p>
              ) : (
                adRequests
                  .filter((item) => item.status === "KONTEN_SELESAI" || item.metaCampaignId || item.metaDraftStatus === "FAILED" || item.metaDraftStatus === "PARTIAL")
                  .slice(0, 30)
                  .map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{item.city} - {formatTestDate(item.startDate, item.testEndDate)} - {item.promotor.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Status draft: {item.metaDraftStatus || "NOT_CREATED"}
                            {item.metaCampaignId ? ` • Campaign ID: ${item.metaCampaignId}` : ""}
                          </p>
                          {item.metaDraftError && (
                            <p className="text-xs text-rose-600 mt-1">{item.metaDraftError}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => handleRetryMetaDraft(item.id)}
                          disabled={metaRetryingAdId === item.id}
                        >
                          {metaRetryingAdId === item.id ? "Memproses..." : "Generate Ulang Draft Meta"}
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pengaturan Notifikasi WhatsApp</h2>
              <p className="text-xs text-muted-foreground">Aktifkan/Nonaktifkan notifikasi otomatis</p>
            </div>
            <Badge variant="outline" className="text-emerald-600 border-emerald-100 bg-emerald-50">Emerald Green Toggle</Badge>
          </div>

          <Card className="shadow-none border-slate-200 bg-slate-50/30">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Tautan Channel WhatsApp</CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">Link ini akan digunakan promotor untuk melihat/mengunduh konten</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="flex gap-2">
                <Input
                  placeholder="https://whatsapp.com/channel/..."
                  value={waChannelLink}
                  onChange={(e) => setWaChannelLink(e.target.value)}
                  className="bg-white text-xs h-9"
                />
                <Button size="sm" className="h-9 px-4 font-semibold" onClick={handleSaveWaChannelLink} disabled={isSubmitting}>
                  {isSubmitting ? "..." : "Simpan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { slug: "payment-confirmed-promotor", name: "Pembayaran Valid (Promotor)", desc: "Bukti bayar divalidasi", default: "Halo *{promotor}*, Pembayaran iklan Anda untuk kota *{city}* telah diterima. Terimakasih!" },
              { slug: "payment-confirmed-advertiser", name: "Pembayaran Masuk (Advertiser)", desc: "Laporan uang masuk", default: "*NOTIFIKASI*: Promotor *{promotor}* telah bayar untuk *{city}*." },
              { slug: "content-finished-promotor", name: "Konten Selesai (Promotor)", desc: "Video siap diunduh", default: "Halo *{promotor}*, Konten iklan *{city}* sudah selesai! Silakan cek dashboard." },
              { slug: "ad-scheduled-promotor", name: "Iklan Dijadwalkan (Promotor)", desc: "Tanggal tayang diputuskan", default: "Kabar gembira *{promotor}*! Iklan *{city}* telah dijadwalkan tayang." },
              { slug: "client-report-stifin", name: "Laporan Klien (Admin STIFIn)", desc: "Laporan harian leads", default: "Admin: *{promotor}* melaporkan *{jumlah}* klien untuk iklan *{city}*." },
              { slug: "salary-disbursed-creator", name: "Gaji Cair (Konten Kreator)", desc: "Dikirim saat admin mencairkan gaji kreator", default: "Halo *{creator}*, gaji Anda telah dicairkan pada *{tanggal}*. Invoice: *{invoice}*. Total *{jumlah_konten} konten* dari *{jumlah_request} request* dengan nominal *{nominal}*." },
              { slug: "bonus-disbursed-advertiser", name: "Bonus Cair (Advertiser)", desc: "Dikirim saat admin mencairkan bonus advertiser", default: "Halo *{advertiser}*, bonus telah dicairkan pada *{tanggal}*. Invoice: *{invoice}*. Total *{nominal}* untuk *{jumlah_klien} klien* (*{jumlah_item} item*) dari *{promotor}*." },
            ].map((tpl) => {
              const current = notifTemplates.find(t => t.slug === tpl.slug)
              const isActive = current ? current.isActive : true
              return (
                <Card key={tpl.slug} className={`border-slate-200 ${!isActive ? "opacity-60 grayscale" : ""}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold uppercase tracking-tight text-slate-700">{tpl.name}</CardTitle>
                      <Switch className="data-[state=checked]:bg-emerald-500" checked={isActive} onCheckedChange={(c) => handleUpdateNotifTemplate(null, tpl.slug, c)} />
                    </div>
                    <CardDescription className="text-xs font-medium">{tpl.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="bg-slate-50 rounded border p-3 text-[11px] font-mono text-slate-700 min-h-[60px]">
                      {current?.message || tpl.default}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs font-semibold h-8 uppercase tracking-widest" onClick={() => {
                      setEditingNotifTemplate(current || { slug: tpl.slug, name: tpl.name, message: tpl.default, isActive: true } as any)
                    }}>
                      <Settings className="h-3 w-3 mr-2" /> Edit Pesan
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Global Alert Center</h2>
              <p className="text-xs text-muted-foreground">Kelola banner pengumuman global untuk semua user aplikasi.</p>
            </div>
            <Button size="sm" className="font-semibold h-9 gap-2" onClick={openCreateAnnouncementDialog}>
              <Plus className="h-4 w-4" /> Buat Pengumuman
            </Button>
          </div>

          <Card className="shadow-none border-slate-100">
            <CardContent className="p-4 space-y-3">
              {announcementsLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pengumuman global.</p>
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge
                            variant="outline"
                            className={
                              item.variant === "warning"
                                ? "border-amber-200 text-amber-700 bg-amber-50"
                                : item.variant === "danger"
                                  ? "border-rose-200 text-rose-700 bg-rose-50"
                                  : item.variant === "success"
                                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                    : "border-blue-200 text-blue-700 bg-blue-50"
                            }
                          >
                            {item.variant.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={item.isActive ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-slate-50"}>
                            {item.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              item.priority === "pinned"
                                ? "border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50"
                                : item.priority === "high"
                                  ? "border-rose-200 text-rose-700 bg-rose-50"
                                  : "border-slate-200 text-slate-600 bg-slate-50"
                            }
                          >
                            {item.priority === "pinned" ? "PINNED" : item.priority === "high" ? "HIGH" : "NORMAL"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{item.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Mulai: {item.startsAt ? formatDate(item.startsAt) : "-"} • Berakhir: {item.endsAt ? formatDate(item.endsAt) : "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={(checked) => handleToggleAnnouncement(item, checked)}
                          className="data-[state=checked]:bg-emerald-500"
                          disabled={isSubmitting}
                        />
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditAnnouncementDialog(item)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-rose-600 border-rose-200" onClick={() => handleDeleteAnnouncement(item.id)}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Monitoring Pencairan</h2>
            <p className="text-xs text-muted-foreground">Pantau gaji kreator dan bonus advertiser yang belum/sudah dicairkan admin STIFIn.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Belum Dicairkan</CardTitle>
                <Wallet className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-orange-600">
                  {formatRupiah(payoutMonitor?.unpaidSummary.totalAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(payoutMonitor?.unpaidSummary.totalRequests || 0)} request
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Konten Belum Cair</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-blue-600">
                  {(payoutMonitor?.unpaidSummary.totalContents || 0).toLocaleString("id-ID")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total item konten</p>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Dicairkan</CardTitle>
                <ReceiptText className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600">
                  {formatRupiah((payoutMonitor?.paidBatches || []).reduce((sum, b) => sum + b.totalAmount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(payoutMonitor?.paidBatches || []).length} invoice
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none border-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Invoice Pencairan</CardTitle>
              <CardDescription>Klik invoice untuk melihat rincian item konten yang dibayar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2 pb-4 border-b border-slate-100">
                <p className="text-sm font-semibold">Daftar Item Belum Dicairkan</p>
                {(payoutMonitor?.unpaidItems.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada item belum dicairkan.</p>
                ) : (
                  paginatedPayoutUnpaidItems.map((item) => (
                    <div key={item.adRequestId} className="rounded-md bg-slate-50 p-2 text-xs">
                      <p className="font-medium">
                        {item.city} - {formatTestDate(item.startDate, item.testEndDate)} - {item.promotorName}
                      </p>
                      <p className="text-muted-foreground">
                        Kreator: {item.creatorName} • {item.contentCount} konten • {formatRupiah(item.amount)}
                      </p>
                    </div>
                  ))
                )}
                {payoutUnpaidItems.length > MONITOR_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      Halaman {payoutUnpaidPage} / {payoutUnpaidTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={payoutUnpaidPage <= 1}
                        onClick={() => setPayoutUnpaidPage((prev) => Math.max(1, prev - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={payoutUnpaidPage >= payoutUnpaidTotalPages}
                        onClick={() => setPayoutUnpaidPage((prev) => Math.min(payoutUnpaidTotalPages, prev + 1))}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm font-semibold pt-2">Riwayat Invoice Dicairkan</p>
              {(payoutMonitor?.paidBatches.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada invoice pencairan.</p>
              ) : (
                paginatedPayoutPaidBatches.map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="text-sm font-medium">
                          {batch.invoiceNumber || "-"} | Pencairan {formatDate(batch.payoutDate)} | {batch.totalContents} konten | {batch.creatorName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-emerald-700">{formatRupiah(batch.totalAmount)}</p>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {batch.transferProofUrl && (
                        <button
                          type="button"
                          onClick={() => openProofPreview(batch.transferProofUrl!, `Bukti Transfer - ${batch.invoiceNumber || "Invoice"}`)}
                          className="inline-block text-xs text-blue-600 hover:underline"
                        >
                          Lihat bukti transfer
                        </button>
                      )}
                      {batch.items.map((item) => (
                        <div key={item.id} className="rounded-md bg-slate-50 p-2 text-xs">
                          <p className="font-medium">
                            {item.city} - {formatTestDate(item.startDate, item.testEndDate)} - {item.promotorName}
                          </p>
                          <p className="text-muted-foreground">{item.contentCount} konten • {formatRupiah(item.requestAmount)}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}
              {payoutPaidBatches.length > MONITOR_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Halaman {payoutPaidPage} / {payoutPaidTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={payoutPaidPage <= 1}
                      onClick={() => setPayoutPaidPage((prev) => Math.max(1, prev - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={payoutPaidPage >= payoutPaidTotalPages}
                      onClick={() => setPayoutPaidPage((prev) => Math.min(payoutPaidTotalPages, prev + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonus_payouts" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Monitoring Bonus Advertiser</h2>
            <p className="text-xs text-muted-foreground">Pantau bonus belum cair dan riwayat bonus yang sudah dicairkan admin STIFIn.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Belum Dicairkan</CardTitle>
                <Wallet className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-orange-600">
                  {formatRupiah(bonusMonitor?.unpaidSummary.totalAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(bonusMonitor?.unpaidSummary.totalItems || 0)} item
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Klien Belum Cair</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-blue-600">
                  {(bonusMonitor?.unpaidSummary.totalClients || 0).toLocaleString("id-ID")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total klien valid</p>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Dicairkan</CardTitle>
                <ReceiptText className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600">
                  {formatRupiah((bonusMonitor?.paidBatches || []).reduce((sum, b) => sum + b.totalAmount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(bonusMonitor?.paidBatches || []).length} invoice
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none border-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Invoice Bonus</CardTitle>
              <CardDescription>Klik invoice untuk melihat rincian item bonus yang dibayar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2 pb-4 border-b border-slate-100">
                <p className="text-sm font-semibold">Daftar Bonus Belum Dicairkan</p>
                {(bonusMonitor?.unpaidItems.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada item bonus belum dicairkan.</p>
                ) : (
                  paginatedBonusUnpaidItems.map((item) => (
                    <div key={item.promotorResultId} className="rounded-md bg-slate-50 p-2 text-xs">
                      <p className="font-medium">
                        {item.promotorName} - {item.city} - {formatTestDate(item.startDate, item.testEndDate)}
                      </p>
                      <p className="text-muted-foreground">
                        {item.clientCount.toLocaleString("id-ID")} klien • {formatRupiah(item.amount)}
                      </p>
                    </div>
                  ))
                )}
                {bonusUnpaidItems.length > MONITOR_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      Halaman {bonusUnpaidPage} / {bonusUnpaidTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={bonusUnpaidPage <= 1}
                        onClick={() => setBonusUnpaidPage((prev) => Math.max(1, prev - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={bonusUnpaidPage >= bonusUnpaidTotalPages}
                        onClick={() => setBonusUnpaidPage((prev) => Math.min(bonusUnpaidTotalPages, prev + 1))}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm font-semibold pt-2">Riwayat Invoice Bonus Dicairkan</p>
              {(bonusMonitor?.paidBatches.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada invoice bonus.</p>
              ) : (
                paginatedBonusPaidBatches.map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="text-sm font-medium">
                          {batch.invoiceNumber || "-"} | Pencairan {formatDate(batch.payoutDate)} | {batch.totalClients.toLocaleString("id-ID")} klien | {batch.promotorLabel || batch.promotorName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-emerald-700">{formatRupiah(batch.totalAmount)}</p>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {batch.transferProofUrl && (
                        <button
                          type="button"
                          onClick={() => openProofPreview(batch.transferProofUrl!, `Bukti Transfer Bonus - ${batch.invoiceNumber || "Invoice"}`)}
                          className="inline-block text-xs text-blue-600 hover:underline"
                        >
                          Lihat bukti transfer
                        </button>
                      )}
                      {batch.items.map((item) => (
                        <div key={item.id} className="rounded-md bg-slate-50 p-2 text-xs">
                          <p className="font-medium">
                            {item.promotorName} - {item.city} - {formatTestDate(item.startDate, item.testEndDate)}
                          </p>
                          <p className="text-muted-foreground">{item.clientCount.toLocaleString("id-ID")} klien • {formatRupiah(item.bonusAmount)}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}
              {bonusPaidBatches.length > MONITOR_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Halaman {bonusPaidPage} / {bonusPaidTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bonusPaidPage <= 1}
                      onClick={() => setBonusPaidPage((prev) => Math.max(1, prev - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bonusPaidPage >= bonusPaidTotalPages}
                      onClick={() => setBonusPaidPage((prev) => Math.min(bonusPaidTotalPages, prev + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotors" className="space-y-4">
          <div className="flex flex-col gap-1 mb-1">
            <h2 className="text-lg font-semibold">Performa Promotor</h2>
            <p className="text-xs text-muted-foreground">Monitoring performa pengajuan dari setiap promotor</p>
          </div>

          {promotorData.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground italic border-dashed border-2">
              <Users className="h-10 w-10 mb-3 opacity-20" />
              <p>Belum ada promotor yang terdaftar dalam sistem.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <Card className="hidden md:block shadow-none border-slate-100 overflow-hidden">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50/50 sticky top-0 z-10">
                          <th className="text-left p-4 font-semibold text-slate-900">Promotor</th>
                          <th className="text-left p-4 font-semibold text-slate-900">WhatsApp</th>
                          <th className="text-center p-4 font-semibold text-slate-900">Ads</th>
                          <th className="text-center p-4 font-semibold text-slate-900">Avg Budget</th>
                          <th className="text-center p-4 font-semibold text-slate-900">Leads</th>
                          <th className="text-center p-4 font-semibold text-slate-900">Clients</th>
                          <th className="text-center p-4 font-semibold text-slate-900">CVR</th>
                          <th className="text-right p-4 font-semibold text-slate-900">Spending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotorData.map((p) => {
                          const avgBudget = p.adCountForBudget > 0 ? p.totalDailyBudget / p.adCountForBudget : 0
                          const cvr = p.totalLeads > 0 ? (p.totalClients / p.totalLeads) * 100 : 0

                          return (
                            <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors group">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">
                                    {p.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-slate-900">{p.name}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <a
                                  href={`https://wa.me/${p.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-emerald-600 font-medium hover:underline text-xs bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/50"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {p.phone}
                                </a>
                              </td>
                              <td className="p-4 text-center">
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                  {p.totalConfirmed}
                                </Badge>
                              </td>
                              <td className="p-4 text-center font-medium text-slate-600 text-xs text-nowrap">
                                {formatRupiah(Math.round(avgBudget))}
                              </td>
                              <td className="p-4 text-center font-bold text-blue-600">
                                {p.totalLeads.toLocaleString("id-ID")}
                              </td>
                              <td className="p-4 text-center font-bold text-slate-900">
                                {p.totalClients.toLocaleString("id-ID")}
                              </td>
                              <td className="p-4 text-center">
                                <Badge className={getCvrColor(cvr)}>
                                  {cvr.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="p-4 text-right">
                                <span className="font-bold text-emerald-600">{formatRupiah(p.totalSpent)}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {promotorData.map((p) => (
                  <Card key={p.id} className="shadow-none border-slate-100">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                        </div>
                        <a href={`https://wa.me/${p.phone.replace(/\D/g, "")}`} className="p-2 bg-emerald-100 text-emerald-700 rounded-full">
                          <MessageSquare className="h-4 w-4" />
                        </a>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-3 border-y border-slate-50 mt-2">
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Total Leads</p>
                          <p className="text-sm font-bold text-blue-600">{p.totalLeads}</p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="text-[9px] uppercase font-bold text-slate-400">CVR (%)</p>
                          <p className={`text-sm font-bold ${(() => {
                            const cvr = p.totalLeads > 0 ? (p.totalClients / p.totalLeads) * 100 : 0
                            if (cvr === 0) return "text-slate-400"
                            if (cvr <= 5) return "text-red-600"
                            if (cvr <= 10) return "text-amber-600"
                            return "text-emerald-600"
                          })()
                            }`}>
                            {p.totalLeads > 0 ? ((p.totalClients / p.totalLeads) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Avg Budget</p>
                          <p className="text-[11px] font-bold text-slate-600">
                            {formatRupiah(Math.round(p.adCountForBudget > 0 ? p.totalDailyBudget / p.adCountForBudget : 0))}
                          </p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Spending</p>
                          <p className="text-sm font-bold text-emerald-600">{p.totalSpent > 1000000 ? `${(p.totalSpent / 1000000).toFixed(1)}jt` : formatRupiah(p.totalSpent)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Manajemen User</h2>
              <p className="text-xs text-muted-foreground">
                Daftar user aplikasi. Role Promotor/Kreator/Admin STIFIn dapat dinonaktifkan, dan role tersebut dapat dihapus bila belum punya riwayat transaksi.
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                  Kreator Aktif: {activeCreatorCount}
                </Badge>
                <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50">
                  OFF: {inactiveCreatorCount}
                </Badge>
                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                  Total Kreator: {creatorUsers.length}
                </Badge>
              </div>
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                <p className="font-semibold text-slate-900">Backup Terakhir</p>
                {configLastBackupAt ? (
                  <p>
                    {configLastAction === "restore" ? "Restore" : "Backup"} pada {formatDateTime(configLastBackupAt)}
                  </p>
                ) : (
                  <p>Belum ada riwayat backup/restore dari dashboard ini.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={restoreConfigInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => handleRestoreConfigFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold"
                onClick={handleBackupConfig}
                disabled={backingUpConfig}
              >
                {backingUpConfig ? "Backup..." : "Backup Config"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold"
                onClick={handleRestoreConfigClick}
                disabled={restoringConfig}
              >
                {restoringConfig ? "Restore..." : "Restore Config"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="font-semibold"
                onClick={() => setCreateUserDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah User
              </Button>
            </div>
          </div>

          <Card className="shadow-none border-slate-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4 text-slate-500" />
                Hubungkan Admin STIFIn ke Akun Promotor
              </CardTitle>
              <CardDescription className="text-xs">
                Relasi ini dipakai untuk fitur switch profile dari akun Admin STIFIn ke dashboard promotor terkait. Maksimal 2 promotor per admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-[11px] text-slate-600">
                Slot admin terpilih: <span className="font-semibold">{selectedAdminLinkCount}/2</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={selectedLinkAdminId}
                  onChange={(e) => setSelectedLinkAdminId(e.target.value)}
                >
                  <option value="">Pilih Admin STIFIn</option>
                  {stifinAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} ({(stifinLinkCounts[admin.id] || 0)}/2)
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={selectedLinkPromotorId}
                  onChange={(e) => setSelectedLinkPromotorId(e.target.value)}
                >
                  <option value="">Pilih Promotor</option>
                  {promotorUsers.map((promotor) => (
                    <option key={promotor.id} value={promotor.id}>
                      {promotor.name} ({promotor.email})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  className="font-semibold"
                  onClick={handleLinkAdminPromotor}
                  disabled={linkingAccount || !canAddSelectedAdminLink}
                >
                  {linkingAccount ? "Menyimpan..." : canAddSelectedAdminLink ? "Hubungkan" : "Slot Penuh"}
                </Button>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 divide-y">
                {linkedAccounts.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3">Belum ada relasi admin-promotor.</p>
                ) : (
                  linkedAccounts.map((link) => {
                    const key = `${link.owner.id}:${link.profile.id}`
                    return (
                      <div key={key} className="p-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{link.owner.name}</span>
                          <span className="text-slate-400"> ↔ </span>
                          <span className="font-semibold">{link.profile.name}</span>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => handleUnlinkAdminPromotor(link.owner.id, link.profile.id)}
                          disabled={unlinkingKey === key}
                        >
                          <Unlink2 className="h-3 w-3 mr-1" />
                          {unlinkingKey === key ? "..." : "Lepas"}
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-100 overflow-hidden">
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : managedUsers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Belum ada user.
                </div>
              ) : (
                <ScrollArea className="max-h-[620px]">
                  <div className="divide-y">
                    {managedUsers.map((appUser) => (
                      <div key={appUser.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-900 truncate">{appUser.name}</p>
                            <Badge variant="outline" className={getRoleBadgeClass(appUser.role)}>
                              {getRoleLabel(appUser.role)}
                            </Badge>
                            {appUser.canToggle && (
                              <Badge variant="outline" className={appUser.isEnabled ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-slate-50"}>
                                {appUser.isEnabled ? "ON" : "OFF"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{appUser.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {appUser.city || "-"} • {appUser.phone || "-"}
                          </p>
                        </div>
                        {appUser.canToggle || appUser.canDelete ? (
                          <div className="flex items-center gap-2">
                            {appUser.canDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => handleDeleteManagedUser(appUser.id)}
                                disabled={deletingUserId === appUser.id}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {deletingUserId === appUser.id ? "Menghapus..." : "Hapus"}
                              </Button>
                            )}
                            {appUser.canToggle && (
                              <Switch
                                checked={appUser.isEnabled}
                                onCheckedChange={(checked) => handleToggleManagedUser(appUser.id, checked)}
                                disabled={updatingUserId === appUser.id}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Tidak bisa diubah</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unified Dialogs (Promotor Style) */}
      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveAnnouncement} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold text-lg">{editingAnnouncement ? "Edit Pengumuman" : "Buat Pengumuman Global"}</DialogTitle>
              <DialogDescription className="text-xs">Pengumuman aktif akan muncul sebagai banner di seluruh dashboard user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Judul</Label>
                <Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Isi Pengumuman</Label>
                <Textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="min-h-[120px] bg-slate-50 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Tipe Banner</Label>
                <Tabs value={announcementVariant} onValueChange={(v) => setAnnouncementVariant(v as "info" | "success" | "warning" | "danger")}>
                  <TabsList className="grid grid-cols-4">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="success">Success</TabsTrigger>
                    <TabsTrigger value="warning">Warning</TabsTrigger>
                    <TabsTrigger value="danger">Danger</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Prioritas</Label>
                <Tabs value={announcementPriority} onValueChange={(v) => setAnnouncementPriority(v as "pinned" | "high" | "normal")}>
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="pinned">Pinned</TabsTrigger>
                    <TabsTrigger value="high">High</TabsTrigger>
                    <TabsTrigger value="normal">Normal</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Mulai Tampil (opsional)</Label>
                  <Input type="datetime-local" value={announcementStartsAt} onChange={(e) => setAnnouncementStartsAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Berakhir (opsional)</Label>
                  <Input type="datetime-local" value={announcementEndsAt} onChange={(e) => setAnnouncementEndsAt(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold">Status Pengumuman</p>
                  <p className="text-xs text-muted-foreground">Jika OFF, banner tidak akan ditampilkan ke user.</p>
                </div>
                <Switch checked={announcementIsActive} onCheckedChange={setAnnouncementIsActive} className="data-[state=checked]:bg-emerald-500" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAnnouncementDialogOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" className="font-bold px-8" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createUserDialogOpen}
        onOpenChange={(open) => {
          setCreateUserDialogOpen(open)
          if (!open) resetCreateUserForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateManagedUser} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold">Tambah User</DialogTitle>
              <DialogDescription className="text-xs">
                Pembuatan akun untuk role Promotor, Kreator, dan Admin STIFIn.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Role</Label>
                <Tabs value={createUserRole} onValueChange={(v) => setCreateUserRole(v as CreateManagedUserRole)}>
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="PROMOTOR">Promotor</TabsTrigger>
                    <TabsTrigger value="KONTEN_KREATOR">Kreator</TabsTrigger>
                    <TabsTrigger value="STIFIN">Admin STIFIn</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Nama Lengkap</Label>
                <Input value={createUserName} onChange={(e) => setCreateUserName(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Email</Label>
                <Input
                  type="email"
                  value={createUserEmail}
                  onChange={(e) => setCreateUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Nomor WhatsApp</Label>
                <Input
                  value={createUserPhone}
                  onChange={(e) => setCreateUserPhone(e.target.value)}
                  placeholder="08123456789"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Kota Asal</Label>
                <Input
                  value={createUserCity}
                  onChange={(e) => setCreateUserCity(e.target.value)}
                  placeholder="Contoh: Bandung"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Password</Label>
                <Input
                  type="password"
                  value={createUserPassword}
                  onChange={(e) => setCreateUserPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-sm">Konfirmasi Password</Label>
                <Input
                  type="password"
                  value={createUserPasswordConfirm}
                  onChange={(e) => setCreateUserPasswordConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateUserDialogOpen(false)} disabled={createUserLoading}>
                Batal
              </Button>
              <Button type="submit" size="sm" className="font-bold px-8" disabled={createUserLoading}>
                {createUserLoading ? "Menyimpan..." : "Simpan User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSchedule} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold">Penjadwalan Iklan</DialogTitle>
              <DialogDescription className="text-xs">Tentukan jadwal tayang iklan di Facebook/Instagram.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Mode Jadwal</Label>
                <Tabs value={scheduleMode} onValueChange={(v) => setScheduleMode(v as "DEFAULT" | "CUSTOM")}>
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="DEFAULT">Default (Otomatis)</TabsTrigger>
                    <TabsTrigger value="CUSTOM">Custom (Manual)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Waktu Mulai Tayang</Label>
                  <Input
                    type="datetime-local"
                    value={adStartDate}
                    onChange={(e) => setAdStartDate(e.target.value)}
                    disabled={scheduleMode === "DEFAULT"}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Waktu Berakhir Tayang</Label>
                  <Input
                    type="datetime-local"
                    value={adEndDate}
                    onChange={(e) => setAdEndDate(e.target.value)}
                    disabled={scheduleMode === "DEFAULT"}
                    required
                  />
                </div>
              </div>

              {scheduleMode === "DEFAULT" && selectedAd && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-[10px] text-blue-700 font-medium">
                  {(() => {
                    const schedule = computeDefaultAdSchedule(selectedAd.startDate, selectedAd.testEndDate, selectedAd.durationDays)
                    return (
                      <div className="space-y-1">
                        <p>
                          Tanggal tes {formatTestDate(selectedAd.startDate, selectedAd.testEndDate)} (durasi {selectedAd.durationDays} hari).
                        </p>
                        <p>Jadwal tayang default: {formatDateTimeFromDate(schedule.start)} - {formatDateTimeFromDate(schedule.end)}.</p>
                        <p>Deadline pembayaran: {formatDateTimeFromDate(schedule.paymentDeadline)}.</p>
                        <p>Deadline konten selesai: {formatDateTimeFromDate(schedule.contentDeadline)}.</p>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setScheduleDialogOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" className="bg-slate-900 text-white font-bold" disabled={isSubmitting}>{isSubmitting ? "Memproses..." : "Konfirmasi Jadwal"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUploadReport} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold">Upload Laporan Hasil</DialogTitle>
              <DialogDescription className="text-xs">Masukkan budget terpakai dan leads yang masuk.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Biaya Iklan (Ads Spent)</Label>
                <Input type="number" value={inputAmountSpent} onChange={(e) => setInputAmountSpent(e.target.value)} placeholder="0" required />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">Total Leads/Gasing</Label>
                <Input type="number" value={inputTotalLeads} onChange={(e) => setInputTotalLeads(e.target.value)} placeholder="0" required />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-sm">CPR (Cost Per Result)</Label>
                <Input type="number" step="0.01" value={inputCPR} onChange={(e) => setInputCPR(e.target.value)} placeholder="0" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReportDialogOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Laporan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold text-lg">{editingTemplate ? "Edit Template Master" : "Buat Template Baru"}</DialogTitle>
              <DialogDescription className="text-xs">Kelola konten narasi untuk script video iklan.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Kategori</Label>
                <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "VO" | "JJ")}>
                  <TabsList className="grid grid-cols-2"><TabsTrigger value="VO">Voice Over</TabsTrigger><TabsTrigger value="JJ">Jedag Jedug</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Nama Template</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Narasi Script</Label>
                <Textarea value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} className="min-h-[150px] font-mono text-sm leading-relaxed bg-slate-50 border-slate-200" required />
              </div>
              <div className="text-[10px] text-muted-foreground bg-slate-100 p-3 rounded-lg border border-slate-200 font-medium">
                <span className="font-bold text-slate-700">Variabel:</span> {"{city}"} (Kota), {"{day}"} (Hari), {"{date}"} (Tanggal)
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsTemplateDialogOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" className="font-bold px-8" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNotifTemplate} onOpenChange={(v) => !v && setEditingNotifTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => handleUpdateNotifTemplate(e, editingNotifTemplate?.slug || "", editingNotifTemplate?.isActive, editingNotifTemplate?.message)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Pesan WhatsApp</DialogTitle>
              <DialogDescription className="text-xs">Ubah isi pesan otomatis yang dikirim sistem.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-4">
              <Textarea value={editingNotifTemplate?.message || ""} onChange={(e) => setEditingNotifTemplate(prev => prev ? { ...prev, message: e.target.value } : null)} className="min-h-[140px] font-mono text-[13px] bg-slate-50 border-slate-200 p-4 leading-relaxed" />
              <div className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-200 p-3 rounded-lg font-medium">
                <span className="font-bold text-amber-800">Variabel WA:</span> {"{promotor}"}, {"{city}"}, {"{jumlah}"}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingNotifTemplate(null)}>Batal</Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8" disabled={isSubmitting}>Update Pesan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={proofPreviewOpen} onOpenChange={setProofPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-semibold">{proofPreviewTitle}</DialogTitle>
            <DialogDescription className="text-xs">Preview bukti transfer tanpa membuka tab baru.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-slate-50 overflow-hidden">
            {isPdfProof ? (
              <iframe
                title={proofPreviewTitle}
                src={proofPreviewUrl}
                className="w-full h-[65vh] bg-white"
              />
            ) : (
              <img src={proofPreviewUrl} alt={proofPreviewTitle} className="w-full h-auto max-h-[65vh] object-contain bg-white" />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(proofPreviewUrl, "_blank", "noopener,noreferrer")}>
              Buka di tab baru
            </Button>
            <Button type="button" size="sm" onClick={() => setProofPreviewOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


