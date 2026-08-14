"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Layers,
  Users,
  FileText,
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

const NAV_ITEMS: {
  id: Page
  label: string
  shortLabel: string
  icon: React.ElementType
}[] = [
  {
    id: "tongguan",
    label: "Hôm nay",
    shortLabel: "Hôm nay",
    icon: LayoutDashboard,
  },
  {
    id: "day",
    label: "Dây hụi",
    shortLabel: "Dây hụi",
    icon: Layers,
  },
  {
    id: "huivien",
    label: "Hụi viên",
    shortLabel: "H.viên",
    icon: Users,
  },
  {
    id: "phieu",
    label: "Phiếu",
    shortLabel: "Phiếu",
    icon: FileText,
  },
  {
    id: "candoi",
    label: "Cân đối",
    shortLabel: "Cân đối",
    icon: Scale,
  },
]

interface Props {
  page: Page
  onNavigate: (p: Page) => void
  children: React.ReactNode
}

export function AppShell({
  page,
  onNavigate,
  children,
}: Props) {
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex xl:w-64">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
            <BookOpen className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              Sổ Hụi
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Sổ tiền hằng ngày
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <NavButton
            item={{
              id: "caidat",
              label: "Cài đặt",
              shortLabel: "Cài đặt",
              icon: Settings,
            }}
            active={page === "caidat"}
            onClick={() => navigate("caidat")}
          />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>

          <p className="px-3 pt-1 text-xs text-muted-foreground">
            v1.0 • Sổ Hụi
          </p>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile slide menu */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:hidden",
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold">
              Sổ Hụi
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent"
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
            item={{
              id: "caidat",
              label: "Cài đặt",
              shortLabel: "Cài đặt",
              icon: Settings,
            }}
            active={page === "caidat"}
            onClick={() => navigate("caidat")}
            mobile
          />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 text-foreground md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="truncate font-bold">
              Sổ Hụi
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-foreground hover:bg-accent"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto bg-background pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_oklch(0.23_0.035_258_/_0.06)] backdrop-blur md:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                page === item.id
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />

              <span className="w-full truncate text-center text-[10px] leading-tight">
                {item.shortLabel}
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
  item: {
    id: Page
    label: string
    shortLabel?: string
    icon: React.ElementType
  }
  active: boolean
  onClick: () => void
  mobile?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        mobile ? "py-3" : "py-2.5",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-card)]"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}
