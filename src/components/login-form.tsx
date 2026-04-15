"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Building2, Eye, EyeOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const demoAccounts = [
  { email: "roy@stifin.com", role: "PROMOTOR", name: "Roy" },
  { email: "sari@stifin.com", role: "PROMOTOR", name: "Sari" },
  { email: "creator@stifin.com", role: "KONTEN KREATOR", name: "Admin Creator" },
  { email: "ads@stifin.com", role: "ADVERTISER", name: "Admin Ads" },
  { email: "admin@stifin.com", role: "STIFIN", name: "STIFIn Admin" },
]

const roleColors: Record<string, string> = {
  PROMOTOR: "bg-amber-100 text-amber-800 border-amber-200",
  "KONTEN KREATOR": "bg-emerald-100 text-emerald-800 border-emerald-200",
  ADVERTISER: "bg-purple-100 text-purple-800 border-purple-200",
  STIFIN: "bg-rose-100 text-rose-800 border-rose-200",
}

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerCity, setRegisterCity] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")
  const [registerLoading, setRegisterLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || "Login gagal")
    }
  }

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword("password123")
    setError("")

    const result = await login(demoEmail, "password123")
    if (!result.success) {
      setError(result.error || "Login gagal")
    }
  }

  const resetRegisterForm = () => {
    setRegisterName("")
    setRegisterEmail("")
    setRegisterPhone("")
    setRegisterCity("")
    setRegisterPassword("")
    setRegisterPasswordConfirm("")
  }

  const handleRegisterPromotor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (registerPassword !== registerPasswordConfirm) {
      toast.error("Konfirmasi password tidak sama")
      return
    }

    setRegisterLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          role: "PROMOTOR",
          city: registerCity,
          phone: registerPhone,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Pendaftaran gagal")
        return
      }

      setEmail(registerEmail)
      setPassword(registerPassword)
      toast.success("Pendaftaran promotor berhasil. Silakan klik Masuk.")
      setRegisterOpen(false)
      resetRegisterForm()
    } catch {
      toast.error("Terjadi kesalahan saat mendaftar")
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-200">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">STIFIn</h1>
          <p className="text-slate-500">Sistem Manajemen Iklan & Promotor</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Masuk ke Dashboard</CardTitle>
            <CardDescription>Masukkan email dan password untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@stifin.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full">
                Masuk
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setRegisterOpen(true)}
              >
                Daftar Promotor
              </Button>
            </form>
          </CardContent>
        </Card>

        <Dialog
          open={registerOpen}
          onOpenChange={(open) => {
            setRegisterOpen(open)
            if (!open) resetRegisterForm()
          }}
        >
          <DialogContent className="sm:max-w-[440px]">
            <form onSubmit={handleRegisterPromotor} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Daftar Akun Promotor</DialogTitle>
                <DialogDescription>
                  Isi data berikut untuk membuat akun promotor baru.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="registerName">Nama Lengkap</Label>
                <Input
                  id="registerName"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerEmail">Email</Label>
                <Input
                  id="registerEmail"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPhone">Nomor WhatsApp</Label>
                <Input
                  id="registerPhone"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value)}
                  placeholder="08123456789"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerCity">Kota Asal</Label>
                <Input
                  id="registerCity"
                  value={registerCity}
                  onChange={(e) => setRegisterCity(e.target.value)}
                  placeholder="Contoh: Bandung"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPassword">Password</Label>
                <Input
                  id="registerPassword"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPasswordConfirm">Konfirmasi Password</Label>
                <Input
                  id="registerPasswordConfirm"
                  type="password"
                  value={registerPasswordConfirm}
                  onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                  placeholder="Ulangi password"
                  minLength={6}
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegisterOpen(false)}
                  disabled={registerLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={registerLoading}>
                  {registerLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mendaftar...
                    </>
                  ) : (
                    "Daftarkan Akun"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Demo Accounts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Demo Accounts</CardTitle>
            <CardDescription className="text-xs">Klik untuk login otomatis (password: password123)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleDemoLogin(account.email)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded-md text-xs font-semibold border ${roleColors[account.role] || "bg-slate-100 text-slate-700"}`}>
                      {account.role}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{account.name}</div>
                      <div className="text-xs text-slate-500">{account.email}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          © 2025 STIFIn - Tes Minat & Bakat Genetik
        </p>
      </div>
    </div>
  )
}
