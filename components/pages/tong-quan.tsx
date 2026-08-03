"use client"

import {
  Users, Layers, Flame, FileText,
  CheckCircle2, AlertCircle, Clock, ChevronRight,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DAY_HUI, HUI_VIEN, PHIEU_LIST, DAY_KHUI_HOM_NAY,
  formatVND, getHuiVien,
} from "@/lib/mock-data"
import type { Page } from "@/components/app-shell"

interface Props { onNavigate: (p: Page) => void }

export function TongQuanPage({ onNavigate }: Props) {
  const dayHoatDong = DAY_HUI.filter(d => d.trang_thai === "hoat_dong")
  const chuaHoanTat = PHIEU_LIST.filter(p => p.trang_thai !== "du")
  const tongTienChua = chuaHoanTat.reduce((s, p) => s + (p.tong_tien - p.da_thanh_toan), 0)

  const viecCanLam = [
    ...DAY_KHUI_HOM_NAY.map(d => ({
      icon: Flame,
      iconCls: "text-orange-500",
      text: `Khui kỳ ${d.ky_hien_tai} — ${d.ten}`,
      action: () => onNavigate("khui"),
      urgent: true,
    })),
    ...PHIEU_LIST.filter(p => p.trang_thai === "chua").map(p => {
      const hv = getHuiVien(p.hui_vien_id)
      return {
        icon: AlertCircle,
        iconCls: "text-status-red-fg",
        text: `Thu ${formatVND(p.tong_tien)} từ ${hv?.ho_ten}`,
        action: () => onNavigate("phieu"),
        urgent: false,
      }
    }),
    ...PHIEU_LIST.filter(p => p.trang_thai === "mot_phan").map(p => {
      const hv = getHuiVien(p.hui_vien_id)
      return {
        icon: Clock,
        iconCls: "text-status-yellow-fg",
        text: `Còn thiếu ${formatVND(p.tong_tien - p.da_thanh_toan)} từ ${hv?.ho_ten}`,
        action: () => onNavigate("phieu"),
        urgent: false,
      }
    }),
  ]

  const stats = [
    {
      label: "Hụi viên",
      value: HUI_VIEN.length,
      icon: Users,
      sub: `${HUI_VIEN.reduce((s,h) => s + h.chan_song, 0)} chân đang sống`,
      onClick: () => onNavigate("huivien"),
    },
    {
      label: "Dây hoạt động",
      value: dayHoatDong.length,
      icon: Layers,
      sub: `${DAY_HUI.reduce((s,d) => s + d.so_chan, 0)} chân tổng cộng`,
      onClick: () => onNavigate("day"),
    },
    {
      label: "Khui hôm nay",
      value: DAY_KHUI_HOM_NAY.length,
      icon: Flame,
      sub: DAY_KHUI_HOM_NAY.length > 0 ? "Cần xử lý ngay!" : "Không có dây cần khui",
      urgent: DAY_KHUI_HOM_NAY.length > 0,
      onClick: () => onNavigate("khui"),
    },
    {
      label: "Phiếu chưa hoàn tất",
      value: chuaHoanTat.length,
      icon: FileText,
      sub: `Còn lại ${formatVND(tongTienChua)}`,
      urgent: chuaHoanTat.length > 0,
      onClick: () => onNavigate("phieu"),
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Tổng quan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ngày 03/08/2026</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="text-left"
          >
            <Card className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${s.urgent ? "border-status-red/40 bg-status-red/5" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.urgent ? "text-destructive" : "text-primary"}`}>
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.sub}</p>
                </div>
                <div className={`p-2 rounded-lg ${s.urgent ? "bg-status-red/15" : "bg-secondary"}`}>
                  <s.icon className={`w-5 h-5 ${s.urgent ? "text-destructive" : "text-primary"}`} />
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Việc cần làm */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Việc cần làm hôm nay</h2>
            <span className="text-xs text-muted-foreground">{viecCanLam.length} mục</span>
          </div>
          {viecCanLam.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-status-green-fg" />
              Không có việc cần làm hôm nay.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {viecCanLam.map((v, i) => (
                <li key={i}>
                  <button
                    onClick={v.action}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left group"
                  >
                    <v.icon className={`w-4 h-4 shrink-0 ${v.iconCls}`} />
                    <span className="text-sm text-foreground flex-1 leading-snug">{v.text}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Tiến độ các dây */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Tiến độ dây hụi</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onNavigate("day")}
            >
              Xem tất cả
            </Button>
          </div>
          <div className="space-y-3">
            {DAY_HUI.filter(d => d.trang_thai === "hoat_dong").map((d) => {
              const pct = Math.round((d.ky_hien_tai / d.tong_ky) * 100)
              return (
                <button
                  key={d.id}
                  onClick={() => onNavigate("day")}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[70%]">
                      {d.ten}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Kỳ {d.ky_hien_tai}/{d.tong_ky}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatVND(d.menh_gia)}/chân • Kỳ tiếp: {d.ngay_ky_tiep}
                  </p>
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Tóm tắt tài chính */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tóm tắt tài chính</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Tổng mệnh giá/tháng", value: formatVND(DAY_HUI.filter(d=>d.trang_thai==="hoat_dong").reduce((s,d)=>s+d.menh_gia*d.so_chan,0)), cls: "text-foreground" },
            { label: "Còn phải thu", value: formatVND(tongTienChua), cls: "text-destructive" },
            { label: "Phiếu đã hoàn tất", value: PHIEU_LIST.filter(p=>p.trang_thai==="du").length + " phiếu", cls: "text-status-green-fg" },
            { label: "Phiếu chưa xong", value: chuaHoanTat.length + " phiếu", cls: "text-status-yellow-fg" },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-base font-semibold mt-0.5 ${item.cls}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
