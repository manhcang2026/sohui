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
  Settings,
  Scale,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export type Page =
  | "tongguan"
  | "khui"
  | "day"
  | "huivien"
  | "phieu"
  | "candoi"
  | "caidat"

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "tongguan", label: "Tổng quan", icon: LayoutDashboard },
  { id: "khui", label: "Khui hôm nay", icon: Flame },
  { id: "day", label: "Dây hụi", icon: Layers },
  { id: "huivien", label: "Hụi viên", icon: Users },
  { id: "phieu", label: "Phiếu thu–chi", icon: FileText },
  { id: "candoi", label: "Cân đối tiền", icon: Scale },
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

  function navigate(target: Page) {
    onNavigate(target)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-foreground/10">
            <BookOpen className="h-4 w-4 text-sidebar-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Sổ Hụi
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <NavButton
            item={{ id: "caidat", label: "Cài đặt", icon: Settings }}
            active={page === "caidat"}
            onClick={() => navigate("caidat")}
          />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
          <p className="px-3 pt-1 text-xs text-sidebar-foreground/40">
            v1.0 • Sổ Hụi
          </p>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sidebar-foreground" />
            <span className="text-base font-semibold">Sổ Hụi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => navigate(item.id)}
              mobile
            />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <NavButton
            item={{ id: "caidat", label: "Cài đặt", icon: Settings }}
            active={page === "caidat"}
            onClick={() => navigate("caidat")}
            mobile
          />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between bg-primary px-4 py-3 text-primary-foreground md:hidden">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <span className="font-semibold">Sổ Hụi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>

        <nav className="flex shrink-0 border-t border-border bg-card md:hidden">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
                page === item.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-center text-[10px] leading-tight">
                {item.id === "tongguan"
                  ? "T.quan"
                  : item.id === "khui"
                    ? "Khui"
                    : item.id === "day"
                      ? "Dây hụi"
                      : item.id === "huivien"
                        ? "H.viên"
                        : "Phiếu"}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

function NavButton({
  item,
  active,
  onClick,
  mobile = false,
}: {
  item: { id: Page; label: string; icon: React.ElementType }
  active: boolean
  onClick: () => void
  mobile?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium transition-colors",
        mobile ? "py-3" : "py-2.5",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </button>
  )
}
