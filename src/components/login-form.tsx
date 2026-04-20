"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"


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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
            <Image
              src="/logo-stifin.jpg"
              alt="Logo STIFIn"
              width={64}
              height={64}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">STIFIn Ads</h1>
          <p className="text-slate-500">Sistem Manajemen Iklan Promotor STIFIn</p>
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

        <p className="text-center text-xs text-slate-400">
          © 2025 STIFIn - Tes Minat & Bakat Genetik
        </p>
      </div>
    </div>
  )
}
