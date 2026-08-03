"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Layers,
  Users,
  FileText,
  Flame,
  Menu,
  X,
  BookOpen,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export type Page = "tongguan" | "khui" | "day" | "huivien" | "phieu"

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "tongguan", label: "Tổng quan",     icon: LayoutDashboard },
  { id: "khui",     label: "Khui hôm nay",  icon: Flame },
  { id: "day",      label: "Dây hụi",       icon: Layers },
  { id: "huivien",  label: "Hụi viên",      icon: Users },
  { id: "phieu",    label: "Phiếu thu–chi", icon: FileText },
]

interface Props {
  page: Page
  onNavigate: (p: Page) => void
  children: React.ReactNode
}

export function AppShell({ page, onNavigate, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.assign("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar – desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-sidebar text-sidebar-foreground shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-md bg-primary-foreground/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-sidebar-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Sổ Hụi
          </span>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
                page === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
            <LogOut className="size-4" />
            Đăng xuất
          </button>
          <p className="px-3 pt-1 text-xs text-sidebar-foreground/40">v1.0 • Sổ Hụi</p>
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col md:hidden transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sidebar-foreground" />
            <span className="text-base font-semibold">Sổ Hụi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent/60 h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-3 rounded-md text-sm font-medium transition-colors text-left",
                page === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">Sổ Hụi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex bg-card border-t border-border shrink-0">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
                page === item.id
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight text-center">
                {item.id === "tongguan" ? "T.quan" :
                 item.id === "khui" ? "Khui" :
                 item.id === "day" ? "Dây hụi" :
                 item.id === "huivien" ? "H.viên" : "Phiếu"}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
