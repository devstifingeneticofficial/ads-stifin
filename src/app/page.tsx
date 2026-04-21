"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    if (user.role === "PROMOTOR") router.replace("/promotor/pengajuan-iklan")
    if (user.role === "KONTEN_KREATOR") router.replace("/kreator/menunggu")
    if (user.role === "ADVERTISER") router.replace("/advertiser/overview")
    if (user.role === "STIFIN") router.replace("/stifin/semua-pengajuan")
  }, [loading, user, router])

  if (loading) return <FullPageLoader />
  if (!user) return <LoginForm />

  return <FullPageLoader />
}

