"use client"

import { useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import { DashboardLayout } from "@/components/dashboard-layout"
import KontenKreatorDashboard from "@/components/konten-kreator-dashboard"
import { Loader2 } from "lucide-react"

const ROUTE_TO_KREATOR_TAB: Record<string, string> = {
  menunggu: "MENUNGGU_KONTEN",
  diproses: "DIPROSES",
  selesai: "SELESAI",
  gaji: "GAJI",
}

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
    </div>
  )
}

export default function KreatorTabPage() {
  const { user, loading } = useAuth()
  const params = useParams<{ tab?: string }>()
  const router = useRouter()

  const routeTab = params?.tab || "menunggu"
  const initialTab = useMemo(
    () => ROUTE_TO_KREATOR_TAB[routeTab] || "MENUNGGU_KONTEN",
    [routeTab]
  )

  useEffect(() => {
    if (!ROUTE_TO_KREATOR_TAB[routeTab]) {
      router.replace("/kreator/menunggu")
    }
  }, [routeTab, router])

  useEffect(() => {
    if (!loading && user && user.role !== "KONTEN_KREATOR") {
      router.replace("/")
    }
  }, [loading, user, router])

  if (loading) return <DashboardLoader />
  if (!user) return <LoginForm />
  if (user.role !== "KONTEN_KREATOR") return <DashboardLoader />

  return (
    <DashboardLayout>
      <KontenKreatorDashboard initialTab={initialTab} routeBasePath="/kreator" />
    </DashboardLayout>
  )
}

