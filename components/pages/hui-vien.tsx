"use client"

import { useState } from "react"
import { ArrowLeft, Phone, ChevronRight, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChanBadge, StatusBadge } from "@/components/shared/status-badge"
import { HUI_VIEN, DAY_HUI, PHIEU_LIST, formatVND } from "@/lib/mock-data"
import type { HuiVien } from "@/lib/mock-data"

export function HuiVienPage() {
  const [selected, setSelected] = useState<HuiVien | null>(null)
  if (selected) return <HuiVienDetail hv={selected} onBack={() => setSelected(null)} />
  return <HuiVienList onSelect={setSelected} />
}

function HuiVienList({ onSelect }: { onSelect: (h: HuiVien) => void }) {
  const [q, setQ] = useState("")
  const list = HUI_VIEN.filter(h =>
    h.ho_ten.toLowerCase().includes(q.toLowerCase()) ||
    h.sdt.includes(q)
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Hụi viên</h1>
        <span className="text-sm text-muted-foreground">{HUI_VIEN.length} người</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên hoặc SĐT..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Họ tên", "SĐT", "Số chân", "Chân sống", "Chân chết", "Nợ"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map(h => (
              <tr
                key={h.id}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onSelect(h)}
              >
                <td className="px-4 py-3 font-medium text-foreground">{h.ho_ten}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.sdt}</td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">{h.so_chan}</td>
                <td className="px-4 py-3 text-center text-status-green-fg font-medium">{h.chan_song}</td>
                <td className="px-4 py-3 text-center text-status-red-fg font-medium">{h.chan_chet}</td>
                <td className="px-4 py-3">
                  {h.tong_tien_no > 0
                    ? <span className="text-destructive font-medium">{formatVND(h.tong_tien_no)}</span>
                    : <span className="text-status-green-fg text-xs">Không nợ</span>}
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {list.map(h => (
          <Card
            key={h.id}
            className="p-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelect(h)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {h.ho_ten.split(" ").pop()?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{h.ho_ten}</p>
                  <p className="text-xs text-muted-foreground">{h.sdt}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{h.so_chan} chân</p>
                <div className="flex gap-1.5 mt-0.5 justify-end">
                  <span className="text-xs text-status-green-fg">{h.chan_song} sống</span>
                  {h.chan_chet > 0 && <span className="text-xs text-status-red-fg">{h.chan_chet} chết</span>}
                </div>
              </div>
            </div>
            {h.tong_tien_no > 0 && (
              <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground">Còn nợ:</span>
                <span className="text-destructive font-semibold">{formatVND(h.tong_tien_no)}</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function HuiVienDetail({ hv, onBack }: { hv: HuiVien; onBack: () => void }) {
  // Tìm các chân của hụi viên này trong từng dây
  const chanList = DAY_HUI.flatMap(d =>
    d.chans
      .filter(c => c.hui_vien_id === hv.id)
      .map(c => ({ ...c, day: d }))
  )
  const phieus = PHIEU_LIST.filter(p => p.hui_vien_id === hv.id)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">{hv.ho_ten}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {hv.sdt}
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Tổng chân", value: hv.so_chan, cls: "text-foreground" },
          { label: "Chân sống", value: hv.chan_song, cls: "text-status-green-fg" },
          { label: "Chân chết", value: hv.chan_chet, cls: "text-status-red-fg" },
          { label: "Tổng nợ", value: formatVND(hv.tong_tien_no), cls: hv.tong_tien_no > 0 ? "text-destructive" : "text-status-green-fg" },
        ].map(i => (
          <Card key={i.label} className="p-3">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${i.cls}`}>{i.value}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="chan">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="chan">Chân tham gia</TabsTrigger>
          <TabsTrigger value="phieu">Lịch sử phiếu</TabsTrigger>
        </TabsList>

        <TabsContent value="chan" className="mt-3">
          <Card className="overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Dây hụi", "Vị trí", "Mệnh giá", "Trạng thái", "Đã hốt", "Kỳ hốt"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chanList.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{c.day.ten}</p>
                        <p className="text-xs text-muted-foreground">Kỳ {c.day.ky_hien_tai}/{c.day.tong_ky}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-sm">{c.vi_tri}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{formatVND(c.day.menh_gia)}</td>
                      <td className="px-4 py-2.5"><ChanBadge alive={c.trang_thai === "song"} /></td>
                      <td className="px-4 py-2.5">
                        {c.da_hot
                          ? <span className="text-status-green-fg font-medium">Đã hốt</span>
                          : <span className="text-muted-foreground text-xs">Chưa</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.ky_hot ? `Kỳ ${c.ky_hot}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-border">
              {chanList.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.day.ten}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vị trí {c.vi_tri} • {formatVND(c.day.menh_gia)} • Kỳ {c.day.ky_hien_tai}/{c.day.tong_ky}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.da_hot && <span className="text-xs text-status-green-fg">Kỳ {c.ky_hot}</span>}
                      <ChanBadge alive={c.trang_thai === "song"} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="phieu" className="mt-3">
          {phieus.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Chưa có phiếu nào.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden divide-y divide-border">
              {phieus.map(p => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${p.loai === "thu" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                          {p.loai === "thu" ? "Thu" : "Chi"}
                        </span>
                        <span className="text-xs text-muted-foreground">{p.ngay}</span>
                      </div>
                      <p className="text-base font-bold text-foreground">{formatVND(p.tong_tien)}</p>
                      {p.da_thanh_toan < p.tong_tien && (
                        <p className="text-xs text-muted-foreground">
                          Đã thanh toán: {formatVND(p.da_thanh_toan)} • Còn: {formatVND(p.tong_tien - p.da_thanh_toan)}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={p.trang_thai} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
