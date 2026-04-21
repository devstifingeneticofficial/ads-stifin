"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Megaphone,
  FileText,
  Building2,
  Target,
  MessageSquare,
  Wallet,
  ReceiptText,
  ChevronDown,
  Trophy,
} from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { compressImage } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromotorResult {
  id: string
  totalClients: number
  previousTotalClients: number | null
  note: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface AdReport {
  id: string
  cpr: number | null
  totalLeads: number | null
  amountSpent: number | null
  createdAt: string
  updatedAt: string
}

interface AdRequest {
  id: string
  city: string
  startDate: string
  adStartDate?: string | null
  adEndDate?: string | null
  durationDays: number
  dailyBudget: number
  totalBudget: number
  ppn: number
  totalPayment: number
  status: string
  briefType: string | null
  briefContent: string | null
  paymentProofUrl: string | null
  contentUrl: string | null
  createdAt: string
  updatedAt: string
  promotor: {
    id: string
    name: string
    email: string
    city: string
  }
  promotorResult: PromotorResult | null
  adReport: AdReport | null
}

interface PayoutUnpaidItem {
  adRequestId: string
  creatorId: string
  creatorName: string
  promotorName: string
  city: string
  startDate: string
  testEndDate: string | null
  amount: number
  contentCount: number
}

interface PayoutBatch {
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
    adRequestId: string
    city: string
    startDate: string
    testEndDate: string | null
    promotorName: string
    requestAmount: number
    contentCount: number
  }>
}

interface PayoutData {
  unpaidSummary: {
    totalRequests: number
    totalContents: number
    totalAmount: number
  }
  unpaidItems: PayoutUnpaidItem[]
  paidBatches: PayoutBatch[]
}

interface BonusUnpaidItem {
  promotorResultId: string
  adRequestId: string
  promotorId: string
  promotorName: string
  city: string
  startDate: string
  testEndDate: string | null
  clientCount: number
  amount: number
}

interface BonusBatch {
  id: string
  invoiceNumber?: string
  promotorId: string
  promotorName: string
  promotorLabel?: string
  payoutDate: string
  totalItems: number
  totalClients: number
  totalAmount: number
  transferProofUrl?: string | null
  items: Array<{
    id: string
    promotorResultId: string
    adRequestId: string
    city: string
    startDate: string
    testEndDate: string | null
    promotorName: string
    clientCount: number
    bonusAmount: number
  }>
}

interface BonusData {
  config: {
    bonusPerClient: number
  }
  unpaidSummary: {
    totalItems: number
    totalClients: number
    totalAmount: number
  }
  unpaidItems: BonusUnpaidItem[]
  paidBatches: BonusBatch[]
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
  SELESAI: { label: "Selesai", variant: "secondary", className: "border-gray-400 text-gray-600 bg-gray-100" },
  FINAL: { label: "Iklan Final", variant: "default", className: "bg-slate-900 text-white border-slate-900" },
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

const getBriefTypeBadge = (briefType: string) => {
  if (briefType === "JJ") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200">
        Jedag Jedug
      </Badge>
    )
  }
  if (briefType === "VO") {
    return (
      <Badge className="bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-200">
        Voice Over
      </Badge>
    )
  }
  return <Badge variant="secondary">{briefType}</Badge>
}

const getCvrColor = (cvr: number) => {
  if (cvr === 0) return "bg-slate-100 text-slate-600 border-slate-200"
  if (cvr <= 5) return "bg-red-100 text-red-700 border-red-200"
  if (cvr <= 10) return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-emerald-100 text-emerald-700 border-emerald-200"
}

// ─── Component ───────────────────────────────────────────────────────────────

const STIFIN_TAB_TO_ROUTE: Record<string, string> = {
  semua: "semua-pengajuan",
  promotor: "laporan-promotor",
  advertiser: "laporan-advertiser",
  top_promotor: "top-promotor",
  gaji_kreator: "gaji-kreator",
  bonus_advertiser: "bonus-advertiser",
}

export default function StifinDashboard({
  initialTab = "semua",
  routeBasePath,
}: {
  initialTab?: string
  routeBasePath?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMainTab, setActiveMainTab] = useState(initialTab)

  // Filter states
  const [semuaSubTab, setSemuaSubTab] = useState<
    "ALL" | "PAYMENT" | "CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL"
  >("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [searchCity, setSearchCity] = useState("")
  const [promotorReportTab, setPromotorReportTab] = useState<"BELUM_LAPOR" | "SUDAH_LAPOR">("SUDAH_LAPOR")
  const [advertiserReportTab, setAdvertiserReportTab] = useState<"SEMUA" | "BERJALAN" | "SELESAI">("BERJALAN")
  const [currentPage, setCurrentPage] = useState(1)
  const [promotorReportPage, setPromotorReportPage] = useState(1)
  const [advertiserReportPage, setAdvertiserReportPage] = useState(1)
  const [creatorUnpaidPage, setCreatorUnpaidPage] = useState(1)
  const [creatorPaidPage, setCreatorPaidPage] = useState(1)
  const [bonusUnpaidPage, setBonusUnpaidPage] = useState(1)
  const [bonusPaidPage, setBonusPaidPage] = useState(1)
  const [pageSizeOption, setPageSizeOption] = useState("10")
  const [customPageSize, setCustomPageSize] = useState("10")
  const [payoutData, setPayoutData] = useState<PayoutData | null>(null)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [selectedPayoutItems, setSelectedPayoutItems] = useState<string[]>([])
  const [payingPayout, setPayingPayout] = useState(false)
  const [disburseDialogOpen, setDisburseDialogOpen] = useState(false)
  const [transferProofUrl, setTransferProofUrl] = useState("")
  const [proofUploading, setProofUploading] = useState(false)
  const [bonusData, setBonusData] = useState<BonusData | null>(null)
  const [bonusLoading, setBonusLoading] = useState(false)
  const [selectedBonusItems, setSelectedBonusItems] = useState<string[]>([])
  const [payingBonus, setPayingBonus] = useState(false)
  const [bonusDisburseDialogOpen, setBonusDisburseDialogOpen] = useState(false)
  const [bonusTransferProofUrl, setBonusTransferProofUrl] = useState("")
  const [bonusProofUploading, setBonusProofUploading] = useState(false)
  const [proofPreviewOpen, setProofPreviewOpen] = useState(false)
  const [proofPreviewUrl, setProofPreviewUrl] = useState("")
  const [proofPreviewTitle, setProofPreviewTitle] = useState("Bukti Transfer")
  const loadedMainTabsRef = useRef(new Set<string>())

  const tabStatusScope = useMemo<Record<string, string[]>>(
    () => ({
      promotor: ["SELESAI", "FINAL"],
      advertiser: ["IKLAN_DIJADWALKAN", "IKLAN_BERJALAN", "SELESAI", "FINAL"],
    }),
    []
  )

  const openProofPreview = (url: string, title = "Bukti Transfer") => {
    setProofPreviewUrl(url)
    setProofPreviewTitle(title)
    setProofPreviewOpen(true)
  }

  const isPdfProof = proofPreviewUrl.toLowerCase().includes(".pdf")

  // ── Promotor aggregation ───────────────────────────────────────────────────
  const promotorData = useMemo(() => {
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
  }, [adRequests])

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAdRequests = useCallback(async (targetTab?: string) => {
    const tab = targetTab || activeMainTab
    setLoading(true)
    try {
      const query = new URLSearchParams()
      query.set("lite", "1")
      query.set("view", `stifin:${tab}`)
      const scopedStatuses = tabStatusScope[tab]
      if (scopedStatuses && scopedStatuses.length > 0) {
        query.set("statuses", scopedStatuses.join(","))
      }

      const res = await fetch(`/api/ad-requests?${query.toString()}`)
      if (!res.ok) {
        throw new Error("Gagal mengambil data")
      }
      const data: AdRequest[] = await res.json()
      setAdRequests(data)
    } catch {
      toast.error("Gagal memuat data pengajuan iklan")
    } finally {
      setLoading(false)
    }
  }, [activeMainTab, tabStatusScope])

  const fetchPayoutData = useCallback(async () => {
    setPayoutLoading(true)
    try {
      const res = await fetch("/api/creator-payouts")
      if (!res.ok) throw new Error("Gagal memuat data payout")
      const data: PayoutData = await res.json()
      setPayoutData(data)
    } catch {
      toast.error("Gagal memuat data payout kreator")
    } finally {
      setPayoutLoading(false)
    }
  }, [])

  const fetchBonusData = useCallback(async () => {
    setBonusLoading(true)
    try {
      const res = await fetch("/api/advertiser-bonuses")
      if (!res.ok) throw new Error("Gagal memuat data bonus")
      const data: BonusData = await res.json()
      setBonusData(data)
    } catch {
      toast.error("Gagal memuat data bonus advertiser")
    } finally {
      setBonusLoading(false)
    }
  }, [])
  
  const [validatingId, setValidatingId] = useState<string | null>(null)

  const handleValidate = async (adRequestId: string) => {
    setValidatingId(adRequestId)
    try {
      const res = await fetch(`/api/ad-requests/${adRequestId}/validate-result`, {
        method: "POST",
      })
      if (!res.ok) {
        throw new Error("Gagal memvalidasi")
      }
      toast.success("Laporan berhasil divalidasi")
      fetchAdRequests()
      fetchBonusData()
    } catch {
      toast.error("Gagal memvalidasi laporan")
    } finally {
      setValidatingId(null)
    }
  }

  useEffect(() => {
    if (!initialTab) return
    setActiveMainTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!user) return
    loadedMainTabsRef.current.clear()
    const initial = initialTab || "semua"
    const needsAdRequests = ["semua", "promotor", "advertiser", "top_promotor"].includes(initial)
    if (needsAdRequests) {
      loadedMainTabsRef.current.add(initial)
      fetchAdRequests(initial)
    } else {
      setLoading(false)
    }
    if (initial === "gaji_kreator") {
      fetchPayoutData()
    }
    if (initial === "bonus_advertiser") {
      fetchBonusData()
    }
  }, [user, initialTab, fetchAdRequests, fetchPayoutData, fetchBonusData])

  useEffect(() => {
    if (!user) return
    const needsAdRequests = ["semua", "promotor", "advertiser", "top_promotor"].includes(activeMainTab)
    if (!needsAdRequests) return
    if (loadedMainTabsRef.current.has(activeMainTab)) return
    loadedMainTabsRef.current.add(activeMainTab)
    fetchAdRequests(activeMainTab)
  }, [user, activeMainTab, fetchAdRequests])

  useEffect(() => {
    if (!user) return
    if (activeMainTab === "gaji_kreator" && !payoutData) {
      fetchPayoutData()
    }
    if (activeMainTab === "bonus_advertiser" && !bonusData) {
      fetchBonusData()
    }
  }, [user, activeMainTab, payoutData, bonusData, fetchPayoutData, fetchBonusData])

  const togglePayoutItem = (adRequestId: string) => {
    setSelectedPayoutItems((prev) =>
      prev.includes(adRequestId)
        ? prev.filter((id) => id !== adRequestId)
        : [...prev, adRequestId]
    )
  }

  const handleOpenDisburseDialog = () => {
    if (selectedPayoutItems.length === 0) {
      toast.error("Pilih minimal satu item payout")
      return
    }
    setTransferProofUrl("")
    setDisburseDialogOpen(true)
  }

  const handleUploadTransferProof = async (file: File | null) => {
    if (!file) return
    setProofUploading(true)
    try {
      const isImage = file.type.startsWith("image/")
      const uploadFile = isImage ? await compressImage(file) : file

      const formData = new FormData()
      formData.append("file", uploadFile)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Gagal mengunggah bukti transfer")
      const data = await res.json()
      if (!data.url) throw new Error("URL bukti transfer tidak valid")
      setTransferProofUrl(data.url)
      toast.success("Bukti transfer berhasil diunggah")
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengunggah bukti transfer")
    } finally {
      setProofUploading(false)
    }
  }

  const handleDisburseSelected = async () => {
    if (selectedPayoutItems.length === 0) {
      toast.error("Pilih minimal satu item payout")
      return
    }

    if (!transferProofUrl) {
      toast.error("Bukti transfer wajib diunggah")
      return
    }

    setPayingPayout(true)
    try {
      const res = await fetch("/api/creator-payouts/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adRequestIds: selectedPayoutItems,
          transferProofUrl,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal mencairkan gaji")
      }

      toast.success("Pencairan gaji kreator berhasil")
      setSelectedPayoutItems([])
      setTransferProofUrl("")
      setDisburseDialogOpen(false)
      fetchPayoutData()
    } catch (error: any) {
      toast.error(error?.message || "Gagal mencairkan gaji kreator")
    } finally {
      setPayingPayout(false)
    }
  }

  const toggleBonusItem = (promotorResultId: string) => {
    setSelectedBonusItems((prev) =>
      prev.includes(promotorResultId)
        ? prev.filter((id) => id !== promotorResultId)
        : [...prev, promotorResultId]
    )
  }

  const handleOpenBonusDisburseDialog = () => {
    if (selectedBonusItems.length === 0) {
      toast.error("Pilih minimal satu item bonus")
      return
    }
    setBonusTransferProofUrl("")
    setBonusDisburseDialogOpen(true)
  }

  const handleUploadBonusTransferProof = async (file: File | null) => {
    if (!file) return
    setBonusProofUploading(true)
    try {
      const isImage = file.type.startsWith("image/")
      const uploadFile = isImage ? await compressImage(file) : file

      const formData = new FormData()
      formData.append("file", uploadFile)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Gagal mengunggah bukti transfer bonus")
      const data = await res.json()
      if (!data.url) throw new Error("URL bukti transfer bonus tidak valid")
      setBonusTransferProofUrl(data.url)
      toast.success("Bukti transfer bonus berhasil diunggah")
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengunggah bukti transfer bonus")
    } finally {
      setBonusProofUploading(false)
    }
  }

  const handleDisburseSelectedBonus = async () => {
    if (selectedBonusItems.length === 0) {
      toast.error("Pilih minimal satu item bonus")
      return
    }

    if (!bonusTransferProofUrl) {
      toast.error("Bukti transfer bonus wajib diunggah")
      return
    }

    setPayingBonus(true)
    try {
      const res = await fetch("/api/advertiser-bonuses/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotorResultIds: selectedBonusItems,
          transferProofUrl: bonusTransferProofUrl,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal mencairkan bonus")
      }

      toast.success("Pencairan bonus berhasil")
      setSelectedBonusItems([])
      setBonusTransferProofUrl("")
      setBonusDisburseDialogOpen(false)
      fetchBonusData()
    } catch (error: any) {
      toast.error(error?.message || "Gagal mencairkan bonus")
    } finally {
      setPayingBonus(false)
    }
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  const totalPromotor = adRequests.length
  const iklanAktif = adRequests.filter(
    (r) => r.status === "IKLAN_BERJALAN"
  ).length
  const totalRevenue = adRequests.reduce((sum, r) => sum + r.totalPayment, 0)
  const totalKlienDidapat = adRequests.reduce((sum, r) => {
    if (r.promotorResult) {
      return sum + r.promotorResult.totalClients
    }
    return sum
  }, 0)

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const matchesSemuaSubTab = useCallback(
    (status: string) => {
      switch (semuaSubTab) {
        case "PAYMENT":
          return ["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"].includes(status)
        case "CONTENT":
          return ["MENUNGGU_KONTEN", "DIPROSES", "KONTEN_SELESAI"].includes(status)
        case "SCHEDULED":
          return status === "IKLAN_DIJADWALKAN"
        case "ACTIVE":
          return status === "IKLAN_BERJALAN"
        case "DONE":
          return status === "SELESAI"
        case "FINAL":
          return status === "FINAL"
        default:
          return true
      }
    },
    [semuaSubTab]
  )

  const funnelCards = useMemo(() => {
    const now = Date.now()
    const categories: Array<{
      key: "PAYMENT" | "CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL"
      label: string
      statuses: string[]
      tone: string
    }> = [
      {
        key: "PAYMENT",
        label: "Pembayaran",
        statuses: ["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI_PEMBAYARAN"],
        tone: "bg-amber-50 border-amber-200",
      },
      {
        key: "CONTENT",
        label: "Konten",
        statuses: ["MENUNGGU_KONTEN", "DIPROSES", "KONTEN_SELESAI"],
        tone: "bg-orange-50 border-orange-200",
      },
      {
        key: "SCHEDULED",
        label: "Dijadwalkan",
        statuses: ["IKLAN_DIJADWALKAN"],
        tone: "bg-blue-50 border-blue-200",
      },
      {
        key: "ACTIVE",
        label: "Aktif",
        statuses: ["IKLAN_BERJALAN"],
        tone: "bg-violet-50 border-violet-200",
      },
      {
        key: "DONE",
        label: "Selesai",
        statuses: ["SELESAI"],
        tone: "bg-slate-50 border-slate-200",
      },
      {
        key: "FINAL",
        label: "Final",
        statuses: ["FINAL"],
        tone: "bg-emerald-50 border-emerald-200",
      },
    ]

    return categories.map((category) => {
      const items = adRequests.filter((r) => category.statuses.includes(r.status))
      const agesInDays = items.map((item) =>
        Math.max(0, (now - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      )
      const avgDays = agesInDays.length
        ? agesInDays.reduce((sum, value) => sum + value, 0) / agesInDays.length
        : 0

      return {
        ...category,
        count: items.length,
        avgDays,
      }
    })
  }, [adRequests])

  const filteredAdRequests = useMemo(() => {
    return adRequests.filter((r) => {
      const matchesSubTab = matchesSemuaSubTab(r.status)
      const matchesStatus =
        statusFilter === "ALL" || r.status === statusFilter
      const matchesCity =
        !searchCity ||
        r.city.toLowerCase().includes(searchCity.toLowerCase())
      return matchesSubTab && matchesStatus && matchesCity
    })
  }, [adRequests, matchesSemuaSubTab, statusFilter, searchCity])

  const effectivePageSize = useMemo(() => {
    if (pageSizeOption === "custom") {
      const parsed = parseInt(customPageSize, 10)
      if (Number.isNaN(parsed)) return 10
      return Math.min(Math.max(parsed, 1), 1000)
    }
    const parsed = parseInt(pageSizeOption, 10)
    return Number.isNaN(parsed) ? 10 : parsed
  }, [pageSizeOption, customPageSize])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAdRequests.length / effectivePageSize)
  )

  const paginatedAdRequests = useMemo(() => {
    const start = (currentPage - 1) * effectivePageSize
    const end = start + effectivePageSize
    return filteredAdRequests.slice(start, end)
  }, [filteredAdRequests, currentPage, effectivePageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [semuaSubTab, statusFilter, searchCity, pageSizeOption, customPageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const promotorResults = useMemo(() => {
    return adRequests
      .filter((r) => r.promotorResult !== null)
      .map((r) => ({
        id: r.id,
        promotorName: r.promotor.name,
        promotorCity: r.promotor.city,
        city: r.city,
        totalClients: r.promotorResult!.totalClients,
        previousTotalClients: r.promotorResult!.previousTotalClients,
        note: r.promotorResult!.note,
        status: r.promotorResult!.status,
        createdAt: r.promotorResult!.createdAt,
      }))
  }, [adRequests])

  const promotorBelumLapor = useMemo(() => {
    return adRequests
      .filter((r) => r.status === "SELESAI" && r.promotorResult === null)
      .map((r) => ({
        id: r.id,
        promotorName: r.promotor.name,
        promotorCity: r.promotor.city,
        city: r.city,
        status: r.status,
        createdAt: r.updatedAt || r.createdAt,
      }))
  }, [adRequests])

  const PROMOTOR_REPORT_PAGE_SIZE = 10
  const activePromotorRows = useMemo(
    () => (promotorReportTab === "SUDAH_LAPOR" ? promotorResults : promotorBelumLapor),
    [promotorReportTab, promotorResults, promotorBelumLapor]
  )
  const promotorReportTotalPages = Math.max(
    1,
    Math.ceil(activePromotorRows.length / PROMOTOR_REPORT_PAGE_SIZE)
  )
  const paginatedPromotorRows = useMemo(() => {
    const safePage = Math.min(promotorReportPage, promotorReportTotalPages)
    const start = (safePage - 1) * PROMOTOR_REPORT_PAGE_SIZE
    const end = start + PROMOTOR_REPORT_PAGE_SIZE
    return activePromotorRows.slice(start, end)
  }, [activePromotorRows, promotorReportPage, promotorReportTotalPages])

  useEffect(() => {
    setPromotorReportPage(1)
  }, [promotorReportTab])

  useEffect(() => {
    if (promotorReportPage > promotorReportTotalPages) {
      setPromotorReportPage(promotorReportTotalPages)
    }
  }, [promotorReportPage, promotorReportTotalPages])

  const adReports = useMemo(() => {
    return adRequests
      .filter((r) => r.adReport !== null)
      .map((r) => ({
        id: r.id,
        promotorName: r.promotor.name,
        promotorCity: r.promotor.city,
        city: r.city,
        status: r.status,
        adEndDate: r.adEndDate ?? null,
        cpr: r.adReport!.cpr,
        totalLeads: r.adReport!.totalLeads,
        amountSpent: r.adReport!.amountSpent,
        createdAt: r.adReport!.createdAt,
      }))
  }, [adRequests])

  const advertiserReportGroups = useMemo(() => {
    const nowTs = Date.now()
    const isEndedByDate = (endDate: string | null) => {
      if (!endDate) return false
      const ts = new Date(endDate).getTime()
      return Number.isFinite(ts) && ts <= nowTs
    }

    const berjalan = adReports.filter((r) => {
      if (isEndedByDate(r.adEndDate)) return false
      return r.status === "IKLAN_DIJADWALKAN" || r.status === "IKLAN_BERJALAN"
    })

    const selesai = adReports.filter((r) => {
      if (isEndedByDate(r.adEndDate)) return true
      return r.status === "SELESAI" || r.status === "FINAL"
    })

    return { semua: adReports, berjalan, selesai }
  }, [adReports])

  const activeAdReports = advertiserReportTab === "SEMUA"
    ? advertiserReportGroups.semua
    : advertiserReportTab === "BERJALAN"
      ? advertiserReportGroups.berjalan
      : advertiserReportGroups.selesai

  const ADVERTISER_REPORT_PAGE_SIZE = 10
  const advertiserReportTotalPages = Math.max(
    1,
    Math.ceil(activeAdReports.length / ADVERTISER_REPORT_PAGE_SIZE)
  )
  const paginatedAdvertiserReports = useMemo(() => {
    const safePage = Math.min(advertiserReportPage, advertiserReportTotalPages)
    const start = (safePage - 1) * ADVERTISER_REPORT_PAGE_SIZE
    const end = start + ADVERTISER_REPORT_PAGE_SIZE
    return activeAdReports.slice(start, end)
  }, [activeAdReports, advertiserReportPage, advertiserReportTotalPages])

  useEffect(() => {
    setAdvertiserReportPage(1)
  }, [advertiserReportTab])

  useEffect(() => {
    if (advertiserReportPage > advertiserReportTotalPages) {
      setAdvertiserReportPage(advertiserReportTotalPages)
    }
  }, [advertiserReportPage, advertiserReportTotalPages])

  // ── Summary: Promotor results ──────────────────────────────────────────────

  const promotorSummaryTotalClients = promotorResults.reduce(
    (sum, r) => sum + r.totalClients,
    0
  )

  // ── Summary: Ad reports ────────────────────────────────────────────────────

  const validCprs = activeAdReports.filter((r) => r.cpr !== null && r.cpr > 0)
  const averageCpr =
    validCprs.length > 0
      ? validCprs.reduce((sum, r) => sum + r.cpr!, 0) / validCprs.length
      : 0

  const reportTotalLeads = activeAdReports.reduce(
    (sum, r) => sum + (r.totalLeads ?? 0),
    0
  )

  const reportTotalAmountSpent = activeAdReports.reduce(
    (sum, r) => sum + (r.amountSpent ?? 0),
    0
  )

  const selectedPayoutNominal = (payoutData?.unpaidItems || [])
    .filter((item) => selectedPayoutItems.includes(item.adRequestId))
    .reduce((sum, item) => sum + item.amount, 0)

  const selectedPayoutContents = (payoutData?.unpaidItems || [])
    .filter((item) => selectedPayoutItems.includes(item.adRequestId))
    .reduce((sum, item) => sum + item.contentCount, 0)

  const selectedBonusNominal = (bonusData?.unpaidItems || [])
    .filter((item) => selectedBonusItems.includes(item.promotorResultId))
    .reduce((sum, item) => sum + item.amount, 0)

  const selectedBonusClients = (bonusData?.unpaidItems || [])
    .filter((item) => selectedBonusItems.includes(item.promotorResultId))
    .reduce((sum, item) => sum + item.clientCount, 0)

  const PAYOUT_PAGE_SIZE = 10
  const creatorUnpaidItems = payoutData?.unpaidItems || []
  const creatorPaidBatches = payoutData?.paidBatches || []
  const bonusUnpaidItems = bonusData?.unpaidItems || []
  const bonusPaidBatches = bonusData?.paidBatches || []

  const creatorUnpaidTotalPages = Math.max(1, Math.ceil(creatorUnpaidItems.length / PAYOUT_PAGE_SIZE))
  const creatorPaidTotalPages = Math.max(1, Math.ceil(creatorPaidBatches.length / PAYOUT_PAGE_SIZE))
  const bonusUnpaidTotalPages = Math.max(1, Math.ceil(bonusUnpaidItems.length / PAYOUT_PAGE_SIZE))
  const bonusPaidTotalPages = Math.max(1, Math.ceil(bonusPaidBatches.length / PAYOUT_PAGE_SIZE))

  const paginatedCreatorUnpaidItems = creatorUnpaidItems.slice(
    (Math.min(creatorUnpaidPage, creatorUnpaidTotalPages) - 1) * PAYOUT_PAGE_SIZE,
    (Math.min(creatorUnpaidPage, creatorUnpaidTotalPages) - 1) * PAYOUT_PAGE_SIZE + PAYOUT_PAGE_SIZE
  )
  const paginatedCreatorPaidBatches = creatorPaidBatches.slice(
    (Math.min(creatorPaidPage, creatorPaidTotalPages) - 1) * PAYOUT_PAGE_SIZE,
    (Math.min(creatorPaidPage, creatorPaidTotalPages) - 1) * PAYOUT_PAGE_SIZE + PAYOUT_PAGE_SIZE
  )
  const paginatedBonusUnpaidItems = bonusUnpaidItems.slice(
    (Math.min(bonusUnpaidPage, bonusUnpaidTotalPages) - 1) * PAYOUT_PAGE_SIZE,
    (Math.min(bonusUnpaidPage, bonusUnpaidTotalPages) - 1) * PAYOUT_PAGE_SIZE + PAYOUT_PAGE_SIZE
  )
  const paginatedBonusPaidBatches = bonusPaidBatches.slice(
    (Math.min(bonusPaidPage, bonusPaidTotalPages) - 1) * PAYOUT_PAGE_SIZE,
    (Math.min(bonusPaidPage, bonusPaidTotalPages) - 1) * PAYOUT_PAGE_SIZE + PAYOUT_PAGE_SIZE
  )

  useEffect(() => {
    setCreatorUnpaidPage(1)
    setCreatorPaidPage(1)
  }, [creatorUnpaidItems.length, creatorPaidBatches.length])

  useEffect(() => {
    setBonusUnpaidPage(1)
    setBonusPaidPage(1)
  }, [bonusUnpaidItems.length, bonusPaidBatches.length])

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Tabs skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard STIFIN
        </h1>
        <p className="text-muted-foreground">
          Monitoring seluruh pengajuan iklan, laporan promotor, dan performa iklan
        </p>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Promotor
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPromotor}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total pengajuan dari semua promotor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Iklan Aktif
            </CardTitle>
            <Megaphone className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {iklanAktif}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Iklan sedang berjalan saat ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatRupiah(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total pembayaran masuk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Klien Didapat
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {totalKlienDidapat.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total klien dari semua promotor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ─────────────────────────────────────────────────────── */}
      <Tabs
        value={activeMainTab}
        onValueChange={(nextTab) => {
          setActiveMainTab(nextTab)
          if (routeBasePath) {
            const routeSegment = STIFIN_TAB_TO_ROUTE[nextTab] || STIFIN_TAB_TO_ROUTE.semua
            router.push(`${routeBasePath}/${routeSegment}`)
          }
        }}
        className="w-full"
      >
        <TabsList className="bg-slate-100/50 p-1 border h-auto flex flex-wrap gap-1">
          <TabsTrigger value="semua" className="text-xs font-semibold gap-2"><BarChart3 className="h-4 w-4" /> Semua Pengajuan</TabsTrigger>
          <TabsTrigger value="promotor" className="text-xs font-semibold gap-2"><FileText className="h-4 w-4" /> Laporan Promotor</TabsTrigger>
          <TabsTrigger value="advertiser" className="text-xs font-semibold gap-2"><ReceiptText className="h-4 w-4" /> Laporan Advertiser</TabsTrigger>
          <TabsTrigger value="top_promotor" className="text-xs font-semibold gap-2"><Trophy className="h-4 w-4" /> Top Promotor</TabsTrigger>
          <TabsTrigger value="gaji_kreator" className="text-xs font-semibold gap-2"><Wallet className="h-4 w-4" /> Gaji Kreator</TabsTrigger>
          <TabsTrigger value="bonus_advertiser" className="text-xs font-semibold gap-2"><DollarSign className="h-4 w-4" /> Bonus Advertiser</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Semua Pengajuan ─────────────────────────────────────────── */}
        <TabsContent value="semua" className="space-y-4 mt-4">
          <Card className="shadow-none border-slate-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Funnel Operasional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const counts: Record<string, number> = funnelCards.reduce((acc, item) => {
                  acc[item.key] = item.count
                  return acc
                }, {} as Record<string, number>)
                return (
                  <Tabs
                    value={semuaSubTab}
                    onValueChange={(v) =>
                      setSemuaSubTab(
                        v as "ALL" | "PAYMENT" | "CONTENT" | "SCHEDULED" | "ACTIVE" | "DONE" | "FINAL"
                      )
                    }
                    className="w-full"
                  >
                    <TabsList className="w-full bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
                      <TabsTrigger value="ALL" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Semua
                        {adRequests.length > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white font-bold">
                            {adRequests.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="PAYMENT" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Pembayaran
                        {(counts.PAYMENT || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white font-bold">
                            {counts.PAYMENT}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="CONTENT" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Konten
                        {(counts.CONTENT || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-orange-500 text-[9px] text-white font-bold">
                            {counts.CONTENT}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="SCHEDULED" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Dijadwalkan
                        {(counts.SCHEDULED || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white font-bold">
                            {counts.SCHEDULED}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="ACTIVE" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Aktif
                        {(counts.ACTIVE || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-violet-500 text-[9px] text-white font-bold">
                            {counts.ACTIVE}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="DONE" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Selesai
                        {(counts.DONE || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-500 text-[9px] text-white font-bold">
                            {counts.DONE}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="FINAL" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Final
                        {(counts.FINAL || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white font-bold">
                            {counts.FINAL}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )
              })()}
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan kota..."
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="MENUNGGU_PEMBAYARAN">
                  Menunggu Pembayaran
                </SelectItem>
                <SelectItem value="MENUNGGU_KONTEN">
                  Menunggu Konten
                </SelectItem>
                <SelectItem value="DIPROSES">Diproses</SelectItem>
                <SelectItem value="KONTEN_SELESAI">Konten Selesai</SelectItem>
                <SelectItem value="IKLAN_DIJADWALKAN">Iklan Dijadwalkan</SelectItem>
                <SelectItem value="IKLAN_BERJALAN">Iklan Berjalan</SelectItem>
                <SelectItem value="SELESAI">Selesai</SelectItem>
                <SelectItem value="FINAL">Final</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pageSizeOption} onValueChange={setPageSizeOption}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Baris per halaman" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 baris</SelectItem>
                <SelectItem value="20">20 baris</SelectItem>
                <SelectItem value="50">50 baris</SelectItem>
                <SelectItem value="100">100 baris</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pageSizeOption === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={1000}
                value={customPageSize}
                onChange={(e) => setCustomPageSize(e.target.value)}
                className="w-full sm:w-[170px]"
                placeholder="Jumlah baris"
              />
              <p className="text-xs text-muted-foreground">
                1 - 1000 baris
              </p>
            </div>
          )}

          {/* List */}
          {filteredAdRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Belum ada data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchCity || statusFilter !== "ALL"
                    ? "Tidak ada pengajuan yang cocok dengan filter"
                    : "Belum ada pengajuan iklan dari promotor"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Promotor
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Kota
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tanggal
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
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tipe Brief
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAdRequests.map((ad) => (
                          <tr
                            key={ad.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-medium">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {ad.promotor.name}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {ad.city}
                              </div>
                            </td>
                            <td className="p-4">
                              {formatShortDate(ad.startDate)}
                            </td>
                            <td className="p-4">{ad.durationDays} hari</td>
                            <td className="p-4">
                              {formatRupiah(ad.totalPayment)}
                            </td>
                            <td className="p-4">
                              {getStatusBadge(ad.status)}
                            </td>
                            <td className="p-4">
                              {ad.briefType
                                ? getBriefTypeBadge(ad.briefType)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginatedAdRequests.map((ad) => (
                  <Card key={ad.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {ad.promotor.name}
                          </span>
                        </div>
                        {getStatusBadge(ad.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Kota
                          </p>
                          <p className="font-medium">{ad.city}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Tanggal
                          </p>
                          <p className="font-medium">
                            {formatShortDate(ad.startDate)}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs">
                            Durasi
                          </p>
                          <p className="font-medium">{ad.durationDays} hari</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Budget
                          </p>
                          <p className="font-medium">
                            {formatRupiah(ad.totalPayment)}
                          </p>
                        </div>
                      </div>
                      {ad.briefType && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Tipe Brief:
                          </span>
                          {getBriefTypeBadge(ad.briefType)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Menampilkan{" "}
                  {filteredAdRequests.length === 0
                    ? 0
                    : (currentPage - 1) * effectivePageSize + 1}
                  {" - "}
                  {Math.min(
                    currentPage * effectivePageSize,
                    filteredAdRequests.length
                  )}{" "}
                  dari {filteredAdRequests.length} data
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">
                    Halaman {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Laporan Promotor ────────────────────────────────────────── */}
        <TabsContent value="promotor" className="space-y-4 mt-4">
          <Tabs
            value={promotorReportTab}
            onValueChange={(v) => setPromotorReportTab(v as "BELUM_LAPOR" | "SUDAH_LAPOR")}
            className="w-full"
          >
            <TabsList className="bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
              <TabsTrigger value="BELUM_LAPOR" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Belum Lapor
                {promotorBelumLapor.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white font-bold">
                    {promotorBelumLapor.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="SUDAH_LAPOR" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Sudah Lapor
                {promotorResults.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white font-bold">
                    {promotorResults.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Summary Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {promotorReportTab === "SUDAH_LAPOR"
                  ? "Total Klien dari Semua Promotor"
                  : "Promotor Belum Input Laporan Klien"}
              </CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">
                {promotorReportTab === "SUDAH_LAPOR"
                  ? promotorSummaryTotalClients.toLocaleString("id-ID")
                  : promotorBelumLapor.length.toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {promotorReportTab === "SUDAH_LAPOR"
                  ? `Dari ${promotorResults.length} laporan promotor`
                  : "Menunggu promotor menginput jumlah klien"}
              </p>
            </CardContent>
          </Card>

          {/* List */}
          {promotorReportTab === "SUDAH_LAPOR" && promotorResults.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Belum ada laporan</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Laporan promotor akan tampil setelah promotor menginput hasil
                </p>
              </CardContent>
            </Card>
          ) : promotorReportTab === "BELUM_LAPOR" && promotorBelumLapor.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Semua sudah lapor</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tidak ada promotor yang menunggu input jumlah klien.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Promotor
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Kota
                          </th>
                          {promotorReportTab === "SUDAH_LAPOR" ? (
                            <>
                              <th className="text-left p-4 font-medium text-muted-foreground">
                                Total Klien
                              </th>
                              <th className="text-left p-4 font-medium text-muted-foreground">
                                Catatan
                              </th>
                            </>
                          ) : (
                            <th className="text-left p-4 font-medium text-muted-foreground">
                              Status Laporan
                            </th>
                          )}
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tanggal
                          </th>
                          {promotorReportTab === "SUDAH_LAPOR" && (
                            <th className="text-left p-4 font-medium text-muted-foreground">
                              Validasi
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPromotorRows.map((r: any) => (
                          <tr
                            key={r.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-medium">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {r.promotorName}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {r.city}
                              </div>
                            </td>
                            {promotorReportTab === "SUDAH_LAPOR" ? (
                              <>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <Badge
                                      variant="secondary"
                                      className="bg-amber-100 text-amber-800 border-amber-300 w-fit"
                                    >
                                      {r.totalClients} klien
                                    </Badge>
                                    {r.previousTotalClients !== null && r.previousTotalClients !== r.totalClients && (
                                      <span className="text-[10px] text-muted-foreground line-through italic">
                                        Sebelumnya: {r.previousTotalClients}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 max-w-[200px] truncate">
                                  {r.note || (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <td className="p-4">
                                <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                                  Belum Lapor
                                </Badge>
                              </td>
                            )}
                            <td className="p-4 text-muted-foreground">
                              {formatShortDate(r.createdAt)}
                            </td>
                            {promotorReportTab === "SUDAH_LAPOR" && (
                              <td className="p-4">
                                {r.status === "VALID" ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    Sudah Valid
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleValidate(r.id)}
                                    disabled={validatingId === r.id}
                                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
                                  >
                                    Valid
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginatedPromotorRows.map((r: any) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {r.promotorName}
                          </span>
                        </div>
                        {promotorReportTab === "SUDAH_LAPOR" ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 border-amber-300 shrink-0"
                          >
                            {r.totalClients} klien
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 shrink-0">
                            Belum Lapor
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Kota
                          </p>
                          <p className="font-medium">{r.city}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-xs">
                            Tanggal
                          </p>
                          <p className="font-medium">
                            {formatShortDate(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      {promotorReportTab === "SUDAH_LAPOR" && r.note && (
                        <div className="rounded-md bg-muted/50 p-3 text-sm">
                          <p className="text-muted-foreground text-xs mb-1">
                            Catatan
                          </p>
                          <p className="text-foreground">{r.note}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {activePromotorRows.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan{" "}
                    {(promotorReportPage - 1) * PROMOTOR_REPORT_PAGE_SIZE + 1}
                    {" - "}
                    {Math.min(
                      promotorReportPage * PROMOTOR_REPORT_PAGE_SIZE,
                      activePromotorRows.length
                    )}{" "}
                    dari {activePromotorRows.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={promotorReportPage <= 1}
                      onClick={() =>
                        setPromotorReportPage((prev) => Math.max(1, prev - 1))
                      }
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      Halaman {promotorReportPage} / {promotorReportTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={promotorReportPage >= promotorReportTotalPages}
                      onClick={() =>
                        setPromotorReportPage((prev) =>
                          Math.min(promotorReportTotalPages, prev + 1)
                        )
                      }
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>


        {/* ── Tab 3: Laporan Advertiser ─────────────────────────────────────── */}
        <TabsContent value="advertiser" className="space-y-4 mt-4">
          <Tabs
            value={advertiserReportTab}
            onValueChange={(v) => setAdvertiserReportTab(v as "SEMUA" | "BERJALAN" | "SELESAI")}
            className="w-full"
          >
            <TabsList className="bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
              <TabsTrigger value="SEMUA" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Semua
                {advertiserReportGroups.semua.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white font-bold">
                    {advertiserReportGroups.semua.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="BERJALAN" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Berjalan
                {advertiserReportGroups.berjalan.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white font-bold">
                    {advertiserReportGroups.berjalan.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="SELESAI" className="relative text-xs h-8 px-3 font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Selesai
                {advertiserReportGroups.selesai.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white font-bold">
                    {advertiserReportGroups.selesai.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 pt-2 sm:pt-3 pb-0 sm:pb-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Rata-rata CPR
                </CardTitle>
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 pt-0">
                <div className="text-lg sm:text-xl leading-tight font-bold text-emerald-700">
                  {validCprs.length > 0
                    ? formatRupiah(Math.round(averageCpr))
                    : "-"}
                </div>
                <p className="hidden sm:block text-xs text-muted-foreground mt-1">
                  Cost Per Result rata-rata
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 pt-2 sm:pt-3 pb-0 sm:pb-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Total Leads
                </CardTitle>
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 pt-0">
                <div className="text-lg sm:text-xl leading-tight font-bold text-violet-700">
                  {reportTotalLeads.toLocaleString("id-ID")}
                </div>
                <p className="hidden sm:block text-xs text-muted-foreground mt-1">
                  Leads dari semua iklan
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 pt-2 sm:pt-3 pb-0 sm:pb-1">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Total Amount Spent
                </CardTitle>
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 pt-0">
                <div className="text-lg sm:text-xl leading-tight font-bold text-orange-700">
                  {formatRupiah(reportTotalAmountSpent)}
                </div>
                <p className="hidden sm:block text-xs text-muted-foreground mt-1">
                  Total biaya iklan yang terpakai
                </p>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          {activeAdReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  {advertiserReportTab === "SEMUA"
                    ? "Belum ada laporan iklan"
                    : advertiserReportTab === "BERJALAN"
                      ? "Belum ada laporan iklan berjalan"
                      : "Belum ada laporan iklan selesai"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {advertiserReportTab === "SEMUA"
                    ? "Laporan iklan akan tampil setelah data sinkron Meta tersedia."
                    : advertiserReportTab === "BERJALAN"
                      ? "Data akan muncul saat iklan sudah dijadwalkan/aktif dan sinkron Meta tersedia."
                      : "Data akan muncul setelah iklan berakhir dan sinkron Meta tersedia."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Promotor
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Kota
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            CPR
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Total Leads
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Amount Spent
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tanggal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAdvertiserReports.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-medium">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {r.promotorName}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {r.city}
                              </div>
                            </td>
                            <td className="p-4">
                              {r.cpr !== null
                                ? formatRupiah(Math.round(r.cpr))
                                : "-"}
                            </td>
                            <td className="p-4">
                              {r.totalLeads !== null
                                ? r.totalLeads.toLocaleString("id-ID")
                                : "-"}
                            </td>
                            <td className="p-4">
                              {r.amountSpent !== null
                                ? formatRupiah(r.amountSpent)
                                : "-"}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {formatShortDate(r.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginatedAdvertiserReports.map((r) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {r.promotorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {r.city}
                        <span className="mx-1">·</span>
                        {formatShortDate(r.createdAt)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-md bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            CPR
                          </p>
                          <p className="font-semibold text-sm">
                            {r.cpr !== null
                              ? formatRupiah(Math.round(r.cpr))
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            Leads
                          </p>
                          <p className="font-semibold text-sm">
                            {r.totalLeads !== null
                              ? r.totalLeads.toLocaleString("id-ID")
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            Spent
                          </p>
                          <p className="font-semibold text-sm">
                            {r.amountSpent !== null
                              ? formatRupiah(r.amountSpent)
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {activeAdReports.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan{" "}
                    {(advertiserReportPage - 1) * ADVERTISER_REPORT_PAGE_SIZE + 1}
                    {" - "}
                    {Math.min(
                      advertiserReportPage * ADVERTISER_REPORT_PAGE_SIZE,
                      activeAdReports.length
                    )}{" "}
                    dari {activeAdReports.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={advertiserReportPage <= 1}
                      onClick={() =>
                        setAdvertiserReportPage((prev) => Math.max(1, prev - 1))
                      }
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      Halaman {advertiserReportPage} / {advertiserReportTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={advertiserReportPage >= advertiserReportTotalPages}
                      onClick={() =>
                        setAdvertiserReportPage((prev) =>
                          Math.min(advertiserReportTotalPages, prev + 1)
                        )
                      }
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        <TabsContent value="top_promotor" className="space-y-4 mt-4">
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
                             })()}`}>
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

        <TabsContent value="gaji_kreator" className="space-y-4 mt-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Pencairan Gaji Konten Kreator</h2>
            <p className="text-xs text-muted-foreground">
              Pilih item konten status KONTEN SELESAI yang ingin dicairkan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Belum Dicairkan</CardTitle>
                <Wallet className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatRupiah(payoutData?.unpaidSummary.totalAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(payoutData?.unpaidSummary.totalRequests || 0).toLocaleString("id-ID")} request
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Terpilih Dicairkan</CardTitle>
                <ReceiptText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatRupiah(selectedPayoutNominal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPayoutItems.length} request • {selectedPayoutContents} konten
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Dicairkan</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatRupiah((payoutData?.paidBatches || []).reduce((sum, b) => sum + b.totalAmount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(payoutData?.paidBatches || []).length} invoice
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Daftar Item Belum Dicairkan</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Pilih satu atau beberapa item untuk dicairkan.</p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenDisburseDialog}
                disabled={payingPayout || selectedPayoutItems.length === 0}
              >
                {payingPayout ? "Memproses..." : "Bayar Item Terpilih"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {payoutLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data payout...</p>
              ) : (payoutData?.unpaidItems.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada item payout yang menunggu pencairan.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-1">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() =>
                        setSelectedPayoutItems((prev) =>
                          prev.length === (payoutData?.unpaidItems.length || 0)
                            ? []
                            : (payoutData?.unpaidItems || []).map((i) => i.adRequestId)
                        )
                      }
                    >
                      {selectedPayoutItems.length === (payoutData?.unpaidItems.length || 0)
                        ? "Batalkan pilih semua"
                        : "Pilih semua"}
                    </button>
                    <span className="text-xs text-muted-foreground">{selectedPayoutItems.length} item dipilih</span>
                  </div>
                  {paginatedCreatorUnpaidItems.map((item) => (
                    <label key={item.adRequestId} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPayoutItems.includes(item.adRequestId)}
                        onChange={() => togglePayoutItem(item.adRequestId)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="font-medium text-sm">
                            {item.creatorName} - {item.city} - {formatTestDate(item.startDate, item.testEndDate)}
                          </p>
                          <p className="font-semibold text-sm">{formatRupiah(item.amount)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Promotor: {item.promotorName} • {item.contentCount} konten</p>
                      </div>
                    </label>
                  ))}
                  {creatorUnpaidItems.length > PAYOUT_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        Halaman {creatorUnpaidPage} / {creatorUnpaidTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={creatorUnpaidPage <= 1}
                          onClick={() => setCreatorUnpaidPage((p) => Math.max(1, p - 1))}
                        >
                          Sebelumnya
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={creatorUnpaidPage >= creatorUnpaidTotalPages}
                          onClick={() => setCreatorUnpaidPage((p) => Math.min(creatorUnpaidTotalPages, p + 1))}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Invoice Pencairan</CardTitle>
              <p className="text-xs text-muted-foreground">Klik invoice untuk melihat detail item.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(payoutData?.paidBatches.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada invoice pencairan.</p>
              ) : (
                paginatedCreatorPaidBatches.map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="font-medium text-sm">
                          {batch.invoiceNumber || "-"} | Pencairan {formatDate(batch.payoutDate)} | {batch.totalContents} konten | {batch.creatorName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-emerald-700">{formatRupiah(batch.totalAmount)}</p>
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
              {creatorPaidBatches.length > PAYOUT_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Halaman {creatorPaidPage} / {creatorPaidTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creatorPaidPage <= 1}
                      onClick={() => setCreatorPaidPage((p) => Math.max(1, p - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creatorPaidPage >= creatorPaidTotalPages}
                      onClick={() => setCreatorPaidPage((p) => Math.min(creatorPaidTotalPages, p + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonus_advertiser" className="space-y-4 mt-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Pencairan Bonus Advertiser</h2>
            <p className="text-xs text-muted-foreground">
              Bonus dihitung dari laporan promotor berstatus VALID (Rp25.000 per klien).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Belum Dicairkan</CardTitle>
                <Wallet className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatRupiah(bonusData?.unpaidSummary.totalAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(bonusData?.unpaidSummary.totalItems || 0).toLocaleString("id-ID")} item
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Terpilih Dicairkan</CardTitle>
                <ReceiptText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatRupiah(selectedBonusNominal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedBonusItems.length} item • {selectedBonusClients.toLocaleString("id-ID")} klien
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Dicairkan</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatRupiah((bonusData?.paidBatches || []).reduce((sum, b) => sum + b.totalAmount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(bonusData?.paidBatches || []).length} invoice
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Daftar Item Bonus Belum Dicairkan</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Pilih satu atau beberapa item bonus untuk dicairkan.</p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenBonusDisburseDialog}
                disabled={payingBonus || selectedBonusItems.length === 0}
              >
                {payingBonus ? "Memproses..." : "Bayar Bonus Terpilih"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {bonusLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data bonus...</p>
              ) : (bonusData?.unpaidItems.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada item bonus yang menunggu pencairan.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-1">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() =>
                        setSelectedBonusItems((prev) =>
                          prev.length === (bonusData?.unpaidItems.length || 0)
                            ? []
                            : (bonusData?.unpaidItems || []).map((i) => i.promotorResultId)
                        )
                      }
                    >
                      {selectedBonusItems.length === (bonusData?.unpaidItems.length || 0)
                        ? "Batalkan pilih semua"
                        : "Pilih semua"}
                    </button>
                    <span className="text-xs text-muted-foreground">{selectedBonusItems.length} item dipilih</span>
                  </div>
                  {paginatedBonusUnpaidItems.map((item) => (
                    <label key={item.promotorResultId} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBonusItems.includes(item.promotorResultId)}
                        onChange={() => toggleBonusItem(item.promotorResultId)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="font-medium text-sm">
                            {item.promotorName} - {item.city} - {formatTestDate(item.startDate, item.testEndDate)}
                          </p>
                          <p className="font-semibold text-sm">{formatRupiah(item.amount)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.clientCount.toLocaleString("id-ID")} klien valid</p>
                      </div>
                    </label>
                  ))}
                  {bonusUnpaidItems.length > PAYOUT_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        Halaman {bonusUnpaidPage} / {bonusUnpaidTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bonusUnpaidPage <= 1}
                          onClick={() => setBonusUnpaidPage((p) => Math.max(1, p - 1))}
                        >
                          Sebelumnya
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bonusUnpaidPage >= bonusUnpaidTotalPages}
                          onClick={() => setBonusUnpaidPage((p) => Math.min(bonusUnpaidTotalPages, p + 1))}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Invoice Bonus</CardTitle>
              <p className="text-xs text-muted-foreground">Klik invoice untuk melihat detail item bonus.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(bonusData?.paidBatches.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada invoice bonus.</p>
              ) : (
                paginatedBonusPaidBatches.map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="font-medium text-sm">
                          {batch.invoiceNumber || "-"} | Pencairan {formatDate(batch.payoutDate)} | {batch.totalClients.toLocaleString("id-ID")} klien | {batch.promotorLabel || batch.promotorName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-emerald-700">{formatRupiah(batch.totalAmount)}</p>
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
              {bonusPaidBatches.length > PAYOUT_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Halaman {bonusPaidPage} / {bonusPaidTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bonusPaidPage <= 1}
                      onClick={() => setBonusPaidPage((p) => Math.max(1, p - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bonusPaidPage >= bonusPaidTotalPages}
                      onClick={() => setBonusPaidPage((p) => Math.min(bonusPaidTotalPages, p + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={disburseDialogOpen} onOpenChange={setDisburseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pencairan Gaji Kreator</DialogTitle>
            <DialogDescription>
              Pastikan nominal transfer dan bukti transfer sudah sesuai sebelum mencairkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-medium">
                Total transfer: {formatRupiah(selectedPayoutNominal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedPayoutItems.length} request • {selectedPayoutContents} konten
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upload bukti transfer</p>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleUploadTransferProof(e.target.files?.[0] || null)}
              />
              {proofUploading && (
                <p className="text-xs text-muted-foreground">Mengunggah bukti transfer...</p>
              )}
              {transferProofUrl && (
                <button
                  type="button"
                  onClick={() => openProofPreview(transferProofUrl, "Bukti Transfer (Gaji Kreator)")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Bukti transfer berhasil diunggah, klik untuk lihat
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisburseDialogOpen(false)}
              disabled={payingPayout}
            >
              Batal
            </Button>
            <Button
              onClick={handleDisburseSelected}
              disabled={payingPayout || proofUploading || !transferProofUrl}
            >
              {payingPayout ? "Memproses..." : "Konfirmasi Bayar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bonusDisburseDialogOpen} onOpenChange={setBonusDisburseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pencairan Bonus Advertiser</DialogTitle>
            <DialogDescription>
              Pastikan nominal transfer bonus dan bukti transfer sudah sesuai sebelum mencairkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-medium">
                Total transfer: {formatRupiah(selectedBonusNominal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedBonusItems.length} item • {selectedBonusClients.toLocaleString("id-ID")} klien
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upload bukti transfer bonus</p>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleUploadBonusTransferProof(e.target.files?.[0] || null)}
              />
              {bonusProofUploading && (
                <p className="text-xs text-muted-foreground">Mengunggah bukti transfer bonus...</p>
              )}
              {bonusTransferProofUrl && (
                <button
                  type="button"
                  onClick={() => openProofPreview(bonusTransferProofUrl, "Bukti Transfer Bonus")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Bukti transfer bonus berhasil diunggah, klik untuk lihat
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBonusDisburseDialogOpen(false)}
              disabled={payingBonus}
            >
              Batal
            </Button>
            <Button
              onClick={handleDisburseSelectedBonus}
              disabled={payingBonus || bonusProofUploading || !bonusTransferProofUrl}
            >
              {payingBonus ? "Memproses..." : "Konfirmasi Bayar Bonus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proofPreviewOpen} onOpenChange={setProofPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{proofPreviewTitle}</DialogTitle>
            <DialogDescription>Preview bukti transfer tanpa membuka tab baru.</DialogDescription>
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
            <Button type="button" variant="outline" onClick={() => window.open(proofPreviewUrl, "_blank", "noopener,noreferrer")}>
              Buka di tab baru
            </Button>
            <Button type="button" onClick={() => setProofPreviewOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
