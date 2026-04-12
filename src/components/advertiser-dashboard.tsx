"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  CalendarCheck,
  Bell,
  Clock,
  CheckCircle,
  FileText,
  Play,
  BarChart3,
  DollarSign,
  TrendingUp,
  Loader2,
  Plus,
  Megaphone,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  Settings,
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  promotorName: string
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
  briefContent: string | null
  briefVO: string | null
  briefJJ: string | null
  paymentProofUrl: string | null
  adStartDate: string | null
  adEndDate: string | null
  adReport: AdReport | null
}

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRupiah = (value: number): string =>
  `Rp ${value.toLocaleString("id-ID")}`

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdvertiserDashboard() {
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Gagal mengambil notifikasi")
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch { /* silent */ }
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
      fetchNotifications()
      fetchBriefTemplates()
      fetchNotifTemplates()
    }
  }, [user, fetchAdRequests, fetchNotifications, fetchBriefTemplates, fetchNotifTemplates])

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

  const handleUpdateNotifTemplate = async (e: React.FormEvent | null, slug: string, isActive?: boolean, message?: string) => {
    if (e) e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/notification-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, isActive, message }),
      })
      if (!res.ok) throw new Error("Gagal mengupdate template")
      if (message !== undefined) toast.success("Template WA berhasil diperbarui")
      fetchNotifTemplates()
      setEditingNotifTemplate(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalSpent = adRequests.reduce((acc, curr) => acc + (curr.adReport?.amountSpent || 0), 0)
  const totalLeads = adRequests.reduce((acc, curr) => acc + (curr.adReport?.totalLeads || 0), 0)

  if (loading) return <div>Memuat...</div>

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Advertiser</h1>
          <p className="text-muted-foreground">Monitoring seluruh performa iklan di berbagai kota</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Budget Terpakai</CardTitle>
            <DollarSign className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white border p-1 h-12">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="master" className="gap-2"><FileText className="h-4 w-4" /> Master Brief</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" /> Pengaturan WA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
           <Card><CardContent className="pt-6">Silakan cek daftar pengajuan di bawah ini.</CardContent></Card>
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
           <Card><CardContent className="pt-6">Kelola template script video di sini.</CardContent></Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Manajemen Notifikasi WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Aktifkan atau nonaktifkan jenis notifikasi tertentu.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { slug: "payment-confirmed-promotor", name: "Pembayaran Valid (ke Promotor)", desc: "Dikirim saat bukti bayar diunggah", default: "Halo {promotor}, Pembayaran iklan {kota} diterima. Menunggu konten." },
              { slug: "payment-confirmed-advertiser", name: "Pembayaran Masuk (ke Advertiser)", desc: "Notifikasi untuk tim Advertiser", default: "Notif: {promotor} telah bayar untuk {kota}." },
              { slug: "content-finished-promotor", name: "Konten Selesai (ke Promotor)", desc: "Dikirim saat kreator selesai upload video", default: "Halo {promotor}, Konten iklan {kota} sudah selesai! Cek dashboard." },
              { slug: "ad-scheduled-promotor", name: "Iklan Dijadwalkan (ke Promotor)", desc: "Dikirim saat jadwal iklan ditentukan", default: "Kabar gembira {promotor}! Iklan {kota} dijadwalkan tayang." },
              { slug: "client-report-stifin", name: "Laporan Klien (ke Admin STIFIn)", desc: "Dikirim saat promotor input jumlah klien", default: "Admin: {promotor} melaporkan {jumlah} klien untuk iklan {kota}." },
            ].map((tpl) => {
              const current = notifTemplates.find(t => t.slug === tpl.slug)
              const isActive = current ? current.isActive : true
              
              return (
                <Card key={tpl.slug} className={`transition-all ${!isActive ? "opacity-60 bg-slate-50 border-dashed" : "hover:border-slate-300"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tpl.name}</CardTitle>
                      <Switch 
                        checked={isActive} 
                        onCheckedChange={(checked) => handleUpdateNotifTemplate(null, tpl.slug, checked)}
                      />
                    </div>
                    <CardDescription>{tpl.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap min-h-[60px]">
                      {current?.message || tpl.default}
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => {
                      setEditingNotifTemplate(current || { slug: tpl.slug, name: tpl.name, message: tpl.default, isActive: true } as any)
                    }}>
                      <Settings className="h-4 w-4 mr-2" /> Edit Kalimat
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border flex gap-3 mt-4">
            <AlertCircle className="h-5 w-5 text-slate-500 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">Tips:</p>
              <p>Gunakan saklar di kanan atas setiap kartu untuk menghentikan pengiriman WhatsApp otomatis secara sementara.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingNotifTemplate} onOpenChange={(v) => !v && setEditingNotifTemplate(null)}>
        <DialogContent>
          <form onSubmit={(e) => handleUpdateNotifTemplate(e, editingNotifTemplate?.slug || "", editingNotifTemplate?.isActive, editingNotifTemplate?.message)}>
            <DialogHeader>
              <DialogTitle>Edit Template WhatsApp</DialogTitle>
              <DialogDescription>Gunakan variabel dinamis untuk data otomatis.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
               <div>
                 <Label>Isi Kalimat WhatsApp</Label>
                 <Textarea 
                   value={editingNotifTemplate?.message || ""} 
                   onChange={(e) => setEditingNotifTemplate(prev => prev ? { ...prev, message: e.target.value } : null)}
                   className="min-h-[150px] font-mono text-sm"
                 />
               </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingNotifTemplate(null)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
