"use client"

import { useState } from "react"
import { ArrowLeft, Calendar, Users, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { KyBadge, ChanBadge } from "@/components/shared/status-badge"
import { DAY_HUI, HUI_VIEN, formatVND } from "@/lib/mock-data"
import type { DayHui } from "@/lib/mock-data"

export function DayHuiPage() {
  const [selected, setSelected] = useState<DayHui | null>(null)
  if (selected) return <DayDetail day={selected} onBack={() => setSelected(null)} />
  return <DayList onSelect={setSelected} />
}

function DayList({ onSelect }: { onSelect: (d: DayHui) => void }) {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dây hụi</h1>
        <span className="text-sm text-muted-foreground">{DAY_HUI.length} dây</span>
      </div>

      <div className="space-y-3">
        {DAY_HUI.map(d => {
          const pct = Math.round((d.ky_hien_tai / d.tong_ky) * 100)
          const chanSong = d.chans.filter(c => c.trang_thai === "song").length
          const chanChet = d.chans.filter(c => c.trang_thai === "chet").length
          return (
            <Card
              key={d.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelect(d)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-foreground truncate">{d.ten}</h2>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {d.chu_ky === "tuan" ? "Tuần" : "Tháng"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mb-3">
                    <span>{formatVND(d.menh_gia)}/chân</span>
                    <span>Thảo: {formatVND(d.tien_thao_mac_dinh)}</span>
                    <span>Kỳ tiếp: {d.ngay_ky_tiep}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground w-14 text-right">
                      Kỳ {d.ky_hien_tai}/{d.tong_ky}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-status-green-fg font-medium">{chanSong} chân sống</span>
                    {chanChet > 0 && <span className="text-status-red-fg">{chanChet} chân chết</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function DayDetail({ day, onBack }: { day: DayHui; onBack: () => void }) {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{day.ten}</h1>
          <p className="text-xs text-muted-foreground">
            {formatVND(day.menh_gia)}/chân • {day.so_chan} chân • Kỳ tiếp: {day.ngay_ky_tiep}
          </p>
        </div>
      </div>

      <Tabs defaultValue="tongquan">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="tongquan" className="text-xs">Tổng quan</TabsTrigger>
          <TabsTrigger value="chan" className="text-xs">Chân hụi</TabsTrigger>
          <TabsTrigger value="lich" className="text-xs">Lịch kỳ</TabsTrigger>
          <TabsTrigger value="lichsu" className="text-xs">Lịch sử</TabsTrigger>
        </TabsList>

        {/* Tổng quan */}
        <TabsContent value="tongquan" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Tiến độ", value: `${day.ky_hien_tai}/${day.tong_ky} kỳ` },
              { label: "Mệnh giá", value: formatVND(day.menh_gia) },
              { label: "Tiền thảo", value: formatVND(day.tien_thao_mac_dinh) },
              { label: "Chu kỳ", value: day.chu_ky === "tuan" ? "Hàng tuần" : "Hàng tháng" },
            ].map(i => (
              <Card key={i.label} className="p-3">
                <p className="text-xs text-muted-foreground">{i.label}</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{i.value}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Tiến độ khui</span>
              <span className="text-sm text-muted-foreground">{Math.round(day.ky_hien_tai/day.tong_ky*100)}%</span>
            </div>
            <Progress value={day.ky_hien_tai/day.tong_ky*100} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>Kỳ 1</span>
              <span>Kỳ {day.tong_ky}</span>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { v: day.chans.filter(c=>c.trang_thai==="song").length, l: "Chân sống", c: "text-status-green-fg" },
              { v: day.chans.filter(c=>c.trang_thai==="chet").length, l: "Chân chết", c: "text-status-red-fg" },
              { v: day.chans.filter(c=>c.da_hot).length, l: "Đã hốt", c: "text-primary" },
            ].map(i => (
              <Card key={i.l} className="p-3">
                <p className={`text-2xl font-bold ${i.c}`}>{i.v}</p>
                <p className="text-xs text-muted-foreground">{i.l}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Chân hụi */}
        <TabsContent value="chan" className="mt-3">
          <Card className="overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["#", "Hụi viên", "SĐT", "Trạng thái", "Đã hốt", "Kỳ hốt"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {day.chans.map(c => {
                    const hv = HUI_VIEN.find(h => h.id === c.hui_vien_id)
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.vi_tri}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{hv?.ho_ten}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{hv?.sdt}</td>
                        <td className="px-4 py-2.5"><ChanBadge alive={c.trang_thai === "song"} /></td>
                        <td className="px-4 py-2.5">
                          {c.da_hot
                            ? <span className="text-status-green-fg font-medium">Đã hốt</span>
                            : <span className="text-muted-foreground">Chưa</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.ky_hot ? `Kỳ ${c.ky_hot}` : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {day.chans.map(c => {
                const hv = HUI_VIEN.find(h => h.id === c.hui_vien_id)
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-5">{c.vi_tri}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{hv?.ho_ten}</p>
                        <p className="text-xs text-muted-foreground">{hv?.sdt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.da_hot && <span className="text-xs text-status-green-fg">Kỳ {c.ky_hot}</span>}
                      <ChanBadge alive={c.trang_thai === "song"} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Lịch kỳ */}
        <TabsContent value="lich" className="mt-3">
          <Card className="overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Kỳ", "Ngày", "Người hốt", "Tiền hốt", "Trạng thái"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {day.ky_list.map(k => (
                    <tr key={k.so_ky} className={`transition-colors ${k.trang_thai === "da_chot" ? "hover:bg-muted/30" : "opacity-60 hover:bg-muted/20"}`}>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-foreground">{k.so_ky}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k.ngay}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{k.hui_vien_hot ?? "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-primary">{k.hui_vien_hot ? formatVND(k.tien_hot) : "—"}</td>
                      <td className="px-4 py-2.5"><KyBadge status={k.trang_thai} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-border">
              {day.ky_list.map(k => (
                <div key={k.so_ky} className={`px-4 py-3 flex items-center justify-between ${k.trang_thai !== "da_chot" ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Kỳ {k.so_ky}</p>
                      <p className="text-xs text-muted-foreground">{k.ngay} • {k.hui_vien_hot ?? "Chưa có người hốt"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {k.hui_vien_hot && <p className="text-sm font-medium text-primary">{formatVND(k.tien_hot)}</p>}
                    <KyBadge status={k.trang_thai} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Lịch sử khui */}
        <TabsContent value="lichsu" className="mt-3">
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {day.ky_list.filter(k => k.trang_thai === "da_chot").reverse().map(k => (
                <div key={k.so_ky} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Kỳ {k.so_ky} — {k.hui_vien_hot}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ngày {k.ngay} • Mệnh giá: {formatVND(k.tien_tham)} • Thảo: {formatVND(k.tien_thao)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-primary">{formatVND(k.tien_hot)}</p>
                      <KyBadge status="da_chot" />
                    </div>
                  </div>
                </div>
              ))}
              {day.ky_list.filter(k => k.trang_thai === "da_chot").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có kỳ nào được chốt.</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
