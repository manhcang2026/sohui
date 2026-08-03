"use client"

import { Download, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatVND, getHuiVien } from "@/lib/mock-data"
import type { Phieu } from "@/lib/mock-data"

interface Props { phieu: Phieu }

export function PhieuJPG({ phieu }: Props) {
  const hv = getHuiVien(phieu.hui_vien_id)
  const conlai = phieu.tong_tien - phieu.da_thanh_toan

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Download className="w-3.5 h-3.5" />
          Tải xuống JPG
        </Button>
        <Button size="sm" className="gap-1.5 text-xs h-8 bg-[#06C755] hover:bg-[#05a847] text-white">
          <MessageCircle className="w-3.5 h-3.5" />
          Gửi Zalo
        </Button>
      </div>

      {/* Phiếu – designed to look clean on Zalo */}
      <div
        id="phieu-card"
        className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 max-w-md mx-auto"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="bg-[#1a3a5c] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-widest font-medium">SỔ HỤI</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {phieu.loai === "thu" ? "Phiếu Thu" : "Phiếu Chi"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">Mã phiếu</p>
              <p className="text-sm font-mono font-semibold text-white">{phieu.id.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Amount hero */}
        <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
            {phieu.loai === "thu" ? "Số tiền cần đóng" : "Số tiền được nhận"}
          </p>
          <p className="text-4xl font-extrabold text-[#1a3a5c] tabular-nums">
            {formatVND(phieu.tong_tien)}
          </p>
          {conlai > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-3 py-0.5">
              <span className="text-xs text-red-600 font-medium">Còn lại: {formatVND(conlai)}</span>
            </div>
          )}
        </div>

        {/* Info rows */}
        <div className="px-5 py-3 space-y-2">
          {[
            { label: "Hụi viên", value: hv?.ho_ten ?? "—" },
            { label: "Số điện thoại", value: hv?.sdt ?? "—" },
            { label: "Ngày phiếu", value: phieu.ngay },
            { label: "Trạng thái", value: phieu.trang_thai === "du" ? "Đã hoàn tất" : phieu.trang_thai === "mot_phan" ? "Thanh toán một phần" : "Chưa thanh toán" },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">{row.label}</span>
              <span className="text-gray-900 font-semibold text-right">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Chi tiết */}
        <div className="mx-5 mb-3 border border-gray-100 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chi tiết dây</p>
          </div>
          <div className="divide-y divide-gray-100">
            {phieu.chi_tiet.map((ct, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{ct.ten_day}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Kỳ {ct.so_ky} • {ct.so_chan} chân • Thảo: {formatVND(ct.tien_thao)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#1a3a5c] whitespace-nowrap">
                    {formatVND(ct.tien_tham * ct.so_chan - ct.tien_thao * ct.so_chan)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bank info */}
        {phieu.loai === "thu" && (
          <div className="mx-5 mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Thông tin chuyển khoản</p>
            <div className="flex gap-3">
              {/* QR placeholder */}
              <div className="w-16 h-16 bg-white border border-blue-200 rounded-md flex items-center justify-center shrink-0">
                <div className="grid grid-cols-3 gap-px">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 ${[0,1,2,3,5,6,7,8].includes(i) ? "bg-gray-800" : "bg-white"}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-xs flex-1">
                <div>
                  <span className="text-gray-500">Ngân hàng: </span>
                  <span className="font-semibold text-gray-900">{phieu.ngan_hang}</span>
                </div>
                <div>
                  <span className="text-gray-500">Số TK: </span>
                  <span className="font-mono font-bold text-gray-900">{phieu.so_tk}</span>
                </div>
                <div>
                  <span className="text-gray-500">Tên TK: </span>
                  <span className="font-semibold text-gray-900">{phieu.ten_tk}</span>
                </div>
                <div className="pt-1">
                  <span className="text-gray-500">Nội dung: </span>
                  <span className="font-mono text-[10px] text-blue-700 break-all">{phieu.noi_dung_ck}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">Phiếu được tạo tự động bởi Sổ Hụi • {new Date().toLocaleDateString("vi-VN")}</p>
        </div>
      </div>
    </div>
  )
}
