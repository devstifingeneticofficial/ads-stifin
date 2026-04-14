"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
  city: string
  startDate: string
  testEndDate: string | null
  durationDays: number
  dailyBudget: number
  totalBudget: number
  ppn: number
  totalPayment: number
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

// ─── Status Flow Order ───────────────────────────────────────────────────────

const STATUS_ORDER = [
  "MENUNGGU_PEMBAYARAN",
  "MENUNGGU_KONTEN",
  "DIPROSES",
  "KONTEN_SELESAI",
  "IKLAN_DIJADWALKAN",
  "IKLAN_BERJALAN",
  "SELESAI",
]

const isAtOrAfter = (status: string, target: string): boolean => {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(target)
}

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

export default function PromotorDashboard() {
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [globalAds, setGlobalAds] = useState<AdRequest[]>([])
  const [allGlobalAds, setAllGlobalAds] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [globalSearch, setGlobalSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [uploadDialogId, setUploadDialogId] = useState<string | null>(null)
  const [resultDialogId, setResultDialogId] = useState<string | null>(null)

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
  const [waLink, setWaLink] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAdRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/ad-requests")
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
  }, [])

  const fetchGlobalAds = useCallback(async () => {
    try {
      const res = await fetch("/api/ad-requests?scope=all")
      if (!res.ok) throw new Error("Gagal mengambil data global")
      const data: AdRequest[] = await res.json()
      // Only show ads with reports for future decision making
      const adsWithReports = data.filter(ad => ad.adReport !== null)
      setGlobalAds(adsWithReports)
      // All confirmed ads (excluding unpaid) for lifetime count
      const confirmedAds = data.filter(ad => ad.status !== "MENUNGGU_PEMBAYARAN")
      setAllGlobalAds(confirmedAds)
    } catch {
      console.error("Failed to fetch global ads")
    }
  }, [])

  const fetchWaLink = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setWaLink(data.value || "")
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (user) {
      fetchAdRequests()
      fetchGlobalAds()
      fetchWaLink()
    }
  }, [user, fetchAdRequests, fetchGlobalAds, fetchWaLink])

  const renderAdCards = (tabType: "PAY" | "CONTENT" | "PROCESS" | "DONE") => {
    const filtered = adRequests.filter((ad) => {
      if (tabType === "PAY") return ad.status === "MENUNGGU_PEMBAYARAN"
      if (tabType === "CONTENT") return ["MENUNGGU_KONTEN", "DIPROSES"].includes(ad.status)
      if (tabType === "PROCESS") return ["KONTEN_SELESAI", "IKLAN_DIJADWALKAN"].includes(ad.status)
      if (tabType === "ACTIVE") return ad.status === "IKLAN_BERJALAN"
      if (tabType === "DONE") return ["SELESAI", "FINAL"].includes(ad.status)
      return true
    })

    if (filtered.length === 0) {
      return (
        <Card className="border-dashed shadow-none bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm italic">Belum ada pengajuan di kategori ini.</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {filtered.map((ad) => (
          <Card key={ad.id}>
            <CardHeader className="px-4 py-3 pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-bold flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {ad.city}
                  </CardTitle>
                  <CardDescription className="text-[10px] italic">
                    Dibuat {formatDate(ad.createdAt)}
                  </CardDescription>
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
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-tight font-medium">
                    <DollarSign className="h-3 w-3" />
                    Total Bayar
                  </p>
                  <p className="font-bold text-slate-800 text-[13px]">
                    {formatRupiah(ad.totalPayment)}
                  </p>
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="opacity-70">Mulai:</span>
                      <span className="font-semibold">{new Date(ad.adStartDate).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Berakhir:</span>
                      <span className="font-semibold">{new Date(ad.adEndDate!).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              )}


              {/* Action buttons based on status */}
              <div className="flex flex-wrap gap-2">
                {/* MENUNGGU_PEMBAYARAN → Upload bukti transfer */}
                {ad.status === "MENUNGGU_PEMBAYARAN" && (
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
                          Upload Bukti Transfer
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
                            <p className="text-xl font-bold">
                              {formatRupiah(ad.totalPayment)}
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
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
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
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  const totalPengajuan = adRequests.length
  const iklanBerjalan = adRequests.filter(
    (r) => r.status === "IKLAN_BERJALAN"
  ).length
  const totalKlien = adRequests.reduce((sum, r) => {
    if (r.promotorResult) {
      return sum + r.promotorResult.totalClients
    }
    return sum
  }, 0)

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
          city: formCity,
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
      // 1. Upload file
      const formData = new FormData()
      formData.append("file", uploadFile)
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
          city: editFormCity,
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
  const calcTotalPayment = calcTotalBudget + calcPPn

  // ── Filtered history ──────────────────────────────────────────────────────

  const filteredHistory = adRequests.filter((r) =>
    r.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pengajuan Iklan
            </CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPengajuan}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Iklan Berjalan
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{iklanBerjalan}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Klien dari Iklan
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKlien}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue="pengajuan" className="w-full">
        <TabsList className="bg-slate-100/50 p-1 border h-auto flex flex-wrap gap-1">
          <TabsTrigger value="pengajuan">Pengajuan Iklan</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Iklan</TabsTrigger>
          <TabsTrigger value="data-iklan">Data Iklan</TabsTrigger>
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
              <DialogContent className="sm:max-w-md">
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
                          <span>Total Pembayaran</span>
                          <span>{formatRupiah(calcTotalPayment)}</span>
                        </div>
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
          <Tabs defaultValue="PAY" className="w-full space-y-6">
            <TabsList className="bg-slate-100/50 p-0.5 border h-auto flex flex-wrap justify-start gap-1 rounded-lg">
              <TabsTrigger value="PAY" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Pembayaran
                {adRequests.filter(r => r.status === "MENUNGGU_PEMBAYARAN").length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                    {adRequests.filter(r => r.status === "MENUNGGU_PEMBAYARAN").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="CONTENT" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Konten
                {adRequests.filter(r => ["MENUNGGU_KONTEN", "DIPROSES"].includes(r.status)).length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {adRequests.filter(r => ["MENUNGGU_KONTEN", "DIPROSES"].includes(r.status)).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="PROCESS" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Diproses
                {adRequests.filter(r => ["KONTEN_SELESAI", "IKLAN_DIJADWALKAN"].includes(r.status)).length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {adRequests.filter(r => ["KONTEN_SELESAI", "IKLAN_DIJADWALKAN"].includes(r.status)).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ACTIVE" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Iklan Aktif
                {adRequests.filter(r => r.status === "IKLAN_BERJALAN").length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-purple-100 text-purple-700 border-purple-200">
                    {adRequests.filter(r => r.status === "IKLAN_BERJALAN").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="DONE" className="text-xs h-8 px-3 font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md gap-2">
                Selesai
              </TabsTrigger>
            </TabsList>

            <TabsContent value="PAY" className="mt-0">
              {renderAdCards("PAY")}
            </TabsContent>
            <TabsContent value="CONTENT" className="mt-0">
              {renderAdCards("CONTENT")}
            </TabsContent>
            <TabsContent value="PROCESS" className="mt-0">
              {renderAdCards("PROCESS")}
            </TabsContent>
            <TabsContent value="ACTIVE" className="mt-0">
              {renderAdCards("ACTIVE")}
            </TabsContent>
            <TabsContent value="DONE" className="mt-0">
              {renderAdCards("DONE")}
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
                        {filteredHistory.map((ad) => (
                          <tr
                            key={ad.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-medium">{ad.city}</td>
                            <td className="p-4">{formatTestDate(ad.startDate, ad.testEndDate)}</td>
                            <td className="p-4">{ad.durationDays} hari</td>
                            <td className="p-4">
                              {formatRupiah(ad.totalPayment)}
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
                    {filteredHistory.map((ad) => (
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
                            <span className="font-semibold text-[11px]">{formatRupiah(ad.totalPayment)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan kota atau promotor..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {(() => {
              const filtered = globalAds.filter(ad =>
                ad.city.toLowerCase().includes(globalSearch.toLowerCase()) ||
                ad.promotor.name.toLowerCase().includes(globalSearch.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">Data tidak ditemukan</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Belum ada data iklan yang tersedia untuk ditampilkan.
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
                          <th className="p-4 text-left font-medium">Leads</th>
                          <th className="p-4 text-left font-medium">Klien</th>
                          <th className="p-4 text-left font-medium">CPR</th>
                          <th className="p-4 text-left font-medium">Budget/Hari</th>
                          <th className="p-4 text-left font-medium">Durasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filtered.map((ad) => (
                          <tr key={ad.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 font-medium">{ad.promotor.name}</td>
                            <td className="p-4">{ad.city}</td>
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
                              {ad.adReport?.cpr ? formatRupiah(Math.round(ad.adReport.cpr)) : "-"}
                            </td>
                            <td className="p-4">{formatRupiah(ad.dailyBudget)}</td>
                            <td className="p-4">{ad.durationDays} hari</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {filtered.map((ad) => (
                      <Card key={ad.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-sm font-bold">{ad.city}</CardTitle>
                              <CardDescription className="text-xs">{ad.promotor.name}</CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
                                {ad.adReport?.totalLeads} Leads
                              </Badge>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
                                {ad.promotorResult?.totalClients || 0} Klien
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-[11px]">
                            <div className="space-y-0.5">
                              <p className="text-muted-foreground uppercase">CPR</p>
                              <p className="font-bold">{ad.adReport?.cpr ? formatRupiah(Math.round(ad.adReport.cpr)) : "-"}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-muted-foreground uppercase">Budget Harian</p>
                              <p className="font-bold">{formatRupiah(ad.dailyBudget)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-muted-foreground uppercase">Durasi</p>
                              <p className="font-bold">{ad.durationDays} hari</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                [...topPromotorStats].sort((a, b) => b.totalClients - a.totalClients).map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={`${p.totalClients} Orang`} label="Total Klien" color="text-purple-600" />
                ))
              )}
            </TabsContent>

            <TabsContent value="spending" className="space-y-2 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-3">Peringkat berdasarkan total anggaran iklan yang sudah terpakai</p>
              {topPromotorStats.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground italic border-dashed"><p>Belum ada data</p></Card>
              ) : (
                [...topPromotorStats].sort((a, b) => b.totalSpent - a.totalSpent).map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={formatRupiah(p.totalSpent)} label="Total Ads Spent" color="text-emerald-600" />
                ))
              )}
            </TabsContent>

            <TabsContent value="iklan" className="space-y-2 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-3">Peringkat berdasarkan jumlah total pengajuan iklan</p>
              {topPromotorStats.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground italic border-dashed"><p>Belum ada data</p></Card>
              ) : (
                [...topPromotorStats].sort((a, b) => b.totalAds - a.totalAds).map((p, i) => (
                  <RankCard key={p.id} rank={i + 1} name={p.name} value={`${p.totalAds} Iklan`} label="Total Pengajuan" color="text-blue-600" />
                ))
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      {/* ── Edit Dialog ── */}
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

    </div>
  )
}
