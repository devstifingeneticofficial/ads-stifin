"use client"

import { useState, useEffect, useCallback } from "react"
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
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Megaphone,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

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

interface AdRequest {
  id: string
  promotor: { id: string; name: string; email: string; city: string }
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
  createdAt: string
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

const formatToDateTimeLocal = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  MENUNGGU_PEMBAYARAN: { label: "Menunggu Pembayaran", variant: "outline", className: "border-amber-500 text-amber-700 bg-amber-50" },
  MENUNGGU_KONTEN: { label: "Menunggu Konten", variant: "outline", className: "border-orange-500 text-orange-700 bg-orange-50" },
  DIPROSES: { label: "Diproses", variant: "outline", className: "border-blue-500 text-blue-700 bg-blue-50" },
  KONTEN_SELESAI: { label: "Konten Selesai", variant: "outline", className: "border-green-500 text-green-700 bg-green-50" },
  IKLAN_DIJADWALKAN: { label: "Iklan Dijadwalkan", variant: "outline", className: "border-blue-500 text-blue-700 bg-blue-50" },
  IKLAN_BERJALAN: { label: "Iklan Berjalan", variant: "outline", className: "border-purple-500 text-purple-700 bg-purple-50" },
  SELESAI: { label: "Selesai", variant: "secondary", className: "border-gray-400 text-gray-600 bg-gray-100" },
}

const getStatusBadge = (status: string) => {
  const config = statusConfig[status] || { label: status, variant: "outline", className: "" }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdvertiserDashboard() {
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

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

  const fetchAdRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/ad-requests")
      if (!res.ok) throw new Error("Gagal mengambil data")
      const data = await res.json()
      setAdRequests(data)
    } catch {
      toast.error("Gagal memuat data pengajuan iklan")
    } finally {
      setLoading(false)
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

  useEffect(() => {
    if (user) {
      fetchAdRequests()
      fetchBriefTemplates()
      fetchNotifTemplates()
      fetchWaChannelLink()
    }
  }, [user, fetchAdRequests, fetchBriefTemplates, fetchNotifTemplates, fetchWaChannelLink])

  useEffect(() => {
    if (selectedAd && scheduleMode === "DEFAULT") {
      const baseDate = new Date(selectedAd.startDate)
      
      // Default Start: T - 4 days at 16:00
      const start = new Date(baseDate)
      start.setDate(baseDate.getDate() - 4)
      start.setHours(16, 0, 0, 0)
      
      // Default End: Start + Duration at 21:00
      const end = new Date(start)
      end.setDate(start.getDate() + selectedAd.durationDays)
      end.setHours(21, 0, 0, 0)

      setAdStartDate(formatToDateTimeLocal(start))
      setAdEndDate(formatToDateTimeLocal(end))
    }
  }, [selectedAd, scheduleMode])

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

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAd) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/ad-requests/${selectedAd.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adStartDate, adEndDate }),
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Iklan berhasil dijadwalkan!")
      setScheduleDialogOpen(false)
      fetchAdRequests()
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
        body: JSON.stringify({ amountSpent: parseInt(inputAmountSpent), totalLeads: parseInt(inputTotalLeads) }),
      })
      if (!res.ok) throw new Error("Gagal")
      toast.success("Laporan berhasil diunggah!")
      setReportDialogOpen(false)
      fetchAdRequests()
    } catch { toast.error("Gagal mengunggah laporan") }
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

  const totalSpentAmount = adRequests.reduce((acc, curr) => acc + (curr.adReport?.amountSpent || 0), 0)
  const totalLeadsCount = adRequests.reduce((acc, curr) => acc + (curr.adReport?.totalLeads || 0), 0)

  const filteredRequests = activeTab === "all" ? adRequests : adRequests.filter(r => r.status === activeTab)

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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-100/50 p-1 border">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="master" className="gap-2"><FileText className="h-4 w-4" /> Master Brief</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" /> Notifikasi WA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-lg font-semibold">Daftar Pengajuan Iklan</h2>
                  <p className="text-xs text-muted-foreground">Kelola pengajuan iklan Anda</p>
               </div>
            </div>

            <div className="grid gap-4">
              {filteredRequests.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground italic border-dashed border-2">
                  <p>Belum ada pengajuan iklan dalam kategori ini.</p>
                </Card>
              ) : (
                filteredRequests.map((ad) => (
                  <Card key={ad.id} className="shadow-none hover:border-slate-300 transition-all">
                    <CardHeader className="p-4 md:p-6 pb-2">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                               <DollarSign className="h-4 w-4 text-muted-foreground" />
                               {ad.city}
                            </CardTitle>
                            <p className="text-[11px] text-muted-foreground font-medium">Dibuat {formatDate(ad.createdAt)} • Promotor: {ad.promotor.name}</p>
                         </div>
                         {getStatusBadge(ad.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 md:px-6 pb-4">
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 text-sm border-t border-slate-50 mt-2">
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium"><Calendar className="h-3 w-3" /> Tanggal Tes STIFIn</p>
                            <p className="font-semibold text-slate-800">{formatTestDate(ad.startDate, ad.testEndDate)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium"><Clock className="h-3 w-3" /> Durasi</p>
                            <p className="font-semibold text-slate-800">{ad.durationDays} hari</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium"><DollarSign className="h-3 w-3" /> Budget/Hari</p>
                            <p className="font-semibold text-slate-800">{formatRupiah(ad.dailyBudget)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium"><DollarSign className="h-3 w-3" /> Total Bayar</p>
                            <p className="font-semibold text-slate-800">{formatRupiah(ad.totalPayment)}</p>
                          </div>
                       </div>

                       {ad.adReport && (
                          <div className="grid grid-cols-2 gap-4 py-3 bg-slate-50/50 rounded-lg px-4 mb-4 border border-slate-100">
                             <div className="flex items-center gap-4">
                                <div className="text-emerald-600 bg-emerald-100 p-2 rounded-full"><TrendingUp className="h-4 w-4" /></div>
                                <div>
                                   <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Leads</p>
                                   <p className="text-lg font-semibold text-emerald-700">{ad.adReport.totalLeads}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4 border-l pl-4">
                                <div className="text-rose-600 bg-rose-100 p-2 rounded-full"><BarChart3 className="h-4 w-4" /></div>
                                <div>
                                   <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Spent</p>
                                   <p className="text-lg font-semibold text-rose-700">{formatRupiah(ad.adReport.amountSpent || 0)}</p>
                                </div>
                             </div>
                          </div>
                       )}

                       <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-2">
                             <Button size="sm" variant="outline" asChild className="h-8 font-semibold text-xs gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                                <a href={waChannelLink || "#"} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> LIHAT KONTEN (WA)</a>
                             </Button>
                             {ad.paymentProofUrl && (
                                <Button size="sm" variant="ghost" asChild className="h-8 font-medium text-xs gap-2 text-muted-foreground hover:text-slate-900">
                                   <a href={ad.paymentProofUrl} target="_blank"><ExternalLink className="h-4 w-4" /> Bukti Bayar</a>
                                </Button>
                             )}
                          </div>
                          <div className="flex items-center gap-2">
                             {ad.status === "KONTEN_SELESAI" && (
                                <Button size="sm" className="h-8 font-semibold text-xs gap-2" onClick={() => { setSelectedAd(ad); setScheduleDialogOpen(true); setScheduleMode("DEFAULT"); }}>
                                   <CalendarCheck className="h-4 w-4" /> Jadwalkan Iklan
                                </Button>
                             )}
                             {ad.status === "IKLAN_BERJALAN" && (
                                <Button size="sm" variant="secondary" className="h-8 font-semibold text-xs gap-2" onClick={() => { setSelectedAd(ad); setReportDialogOpen(true); }}>
                                   <Upload className="h-4 w-4" /> Upload Laporan
                                </Button>
                             )}
                             
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="font-medium text-xs">
                                   <DropdownMenuItem asChild>
                                      <a href={`/api/ad-requests/${ad.id}/report/download`} target="_blank" className="flex items-center gap-2"><Download className="h-4 w-4" /> Export Report (PDF)</a>
                                   </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                ))
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
      </Tabs>

      {/* Unified Dialogs (Promotor Style) */}
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
                   <p>Sesuai permintaan promotor (Tgl {formatShortDate(selectedAd.startDate)}, Durasi {selectedAd.durationDays} hari), iklan dijadwalkan otomatis tayang 4 hari sebelumnya.</p>
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
    </div>
  )
}
