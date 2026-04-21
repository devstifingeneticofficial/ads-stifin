"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import { DashboardLayout } from "@/components/dashboard-layout"
import AdvertiserDashboard from "@/components/advertiser-dashboard"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"

const ROUTE_TO_ADVERTISER_TAB: Record<string, string> = {
  overview: "overview",
  "master-brief": "master",
  "meta-ads": "meta_ads",
  "notifikasi-wa": "whatsapp",
  "alert-center": "alerts",
  "pencairan-kreator": "payouts",
  "bonus-advertiser": "bonus_payouts",
  promotor: "promotors",
  user: "users",
}

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
    </div>
  )
}

export default function AdvertiserTabPage() {
  const { user, loading } = useAuth()
  const params = useParams<{ tab?: string }>()
  const router = useRouter()

  const routeTab = params?.tab || "overview"
  const initialTab = useMemo(
    () => ROUTE_TO_ADVERTISER_TAB[routeTab] || "overview",
    [routeTab]
  )

  useEffect(() => {
    if (!ROUTE_TO_ADVERTISER_TAB[routeTab]) {
      router.replace("/advertiser/overview")
    }
  }, [routeTab, router])

  useEffect(() => {
    if (!loading && user && user.role !== "ADVERTISER") {
      router.replace("/")
    }
  }, [loading, user, router])

  if (loading) {
    return <DashboardLoader />
  }

  if (!user) {
    return <LoginForm />
  }

  if (user.role !== "ADVERTISER") {
    return <DashboardLoader />
  }

  return (
    <DashboardLayout>
      <AdvertiserDashboard initialTab={initialTab} routeBasePath="/advertiser" />
    </DashboardLayout>
  )
}
