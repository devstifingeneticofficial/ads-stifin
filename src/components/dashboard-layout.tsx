"use client"

import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Building2,
  LogOut,
  Bell,
  Megaphone,
  Palette,
  Target,
  Shield,
  Menu,
  X,
  User as UserIcon,
  Users,
  AlertTriangle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: Building2 },
]

const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
  PROMOTOR: { label: "Promotor", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Megaphone },
  KONTEN_KREATOR: { label: "Konten Kreator", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Palette },
  ADVERTISER: { label: "Advertiser", color: "bg-purple-100 text-purple-800 border-purple-300", icon: Target },
  STIFIN: { label: "STIFIn Admin", color: "bg-rose-100 text-rose-800 border-rose-300", icon: Shield },
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, refreshSession } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<string[]>([])

  // Profile Edit State
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [editName, setEditName] = useState(user?.name || "")
  const [editEmail, setEditEmail] = useState(user?.email || "")
  const [editPhone, setEditPhone] = useState(user?.phone || "")
  const [editCity, setEditCity] = useState(user?.city || "")
  const [isUpdating, setIsUpdating] = useState(false)
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setEditName(user.name)
      setEditEmail(user.email)
      setEditPhone((user as any).phone || "")
      setEditCity((user as any).city || "")
    }
  }, [user])

  useEffect(() => {
    if (profileDialogOpen && user) {
      setEditName(user.name)
      setEditEmail(user.email)
      setEditPhone((user as any).phone || "")
      setEditCity((user as any).city || "")
    }
  }, [profileDialogOpen, user])

  useEffect(() => {
    const shouldForcePasswordChange =
      !!user &&
      (user.role === "KONTEN_KREATOR" || user.role === "STIFIN") &&
      (user as any).mustChangePassword === true
    setChangePasswordDialogOpen(shouldForcePasswordChange)
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    try {
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone, city: editCity }),
      })

      if (!res.ok) throw new Error("Gagal memperbarui profil")
      
      toast.success("Profil berhasil diperbarui!")
      setProfileDialogOpen(false)
      if (refreshSession) await refreshSession()
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan profil")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter")
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Konfirmasi password tidak sama")
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengganti password")

      toast.success("Password berhasil diperbarui")
      setNewPassword("")
      setConfirmNewPassword("")
      setChangePasswordDialogOpen(false)
      if (refreshSession) await refreshSession()
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengganti password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        const res = await fetch("/api/notifications")
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      } catch {
        // silent fail
      }
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user) return

    const loadAnnouncements = async () => {
      try {
        const res = await fetch("/api/announcements")
        if (!res.ok) return
        const data = await res.json()
        setAnnouncements(data.announcements || [])
      } catch {
        // silent fail
      }
    }

    loadAnnouncements()
    const interval = setInterval(loadAnnouncements, 30000)
    return () => clearInterval(interval)
  }, [user])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" })
      fetchNotifications()
    } catch {
      // silent fail
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" })
      fetchNotifications()
    } catch {
      // silent fail
    }
  }

  if (!user) return null

  const config = roleConfig[user.role] || roleConfig.PROMOTOR
  const RoleIcon = config.icon

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 text-sm truncate">STIFIn</h2>
            <p className="text-xs text-slate-500 truncate">Manajemen Iklan</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-rose-50 text-rose-700 font-medium text-sm"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-slate-100">
          <button 
            onClick={() => setProfileDialogOpen(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-sm font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                {config.label}
              </Badge>
            </div>
          </button>
        </div>
      </aside>

      {/* Profile Edit Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleUpdateProfile}>
            <DialogHeader>
              <DialogTitle>Edit Profil</DialogTitle>
              <DialogDescription>
                Perbarui data profil Anda.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Nomor WhatsApp</Label>
                <Input
                  id="phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Contoh: 08123456789"
                />
                <p className="text-[10px] text-muted-foreground">
                  Gunakan format angka saja (contoh: 08123456789)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Kota Asal</Label>
                <Input
                  id="city"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Contoh: Bandung"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setProfileDialogOpen(false)}
                disabled={isUpdating}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <Dialog
          open={changePasswordDialogOpen}
          onOpenChange={(open) => {
            const shouldForcePasswordChange =
              !!user &&
              (user.role === "KONTEN_KREATOR" || user.role === "STIFIN") &&
              (user as any).mustChangePassword === true
            if (!shouldForcePasswordChange) setChangePasswordDialogOpen(open)
          }}
        >
          <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
            <form onSubmit={handleForcePasswordChange}>
              <DialogHeader>
                <DialogTitle>Ganti Password Pertama Kali</DialogTitle>
                <DialogDescription>
                  Demi keamanan akun, Anda wajib mengganti password sebelum melanjutkan.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Password Baru</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmNewPassword">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? "Menyimpan..." : "Simpan Password Baru"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <RoleIcon className="w-4 h-4 text-slate-500" />
              <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">
                Dashboard {config.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="p-2 hover:bg-slate-100 rounded-lg relative"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotif && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                  <Card className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 z-50 sm:w-80 shadow-xl border-slate-200">
                    <CardContent className="p-0">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900">Notifikasi</h3>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
                            >
                              Tandai semua dibaca
                            </button>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {unreadCount} baru
                          </Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-72">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-400">
                            Belum ada notifikasi
                          </div>
                        ) : (
                          notifications.slice(0, 20).map((notif: any) => (
                            <div
                              key={notif.id}
                              className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                                !notif.read ? "bg-rose-50/50" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {!notif.read && (
                                  <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(notif.createdAt).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  {!notif.read && (
                                    <button
                                      onClick={() => markAsRead(notif.id)}
                                      className="text-[10px] text-rose-600 hover:text-rose-700 font-medium mt-1"
                                    >
                                      Tandai dibaca
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-600 hover:text-rose-600"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {announcements
              .slice()
              .sort((a, b) => {
                const rank = (p: string) => (p === "pinned" ? 3 : p === "high" ? 2 : 1)
                const diff = rank(b.priority) - rank(a.priority)
                if (diff !== 0) return diff
                return +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0)
              })
              .filter((item) => !dismissedAnnouncementIds.includes(item.id))
              .map((item) => (
                <Card
                  key={item.id}
                  className={`mb-4 border-l-4 shadow-none ${
                    item.variant === "warning"
                      ? "border-l-amber-500 border-amber-200 bg-amber-50"
                      : item.variant === "danger"
                        ? "border-l-rose-500 border-rose-200 bg-rose-50"
                        : item.variant === "success"
                          ? "border-l-emerald-500 border-emerald-200 bg-emerald-50"
                          : "border-l-blue-500 border-blue-200 bg-blue-50"
                  }`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-slate-700" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{item.message}</p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setDismissedAnnouncementIds((prev) => [...prev, item.id])
                        }
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Tutup
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-4 lg:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-400">
            <span>© 2025 STIFIn - Tes Minat & Bakat Genetik</span>
            <span className="hidden sm:inline">v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
