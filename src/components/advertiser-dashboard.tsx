"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  CalendarCheck,
  Clock,
  FileText,
  BarChart3,
  DollarSign,
  TrendingUp,
  Plus,
  Megaphone,
  AlertCircle,
  MessageSquare,
  Settings,
  MoreVertical,
  ExternalLink,
  Download,
  Upload,
  Search,
  Building2,
  Users,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

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
  durationDays: number
  dailyBudget: number
  totalBudget: number
  ppn: number
  totalPayment: number
  status: string
  briefType: string | null
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

  // Filters (Adopted from STIFIn Admin)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [searchCity, setSearchCity] = useState("")

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

  // Action States
  const [selectedAd, setSelectedAd] = useState<AdRequest | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [adStartDate, setAdStartDate] = useState("")
  const [adEndDate, setAdEndDate] = useState("")
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

  useEffect(() => {
    if (user) {
      fetchAdRequests()
      fetchBriefTemplates()
      fetchNotifTemplates()
    }
  }, [user, fetchAdRequests, fetchBriefTemplates, fetchNotifTemplates])

  // Logic from STIFIn Admin
  const filteredAdRequests = useMemo(() => {
    return adRequests.filter((r) => {
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter
      const matchesCity = !searchCity || r.city.toLowerCase().includes(searchCity.toLowerCase())
      return matchesStatus && matchesCity
    })
  }, [adRequests, statusFilter, searchCity])

  const totalSpentAmount = adRequests.reduce((acc, curr) => acc + (curr.adReport?.amountSpent || 0), 0)
  const totalLeadsCount = adRequests.reduce((acc, curr) => acc + (curr.adReport?.totalLeads || 0), 0)

  // Master Brief Handlers
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

  // WA Template Handler
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

  // Action Handlers
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

  if (loading) return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Advertiser</h1>
        <p className="text-muted-foreground">Monitoring seluruh pengajuan iklan, laporan promotor, dan performa iklan</p>
      </div>

      {/* ── Stats Cards (STIFIn Admin Style) ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Budget Terpakai</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{formatRupiah(totalSpentAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pengeluaran dari iklan yang berjalan</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Leads Didapat</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{totalLeadsCount.toLocaleString("id-ID")}</div>
            <p className="text-xs text-muted-foreground mt-1">Total calon klien dari seluruh iklan</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs (STIFIn Admin Style) ───────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Pengajuan Iklan</TabsTrigger>
          <TabsTrigger value="master">Master Brief</TabsTrigger>
          <TabsTrigger value="whatsapp">Pengaturan WA</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Filters (Like Admin) */}
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
                <SelectItem value="MENUNGGU_PEMBAYARAN">Menunggu Pembayaran</SelectItem>
                <SelectItem value="MENUNGGU_KONTEN">Menunggu Konten</SelectItem>
                <SelectItem value="DIPROSES">Diproses</SelectItem>
                <SelectItem value="KONTEN_SELESAI">Konten Selesai</SelectItem>
                <SelectItem value="IKLAN_DIJADWALKAN">Iklan Dijadwalkan</SelectItem>
                <SelectItem value="IKLAN_BERJALAN">Iklan Berjalan</SelectItem>
                <SelectItem value="SELESAI">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAdRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Belum ada data</h3>
                  <p className="text-sm text-muted-foreground mt-1 italic">Tidak ada pengajuan iklan yang sesuai filter.</p>
                </CardContent>
              </Card>
            ) : (
              filteredAdRequests.map((ad) => (
                <Card key={ad.id} className="hover:border-slate-300 transition-all">
                  <CardHeader className="pb-3 pt-4 px-4 md:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border text-sm">{ad.city.charAt(0)}</div>
                         <div>
                            <CardTitle className="text-base font-bold text-slate-900">{ad.city}</CardTitle>
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight">Promotor: {ad.promotor.name}</p>
                         </div>
                      </div>
                      {getStatusBadge(ad.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 md:px-6 pb-4">
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 text-sm border-y border-slate-50 mb-3">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tgl Mulai</p>
                          <p className="font-semibold text-slate-800">{formatShortDate(ad.startDate)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Budget</p>
                          <p className="font-semibold text-slate-800">{formatRupiah(ad.totalPayment)}</p>
                        </div>
                        {ad.adReport && (
                          <>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Leads</p>
                              <p className="font-bold text-emerald-700">{ad.adReport.totalLeads}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-rose-600 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Spent</p>
                              <p className="font-bold text-rose-700">{formatRupiah(ad.adReport.amountSpent || 0)}</p>
                            </div>
                          </>
                        )}
                     </div>

                     <div className="flex items-center justify-end gap-2">
                        {ad.status === "KONTEN_SELESAI" && (
                          <Button 
                            variant="default"
                            size="sm" 
                            className="font-bold h-8 text-[11px] uppercase tracking-wider"
                            onClick={() => { setSelectedAd(ad); setScheduleDialogOpen(true); }}
                          >
                            <CalendarCheck className="h-4 w-4 mr-2" /> Susun Jadwal
                          </Button>
                        )}
                        {ad.status === "IKLAN_BERJALAN" && (
                          <Button 
                            variant="secondary"
                            size="sm" 
                            className="font-bold h-8 text-[11px] border border-slate-200 uppercase tracking-wider"
                            onClick={() => { setSelectedAd(ad); setReportDialogOpen(true); }}
                          >
                            <Upload className="h-4 w-4 mr-2" /> Upload Laporan
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs font-bold w-40">
                             <DropdownMenuItem asChild>
                                <a href={`/api/ad-requests/${ad.id}/report/download`} target="_blank" className="flex items-center gap-2">
                                  <Download className="h-4 w-4" /> Export Report PDF
                                </a>
                             </DropdownMenuItem>
                             {ad.paymentProofUrl && (
                               <DropdownMenuItem asChild>
                                  <a href={ad.paymentProofUrl} target="_blank" className="flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4" /> Lihat Bukti Bayar
                                  </a>
                               </DropdownMenuItem>
                             )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                     </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Tab 2: Master Brief ────────────────────────────────────────── */}
        <TabsContent value="master" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
               <h2 className="text-lg font-bold">Master Template Brief</h2>
               <p className="text-xs text-muted-foreground">Kelola format narasi VO dan Jedag Jedug otomatis</p>
            </div>
            <Button onClick={() => { setEditingTemplate(null); setTemplateName(""); setTemplateContent(""); setIsTemplateDialogOpen(true); }} size="sm" className="font-bold h-9">
              <Plus className="h-4 w-4 mr-2" /> Tambah Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {briefTemplates.length === 0 ? (
               <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg border-dashed">Belum ada template master yang tersimpan.</div>
            ) : (
              briefTemplates.map((t) => (
                <Card key={t.id} className="group relative overflow-hidden bg-white hover:border-slate-300 transition-all border-slate-200">
                  <div className={`h-1.5 w-full ${t.type === "VO" ? "bg-blue-500" : "bg-purple-500"}`} />
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider ${t.type === "VO" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-purple-200 text-purple-700 bg-purple-50"}`}>
                        {t.type === "VO" ? "Voice Over" : "Jedag Jedug"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingTemplate(t); setTemplateType(t.type as "VO" | "JJ"); setTemplateName(t.name); setTemplateContent(t.content); setIsTemplateDialogOpen(true); }}><Settings className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteTemplate(t.id)}><AlertCircle className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <CardTitle className="text-base font-bold mt-2 text-slate-800">{t.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <pre className="bg-slate-50 p-3 rounded text-[11px] font-mono text-slate-600 min-h-[100px] whitespace-pre-wrap leading-relaxed border">
                      {t.content}
                    </pre>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Tab 3: WhatsApp Settings ───────────────────────────────────── */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <div>
            <h2 className="text-lg font-bold">Notifikasi WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Konfigurasi pesan otomatis ke Promotor & Advertiser</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { slug: "payment-confirmed-promotor", name: "Pembayaran Valid (Promotor)", desc: "Pesan saat bukti bayar divalidasi", default: "Halo *{promotor}*, Pembayaran iklan Anda untuk kota *{city}* telah diterima. Terimakasih!" },
              { slug: "payment-confirmed-advertiser", name: "Pembayaran Masuk (Advertiser)", desc: "Laporan untuk tim Advertiser", default: "*NOTIFIKASI*: Promotor *{promotor}* telah bayar untuk *{city}*." },
              { slug: "content-finished-promotor", name: "Konten Selesai (Promotor)", desc: "Pesan saat video konten tersedia", default: "Halo *{promotor}*, Konten iklan *{city}* sudah selesai! Silakan cek dashboard." },
              { slug: "ad-scheduled-promotor", name: "Iklan Dijadwalkan (Promotor)", desc: "Pesan saat tanggal tayang diputuskan", default: "Kabar gembira *{promotor}*! Iklan *{city}* telah dijadwalkan tayang." },
              { slug: "client-report-stifin", name: "Laporan Klien (Admin STIFIn)", desc: "Laporan performa leads harian", default: "Admin: *{promotor}* melaporkan *{jumlah}* klien untuk iklan *{city}*." },
            ].map((tpl) => {
              const current = notifTemplates.find(t => t.slug === tpl.slug)
              const isActive = current ? current.isActive : true
              return (
                <Card key={tpl.slug} className={`transition-all border-slate-200 ${!isActive ? "opacity-50 grayscale bg-slate-50" : "hover:border-slate-300"}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold uppercase tracking-tight text-slate-700">{tpl.name}</CardTitle>
                      <Switch className="data-[state=checked]:bg-emerald-500 scale-90" checked={isActive} onCheckedChange={(c) => handleUpdateNotifTemplate(null, tpl.slug, c)} />
                    </div>
                    <CardDescription className="text-xs font-medium text-slate-500">{tpl.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="bg-slate-50 rounded border border-slate-200 p-3 text-[11px] font-mono text-slate-700 min-h-[70px] leading-relaxed">
                      {current?.message || tpl.default}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-[10px] font-bold h-8 uppercase tracking-widest bg-white border-slate-200" onClick={() => {
                      setEditingNotifTemplate(current || { slug: tpl.slug, name: tpl.name, message: tpl.default, isActive: true } as any)
                    }}>
                      <Settings className="h-3 w-3 mr-2" /> Konfigurasi Pesan
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs (Unified Design) ────────────────────────────────────── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSchedule} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-bold text-lg">Penyusunan Jadwal</DialogTitle>
              <DialogDescription>Tentukan periode penayangan iklan di platform.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2 text-sm">
               <div className="space-y-2">
                 <Label className="font-bold text-xs uppercase text-slate-600">Mulai Tayang</Label>
                 <Input type="date" value={adStartDate} onChange={(e) => setAdStartDate(e.target.value)} required className="text-xs font-semibold" />
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-xs uppercase text-slate-600">Selesai Tayang</Label>
                 <Input type="date" value={adEndDate} onChange={(e) => setAdEndDate(e.target.value)} required className="text-xs font-semibold" />
               </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="font-bold text-xs" onClick={() => setScheduleDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold text-xs px-6 bg-slate-900">{isSubmitting ? "Memproses..." : "Konfirmasi"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUploadReport} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-bold text-lg">Laporan Hasil Iklan</DialogTitle>
              <DialogDescription>Input total biaya terpakai dan leads yang didapat.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
               <div className="space-y-2">
                 <Label className="font-bold text-sm">Biaya Terpakai (Ads Spent)</Label>
                 <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">Rp</span>
                    <Input type="number" value={inputAmountSpent} onChange={(e) => setInputAmountSpent(e.target.value)} placeholder="0" required className="pl-9 font-bold" />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-sm">Total Leads Didapat</Label>
                 <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" value={inputTotalLeads} onChange={(e) => setInputTotalLeads(e.target.value)} placeholder="0" required className="pl-10 font-bold" />
                 </div>
               </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="font-bold text-xs" onClick={() => setReportDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold text-xs px-6 bg-emerald-600 hover:bg-emerald-700 text-white">{isSubmitting ? "Menyimpan..." : "Simpan Laporan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <DialogHeader><DialogTitle className="font-bold text-lg text-slate-800">{editingTemplate ? "Edit Template Master" : "Buat Template Baru"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Kategori Brief</Label>
                <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "VO" | "JJ")}>
                  <TabsList className="grid grid-cols-2 h-9"><TabsTrigger value="VO" className="text-xs">Voice Over (Script)</TabsTrigger><TabsTrigger value="JJ" className="text-xs">Jedag Jedug (Vibe)</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Nama Template</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Contoh: Template VO Soft Selling" required className="font-semibold text-sm h-10" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Narasi Script</Label>
                <Textarea value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} placeholder="Gunakan variabel {city}, {day}, {date} di sini..." className="min-h-[150px] font-mono text-sm leading-relaxed p-4 bg-slate-50 border-slate-200" required />
              </div>
              <div className="text-[10px] text-muted-foreground bg-slate-100 p-3 rounded-lg border border-slate-200 font-medium">
                <span className="font-bold text-slate-700">Variabel Tersedia:</span><br/>
                <span className="font-mono text-emerald-600 font-bold">{"{city}"}</span> (Nama Kota), 
                <span className="font-mono text-emerald-600 font-bold ml-2">{"{day}"}</span> (Nama Hari), 
                <span className="font-mono text-emerald-600 font-bold ml-2">{"{date}"}</span> (Tanggal Lengkap)
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="font-bold text-xs" onClick={() => setIsTemplateDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold text-xs px-8 h-10">{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNotifTemplate} onOpenChange={(v) => !v && setEditingNotifTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => handleUpdateNotifTemplate(e, editingNotifTemplate?.slug || "", editingNotifTemplate?.isActive, editingNotifTemplate?.message)} className="space-y-4 text-sm font-semibold">
            <DialogHeader>
              <DialogTitle className="font-bold text-lg">Konfigurasi Pesan WhatsApp</DialogTitle>
              <DialogDescription className="text-xs">Edit kalimat pesan yang akan terkirim secara otomatis.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-4">
               <Textarea value={editingNotifTemplate?.message || ""} onChange={(e) => setEditingNotifTemplate(prev => prev ? { ...prev, message: e.target.value } : null)} className="min-h-[140px] font-mono text-[13px] bg-slate-50 border-slate-200 p-4 leading-relaxed" />
               <div className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-200 p-3 rounded-lg">
                 <span className="font-bold text-amber-800">Variabel Data:</span><br/>
                 <span className="font-mono text-blue-600 font-bold">{"{promotor}"}</span> (Nama Promotor), 
                 <span className="font-mono text-blue-600 font-bold ml-2">{"{city}"}</span> (Nama Kota), 
                 <span className="font-mono text-blue-600 font-bold ml-2">{"{jumlah}"}</span> (Total Leads)
               </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" className="font-bold text-xs" onClick={() => setEditingNotifTemplate(null)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-8 h-10">Update Pesan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
