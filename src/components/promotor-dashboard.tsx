"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Plus,
  Upload,
  Download,
  FileText,
  Calendar,
  DollarSign,
  BarChart3,
  Users,
  Search,
  Megaphone,
  Clock,
  CheckCircle,
  AlertCircle,
  CalendarCheck,
  Building2,
  RefreshCcw,
  ArrowUpDown,
  Info,
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { compressImage } from "@/lib/utils"
import { buildCampaignName } from "@/lib/campaign-naming"
import { fetchWithTimeout } from "@/lib/fetch-timeout"
import { handleRequestError } from "@/lib/request-feedback"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromotorResult {
  id: string
  totalClients: number
  note: string | null
  status: string
}

interface AdReport {
  id: string
  cpr: number | null
  totalLeads: number | null
  amountSpent: number | null
}

interface AdRequest {
  id: string
  campaignCode?: string | null
  metaCampaignId?: string | null
  city: string
  startDate: string
  testEndDate: string | null
  durationDays: number
  dailyBudget: number
  totalBudget: number
  ppn: number
  totalPayment: number
  saldoApplied?: number
  penaltyApplied?: number
  status: string
  paymentProofUrl: string | null
  contentUrl: string | null
  adStartDate: string | null
  adEndDate: string | null
  createdAt: string
  updatedAt: string
  promotorResult: PromotorResult | null
  adReport: AdReport | null
  promotor: { id: string; name: string; email: string; city: string }
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

const getCprColorClass = (cpr: number | null | undefined): string => {
  if (!cpr || !Number.isFinite(cpr)) return "text-slate-600 bg-slate-50 border-slate-200"
  if (cpr <= 2000) return "text-emerald-700 bg-emerald-50 border-emerald-200"
  if (cpr <= 4000) return "text-amber-700 bg-amber-50 border-amber-200"
  return "text-rose-700 bg-rose-50 border-rose-200"
}

const getCprPanelClass = (cpr: number | null | undefined): string => {
  if (!cpr || !Number.isFinite(cpr)) return "border-slate-200 bg-slate-50/60"
  if (cpr <= 2000) return "border-emerald-200 bg-emerald-50/60"
  if (cpr <= 4000) return "border-amber-200 bg-amber-50/60"
  return "border-rose-200 bg-rose-50/60"
}

const getCprToneTextClass = (cpr: number | null | undefined): string => {
  if (!cpr || !Number.isFinite(cpr)) return "text-slate-700"
  if (cpr <= 2000) return "text-emerald-700"
  if (cpr <= 4000) return "text-amber-700"
  return "text-rose-700"
}

const MIN_AUTO_SALDO_APPLY = 100_000
const GLOBAL_ADS_PAGE_SIZE = 15
const HISTORY_PAGE_SIZE = 10
const FINAL_PAGE_SIZE = 10

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
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

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  MENUNGGU_PEMBAYARAN: {
    label: "Menunggu Pembayaran",
    variant: "outline",
    className: "border-amber-500 text-amber-700 bg-amber-50",
  },
  MENUNGGU_VERIFIKASI_PEMBAYARAN: {
    label: "Menunggu Verifikasi Pembayaran",
    variant: "outline",
    className: "border-amber-600 text-amber-800 bg-amber-100",
  },
  MENUNGGU_KONTEN: {
    label: "Menunggu Konten",
    variant: "outline",
    className: "border-orange-500 text-orange-700 bg-orange-50",
  },
  DIPROSES: {
    label: "Diproses",
    variant: "outline",
    className: "border-blue-500 text-blue-700 bg-blue-50",
  },
  KONTEN_SELESAI: {
    label: "Konten Selesai",
    variant: "outline",
    className: "border-green-500 text-green-700 bg-green-50",
  },
  IKLAN_DIJADWALKAN: {
    label: "Iklan Dijadwalkan",
    variant: "outline",
    className: "border-blue-500 text-blue-700 bg-blue-50",
  },
  IKLAN_BERJALAN: { label: "Iklan Berjalan", variant: "outline", className: "border-purple-500 text-purple-700 bg-purple-50" },
  SELESAI: { label: "Iklan Selesai", variant: "secondary", className: "border-gray-400 text-gray-600 bg-gray-100" },
  FINAL: { label: "Final", variant: "default", className: "bg-slate-900 text-white border-slate-900" },
  BATAL: { label: "Dibatalkan", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
}

const getStatusBadge = (status: string) => {
  const config = statusConfig[status]
  if (!config) {
    return (
      <Badge variant="outline" className="border-gray-400 text-gray-600">
        {status}
      </Badge>
    )
  }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// ─── Status Flow Order ───────────────────────────────────────────────────────

const STATUS_ORDER = [
  "MENUNGGU_PEMBAYARAN",
  "MENUNGGU_VERIFIKASI_PEMBAYARAN",
  "MENUNGGU_KONTEN",
  "DIPROSES",
  "KONTEN_SELESAI",
  "IKLAN_DIJADWALKAN",
  "IKLAN_BERJALAN",
  "SELESAI",
  "FINAL",
  "BATAL"
]

const isAtOrAfter = (status: string, target: string): boolean => {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(target)
}

// Normalize city name to Title Case (e.g. "bandung" → "Bandung", "BANDUNG BARAT" → "Bandung Barat")
const toTitleCase = (str: string): string =>
  str.trim().replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

// ─── Sub-Components ──────────────────────────────────────────────────────────

const RankCard = ({ rank, name, value, label, color }: { rank: number; name: string; value: string | number; label: string; color: string }) => (
  <div className={`flex items-center gap-4 p-4 rounded-xl border bg-white shadow-none hover:shadow-sm transition-all ${rank === 1 ? "border-amber-300 bg-amber-50/50" : rank === 2 ? "border-slate-300 bg-slate-50/50" : rank === 3 ? "border-orange-200 bg-orange-50/30" : "border-slate-100"}`}>
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : rank === 3 ? "bg-orange-400 text-white" : "bg-slate-100 text-slate-500"
      }`}>
      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-bold text-slate-900 truncate">{name}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
    </div>
    <div className={`text-right font-black text-lg ${color}`}>{value}</div>
  </div>
)

// ─── Component ───────────────────────────────────────────────────────────────

const PROMOTOR_TAB_TO_ROUTE: Record<string, string> = {
  pengajuan: "pengajuan-iklan",
  riwayat: "riwayat-iklan",
  "data-iklan": "data-iklan-global",
  "top-promotor": "top-promotor",
}

export default function PromotorDashboard({
  initialTab = "pengajuan",
  routeBasePath,
}: {
  initialTab?: string
  routeBasePath?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [globalAds, setGlobalAds] = useState<AdRequest[]>([])
  const [allGlobalAds, setAllGlobalAds] = useState<AdRequest[]>([])
  const [mainTab, setMainTab] = useState(initialTab)
  const [pengajuanTab, setPengajuanTab] = useState<"PAY" | "WAIT_CONTENT" | "PROCESS_CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL">("PAY")
  const [userProfile, setUserProfile] = useState<{ saldoRefund: number; unpaidPenalty: number } | null>(null)
  const [syncingGlobalAds, setSyncingGlobalAds] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [globalSearch, setGlobalSearch] = useState("")
  const [globalTargetFilter, setGlobalTargetFilter] = useState<"ALL" | "15_30" | "30_PLUS">("ALL")
  const [globalSortKey, setGlobalSortKey] = useState<"LEADS" | "KLIEN" | "CPR" | null>(null)
  const [globalSortOrder, setGlobalSortOrder] = useState<"asc" | "desc">("desc")
  const [globalSortDialogOpen, setGlobalSortDialogOpen] = useState(false)
  const [globalPage, setGlobalPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [finalPage, setFinalPage] = useState(1)
  const [metaSyncStatus, setMetaSyncStatus] = useState<MetaSyncStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [uploadDialogId, setUploadDialogId] = useState<string | null>(null)
  const [resultDialogId, setResultDialogId] = useState<string | null>(null)
  const [paymentDetailAd, setPaymentDetailAd] = useState<AdRequest | null>(null)
  const [saldoDetailOpen, setSaldoDetailOpen] = useState(false)

  // Form state for create
  const [testMode, setTestMode] = useState<"1DAY" | "2DAYS">("1DAY")
  const [formCity, setFormCity] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formDuration, setFormDuration] = useState("")
  const [formDailyBudget, setFormDailyBudget] = useState("")
  const [formNote, setFormNote] = useState("")

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Result state
  const [resultClients, setResultClients] = useState("")
  const [resultNote, setResultNote] = useState("")
  const [submittingResult, setSubmittingResult] = useState(false)

  // Edit states
  const [editingAd, setEditingAd] = useState<AdRequest | null>(null)
  const [editFormCity, setEditFormCity] = useState("")
  const [editFormStartDate, setEditFormStartDate] = useState("")
  const [editFormDuration, setEditFormDuration] = useState("")
  const [editFormDailyBudget, setEditFormDailyBudget] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [waLink, setWaLink] = useState("")
  const activeSyncBusyRef = useRef(false)
  const loadedMainTabsRef = useRef(new Set<string>())
  const adRequestsAbortRef = useRef<AbortController | null>(null)
  const globalAdsAbortRef = useRef<AbortController | null>(null)
  const metaSyncStatusAbortRef = useRef<AbortController | null>(null)
  const metaSyncPostAbortRef = useRef<AbortController | null>(null)
  const manualMetaSyncClickedAtRef = useRef(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCampaignLabel = (ad: AdRequest) =>
    buildCampaignName({
      city: ad.city,
      startDate: new Date(ad.startDate),
      promotorName: ad.promotor.name,
      campaignCode: ad.campaignCode || undefined,
    })

  const toggleGlobalSort = (key: "LEADS" | "KLIEN" | "CPR") => {
    if (globalSortKey === key) {
      setGlobalSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setGlobalSortKey(key)
      setGlobalSortOrder(key === "CPR" ? "asc" : "desc")
    }
  }

  const applyGlobalSort = (key: "LEADS" | "KLIEN" | "CPR" | null, order: "asc" | "desc") => {
    setGlobalSortKey(key)
    setGlobalSortOrder(order)
    setGlobalSortDialogOpen(false)
  }

  const getGlobalSortLabel = () => {
    if (!globalSortKey) return "Terbaru (default)"
    if (globalSortKey === "CPR") return globalSortOrder === "asc" ? "CPR Termurah" : "CPR Termahal"
    if (globalSortKey === "LEADS") return globalSortOrder === "asc" ? "Leads Terkecil" : "Leads Terbanyak"
    return globalSortOrder === "asc" ? "Klien Terkecil" : "Klien Terbanyak"
  }

  const handleCopyCampaignLabel = async (ad: AdRequest) => {
    const text = getCampaignLabel(ad)
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Nama campaign siap dicopas")
    } catch {
      toast.error("Gagal menyalin nama campaign")
    }
  }

  const handleCancel = async (id: string, message: string) => {
    if (!confirm(message)) return

    setIsCancelling(id)
    try {
      const res = await fetch(`/api/ad-requests/${id}/cancel`, {
        method: "POST"
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan iklan")
      
      toast.success(data.message || "Iklan berhasil dibatalkan")
      fetchAdRequests()
      fetchUserProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsCancelling(null)
    }
  }

  // ── Stats Memoization ──────────────────────────────────────────────────────

  const topPromotorStats = useMemo(() => {
    const stats: Record<string, { id: string; name: string; totalClients: number; totalSpent: number; totalAds: number }> = {}

    // For clients & spending: use globalAds (with reports)
    globalAds.forEach((ad) => {
      const id = ad.promotor.id
      if (!stats[id]) {
        stats[id] = { id, name: ad.promotor.name, totalClients: 0, totalSpent: 0, totalAds: 0 }
      }
      if (ad.promotorResult?.status === "VALID") {
        stats[id].totalClients += ad.promotorResult.totalClients
      }
      if (ad.adReport) {
        stats[id].totalSpent += ad.adReport.amountSpent || 0
      }
    })

    // For ad count: use allGlobalAds (all confirmed, excl. MENUNGGU_PEMBAYARAN)
    allGlobalAds.forEach((ad) => {
      const id = ad.promotor.id
      if (!stats[id]) {
        stats[id] = { id, name: ad.promotor.name, totalClients: 0, totalSpent: 0, totalAds: 0 }
      }
      stats[id].totalAds++
    })

    return Object.values(stats)
  }, [globalAds, allGlobalAds])

  const adStatusBuckets = useMemo(() => {
    const buckets = {
      PAY: [] as AdRequest[],
      WAIT_CONTENT: [] as AdRequest[],
      PROCESS_CONTENT: [] as AdRequest[],
      SCHEDULED: [] as AdRequest[],
      ACTIVE: [] as AdRequest[],
      DONE: [] as AdRequest[],
      FINAL: [] as AdRequest[],
    }

    for (const ad of adRequests) {
      if (["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(ad.status)) {
        buckets.PAY.push(ad)
      } else if (ad.status === "MENUNGGU_KONTEN") {
        buckets.WAIT_CONTENT.push(ad)
      } else if (["DIPROSES", "KONTEN_SELESAI"].includes(ad.status)) {
        buckets.PROCESS_CONTENT.push(ad)
      } else if (ad.status === "IKLAN_DIJADWALKAN") {
        buckets.SCHEDULED.push(ad)
      } else if (ad.status === "IKLAN_BERJALAN") {
        buckets.ACTIVE.push(ad)
      } else if (ad.status === "SELESAI") {
        buckets.DONE.push(ad)
      } else if (ad.status === "FINAL") {
        buckets.FINAL.push(ad)
      }
    }

    return buckets
  }, [adRequests])

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAdRequests = useCallback(async () => {
    try {
      adRequestsAbortRef.current?.abort()
      const controller = new AbortController()
      adRequestsAbortRef.current = controller
      const res = await fetchWithTimeout("/api/ad-requests?lite=1&view=promotor:main", { signal: controller.signal }, 20000)
      if (!res.ok) {
        throw new Error("Gagal mengambil data")
      }
      const data: AdRequest[] = await res.json()
      setAdRequests(data)
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Muat data pengajuan timeout, coba lagi.",
        errorMessage: "Gagal memuat data pengajuan iklan",
      })
      if (handled !== "error") return
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/users/profile")
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setUserProfile(data.user)
        }
      }
    } catch (err) {
      console.error("Profile fetch error:", err)
    }
  }, [])

  const syncGlobalAdsFromMeta = useCallback(async () => {
    if (activeSyncBusyRef.current) return
    activeSyncBusyRef.current = true
    setSyncingGlobalAds(true)
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
      if (data?.ok && (data.linkedCount > 0 || data.updatedCount > 0)) {
        toast.success(`Sinkron Meta: ${data.linkedCount} mapping, ${data.updatedCount} data terbarui`)
      }
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Sinkron Meta timeout, coba lagi.",
        showErrorToast: false,
      })
      if (handled !== "error") return
      // silent fail, UI tetap bisa pakai data terakhir
    } finally {
      activeSyncBusyRef.current = false
      setSyncingGlobalAds(false)
    }
  }, [])

  const syncActiveAdsFromMeta = useCallback(async (showToast = false) => {
    if (activeSyncBusyRef.current) return
    activeSyncBusyRef.current = true
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
      if (showToast && data?.ok && (data.linkedCount > 0 || data.updatedCount > 0)) {
        toast.success(`Sinkron Meta: ${data.linkedCount} mapping, ${data.updatedCount} data terbarui`)
      }
      await fetchAdRequests()
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Sinkron Meta timeout, coba lagi.",
        showErrorToast: false,
        showTimeoutToast: showToast,
      })
      if (handled !== "error") return
      // silent fail for background sync
    } finally {
      activeSyncBusyRef.current = false
    }
  }, [fetchAdRequests])

  const fetchGlobalAds = useCallback(async (runSync = false) => {
    if (runSync) {
      await syncGlobalAdsFromMeta()
    }
    try {
      globalAdsAbortRef.current?.abort()
      const controller = new AbortController()
      globalAdsAbortRef.current = controller
      const res = await fetchWithTimeout("/api/ad-requests?scope=all&lite=1&view=promotor:global", { signal: controller.signal }, 20000)
      if (!res.ok) {
        setGlobalAds([])
        setAllGlobalAds([])
        return
      }
      const data: AdRequest[] = await res.json()
      // Only show ads with reports for future decision making
      const adsWithReports = data.filter(ad => ad.adReport !== null)
      setGlobalAds(adsWithReports)
      // All confirmed ads (excluding unpaid) for lifetime count
      const confirmedAds = data.filter(ad => !["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(ad.status))
      setAllGlobalAds(confirmedAds)
    } catch (error: any) {
      const handled = handleRequestError(error, {
        timeoutMessage: "Koneksi lambat. Muat data global timeout, coba lagi.",
        showErrorToast: false,
      })
      if (handled !== "error") return
      setGlobalAds([])
      setAllGlobalAds([])
    }
  }, [syncGlobalAdsFromMeta])

  useEffect(() => {
    return () => {
      adRequestsAbortRef.current?.abort()
      globalAdsAbortRef.current?.abort()
      metaSyncStatusAbortRef.current?.abort()
      metaSyncPostAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    setGlobalPage(1)
  }, [globalSearch, globalTargetFilter, globalSortKey, globalSortOrder, globalAds.length])

  useEffect(() => {
    setHistoryPage(1)
  }, [searchQuery, adRequests.length])

  useEffect(() => {
    setFinalPage(1)
  }, [adRequests.length, pengajuanTab])

  const fetchWaLink = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setWaLink(data.value || "")
    } catch { /* silent */ }
  }, [])

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
      const handled = handleRequestError(error, { showErrorToast: false })
      if (handled !== "error") return
      // silent
    }
  }, [])

  const handleManualGlobalMetaSync = useCallback(async () => {
    const now = Date.now()
    if (now - manualMetaSyncClickedAtRef.current < 1200) return
    manualMetaSyncClickedAtRef.current = now
    if (syncingGlobalAds || activeSyncBusyRef.current) return
    await fetchGlobalAds(true)
    await fetchMetaSyncStatus()
  }, [syncingGlobalAds, fetchGlobalAds, fetchMetaSyncStatus])

  useEffect(() => {
    if (!initialTab) return
    setMainTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (user) {
      fetchAdRequests()
      fetchUserProfile()
      fetchWaLink()
      fetchMetaSyncStatus()
    }
  }, [user, fetchAdRequests, fetchUserProfile, fetchWaLink, fetchMetaSyncStatus])

  useEffect(() => {
    if (!user || !mainTab) return
    if (loadedMainTabsRef.current.has(mainTab)) return
    loadedMainTabsRef.current.add(mainTab)
    if (mainTab === "data-iklan" || mainTab === "top-promotor") {
      fetchGlobalAds(false)
    }
  }, [user, mainTab, fetchGlobalAds])

  useEffect(() => {
    if (!user) return
    if (mainTab !== "pengajuan" || pengajuanTab !== "ACTIVE") return

    void syncActiveAdsFromMeta(false)
    const timer = setInterval(() => {
      void syncActiveAdsFromMeta(false)
    }, 60_000)

    return () => clearInterval(timer)
  }, [user, mainTab, pengajuanTab, syncActiveAdsFromMeta])

  const renderAdCards = (tabType: "PAY" | "WAIT_CONTENT" | "PROCESS_CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL") => {
    const filtered = adStatusBuckets[tabType]

    const isFinalTab = tabType === "FINAL"
    const finalTotalItems = filtered.length
    const finalTotalPages = Math.max(1, Math.ceil(finalTotalItems / FINAL_PAGE_SIZE))
    const finalCurrentPage = Math.min(finalPage, finalTotalPages)
    const finalStartIdx = (finalCurrentPage - 1) * FINAL_PAGE_SIZE
    const finalEndIdxExclusive = finalStartIdx + FINAL_PAGE_SIZE
    const finalPaginated = isFinalTab ? filtered.slice(finalStartIdx, finalEndIdxExclusive) : filtered
    const finalFirstItemNumber = finalTotalItems === 0 ? 0 : finalStartIdx + 1
    const finalLastItemNumber = Math.min(finalEndIdxExclusive, finalTotalItems)

    if (filtered.length === 0) {
      return (
        <Card className="border-dashed shadow-none bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm italic">
              {tabType === "DONE"
                ? "Belum ada iklan selesai. Saat status sudah Iklan Selesai, silakan input jumlah klien."
                : tabType === "FINAL"
                  ? "Belum ada data Final. Status Final muncul setelah jumlah klien divalidasi admin STIFIn."
                  : "Belum ada pengajuan di kategori ini."}
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {finalPaginated.map((ad) => (
          <Card key={ad.id}>
            <CardHeader className="px-4 py-3 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {ad.city}
                  </CardTitle>
                  <CardDescription className="text-[10px] italic">
                    Dibuat {formatDate(ad.createdAt)}
                  </CardDescription>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ad.campaignCode || "NO-CODE"}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground">
                      {getCampaignLabel(ad)}
                    </p>
                    {ad.metaCampaignId && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        ID: {ad.metaCampaignId}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleCopyCampaignLabel(ad)}
                    >
                      Copy Nama Campaign
                    </Button>
                  </div>
                </div>
                {getStatusBadge(ad.status)}
              </div>
            </CardHeader>
            <CardContent className="px-4 py-2 space-y-3">
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 py-2 text-sm border-t border-slate-50 mt-1">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1 font-medium text-[10px] uppercase tracking-tight">
                    <Calendar className="h-3 w-3" />
                    Tanggal Tes STIFIn
                  </p>
                  <p className="font-bold text-slate-800 text-[13px]">
                    {formatTestDate(ad.startDate, ad.testEndDate)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-tight font-medium">
                    <Clock className="h-3 w-3" />
                    Durasi
                  </p>
                  <p className="font-bold text-slate-800 text-[13px]">{ad.durationDays} hari</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-tight font-medium">
                    <DollarSign className="h-3 w-3" />
                    Budget/Hari
                  </p>
                  <p className="font-bold text-slate-800 text-[13px]">
                    {formatRupiah(ad.dailyBudget)}
                  </p>
                </div>
                <div 
                  className="space-y-0.5 cursor-pointer hover:bg-slate-50 p-2 -m-1 rounded-md transition-colors active:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPaymentDetailAd(ad);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-tight font-medium">
                      <DollarSign className="h-3 w-3" />
                      Total Bayar
                    </p>
                    <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-blue-100">
                      <Info className="h-2.5 w-2.5" />
                      Detail
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-[13px] border-b border-dotted border-slate-300 w-fit">
                    {formatRupiah(ad.totalBudget + ad.ppn + (ad.penaltyApplied || 0))}
                  </p>
                  {ad.totalPayment === 0 && (
                    <p className="text-[9px] text-emerald-600 font-medium italic mt-0.5">
                      Lunas (Saldo)
                    </p>
                  )}
                  {ad.totalPayment > 0 && ad.saldoApplied && ad.saldoApplied > 0 && (
                    <p className="text-[9px] text-blue-600 font-medium italic mt-0.5">
                      Sisa Bayar: {formatRupiah(ad.totalPayment)}
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduled Info Section */}
              {ad.adStartDate && (
                <div className={`rounded-lg p-3 border text-sm space-y-2 ${ad.status === "IKLAN_DIJADWALKAN"
                  ? "bg-blue-50 border-blue-100 text-blue-800"
                  : "bg-muted/30 border-muted"
                  }`}>
                  <div className="flex items-center gap-2 font-medium">
                    <CalendarCheck className="h-4 w-4" />
                    Jadwal Tayang Iklan
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70 shrink-0">Mulai:</span>
                      <span className="font-semibold leading-none">{new Date(ad.adStartDate).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70 shrink-0">Berakhir:</span>
                      <span className="font-semibold leading-none">{new Date(ad.adEndDate!).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              )}


              {/* Action buttons based on status */}
              <div className="flex flex-wrap gap-2">
                {/* MENUNGGU_PEMBAYARAN / MENUNGGU_VERIFIKASI_PEMBAYARAN → Upload/Upload Ulang bukti transfer */}
                {["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(ad.status) && (
                  <>
                    <Dialog
                      open={uploadDialogId === ad.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setUploadDialogId(ad.id)
                        } else {
                          setUploadDialogId(null)
                          setUploadFile(null)
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          {ad.status === "MENUNGGU_VERIFIKASI_PEMBAYARAN" ? "Upload Ulang Bukti Transfer" : "Upload Bukti Transfer"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Upload Bukti Transfer</DialogTitle>
                          <DialogDescription>
                            Upload bukti pembayaran untuk pengajuan iklan di{" "}
                            <strong>{ad.city}</strong>
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Total Pembayaran
                            </p>
                            <p className="font-semibold">
                              {formatRupiah(ad.totalBudget + ad.ppn + (ad.penaltyApplied || 0))}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`proof-${ad.id}`}>
                              File Bukti Transfer
                            </Label>
                            <Input
                              id={`proof-${ad.id}`}
                              ref={fileInputRef}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) setUploadFile(file)
                              }}
                            />
                            {uploadFile && (
                              <p className="text-xs text-muted-foreground">
                                Dipilih: {uploadFile.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setUploadDialogId(null)
                              setUploadFile(null)
                            }}
                            disabled={uploading}
                          >
                            Batal
                          </Button>
                          <Button
                            onClick={handleUploadProof}
                            disabled={uploading || !uploadFile}
                          >
                            {uploading ? "Mengupload..." : "Upload"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(ad)}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(ad.id)}
                      disabled={isDeleting === ad.id}
                    >
                      {isDeleting === ad.id ? "Menghapus..." : "Hapus"}
                    </Button>
                  </>
                )}

                {/* Batalkan Iklan: MENUNGGU_KONTEN, DIPROSES, KONTEN_SELESAI */}
                {["MENUNGGU_KONTEN", "DIPROSES", "KONTEN_SELESAI"].includes(ad.status) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 border-red-200"
                    onClick={() => {
                      const msg = ad.status === "MENUNGGU_KONTEN"
                        ? "Anda yakin ingin membatalkan pengajuan ini? Saldo Anda akan dikembalikan sepenuhnya."
                        : "Anda yakin membatalkan pengajuan ini? Pembatalan dikenakan biaya Rp 20.000 yang langsung memotong saldo (saldo bisa menjadi minus)."
                      handleCancel(ad.id, msg)
                    }}
                    disabled={isCancelling === ad.id}
                  >
                    {isCancelling === ad.id ? "Membatalkan..." : "Batalkan"}
                  </Button>
                )}

                {/* KONTEN_SELESAI or later → WhatsApp Channel */}
                {isAtOrAfter(ad.status, "KONTEN_SELESAI") && (
                  <Button variant="outline" size="sm" asChild className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold hover:text-emerald-800">
                    <a href={waLink || "#"} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      DOWNLOAD KONTEN
                    </a>
                  </Button>
                )}

                {/* Laporan Promotor (Jumlah Klien) - Muncul setelah Advertiser input laporan (SELESAI) */}
                {ad.status === "SELESAI" && ad.adReport && (
                  <Dialog
                    open={resultDialogId === ad.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setResultDialogId(ad.id)
                        // Pre-fill if result exists
                        if (ad.promotorResult) {
                          setResultClients(
                            String(ad.promotorResult.totalClients)
                          )
                          setResultNote(ad.promotorResult.note || "")
                        } else {
                          setResultClients("")
                          setResultNote("")
                        }
                      } else {
                        setResultDialogId(null)
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className={ad.promotorResult?.status === "VALID" ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800"}>
                        <FileText className="h-4 w-4 mr-2" />
                        {ad.promotorResult?.status === "VALID" ? "Ajukan Revisi" : "Input Jumlah Klien"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{ad.promotorResult?.status === "VALID" ? "Ajukan Revisi Laporan" : "Input Laporan Klien"}</DialogTitle>
                        <DialogDescription>
                          {ad.promotorResult?.status === "VALID"
                            ? "Anda sedang mengajukan revisi untuk laporan yang sudah divalidasi."
                            : `Laporkan jumlah klien yang didapat dari iklan di ${ad.city}`}
                        </DialogDescription>
                      </DialogHeader>
                      {ad.promotorResult?.status === "VALID" && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <p>
                            <strong>Peringatan Revisi:</strong> Mengubah data akan menghapus status <strong>Valid</strong> dan laporan Anda akan memerlukan persetujuan ulang dari Admin STIFIn.
                          </p>
                        </div>
                      )}
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor={`clients-${ad.id}`}>
                            Jumlah Klien
                          </Label>
                          <Input
                            id={`clients-${ad.id}`}
                            type="number"
                            placeholder="Masukkan jumlah klien..."
                            min={0}
                            value={resultClients}
                            onChange={(e) =>
                              setResultClients(e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`note-${ad.id}`}>Catatan</Label>
                          <Input
                            id={`note-${ad.id}`}
                            type="text"
                            placeholder="Catatan tambahan (opsional)..."
                            value={resultNote}
                            onChange={(e) =>
                              setResultNote(e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setResultDialogId(null)}
                          disabled={submittingResult}
                        >
                          Batal
                        </Button>
                        <Button
                          onClick={handleSubmitResult}
                          disabled={submittingResult}
                        >
                          {submittingResult ? "Menyimpan..." : (ad.promotorResult?.status === "VALID" ? "Simpan Revisi" : "Simpan Hasil")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {/* Promotor result display */}
              {ad.promotorResult && isAtOrAfter(ad.status, "KONTEN_SELESAI") && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Hasil Promotor
                    </div>
                    {ad.promotorResult.status === "VALID" ? (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        Sudah Valid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                        Menunggu Validasi
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Jumlah Klien:{" "}
                      </span>
                      <span className="font-medium">
                        {ad.promotorResult.totalClients}
                      </span>
                    </div>
                    {ad.promotorResult.note && (
                      <div>
                        <span className="text-muted-foreground">
                          Catatan:{" "}
                        </span>
                        <span className="font-medium">
                          {ad.promotorResult.note}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ad Report display */}
              {ad.adReport && (
                <div className={`rounded-lg border p-4 space-y-2 ${getCprPanelClass(ad.adReport.cpr)}`}>
                  <div className={`flex items-center gap-2 text-sm font-medium ${getCprToneTextClass(ad.adReport.cpr)}`}>
                    <AlertCircle className={`h-4 w-4 ${getCprToneTextClass(ad.adReport.cpr)}`} />
                    Laporan Iklan
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {ad.adReport.cpr !== null && (
                      <div>
                        <span className="text-muted-foreground">
                          CPR:{" "}
                        </span>
                        <span className="font-medium">
                          {formatRupiah(Math.round(ad.adReport.cpr))}
                        </span>
                      </div>
                    )}
                    {ad.adReport.totalLeads !== null && (
                      <div>
                        <span className="text-muted-foreground">
                          Total Leads:{" "}
                        </span>
                        <span className="font-medium">
                          {ad.adReport.totalLeads}
                        </span>
                      </div>
                    )}
                    {ad.adReport.amountSpent !== null && (
                      <div>
                        <span className="text-muted-foreground">
                          Total Spend:{" "}
                        </span>
                        <span className="font-medium">
                          {formatRupiah(ad.adReport.amountSpent)}
                        </span>
                      </div>
                    )}
                    {ad.adReport.amountSpent !== null && (
                      <div>
                        <span className="text-muted-foreground">
                          Sisa Saldo:{" "}
                        </span>
                        <span className="font-medium text-emerald-700">
                          {formatRupiah(Math.max(ad.totalBudget - ad.adReport.amountSpent, 0))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {isFinalTab && finalTotalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border bg-white px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Menampilkan {finalFirstItemNumber}-{finalLastItemNumber} dari {finalTotalItems} data
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={() => setFinalPage((prev) => Math.max(prev - 1, 1))}
                disabled={finalCurrentPage <= 1}
              >
                Sebelumnya
              </Button>
              <span className="text-xs font-semibold text-slate-700">
                Hal {finalCurrentPage}/{finalTotalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={() => setFinalPage((prev) => Math.min(prev + 1, finalTotalPages))}
                disabled={finalCurrentPage >= finalTotalPages}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  const totalPengajuan = adRequests.length
  const iklanBerjalan = adStatusBuckets.ACTIVE.length
  const totalKlien = useMemo(
    () => adRequests.reduce((sum, r) => sum + (r.promotorResult?.totalClients || 0), 0),
    [adRequests]
  )
  const totalLeftoverSaldo = useMemo(
    () =>
      adRequests.reduce((sum, r) => {
        if (!["SELESAI", "FINAL"].includes(r.status)) return sum
        if (!r.adReport || r.adReport.amountSpent === null || r.adReport.amountSpent === undefined) return sum
        const sisa = Math.max(r.totalBudget - r.adReport.amountSpent, 0)
        return sum + sisa
      }, 0),
    [adRequests]
  )
  const totalSaldoUsed = useMemo(
    () => adRequests.reduce((sum, r) => {
      if (r.status === "BATAL") return sum
      return sum + (r.saldoApplied || 0)
    }, 0),
    [adRequests]
  )
  
  const refundSaldo = userProfile?.saldoRefund || 0
  const totalSaldoTersedia = Math.max(totalLeftoverSaldo - totalSaldoUsed, 0) + refundSaldo
  const saldoSiapPakai = totalSaldoTersedia >= MIN_AUTO_SALDO_APPLY ? totalSaldoTersedia : 0
  const saldoMutations = useMemo(() => {
    const rows: Array<{
      id: string
      at: string
      label: string
      amount: number
      flow: "IN" | "OUT"
      sortRank: number
    }> = []

    for (const ad of adRequests) {
      if (["SELESAI", "FINAL"].includes(ad.status) && ad.adReport?.amountSpent !== null && ad.adReport?.amountSpent !== undefined) {
        const sisa = Math.max(ad.totalBudget - ad.adReport.amountSpent, 0)
        if (sisa > 0) {
          rows.push({
            id: `${ad.id}-leftover`,
            at: ad.updatedAt,
            label: `Sisa budget iklan ${ad.city}`,
            amount: sisa,
            flow: "IN",
            sortRank: 10,
          })
        }
      }

      if (ad.status === "BATAL") {
        const refund = ad.totalPayment + (ad.saldoApplied || 0)
        if (refund > 0) {
          rows.push({
            id: `${ad.id}-refund`,
            at: ad.updatedAt,
            label: `Refund pembatalan ${ad.city}`,
            amount: refund,
            flow: "IN",
            sortRank: 1,
          })
        }
        if ((ad.penaltyApplied || 0) > 0) {
          rows.push({
            id: `${ad.id}-penalty`,
            at: ad.updatedAt,
            label: `Denda pembatalan ${ad.city}`,
            amount: -(ad.penaltyApplied || 0),
            flow: "OUT",
            sortRank: 2,
          })
        }
      }

      if ((ad.saldoApplied || 0) > 0 && ad.status !== "BATAL") {
        rows.push({
          id: `${ad.id}-used`,
          at: ad.createdAt,
          label: `Saldo dipakai untuk pengajuan ${ad.city}`,
          amount: -(ad.saldoApplied || 0),
          flow: "OUT",
          sortRank: 20,
        })
      }
    }

    return rows.sort((a, b) => {
      const byDate = new Date(b.at).getTime() - new Date(a.at).getTime()
      if (byDate !== 0) return byDate
      return a.sortRank - b.sortRank
    })
  }, [adRequests])

  // ── Create ad request ─────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formCity || !formStartDate || !formDuration || !formDailyBudget) {
      toast.error("Semua field wajib diisi")
      return
    }

    const durationDays = parseInt(formDuration, 10)
    const dailyBudget = parseInt(formDailyBudget, 10)

    if (isNaN(durationDays) || durationDays <= 0) {
      toast.error("Durasi harus berupa angka positif")
      return
    }
    if (isNaN(dailyBudget) || dailyBudget <= 0) {
      toast.error("Budget harus berupa angka positif")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/ad-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: toTitleCase(formCity),
          startDate: formStartDate,
          testEndDate: testMode === "2DAYS" ? formEndDate : null,
          durationDays,
          dailyBudget,
          promotorNote: formNote || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal membuat pengajuan")
      }

      toast.success("Pengajuan iklan berhasil dibuat!")
      setCreateDialogOpen(false)
      setFormCity("")
      setFormStartDate("")
      setFormDuration("")
      setFormDailyBudget("")
      setFormNote("")
      fetchAdRequests()
      fetchUserProfile()
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pengajuan")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Upload proof ──────────────────────────────────────────────────────────

  const handleUploadProof = async () => {
    if (!uploadDialogId || !uploadFile) {
      toast.error("Pilih file bukti transfer terlebih dahulu")
      return
    }

    setUploading(true)
    try {
      // 0. Compress file before upload
      const compressedFile = await compressImage(uploadFile)

      // 1. Upload file
      const formData = new FormData()
      formData.append("file", compressedFile)
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!uploadRes.ok) {
        throw new Error("Gagal upload file")
      }
      const { url } = await uploadRes.json()

      // 2. Submit proof URL
      const proofRes = await fetch(
        `/api/ad-requests/${uploadDialogId}/upload-proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentProofUrl: url }),
        }
      )
      if (!proofRes.ok) {
        const err = await proofRes.json()
        throw new Error(err.error || "Gagal upload bukti transfer")
      }

      toast.success("Bukti transfer berhasil diupload!")
      setUploadDialogId(null)
      setUploadFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      fetchAdRequests()
    } catch (err: any) {
      toast.error(err.message || "Gagal upload bukti transfer")
    } finally {
      setUploading(false)
    }
  }

  // ── Submit promotor result ────────────────────────────────────────────────

  const handleSubmitResult = async () => {
    if (!resultDialogId || !resultClients) {
      toast.error("Jumlah klien wajib diisi")
      return
    }

    const totalClients = parseInt(resultClients, 10)
    if (isNaN(totalClients) || totalClients < 0) {
      toast.error("Jumlah klien harus berupa angka non-negatif")
      return
    }

    setSubmittingResult(true)
    try {
      const res = await fetch(
        `/api/ad-requests/${resultDialogId}/promotor-result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalClients, note: resultNote || null }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal input hasil")
      }

      toast.success("Hasil berhasil disimpan!")
      setResultDialogId(null)
      setResultClients("")
      setResultNote("")
      fetchAdRequests()
    } catch (err: any) {
      toast.error(err.message || "Gagal input hasil")
    } finally {
      setSubmittingResult(false)
    }
  }

  // ── Edit & Delete ad request ──────────────────────────────────────────────

  const handleOpenEdit = (ad: AdRequest) => {
    setEditingAd(ad)
    setEditFormCity(ad.city)
    setEditFormStartDate(new Date(ad.startDate).toISOString().split("T")[0])
    setEditFormDuration(ad.durationDays.toString())
    setEditFormDailyBudget(ad.dailyBudget.toString())
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingAd) return
    if (!editFormCity || !editFormStartDate || !editFormDuration || !editFormDailyBudget) {
      toast.error("Semua field wajib diisi")
      return
    }

    const duration = parseInt(editFormDuration, 10)
    const dailyBudget = parseInt(editFormDailyBudget, 10)

    setIsUpdating(true)
    try {
      const res = await fetch(`/api/ad-requests/${editingAd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: toTitleCase(editFormCity),
          startDate: editFormStartDate,
          durationDays: duration,
          dailyBudget,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal mengupdate pengajuan")
      }

      toast.success("Pengajuan berhasil diperbarui!")
      setEditDialogOpen(false)
      fetchAdRequests()
    } catch (err: any) {
      toast.error(err.message || "Gagal mengupdate pengajuan")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengajuan ini?")) return

    setIsDeleting(id)
    try {
      const res = await fetch(`/api/ad-requests/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal menghapus pengajuan")
      }

      toast.success("Pengajuan berhasil dihapus!")
      fetchAdRequests()
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus pengajuan")
    } finally {
      setIsDeleting(null)
    }
  }

  // ── Calculated form summary ───────────────────────────────────────────────

  const calcDuration = parseInt(formDuration, 10) || 0
  const calcDailyBudget = parseInt(formDailyBudget, 10) || 0
  const calcTotalBudget = calcDuration * calcDailyBudget
  const calcPPn = Math.round(calcTotalBudget * 0.11)
  const calcGrossPayment = calcTotalBudget + calcPPn
  const calcSaldoAppliedPreview = Math.min(saldoSiapPakai, calcGrossPayment)
  const calcTotalPayment = Math.max(calcGrossPayment - calcSaldoAppliedPreview, 0)

  // ── Filtered history ──────────────────────────────────────────────────────

  const filteredHistory = useMemo(
    () => adRequests.filter((r) => r.city.toLowerCase().includes(searchQuery.toLowerCase())),
    [adRequests, searchQuery]
  )
  const historyTotalItems = filteredHistory.length
  const historyTotalPages = Math.max(1, Math.ceil(historyTotalItems / HISTORY_PAGE_SIZE))
  const historyCurrentPage = Math.min(historyPage, historyTotalPages)
  const historyStartIdx = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE
  const historyEndIdxExclusive = historyStartIdx + HISTORY_PAGE_SIZE
  const paginatedHistory = useMemo(
    () => filteredHistory.slice(historyStartIdx, historyEndIdxExclusive),
    [filteredHistory, historyStartIdx, historyEndIdxExclusive]
  )
  const historyFirstItemNumber = historyTotalItems === 0 ? 0 : historyStartIdx + 1
  const historyLastItemNumber = Math.min(historyEndIdxExclusive, historyTotalItems)

  const globalAdsDisplay = useMemo(() => {
    const search = globalSearch.toLowerCase().trim()
    const getTestReferenceDate = (ad: AdRequest) => new Date(ad.testEndDate || ad.startDate)
    const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const today = toStartOfDay(new Date())

    const baseFiltered = globalAds.filter((ad) => {
      if (!search) return true
      return ad.city.toLowerCase().includes(search) || ad.promotor.name.toLowerCase().includes(search)
    })

    const filtered = baseFiltered
      .filter((ad) => {
        const lastTargetDate = toStartOfDay(getTestReferenceDate(ad))
        const diffDays = Math.floor((today.getTime() - lastTargetDate.getTime()) / (1000 * 60 * 60 * 24))
        if (!Number.isFinite(diffDays)) return false
        if (globalTargetFilter === "ALL") return true
        if (globalTargetFilter === "15_30") return diffDays >= 15 && diffDays <= 30
        return diffDays > 30
      })
      .sort((a, b) => {
        if (!globalSortKey) {
          return getTestReferenceDate(b).getTime() - getTestReferenceDate(a).getTime()
        }

        const leadsA = a.adReport?.totalLeads || 0
        const leadsB = b.adReport?.totalLeads || 0
        const klienA = a.promotorResult?.totalClients || 0
        const klienB = b.promotorResult?.totalClients || 0
        const cprA = a.adReport?.cpr || 0
        const cprB = b.adReport?.cpr || 0

        let diff = 0
        if (globalSortKey === "LEADS") diff = leadsA - leadsB
        if (globalSortKey === "KLIEN") diff = klienA - klienB
        if (globalSortKey === "CPR") diff = cprA - cprB

        if (diff === 0) {
          return getTestReferenceDate(b).getTime() - getTestReferenceDate(a).getTime()
        }
        return globalSortOrder === "asc" ? diff : -diff
      })

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / GLOBAL_ADS_PAGE_SIZE))
    const currentPage = Math.min(globalPage, totalPages)
    const startIdx = (currentPage - 1) * GLOBAL_ADS_PAGE_SIZE
    const endIdxExclusive = startIdx + GLOBAL_ADS_PAGE_SIZE
    const paginated = filtered.slice(startIdx, endIdxExclusive)
    const firstItemNumber = totalItems === 0 ? 0 : startIdx + 1
    const lastItemNumber = Math.min(endIdxExclusive, totalItems)

    return {
      filtered,
      paginated,
      totalItems,
      totalPages,
      currentPage,
      firstItemNumber,
      lastItemNumber,
    }
  }, [globalAds, globalSearch, globalTargetFilter, globalSortKey, globalSortOrder, globalPage])

  const topPromotorByClients = useMemo(
    () => [...topPromotorStats].sort((a, b) => b.totalClients - a.totalClients),
    [topPromotorStats]
  )
  const topPromotorBySpent = useMemo(
    () => [...topPromotorStats].sort((a, b) => b.totalSpent - a.totalSpent),
    [topPromotorStats]
  )
  const topPromotorByAds = useMemo(
    () => [...topPromotorStats].sort((a, b) => b.totalAds - a.totalAds),
    [topPromotorStats]
  )

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Tabs skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="h-28 sm:h-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 pt-2.5 pb-0.5 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Total Pengajuan Iklan
            </CardTitle>
            <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">{totalPengajuan}</div>
          </CardContent>
        </Card>

        <Card className="h-28 sm:h-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 pt-2.5 pb-0.5 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Iklan Berjalan
            </CardTitle>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">{iklanBerjalan}</div>
          </CardContent>
        </Card>

        <Card className="h-28 sm:h-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 pt-2.5 pb-0.5 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Total Klien dari Iklan
            </CardTitle>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">{totalKlien}</div>
          </CardContent>
        </Card>

        <Card className="h-28 sm:h-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 pt-2.5 pb-0.5 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Saldo Tersedia
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
            <div className={`text-lg sm:text-2xl font-bold ${totalSaldoTersedia < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatRupiah(totalSaldoTersedia)}
            </div>
            <p className="hidden sm:block text-[10px] text-muted-foreground mt-1">
              Sisa budget iklan & refund pembatalan
            </p>
            <button
              type="button"
              onClick={() => setSaldoDetailOpen(true)}
              className="absolute right-2.5 top-0 text-[10px] text-blue-600 hover:text-blue-700 underline underline-offset-2 sm:static sm:mt-0.5"
            >
              detail
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ───────────────────────────────────────────────────── */}
      <Tabs
        value={mainTab}
        onValueChange={(nextTab) => {
          setMainTab(nextTab)
          if (routeBasePath) {
            const routeSegment = PROMOTOR_TAB_TO_ROUTE[nextTab] || PROMOTOR_TAB_TO_ROUTE.pengajuan
            router.push(`${routeBasePath}/${routeSegment}`)
          }
        }}
        className="w-full"
      >
        <TabsList className="bg-slate-100/50 p-1 border h-auto flex flex-wrap gap-1">
          <TabsTrigger value="pengajuan">📝 Pengajuan Iklan</TabsTrigger>
          <TabsTrigger value="riwayat">🗂️ Riwayat Iklan</TabsTrigger>
          <TabsTrigger value="data-iklan">📊 Data Iklan Global</TabsTrigger>
          <TabsTrigger value="top-promotor">🏆 Top Promotor</TabsTrigger>
        </TabsList>

        {/* ── Pengajuan Iklan Tab ───────────────────────────────────────── */}
        <TabsContent value="pengajuan" className="space-y-4 mt-4">
          {/* Create button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Daftar Pengajuan Iklan</h2>
              <p className="text-sm text-muted-foreground">
                Kelola pengajuan iklan Anda
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Pengajuan Iklan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Buat Pengajuan Iklan</DialogTitle>
                  <DialogDescription>
                    Isi detail pengajuan iklan baru Anda
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">Nama Kota</Label>
                    <Input
                      id="city"
                      placeholder="Contoh: Jakarta Selatan"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Opsi Durasi Tes</Label>
                    <Tabs value={testMode} onValueChange={(v) => setTestMode(v as "1DAY" | "2DAYS")}>
                      <TabsList className="grid grid-cols-2 h-8">
                        <TabsTrigger value="1DAY" className="text-xs">1 Hari</TabsTrigger>
                        <TabsTrigger value="2DAYS" className="text-xs">2 Hari</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-[11px] font-semibold">{testMode === "1DAY" ? "Tanggal Tes STIFIn" : "Tes Mulai"}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                      />
                    </div>
                    {testMode === "2DAYS" && (
                      <div className="space-y-2">
                        <Label htmlFor="endDate" className="text-[11px] font-semibold">Tes Selesai</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Durasi Iklan (hari)</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="Contoh: 14"
                      min={1}
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Per Hari (Rupiah)</Label>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="Contoh: 50000"
                      min={1}
                      value={formDailyBudget}
                      onChange={(e) => setFormDailyBudget(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Catatan untuk Advertiser <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                    <Textarea
                      id="note"
                      placeholder="Contoh: mohon tambahkan informasi lokasi spesifik"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="min-h-[72px] text-sm resize-none"
                    />
                  </div>

                  {/* Calculated summary */}
                  {calcTotalBudget > 0 && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Total Budget ({calcDuration} hari)
                          </span>
                          <span className="font-medium">
                            {formatRupiah(calcTotalBudget)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            PPn 11%
                          </span>
                          <span className="font-medium">
                            {formatRupiah(calcPPn)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total Biaya Kotor</span>
                          <span>{formatRupiah(calcGrossPayment)}</span>
                        </div>
                        {calcSaldoAppliedPreview > 0 && (
                          <div className="flex justify-between text-sm font-semibold text-emerald-700">
                            <span>Potongan Saldo Otomatis</span>
                            <span>- {formatRupiah(calcSaldoAppliedPreview)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total Pembayaran</span>
                          <span>{formatRupiah(calcTotalPayment)}</span>
                        </div>
                        {totalSaldoTersedia > 0 && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            Saldo tersedia saat ini: <span className="font-semibold">{formatRupiah(totalSaldoTersedia)}</span>
                            <br />
                            {saldoSiapPakai > 0
                              ? "Saldo otomatis dipakai karena sudah memenuhi minimal Rp 100.000."
                              : "Saldo belum dipakai otomatis karena belum mencapai minimal Rp 100.000."}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    disabled={submitting}
                  >
                    Batal
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting ? "Mengirim..." : "Ajukan Iklan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Ad request sub-tabs */}
          <Tabs value={pengajuanTab} onValueChange={(v) => setPengajuanTab(v as "PAY" | "WAIT_CONTENT" | "PROCESS_CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL")} className="w-full space-y-6">
            <TabsList className="bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
              <TabsTrigger value="PAY" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Pembayaran
                {adStatusBuckets.PAY.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                    {adStatusBuckets.PAY.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="WAIT_CONTENT" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Menunggu Konten
                {adStatusBuckets.WAIT_CONTENT.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {adStatusBuckets.WAIT_CONTENT.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="PROCESS_CONTENT" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Konten Diproses
                {adStatusBuckets.PROCESS_CONTENT.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {adStatusBuckets.PROCESS_CONTENT.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="SCHEDULED" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Iklan Dijadwalkan
                {adStatusBuckets.SCHEDULED.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {adStatusBuckets.SCHEDULED.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ACTIVE" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Iklan Aktif
                {adStatusBuckets.ACTIVE.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-purple-100 text-purple-700 border-purple-200">
                    {adStatusBuckets.ACTIVE.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="DONE" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Iklan Selesai
                {adStatusBuckets.DONE.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-slate-100 text-slate-700 border-slate-200">
                    {adStatusBuckets.DONE.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="FINAL" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Final
                {adStatusBuckets.FINAL.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-slate-900 text-white border-slate-900">
                    {adStatusBuckets.FINAL.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="PAY" className="mt-0">
              {renderAdCards("PAY")}
            </TabsContent>
            <TabsContent value="WAIT_CONTENT" className="mt-0">
              {renderAdCards("WAIT_CONTENT")}
            </TabsContent>
            <TabsContent value="PROCESS_CONTENT" className="mt-0">
              {renderAdCards("PROCESS_CONTENT")}
            </TabsContent>
            <TabsContent value="SCHEDULED" className="mt-0">
              {renderAdCards("SCHEDULED")}
            </TabsContent>
            <TabsContent value="ACTIVE" className="mt-0">
              {renderAdCards("ACTIVE")}
            </TabsContent>
            <TabsContent value="DONE" className="mt-0">
              {renderAdCards("DONE")}
            </TabsContent>
            <TabsContent value="FINAL" className="mt-0">
              {renderAdCards("FINAL")}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Riwayat Iklan Tab ──────────────────────────────────────────── */}
        <TabsContent value="riwayat" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan kota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredHistory.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {searchQuery
                      ? "Tidak ada hasil yang ditemukan"
                      : "Belum ada riwayat"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery
                      ? `Tidak ada pengajuan untuk "${searchQuery}"`
                      : "Riwayat pengajuan iklan akan tampil di sini"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Kota
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tanggal Tes STIFIn
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Durasi
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Budget
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Status
                          </th>

                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistory.map((ad) => (
                          <tr
                            key={ad.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-medium">{ad.city}</td>
                            <td className="p-4">{formatTestDate(ad.startDate, ad.testEndDate)}</td>
                            <td className="p-4">{ad.durationDays} hari</td>
                            <td className="p-4">
                              {formatRupiah(ad.totalBudget + ad.ppn + (ad.penaltyApplied || 0))}
                            </td>
                            <td className="p-4">
                              {getStatusBadge(ad.status)}
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y">
                    {paginatedHistory.map((ad) => (
                      <div key={ad.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{ad.city}</span>
                          {getStatusBadge(ad.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Tes STIFIn</span>
                            <span className="font-semibold text-[11px]">{formatTestDate(ad.startDate, ad.testEndDate)}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Durasi</span>
                            <span className="font-semibold text-[11px]">{ad.durationDays} hari</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Budget</span>
                            <span className="font-semibold text-[11px]">{formatRupiah(ad.totalBudget + ad.ppn + (ad.penaltyApplied || 0))}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {historyTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t bg-white px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Menampilkan {historyFirstItemNumber}-{historyLastItemNumber} dari {historyTotalItems} data
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                          disabled={historyCurrentPage <= 1}
                        >
                          Sebelumnya
                        </Button>
                        <span className="text-xs font-semibold text-slate-700">
                          Hal {historyCurrentPage}/{historyTotalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setHistoryPage((prev) => Math.min(prev + 1, historyTotalPages))}
                          disabled={historyCurrentPage >= historyTotalPages}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Data Iklan (Global) Tab ───────────────────────────────────── */}
        <TabsContent value="data-iklan" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Database Performa Iklan</h2>
              <p className="text-sm text-muted-foreground">
                Data historis iklan untuk membantu Anda memilih kota yang tepat
              </p>
            </div>
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={handleManualGlobalMetaSync}
                disabled={syncingGlobalAds}
              >
                <RefreshCcw className={`h-4 w-4 ${syncingGlobalAds ? "animate-spin" : ""}`} />
                {syncingGlobalAds ? "Sinkron..." : "Sinkron Meta"}
              </Button>
            </div>
            {metaSyncStatus?.lastSuccess?.at && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                Terakhir sinkron: {new Date(metaSyncStatus.lastSuccess.at).toLocaleString("id-ID")} • update {metaSyncStatus.lastSuccess.updatedCount} data
              </p>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan kota atau promotor..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="md:hidden flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Urutan: <span className="font-semibold text-slate-700">{getGlobalSortLabel()}</span>
              </p>
              <Dialog open={globalSortDialogOpen} onOpenChange={setGlobalSortDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Urutkan
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Urutkan Data Iklan</DialogTitle>
                    <DialogDescription>Pilih urutan data untuk tampilan mobile.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-2 py-2">
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort(null, "desc")}>Terbaru (default)</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("CPR", "asc")}>CPR Termurah</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("CPR", "desc")}>CPR Termahal</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("LEADS", "desc")}>Leads Terbanyak</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("LEADS", "asc")}>Leads Terkecil</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("KLIEN", "desc")}>Klien Terbanyak</Button>
                    <Button type="button" variant="outline" className="justify-start" onClick={() => applyGlobalSort("KLIEN", "asc")}>Klien Terkecil</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kota Terakhir Target Iklan
              </p>
              <Tabs value={globalTargetFilter} onValueChange={(v) => setGlobalTargetFilter(v as "ALL" | "15_30" | "30_PLUS")}>
                <TabsList className="bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
                  <TabsTrigger value="ALL" className="text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm">
                    Semua Iklan
                  </TabsTrigger>
                  <TabsTrigger value="15_30" className="text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm">
                    15 - 30 Hari
                  </TabsTrigger>
                  <TabsTrigger value="30_PLUS" className="text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm">
                    +30 Hari
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {(() => {
              const renderSortLabel = (key: "LEADS" | "KLIEN" | "CPR", label: string) => (
                <button
                  type="button"
                  onClick={() => toggleGlobalSort(key)}
                  className={`inline-flex items-center gap-1 font-medium hover:text-slate-900 transition-colors ${
                    globalSortKey === key ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  <span>{label}</span>
                  {globalSortKey === key ? (
                    <span className="text-[10px] leading-none">{globalSortOrder === "asc" ? "▲" : "▼"}</span>
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  )}
                </button>
              )
              const {
                filtered,
                paginated,
                totalItems,
                totalPages,
                currentPage,
                firstItemNumber,
                lastItemNumber,
              } = globalAdsDisplay

              if (filtered.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">Data tidak ditemukan</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {globalTargetFilter === "ALL"
                          ? "Belum ada data iklan yang tersedia untuk ditampilkan."
                          : globalTargetFilter === "15_30"
                          ? "Belum ada kota yang terakhir ditarget dalam rentang 15 - 30 hari."
                          : "Belum ada kota yang terakhir ditarget lebih dari 30 hari."}
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-4 text-left font-medium">Promotor</th>
                          <th className="p-4 text-left font-medium">Kota</th>
                          <th className="p-4 text-left font-medium">Tanggal Tes STIFIn</th>
                          <th className="p-4 text-left font-medium">{renderSortLabel("LEADS", "Leads")}</th>
                          <th className="p-4 text-left font-medium">{renderSortLabel("KLIEN", "Klien")}</th>
                          <th className="p-4 text-left font-medium">{renderSortLabel("CPR", "CPR")}</th>
                          <th className="p-4 text-left font-medium">Budget/Hari</th>
                          <th className="p-4 text-left font-medium">Durasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paginated.map((ad) => (
                          <tr key={ad.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 font-medium">{ad.promotor.name}</td>
                            <td className="p-4">{ad.city}</td>
                            <td className="p-4">{formatTestDate(ad.startDate, ad.testEndDate)}</td>
                            <td className="p-4">
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                {ad.adReport?.totalLeads} Leads
                              </Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {ad.promotorResult?.totalClients || 0} Klien
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">
                              {ad.adReport?.cpr ? (
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${getCprColorClass(ad.adReport.cpr)}`}>
                                  {formatRupiah(Math.round(ad.adReport.cpr))}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-4">{formatRupiah(ad.dailyBudget)}</td>
                            <td className="p-4">{ad.durationDays} hari</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-1.5">
                    {paginated.map((ad) => (
                      <Card key={ad.id} className="border-l-4 border-l-green-500">
                        <CardContent className="px-3 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold leading-none truncate">{ad.city}</p>
                              <p className="text-[11px] text-muted-foreground leading-none mt-0.5 truncate">{ad.promotor.name}</p>
                              <p className="text-[10px] text-muted-foreground leading-none mt-1 truncate">
                                Tes: {formatTestDate(ad.startDate, ad.testEndDate)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mr-3">
                              <Badge variant="secondary" className="h-5 bg-green-100 text-green-800 text-[10px] px-2">
                                {ad.adReport?.totalLeads} Leads
                              </Badge>
                              <Badge variant="secondary" className="h-5 bg-blue-100 text-blue-800 text-[10px] px-2">
                                {ad.promotorResult?.totalClients || 0} Klien
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                            <div className="min-w-0">
                              <p className="text-muted-foreground uppercase text-[10px] leading-none">CPR</p>
                              {ad.adReport?.cpr ? (
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-bold leading-none mt-0.5 ${getCprColorClass(ad.adReport.cpr)}`}>
                                  {formatRupiah(Math.round(ad.adReport.cpr))}
                                </span>
                              ) : (
                                <p className="font-bold mt-0.5">-</p>
                              )}
                            </div>
                            <div className="min-w-0 text-right">
                              <p className="text-muted-foreground uppercase text-[10px] leading-none">Budget/Hari</p>
                              <p className="font-bold leading-none mt-0.5">{formatRupiah(ad.dailyBudget)}</p>
                            </div>
                            <div className="min-w-0 text-right">
                              <p className="text-muted-foreground uppercase text-[10px] leading-none">Durasi</p>
                              <p className="font-bold leading-none mt-0.5">{ad.durationDays} hari</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Menampilkan {firstItemNumber}-{lastItemNumber} dari {totalItems} data
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setGlobalPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage <= 1}
                        >
                          Sebelumnya
                        </Button>
                        <span className="text-xs font-semibold text-slate-700">
                          Hal {currentPage}/{totalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setGlobalPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage >= totalPages}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* ── Top Promotor Tab ─────────────────────────────────────────── */}
        <TabsContent value="top-promotor" className="space-y-4 mt-4">
          <Tabs defaultValue="klien" className="w-full">
            <TabsList className="bg-slate-50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 mb-2 rounded-lg">
              <TabsTrigger value="klien" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">👥 Klien</TabsTrigger>
              <TabsTrigger value="spending" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">💰 Spending</TabsTrigger>
              <TabsTrigger value="iklan" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">📢 Iklan</TabsTrigger>
            </TabsList>

            <TabsContent value="klien" className="space-y-2 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-3">Peringkat berdasarkan total klien</p>
              {topPromotorStats.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground italic border-dashed"><p>Belum ada data</p></Card>
              ) : (
                topPromotorByClients.map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={`${p.totalClients} Orang`} label="Total Klien" color="text-purple-600" />
                ))
              )}
            </TabsContent>

            <TabsContent value="spending" className="space-y-2 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-3">Peringkat berdasarkan total anggaran iklan yang sudah terpakai</p>
              {topPromotorStats.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground italic border-dashed"><p>Belum ada data</p></Card>
              ) : (
                topPromotorBySpent.map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={formatRupiah(p.totalSpent)} label="Total Ads Spent" color="text-emerald-600" />
                ))
              )}
            </TabsContent>

            <TabsContent value="iklan" className="space-y-2 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-3">Peringkat berdasarkan jumlah total pengajuan iklan</p>
              {topPromotorStats.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground italic border-dashed"><p>Belum ada data</p></Card>
              ) : (
                topPromotorByAds.map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={`${p.totalAds} Iklan`} label="Total Pengajuan" color="text-blue-600" />
                ))
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      {/* ── Edit Dialog ── */}
      <Dialog open={saldoDetailOpen} onOpenChange={setSaldoDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mutasi Saldo</DialogTitle>
            <DialogDescription>
              Riwayat pemasukan dan pemakaian saldo Anda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo saat ini</span>
                <span className={`font-bold ${totalSaldoTersedia < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatRupiah(totalSaldoTersedia)}
                </span>
              </div>
            </div>

            {saldoMutations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada mutasi saldo.</p>
            ) : (
              <div className="space-y-2">
                {saldoMutations.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-3 py-2 ${
                      item.flow === "IN"
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-rose-200 bg-rose-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{item.label}</p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              item.flow === "IN"
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border-rose-300 bg-rose-100 text-rose-700"
                            }`}
                          >
                            {item.flow === "IN" ? "Masuk" : "Keluar"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                      </div>
                      <span className={`text-sm font-bold whitespace-nowrap ${item.flow === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                        {item.amount >= 0 ? "+" : "-"}{formatRupiah(Math.abs(item.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setSaldoDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengajuan Iklan</DialogTitle>
            <DialogDescription>
              Ubah detail pengajuan iklan Anda
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-city">Nama Kota</Label>
              <Input
                id="edit-city"
                value={editFormCity}
                onChange={(e) => setEditFormCity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Tanggal Tes STIFIn</Label>
              <Input
                id="edit-startDate"
                type="date"
                value={editFormStartDate}
                onChange={(e) => setEditFormStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-duration">Durasi Iklan (hari)</Label>
              <Input
                id="edit-duration"
                type="number"
                min={1}
                value={editFormDuration}
                onChange={(e) => setEditFormDuration(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-budget">Budget Per Hari (Rupiah)</Label>
              <Input
                id="edit-budget"
                type="number"
                min={1}
                value={editFormDailyBudget}
                onChange={(e) => setEditFormDailyBudget(e.target.value)}
              />
            </div>

            <Separator />
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Pembayaran Baru</span>
                <span className="font-semibold">
                  {formatRupiah(
                    (parseInt(editFormDuration) || 0) * (parseInt(editFormDailyBudget) || 0) * 1.11
                  )}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Batal
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment Detail Dialog ────────────────────────────────────────── */}
      <Dialog open={!!paymentDetailAd} onOpenChange={(open) => !open && setPaymentDetailAd(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rincian Pembayaran</DialogTitle>
            <DialogDescription>
              Detail biaya untuk iklan di <strong>{paymentDetailAd?.city}</strong>
            </DialogDescription>
          </DialogHeader>

          {paymentDetailAd && (
            <div className="space-y-4 py-2">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Biaya Iklan ({paymentDetailAd.durationDays} hari x {formatRupiah(paymentDetailAd.dailyBudget)})</span>
                  <span className="font-medium">{formatRupiah(paymentDetailAd.totalBudget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PPN (11%)</span>
                  <span className="font-medium">{formatRupiah(paymentDetailAd.ppn)}</span>
                </div>
                
                { (paymentDetailAd.penaltyApplied || 0) > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Denda Pembatalan
                    </span>
                    <span className="font-medium">+{formatRupiah(paymentDetailAd.penaltyApplied || 0)}</span>
                  </div>
                )}

                <Separator className="my-1" />

                <div className="flex justify-between text-sm font-semibold text-slate-900 border-t pt-2">
                  <span>Subtotal Tagihan</span>
                  <span>
                    {formatRupiah((paymentDetailAd.totalBudget + paymentDetailAd.ppn + (paymentDetailAd.penaltyApplied || 0)))}
                  </span>
                </div>

                { (paymentDetailAd.saldoApplied || 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 bg-emerald-50 p-2 rounded-md border border-emerald-100">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Potongan Saldo
                    </span>
                    <span className="font-bold">-{formatRupiah(paymentDetailAd.saldoApplied || 0)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-900 p-4 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total yang Dibayar</span>
                  <span className="text-white text-xl font-black">
                    {formatRupiah(paymentDetailAd.totalPayment)}
                  </span>
                </div>
                {paymentDetailAd.totalPayment === 0 && (
                   <p className="text-emerald-400 text-[10px] mt-1 font-medium italic">
                     * Lunas menggunakan saldo sisa
                   </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setPaymentDetailAd(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
