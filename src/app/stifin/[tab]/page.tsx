"use client"

import { useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import { DashboardLayout } from "@/components/dashboard-layout"
import StifinDashboard from "@/components/stifin-dashboard"
import { Loader2 } from "lucide-react"

const ROUTE_TO_STIFIN_TAB: Record<string, string> = {
  "semua-pengajuan": "semua",
  "laporan-promotor": "promotor",
  "laporan-advertiser": "advertiser",
  "top-promotor": "top_promotor",
  "gaji-kreator": "gaji_kreator",
  "bonus-advertiser": "bonus_advertiser",
}

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
    </div>
  )
}

export default function StifinTabPage() {
  const { user, loading } = useAuth()
  const params = useParams<{ tab?: string }>()
  const router = useRouter()

  const routeTab = params?.tab || "semua-pengajuan"
  const initialTab = useMemo(
    () => ROUTE_TO_STIFIN_TAB[routeTab] || "semua",
    [routeTab]
  )

  useEffect(() => {
    if (!ROUTE_TO_STIFIN_TAB[routeTab]) {
      router.replace("/stifin/semua-pengajuan")
    }
  }, [routeTab, router])

  useEffect(() => {
    if (!loading && user && user.role !== "STIFIN") {
      router.replace("/")
    }
  }, [loading, user, router])

  if (loading) {
    return <DashboardLoader />
  }

  if (!user) {
    return <LoginForm />
  }

  if (user.role !== "STIFIN") {
    return <DashboardLoader />
  }

  return (
    <DashboardLayout>
      <StifinDashboard initialTab={initialTab} routeBasePath="/stifin" />
    </DashboardLayout>
  )
}

