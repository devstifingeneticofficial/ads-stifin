"use client"

import { useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import { DashboardLayout } from "@/components/dashboard-layout"
import PromotorDashboard from "@/components/promotor-dashboard"
import { Loader2 } from "lucide-react"

const ROUTE_TO_PROMOTOR_TAB: Record<string, string> = {
  "pengajuan-iklan": "pengajuan",
  "riwayat-iklan": "riwayat",
  "data-iklan-global": "data-iklan",
  "top-promotor": "top-promotor",
}

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
    </div>
  )
}

export default function PromotorTabPage() {
  const { user, loading } = useAuth()
  const params = useParams<{ tab?: string }>()
  const router = useRouter()

  const routeTab = params?.tab || "pengajuan-iklan"
  const initialTab = useMemo(
    () => ROUTE_TO_PROMOTOR_TAB[routeTab] || "pengajuan",
    [routeTab]
  )

  useEffect(() => {
    if (!ROUTE_TO_PROMOTOR_TAB[routeTab]) {
      router.replace("/promotor/pengajuan-iklan")
    }
  }, [routeTab, router])

  useEffect(() => {
    if (!loading && user && user.role !== "PROMOTOR") {
      router.replace("/")
    }
  }, [loading, user, router])

  if (loading) return <DashboardLoader />
  if (!user) return <LoginForm />
  if (user.role !== "PROMOTOR") return <DashboardLoader />

  return (
    <DashboardLayout>
      <PromotorDashboard initialTab={initialTab} routeBasePath="/promotor" />
    </DashboardLayout>
  )
}

