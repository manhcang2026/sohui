"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight, Info, PartyPopper } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { KyBadge } from "@/components/shared/status-badge"
import { DAY_KHUI_HOM_NAY, HUI_VIEN, formatVND } from "@/lib/mock-data"
import type { DayHui } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type DayState = {
  trang_thai: "pending" | "da_chot"
  chan_hot: string
  tien_tham: string
  tien_thao: string
}

export function KhuiHomNayPage() {
  const days = DAY_KHUI_HOM_NAY
  const [currentIdx, setCurrentIdx] = useState(0)
  const [states, setStates] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(
      days.map(d => [d.id, {
        trang_thai: "pending",
        chan_hot: "",
        tien_tham: String(d.menh_gia),
        tien_thao: String(d.tien_thao_mac_dinh),
      }])
    )
  )
  const [showSummary, setShowSummary] = useState(false)

  if (days.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6">Khui hôm nay</h1>
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-status-green-fg mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">Không có dây cần khui hôm nay</p>
          <p className="text-sm text-muted-foreground mt-1">Tất cả các dây đã được xử lý.</p>
        </Card>
      </div>
    )
  }

  const allDone = days.every(d => states[d.id]?.trang_thai === "da_chot")
  const doneCnt = days.filter(d => states[d.id]?.trang_thai === "da_chot").length

  if (showSummary && allDone) {
    return <SummaryView days={days} states={states} onClose={() => setShowSummary(false)} />
  }

  const currentDay = days[currentIdx]
  const st = states[currentDay.id]

  const chanSong = currentDay.chans.filter(c => c.trang_thai === "song" && !c.da_hot)
  const chanHotHv = HUI_VIEN.find(h => h.id === chanSong.find(c => c.id === st.chan_hot)?.hui_vien_id)

  const tienTham = parseFloat(st.tien_tham) || currentDay.menh_gia
  const tienThao = parseFloat(st.tien_thao) || currentDay.tien_thao_mac_dinh
  const soChans = currentDay.so_chan
  const chanSong_count = currentDay.chans.filter(c => c.trang_thai === "song").length
  const chanChet_count = currentDay.chans.filter(c => c.trang_thai === "chet").length

  // Tính tiền người hốt nhận:
  // Tiền hốt = (mệnh giá * số chân sống) - tiền thảo * (số chân sống - số chân đã hốt rồi)
  const da_hot_cnt = currentDay.chans.filter(c => c.da_hot).length
  const tienHot = (tienTham * chanSong_count) - (tienThao * (chanSong_count - da_hot_cnt - 1))

  function updateState(id: string, patch: Partial<DayState>) {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function chotKy() {
    updateState(currentDay.id, { trang_thai: "da_chot" })
    if (currentIdx < days.length - 1) {
      setCurrentIdx(currentIdx + 1)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header + progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Khui hôm nay</h1>
          <span className="text-sm text-muted-foreground font-medium">
            {doneCnt}/{days.length} dây đã chốt
          </span>
        </div>
        <Progress value={(doneCnt / days.length) * 100} className="h-2" />
      </div>

      {/* Day tabs */}
      {days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setCurrentIdx(i)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                i === currentIdx
                  ? "bg-primary text-primary-foreground border-primary"
                  : states[d.id]?.trang_thai === "da_chot"
                  ? "bg-status-green/30 text-status-green-fg border-status-green/40"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {states[d.id]?.trang_thai === "da_chot" && <CheckCircle2 className="w-3 h-3" />}
              {d.ten.split(" ")[1]} {d.ten.split(" ")[2]}
            </button>
          ))}
        </div>
      )}

      {/* Current day card */}
      <Card className="p-4 md:p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{currentDay.ten}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kỳ {currentDay.ky_hien_tai + 1} / {currentDay.tong_ky} •{" "}
              {formatVND(currentDay.menh_gia)}/chân • {soChans} chân
            </p>
          </div>
          <KyBadge status={st.trang_thai === "da_chot" ? "da_chot" : "chua_khui"} />
        </div>

        {st.trang_thai === "da_chot" ? (
          <div className="flex items-center gap-2 py-6 justify-center text-status-green-fg">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Đã chốt kỳ này</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chọn chân hốt */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Chân hốt kỳ này
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {chanSong.map(c => {
                  const hv = HUI_VIEN.find(h => h.id === c.hui_vien_id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => updateState(currentDay.id, { chan_hot: c.id })}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-2 rounded-md text-sm border transition-colors text-left",
                        st.chan_hot === c.id
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-card border-border hover:border-primary/40 text-foreground"
                      )}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{c.vi_tri}</span>
                      <span className="truncate">{hv?.ho_ten}</span>
                    </button>
                  )
                })}
              </div>
              {chanHotHv && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Người hốt: <span className="font-medium text-foreground">{chanHotHv.ho_ten}</span> — {chanHotHv.sdt}
                </p>
              )}
            </div>

            {/* Nhập tiền */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tien-tham" className="text-xs text-muted-foreground mb-1 block">Tiền thăm (mặc định)</Label>
                <Input
                  id="tien-tham"
                  value={st.tien_tham}
                  onChange={e => updateState(currentDay.id, { tien_tham: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
              <div>
                <Label htmlFor="tien-thao" className="text-xs text-muted-foreground mb-1 block">Tiền thảo</Label>
                <Input
                  id="tien-thao"
                  value={st.tien_thao}
                  onChange={e => updateState(currentDay.id, { tien_thao: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
            </div>

            {/* Xem trước */}
            <div className="bg-secondary rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Xem trước tính toán</span>
              </div>
              {[
                [`Mệnh giá × chân sống`, `${formatVND(tienTham)} × ${chanSong_count} = ${formatVND(tienTham * chanSong_count)}`],
                [`Tiền thảo × còn lại`, `${formatVND(tienThao)} × ${chanSong_count - da_hot_cnt - 1} = ${formatVND(tienThao * (chanSong_count - da_hot_cnt - 1))}`],
                [`Chân chết không đóng`, `${chanChet_count} chân`],
                [`→ Người hốt nhận`, formatVND(tienHot)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium ${String(label).startsWith("→") ? "text-primary text-base" : "text-foreground"}`}>{value}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={chotKy}
              disabled={!st.chan_hot}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Chốt kỳ {currentDay.ky_hien_tai + 1}
              <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
            {!st.chan_hot && (
              <p className="text-xs text-center text-muted-foreground">Chọn chân hốt để chốt kỳ</p>
            )}
          </div>
        )}
      </Card>

      {/* Publish summary button */}
      {allDone && (
        <Card className="p-4 border-status-green/40 bg-status-green/5">
          <div className="flex items-center gap-3">
            <PartyPopper className="w-5 h-5 text-status-green-fg" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Tất cả dây đã chốt!</p>
              <p className="text-xs text-muted-foreground">Có thể phát hành phiếu tổng hợp.</p>
            </div>
            <Button
              onClick={() => setShowSummary(true)}
              className="bg-status-green-fg text-white hover:bg-status-green-fg/90"
              size="sm"
            >
              Phát hành phiếu
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function SummaryView({ days, states, onClose }: {
  days: DayHui[]
  states: Record<string, DayState>
  onClose: () => void
}) {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Phiếu tổng hợp hôm nay</h1>
        <Button variant="outline" size="sm" onClick={onClose}>Quay lại</Button>
      </div>
      <Card className="p-4 divide-y divide-border">
        {days.map(d => {
          const st = states[d.id]
          const chanHotChan = d.chans.find(c => c.id === st.chan_hot)
          const hv = HUI_VIEN.find(h => h.id === chanHotChan?.hui_vien_id)
          const tienHot = parseFloat(st.tien_tham) * d.chans.filter(c=>c.trang_thai==="song").length
            - parseFloat(st.tien_thao) * (d.chans.filter(c=>c.trang_thai==="song").length - d.chans.filter(c=>c.da_hot).length - 1)
          return (
            <div key={d.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{d.ten}</p>
                <p className="text-xs text-muted-foreground">
                  Kỳ {d.ky_hien_tai + 1} • Người hốt: {hv?.ho_ten ?? "—"}
                </p>
              </div>
              <p className="text-base font-bold text-primary">{formatVND(tienHot)}</p>
            </div>
          )
        })}
      </Card>
      <p className="text-xs text-muted-foreground text-center">
        Phiếu đã được ghi nhận. Chuyển sang trang Phiếu thu–chi để gửi Zalo.
      </p>
    </div>
  )
}
