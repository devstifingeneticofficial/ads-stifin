"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
} from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function StifinDashboard() {
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [searchCity, setSearchCity] = useState("")

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
    } catch {
      toast.error("Gagal memvalidasi laporan")
    } finally {
      setValidatingId(null)
    }
  }

  useEffect(() => {
    if (user) {
      fetchAdRequests()
    }
  }, [user, fetchAdRequests])

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

  const filteredAdRequests = useMemo(() => {
    return adRequests.filter((r) => {
      const matchesStatus =
        statusFilter === "ALL" || r.status === statusFilter
      const matchesCity =
        !searchCity ||
        r.city.toLowerCase().includes(searchCity.toLowerCase())
      return matchesStatus && matchesCity
    })
  }, [adRequests, statusFilter, searchCity])

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

  const adReports = useMemo(() => {
    return adRequests
      .filter((r) => r.adReport !== null)
      .map((r) => ({
        id: r.id,
        promotorName: r.promotor.name,
        promotorCity: r.promotor.city,
        city: r.city,
        cpr: r.adReport!.cpr,
        totalLeads: r.adReport!.totalLeads,
        amountSpent: r.adReport!.amountSpent,
        createdAt: r.adReport!.createdAt,
      }))
  }, [adRequests])

  // ── Summary: Promotor results ──────────────────────────────────────────────

  const promotorSummaryTotalClients = promotorResults.reduce(
    (sum, r) => sum + r.totalClients,
    0
  )

  // ── Summary: Ad reports ────────────────────────────────────────────────────

  const validCprs = adReports.filter((r) => r.cpr !== null && r.cpr > 0)
  const averageCpr =
    validCprs.length > 0
      ? validCprs.reduce((sum, r) => sum + r.cpr!, 0) / validCprs.length
      : 0

  const reportTotalLeads = adReports.reduce(
    (sum, r) => sum + (r.totalLeads ?? 0),
    0
  )

  const reportTotalAmountSpent = adReports.reduce(
    (sum, r) => sum + (r.amountSpent ?? 0),
    0
  )

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
      <Tabs defaultValue="semua" className="w-full">
        <TabsList className="bg-slate-100/50 p-1 border h-auto flex flex-wrap gap-1">
          <TabsTrigger value="semua">Semua Pengajuan</TabsTrigger>
          <TabsTrigger value="promotor">Laporan Promotor</TabsTrigger>
          <TabsTrigger value="advertiser">Laporan Advertiser</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Semua Pengajuan ─────────────────────────────────────────── */}
        <TabsContent value="semua" className="space-y-4 mt-4">
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
                <SelectItem value="IKLAN_BERJALAN">Iklan Berjalan</SelectItem>
                <SelectItem value="SELESAI">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                        {filteredAdRequests.map((ad) => (
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
                {filteredAdRequests.map((ad) => (
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
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Laporan Promotor ────────────────────────────────────────── */}
        <TabsContent value="promotor" className="space-y-4 mt-4">
          {/* Summary Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Klien dari Semua Promotor
              </CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">
                {promotorSummaryTotalClients.toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Dari {promotorResults.length} laporan promotor
              </p>
            </CardContent>
          </Card>

          {/* List */}
          {promotorResults.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Belum ada laporan</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Laporan promotor akan tampil setelah promotor menginput hasil
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
                            Total Klien
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Catatan
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Tanggal
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Validasi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotorResults.map((r) => (
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
                            <td className="p-4 text-muted-foreground">
                              {formatShortDate(r.createdAt)}
                            </td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {promotorResults.map((r) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {r.promotorName}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 border-amber-300 shrink-0"
                        >
                          {r.totalClients} klien
                        </Badge>
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
                      {r.note && (
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
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: Laporan Advertiser ─────────────────────────────────────── */}
        <TabsContent value="advertiser" className="space-y-4 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Rata-rata CPR
                </CardTitle>
                <Target className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">
                  {validCprs.length > 0
                    ? formatRupiah(Math.round(averageCpr))
                    : "-"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cost Per Result rata-rata
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Leads
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-violet-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-violet-700">
                  {reportTotalLeads.toLocaleString("id-ID")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads dari semua iklan
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Amount Spent
                </CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">
                  {formatRupiah(reportTotalAmountSpent)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total biaya iklan yang terpakai
                </p>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          {adReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Belum ada laporan iklan</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Laporan iklan akan tampil setelah advertiser menginput laporan
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
                        {adReports.map((r) => (
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
                {adReports.map((r) => (
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
