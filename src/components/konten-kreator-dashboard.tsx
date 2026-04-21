"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Play,
  Upload,
  FileText,
  Bell,
  Clock,
  CheckCircle,
  Copy,
  Megaphone,
  Eye,
  Loader2,
  Wallet,
  ReceiptText,
  ChevronDown,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdRequest {
  id: string
  promotor: { name: string }
  contentCreator?: { id: string; name: string; email: string } | null
  city: string
  startDate: string
  testEndDate: string | null
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
}

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

interface CreatorPayoutItem {
  id: string
  adRequestId: string
  city: string
  startDate: string
  testEndDate: string | null
  promotorName: string
  requestAmount: number
  contentCount: number
  completedAt: string
}

interface CreatorPayoutBatch {
  id: string
  invoiceNumber?: string
  payoutDate: string
  totalRequests: number
  totalContents: number
  totalAmount: number
  items: CreatorPayoutItem[]
}

interface CreatorPayoutData {
  unpaidSummary: {
    totalRequests: number
    totalContents: number
    totalAmount: number
  }
  unpaidItems: Array<{
    adRequestId: string
    city: string
    startDate: string
    testEndDate: string | null
    promotorName: string
    amount: number
    contentCount: number
    completedAt: string
  }>
  paidBatches: CreatorPayoutBatch[]
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

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className: string
  }
> = {
  MENUNGGU_PEMBAYARAN: {
    label: "Menunggu Pembayaran",
    variant: "outline",
    className: "border-amber-500 text-amber-700 bg-amber-50",
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
  IKLAN_BERJALAN: {
    label: "Iklan Berjalan",
    variant: "outline",
    className: "border-purple-500 text-purple-700 bg-purple-50",
  },
  SELESAI: {
    label: "Selesai",
    variant: "secondary",
    className: "border-gray-400 text-gray-600 bg-gray-100",
  },
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

// ─── Component ───────────────────────────────────────────────────────────────

const KREATOR_TAB_TO_ROUTE: Record<string, string> = {
  MENUNGGU_KONTEN: "menunggu",
  DIPROSES: "diproses",
  SELESAI: "selesai",
  GAJI: "gaji",
}

export default function KontenKreatorDashboard({
  initialTab = "MENUNGGU_KONTEN",
  routeBasePath,
}: {
  initialTab?: string
  routeBasePath?: string
}) {
  const router = useRouter()
  const CREATOR_TAB_PAGE_SIZE = 10
  const PAGINATED_TABS = new Set(["MENUNGGU_KONTEN", "SELESAI"])
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [tabPages, setTabPages] = useState<Record<string, number>>({
    MENUNGGU_KONTEN: 1,
    SELESAI: 1,
  })
  const [payoutData, setPayoutData] = useState<CreatorPayoutData | null>(null)
  const [payoutLoading, setPayoutLoading] = useState(false)

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [completeConfirmId, setCompleteConfirmId] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Brief sheet state
  const [briefSheetOpen, setBriefSheetOpen] = useState(false)
  const [selectedBrief, setSelectedBrief] = useState<AdRequest | null>(null)

  // Notification states
  const [notifLoading, setNotifLoading] = useState(false)
  const [readingNotifId, setReadingNotifId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialTab) return
    setActiveTab(initialTab)
  }, [initialTab])

  // ── Fetch ad requests ────────────────────────────────────────────────────

  const fetchAdRequests = useCallback(async () => {
    try {
      const statuses = ["MENUNGGU_KONTEN", "DIPROSES", "KONTEN_SELESAI", "IKLAN_BERJALAN", "SELESAI"]
      const query = new URLSearchParams({
        lite: "1",
        view: "kreator:main",
        statuses: statuses.join(","),
      })
      const res = await fetch(`/api/ad-requests?${query.toString()}`)
      if (!res.ok) throw new Error("Gagal mengambil data")
      const data: AdRequest[] = await res.json()
      setAdRequests(data)
    } catch {
      toast.error("Gagal memuat data pengajuan iklan")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchAdRequests()
    }
  }, [user, fetchAdRequests])

  // ── Fetch notifications ──────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Gagal mengambil notifikasi")
      const data = await res.json()
      const rawNotifs: Notification[] = data.notifications || []
      
      // Filter out undesirable historical notifications
      const filteredNotifs = rawNotifs.filter(n => {
        // Hide "Bukti Transfer Diterima" (old title)
        if (n.title === "Bukti Transfer Diterima") return false
        // Hide early "Pengajuan Iklan Baru" that are waiting for payment
        if (n.title === "Pengajuan Iklan Baru" && n.message.includes("Menunggu bukti pembayaran")) return false
        return true
      })
      
      setNotifications(filteredNotifs)
    } catch {
      // Silently fail for notifications
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const fetchPayouts = useCallback(async () => {
    setPayoutLoading(true)
    try {
      const res = await fetch("/api/creator-payouts")
      if (!res.ok) throw new Error("Gagal memuat data gaji")
      const data: CreatorPayoutData = await res.json()
      setPayoutData(data)
    } catch {
      // silent fail
    } finally {
      setPayoutLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user, fetchNotifications])

  useEffect(() => {
    if (!user) return
    if (activeTab === "GAJI" && !payoutData) {
      fetchPayouts()
    }
  }, [user, activeTab, payoutData, fetchPayouts])

  // ── Computed stats ───────────────────────────────────────────────────────

  const statusBuckets = useMemo(() => {
    const buckets = {
      MENUNGGU_KONTEN: [] as AdRequest[],
      DIPROSES: [] as AdRequest[],
      SELESAI: [] as AdRequest[],
    }
    for (const ad of adRequests) {
      if (ad.status === "MENUNGGU_KONTEN") {
        buckets.MENUNGGU_KONTEN.push(ad)
      } else if (ad.status === "DIPROSES") {
        buckets.DIPROSES.push(ad)
      } else if (["KONTEN_SELESAI", "IKLAN_BERJALAN", "SELESAI"].includes(ad.status)) {
        buckets.SELESAI.push(ad)
      }
    }
    return buckets
  }, [adRequests])

  const menungguKontenCount = statusBuckets.MENUNGGU_KONTEN.length
  const diprosesCount = statusBuckets.DIPROSES.length
  const kontenSelesaiCount = statusBuckets.SELESAI.length
  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  // ── Process content (MENUNGGU_KONTEN → DIPROSES) ─────────────────────────
  const handleProcessContent = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ad-requests/${id}/process-content`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal memproses konten")
      }
      toast.success("Pengajuan berhasil diproses!")
      fetchAdRequests()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memproses konten"
      toast.error(message)
    } finally {
      setProcessingId(null)
    }
  }

  // ── Complete content (DIPROSES → KONTEN_SELESAI) ─────────────────────────
  const handleMarkComplete = async (id: string) => {
    setUploading(true)
    try {
      const res = await fetch(`/api/ad-requests/${id}/upload-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentUrl: "WA_CHANNEL" }), // Placeholder URL
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal memperbarui status")
      }
      toast.success("Status iklan diperbarui!")
      setCompleteConfirmId(null)
      fetchAdRequests()
      fetchPayouts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui status"
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  // ── Mark notification as read ────────────────────────────────────────────

  const handleMarkRead = async (notifId: string) => {
    setReadingNotifId(notifId)
    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Gagal menandai notifikasi")
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      )
    } catch {
      toast.error("Gagal menandai notifikasi sebagai dibaca")
    } finally {
      setReadingNotifId(null)
    }
  }

  // ── Copy brief to clipboard ──────────────────────────────────────────────

  const handleCopyBrief = async (content: string) => {
    try {
      // Try modern API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
        toast.success("Brief berhasil disalin!")
        return
      }

      // Fallback for non-HTTPS (IP access)
      const textArea = document.createElement("textarea")
      textArea.value = content
      textArea.style.position = "fixed"
      textArea.style.left = "-9999px"
      textArea.style.top = "0"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand("copy")
      document.body.removeChild(textArea)
      
      if (successful) {
        toast.success("Brief berhasil disalin!")
      } else {
        throw new Error("Gagal menyalin")
      }
    } catch (err) {
      toast.error("Gagal menyalin brief")
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const updateTabPage = (tabStatus: string, nextPage: number) => {
    if (!PAGINATED_TABS.has(tabStatus)) return
    setTabPages((prev) => ({
      ...prev,
      [tabStatus]: Math.max(1, nextPage),
    }))
  }

  const renderAdCards = (tabStatus: string) => {
    const filtered =
      tabStatus === "MENUNGGU_KONTEN"
        ? statusBuckets.MENUNGGU_KONTEN
        : tabStatus === "DIPROSES"
          ? statusBuckets.DIPROSES
          : tabStatus === "SELESAI"
            ? statusBuckets.SELESAI
            : adRequests

    const isPaginatedTab = PAGINATED_TABS.has(tabStatus)
    const currentPage = tabPages[tabStatus] || 1
    const totalPages = Math.max(1, Math.ceil(filtered.length / CREATOR_TAB_PAGE_SIZE))
    const safePage = Math.min(currentPage, totalPages)
    const startIndex = (safePage - 1) * CREATOR_TAB_PAGE_SIZE
    const endIndex = startIndex + CREATOR_TAB_PAGE_SIZE
    const visibleItems = isPaginatedTab ? filtered.slice(startIndex, endIndex) : filtered

    if (filtered.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm italic">Belum ada pengajuan untuk kategori ini.</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {visibleItems.map((ad) => (
          <Card key={ad.id} className="overflow-hidden border-slate-200">
            <CardHeader className="px-4 py-3 pb-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                <div className="space-y-0.5">
                  <CardTitle className="text-base flex items-center gap-2 font-bold">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    {ad.promotor?.name} - {ad.city}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                     <CardDescription className="text-[10px] font-medium italic">
                       Dibuat {formatDate(ad.createdAt)}
                     </CardDescription>
                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tight">
                        <span>TES STIFIn:</span>
                        <span>{formatTestDate(ad.startDate, ad.testEndDate)}</span>
                     </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:mt-0 mt-1">
                  {ad.briefType && getBriefTypeBadge(ad.briefType)}
                  {getStatusBadge(ad.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-2 space-y-3">
              {/* Brief Content Preview */}
              {ad.briefContent && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Brief Konten
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-medium"
                      onClick={() => {
                        setSelectedBrief(ad)
                        setBriefSheetOpen(true)
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Detail
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {ad.briefContent.split("\n\n------------------------------------------------------------\n\n").map((part, idx) => {
                      const isJJ = part.includes("JEDAG-JEDUG");
                      const isVO = part.includes("VOICE OVER");
                      const title = isJJ ? "BRIEF JJ" : isVO ? "BRIEF VO" : "BRIEF KONTEN";
                      const cleanPart = part
                        .replace(/^\[ BRIEF JEDAG-JEDUG \(JJ\) \]\n*/, '')
                        .replace(/^\[ BRIEF VOICE OVER \(VO\) \]\n*/, '');
                      
                      return (
                        <div key={idx} className="relative group">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-tight">{title}</p>
                          <div className="absolute top-6 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 px-2 text-[10px] font-bold"
                              onClick={() => handleCopyBrief(cleanPart)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Salin
                            </Button>
                          </div>
                          <pre className="rounded-lg bg-slate-50/50 border p-4 text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                            {cleanPart}
                          </pre>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Content URL Info */}
              {ad.contentUrl === "WA_CHANNEL" && (
                <div className="text-sm flex items-center gap-2 bg-emerald-50 p-2 rounded border border-emerald-100 italic text-emerald-700">
                  <CheckCircle className="h-3 w-3" />
                  Konten sudah diupload ke Channel WhatsApp
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                {ad.status === "MENUNGGU_KONTEN" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                    size="sm"
                    disabled={processingId === ad.id}
                    onClick={() => handleProcessContent(ad.id)}
                  >
                    {processingId === ad.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    MULAI PROSES
                  </Button>
                )}
                {ad.status === "DIPROSES" && (
                  <Dialog
                    open={completeConfirmId === ad.id}
                    onOpenChange={(open) => setCompleteConfirmId(open ? ad.id : null)}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setCompleteConfirmId(ad.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      KONTEN SELESAI
                    </Button>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-bold">Konfirmasi Upload Konten</DialogTitle>
                        <DialogDescription className="text-xs pt-1">
                          Apakah Anda sudah upload konten di <strong>channel WA</strong> untuk kota <strong>{ad.city}</strong>?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="flex sm:justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 font-bold text-rose-600 border-rose-200 bg-rose-50"
                          onClick={() => setCompleteConfirmId(null)}
                          disabled={uploading}
                        >
                          BELUM
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleMarkComplete(ad.id)}
                          disabled={uploading}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                          SUDAH
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {isPaginatedTab && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              Menampilkan {startIndex + 1}-{Math.min(endIndex, filtered.length)} dari {filtered.length} item
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={safePage <= 1}
                onClick={() => updateTabPage(tabStatus, safePage - 1)}
              >
                Sebelumnya
              </Button>
              <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                Halaman {safePage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={safePage >= totalPages}
                onClick={() => updateTabPage(tabStatus, safePage + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header with Notification Bell ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard Konten Kreator
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Kelola pembuatan konten iklan untuk semua pengajuan
          </p>
        </div>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menunggu Diproses
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {menungguKontenCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pengajuan siap dibuat konten
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sedang Diproses
            </CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {diprosesCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Konten sedang dalam pengerjaan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Konten Selesai
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {kontenSelesaiCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Konten sudah selesai dibuat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          setActiveTab(nextTab)
          if (PAGINATED_TABS.has(nextTab)) {
            updateTabPage(nextTab, 1)
          }
          if (routeBasePath) {
            const routeSegment = KREATOR_TAB_TO_ROUTE[nextTab] || KREATOR_TAB_TO_ROUTE.MENUNGGU_KONTEN
            router.push(`${routeBasePath}/${routeSegment}`)
          }
        }}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100/50 p-1 border">
          <TabsTrigger value="MENUNGGU_KONTEN" className="gap-2 relative">
            <Clock className="h-4 w-4" />
            Menunggu
            {menungguKontenCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white font-bold">
                {menungguKontenCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="DIPROSES" className="gap-2 relative">
            <Play className="h-4 w-4" />
            Diproses
            {diprosesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white font-bold">
                {diprosesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="SELESAI" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Selesai
          </TabsTrigger>
          <TabsTrigger value="GAJI" className="gap-2">
            <Wallet className="h-4 w-4" />
            Gaji
          </TabsTrigger>
        </TabsList>

        <TabsContent value="MENUNGGU_KONTEN" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Menunggu Konten</h2>
            <p className="text-sm text-muted-foreground italic">Daftar antrean iklan yang perlu segera diproses.</p>
          </div>
          {renderAdCards("MENUNGGU_KONTEN")}
        </TabsContent>

        <TabsContent value="DIPROSES" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Sedang Diproses</h2>
            <p className="text-sm text-muted-foreground italic">Daftar iklan yang sedang dalam pengerjaan.</p>
          </div>
          {renderAdCards("DIPROSES")}
        </TabsContent>

        <TabsContent value="SELESAI" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Konten Selesai</h2>
            <p className="text-sm text-muted-foreground italic">Riwayat konten yang sudah dikirim ke Advertiser.</p>
          </div>
          {renderAdCards("SELESAI")}
        </TabsContent>

        <TabsContent value="GAJI" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Perhitungan Gaji</h2>
            <p className="text-sm text-muted-foreground italic">Gaji dihitung dari request dengan status Konten Selesai (Rp20.000/request).</p>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Konten</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {(payoutData?.unpaidSummary.totalContents || 0).toLocaleString("id-ID")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Item konten belum dicairkan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Dicairkan</CardTitle>
                <ReceiptText className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatRupiah(
                    (payoutData?.paidBatches || []).reduce((sum, b) => sum + b.totalAmount, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(payoutData?.paidBatches || []).length} invoice pencairan
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Belum Dicairkan</CardTitle>
              <CardDescription>Daftar item gaji yang menunggu pencairan admin STIFIn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {payoutLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data gaji...</p>
              ) : (payoutData?.unpaidItems.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada item gaji yang menunggu pencairan.</p>
              ) : (
                payoutData!.unpaidItems.map((item) => (
                  <div key={item.adRequestId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {item.city} - {formatTestDate(item.startDate, item.testEndDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">Promotor: {item.promotorName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatRupiah(item.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.contentCount} konten</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Sudah Dicairkan</CardTitle>
              <CardDescription>Klik invoice untuk melihat detail item pencairan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(payoutData?.paidBatches.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada invoice pencairan.</p>
              ) : (
                payoutData!.paidBatches.map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">
                          {batch.invoiceNumber || "-"} | Pencairan {formatDate(batch.payoutDate)} | {batch.totalContents} konten
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-emerald-700">
                            {formatRupiah(batch.totalAmount)}
                          </p>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {batch.items.map((item) => (
                        <div key={item.id} className="rounded-md bg-slate-50 p-2 text-xs">
                          <p className="font-medium">
                            {item.city} - {formatTestDate(item.startDate, item.testEndDate)} - {item.promotorName}
                          </p>
                          <p className="text-muted-foreground">
                            {item.contentCount} konten • {formatRupiah(item.requestAmount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Brief Detail Sheet ────────────────────────────────────────────── */}
      <Sheet open={briefSheetOpen} onOpenChange={setBriefSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg w-full flex flex-col p-0 h-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail Brief Konten
            </SheetTitle>
            <SheetDescription>
              {selectedBrief && (
                <span className="font-medium text-xs">
                  {selectedBrief?.city} &middot; {selectedBrief?.promotor?.name}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col py-4 gap-4">
            {/* Brief meta info */}
            {selectedBrief && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedBrief?.briefType &&
                    getBriefTypeBadge(selectedBrief.briefType)}
                  {getStatusBadge(selectedBrief?.status || "")}
                </div>

                <Separator />



                {/* Brief content */}
                {selectedBrief.briefContent ? (
                  <div className="flex-1 min-h-0 flex flex-col gap-2">
                    <p className="text-sm font-medium px-4 shrink-0">Isi Brief</p>
                    <div className="flex-1 overflow-y-auto px-4 pb-20 touch-pan-y">
                      <div className="space-y-6">
                        {selectedBrief?.briefContent?.split("\n\n------------------------------------------------------------\n\n").map((part, idx) => {
                          const isJJ = part.includes("JEDAG-JEDUG");
                          const isVO = part.includes("VOICE OVER");
                          const title = isJJ ? "BRIEF JJ" : isVO ? "BRIEF VO" : "BRIEF KONTEN";

                          const cleanPart = part
                            .replace(/^\[ BRIEF JEDAG-JEDUG \(JJ\) \]\n*/, '')
                            .replace(/^\[ BRIEF VOICE OVER \(VO\) \]\n*/, '');

                          return (
                            <div key={idx} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-muted-foreground">{title}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs bg-muted/50 hover:bg-muted font-bold"
                                  onClick={() => handleCopyBrief(cleanPart)}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Salin
                                </Button>
                              </div>
                              <pre className="rounded-lg bg-muted/50 border p-4 text-[13px] leading-relaxed whitespace-pre-wrap font-mono select-text border-slate-200">
                                {cleanPart}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">
                      Brief belum tersedia
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
