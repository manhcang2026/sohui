"use client"

import { useState } from "react"
import { Eye, MessageCircle, CheckCheck, CreditCard, ArrowLeft, QrCode } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { PHIEU_LIST, HUI_VIEN, getHuiVien, formatVND } from "@/lib/mock-data"
import type { Phieu, TrangThai, LoaiPhieu } from "@/lib/mock-data"
import { PhieuJPG } from "@/components/pages/phieu-jpg"

export function PhieuThuChiPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filterLoai, setFilterLoai] = useState<string>("all")
  const [filterTT, setFilterTT] = useState<string>("all")
  const [preview, setPreview] = useState<Phieu | null>(null)
  const [phieus, setPhieus] = useState(PHIEU_LIST)

  const filtered = phieus.filter(p => {
    const loaiOk = filterLoai === "all" || p.loai === filterLoai
    const ttOk = filterTT === "all" || p.trang_thai === filterTT
    return loaiOk && ttOk
  })

  const allIds = filtered.map(p => p.id)
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someChecked = allIds.some(id => selected.has(id))

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function markDu() {
    setPhieus(prev =>
      prev.map(p =>
        selected.has(p.id) ? { ...p, trang_thai: "du" as TrangThai, da_thanh_toan: p.tong_tien } : p
      )
    )
    setSelected(new Set())
  }

  if (preview) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setPreview(null)} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-bold">Xem phiếu</h2>
        </div>
        <PhieuJPG phieu={preview} />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Phiếu thu–chi</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} phiếu</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterLoai} onValueChange={setFilterLoai}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="thu">Thu</SelectItem>
            <SelectItem value="chi">Chi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTT} onValueChange={setFilterTT}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            <SelectItem value="chua">Chưa thu</SelectItem>
            <SelectItem value="mot_phan">Một phần</SelectItem>
            <SelectItem value="du">Đủ</SelectItem>
          </SelectContent>
        </Select>
        {someChecked && (
          <Button size="sm" onClick={markDu} className="h-8 text-xs gap-1.5 ml-auto">
            <CheckCheck className="w-3.5 h-3.5" />
            Đánh dấu đủ ({selected.size})
          </Button>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 w-10">
                  <Checkbox
                    checked={allChecked}
                    ref={(el) => { if (el) (el as HTMLButtonElement).indeterminate = someChecked && !allChecked }}
                    onCheckedChange={toggleAll}
                  />
                </th>
                {["Loại", "Hụi viên", "Ngày", "Tổng tiền", "Đã thu/chi", "Còn lại", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => {
                const hv = getHuiVien(p.hui_vien_id)
                const conlai = p.tong_tien - p.da_thanh_toan
                return (
                  <tr key={p.id} className={`transition-colors hover:bg-muted/30 ${selected.has(p.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-2.5">
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${p.loai === "thu" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                        {p.loai}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{hv?.ho_ten}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{p.ngay}</td>
                    <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{formatVND(p.tong_tien)}</td>
                    <td className="px-3 py-2.5 text-status-green-fg whitespace-nowrap">{formatVND(p.da_thanh_toan)}</td>
                    <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${conlai > 0 ? "text-destructive" : "text-status-green-fg"}`}>
                      {conlai > 0 ? formatVND(conlai) : "—"}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.trang_thai} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setPreview(p)}
                          title="Xem phiếu JPG"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Gửi Zalo"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        {p.trang_thai !== "du" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-status-yellow-fg"
                            title="Ghi nhận một phần"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map(p => {
          const hv = getHuiVien(p.hui_vien_id)
          const conlai = p.tong_tien - p.da_thanh_toan
          return (
            <Card key={p.id} className={`p-3 ${selected.has(p.id) ? "ring-1 ring-primary" : ""}`}>
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${p.loai === "thu" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                        {p.loai}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{hv?.ho_ten}</span>
                    </div>
                    <StatusBadge status={p.trang_thai} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{p.ngay}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Tổng tiền</p>
                      <p className="font-semibold text-foreground">{formatVND(p.tong_tien)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Đã thu</p>
                      <p className="font-semibold text-status-green-fg">{formatVND(p.da_thanh_toan)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Còn lại</p>
                      <p className={`font-semibold ${conlai > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {conlai > 0 ? formatVND(conlai) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                      onClick={() => setPreview(p)}
                    >
                      <Eye className="w-3 h-3" />
                      Xem phiếu
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Zalo
                    </Button>
                    {p.trang_thai !== "du" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 flex-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        Ghi nhận
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
