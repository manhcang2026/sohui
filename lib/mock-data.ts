// ============================================================
//  Sổ Hụi – Mock Data
// ============================================================

export type TrangThai = "chua" | "mot_phan" | "du"
export type TrangThaiKy = "chua_khui" | "da_chot"
export type LoaiPhieu = "thu" | "chi"

// ---------- Hụi viên ----------
export interface HuiVien {
  id: string
  ho_ten: string
  sdt: string
  zalo: string
  so_chan: number
  chan_song: number
  chan_chet: number
  tong_tien_no: number // tổng tiền còn nợ
}

export const HUI_VIEN: HuiVien[] = [
  { id: "hv1", ho_ten: "Nguyễn Thị Mai", sdt: "0901 234 567", zalo: "0901234567", so_chan: 4, chan_song: 3, chan_chet: 1, tong_tien_no: 3_000_000 },
  { id: "hv2", ho_ten: "Trần Văn Hùng",  sdt: "0912 345 678", zalo: "0912345678", so_chan: 3, chan_song: 3, chan_chet: 0, tong_tien_no: 0 },
  { id: "hv3", ho_ten: "Lê Thị Hoa",     sdt: "0923 456 789", zalo: "0923456789", so_chan: 5, chan_song: 4, chan_chet: 1, tong_tien_no: 1_500_000 },
  { id: "hv4", ho_ten: "Phạm Minh Tuấn", sdt: "0934 567 890", zalo: "0934567890", so_chan: 2, chan_song: 2, chan_chet: 0, tong_tien_no: 0 },
  { id: "hv5", ho_ten: "Hoàng Thị Lan",  sdt: "0945 678 901", zalo: "0945678901", so_chan: 3, chan_song: 2, chan_chet: 1, tong_tien_no: 2_000_000 },
  { id: "hv6", ho_ten: "Vũ Đức Nam",     sdt: "0956 789 012", zalo: "0956789012", so_chan: 2, chan_song: 2, chan_chet: 0, tong_tien_no: 0 },
  { id: "hv7", ho_ten: "Đỗ Thị Bích",    sdt: "0967 890 123", zalo: "0967890123", so_chan: 4, chan_song: 3, chan_chet: 1, tong_tien_no: 5_000_000 },
]

// ---------- Dây hụi ----------
export interface Chan {
  id: string
  hui_vien_id: string
  vi_tri: number
  trang_thai: "song" | "chet"
  da_hot: boolean
  ky_hot?: number
}

export interface Ky {
  so_ky: number
  ngay: string
  chan_hot_id?: string
  hui_vien_hot?: string
  tien_hot: number
  trang_thai: TrangThaiKy
  tien_tham: number
  tien_thao: number
}

export interface DayHui {
  id: string
  ten: string
  menh_gia: number      // tiền/chân/kỳ
  so_chan: number
  tien_thao_mac_dinh: number
  ky_hien_tai: number
  tong_ky: number
  ngay_ky_tiep: string
  chu_ky: "thang" | "tuan"
  trang_thai: "hoat_dong" | "ket_thuc"
  chans: Chan[]
  ky_list: Ky[]
}

export const DAY_HUI: DayHui[] = [
  {
    id: "d1",
    ten: "Dây 5 triệu (22 chân)",
    menh_gia: 5_000_000,
    so_chan: 22,
    tien_thao_mac_dinh: 100_000,
    ky_hien_tai: 8,
    tong_ky: 22,
    ngay_ky_tiep: "2026-08-05",
    chu_ky: "thang",
    trang_thai: "hoat_dong",
    chans: [
      { id: "c1-1",  hui_vien_id: "hv1", vi_tri: 1,  trang_thai: "song", da_hot: true,  ky_hot: 3 },
      { id: "c1-2",  hui_vien_id: "hv2", vi_tri: 2,  trang_thai: "song", da_hot: true,  ky_hot: 5 },
      { id: "c1-3",  hui_vien_id: "hv3", vi_tri: 3,  trang_thai: "song", da_hot: false },
      { id: "c1-4",  hui_vien_id: "hv1", vi_tri: 4,  trang_thai: "song", da_hot: false },
      { id: "c1-5",  hui_vien_id: "hv4", vi_tri: 5,  trang_thai: "song", da_hot: true,  ky_hot: 1 },
      { id: "c1-6",  hui_vien_id: "hv5", vi_tri: 6,  trang_thai: "song", da_hot: false },
      { id: "c1-7",  hui_vien_id: "hv6", vi_tri: 7,  trang_thai: "song", da_hot: true,  ky_hot: 7 },
      { id: "c1-8",  hui_vien_id: "hv7", vi_tri: 8,  trang_thai: "song", da_hot: false },
      { id: "c1-9",  hui_vien_id: "hv3", vi_tri: 9,  trang_thai: "song", da_hot: false },
      { id: "c1-10", hui_vien_id: "hv2", vi_tri: 10, trang_thai: "song", da_hot: true,  ky_hot: 2 },
      { id: "c1-11", hui_vien_id: "hv4", vi_tri: 11, trang_thai: "song", da_hot: false },
      { id: "c1-12", hui_vien_id: "hv5", vi_tri: 12, trang_thai: "chet", da_hot: false },
      { id: "c1-13", hui_vien_id: "hv1", vi_tri: 13, trang_thai: "song", da_hot: false },
      { id: "c1-14", hui_vien_id: "hv6", vi_tri: 14, trang_thai: "song", da_hot: false },
      { id: "c1-15", hui_vien_id: "hv7", vi_tri: 15, trang_thai: "song", da_hot: false },
      { id: "c1-16", hui_vien_id: "hv3", vi_tri: 16, trang_thai: "song", da_hot: false },
      { id: "c1-17", hui_vien_id: "hv2", vi_tri: 17, trang_thai: "song", da_hot: false },
      { id: "c1-18", hui_vien_id: "hv4", vi_tri: 18, trang_thai: "song", da_hot: false },
      { id: "c1-19", hui_vien_id: "hv5", vi_tri: 19, trang_thai: "song", da_hot: false },
      { id: "c1-20", hui_vien_id: "hv1", vi_tri: 20, trang_thai: "song", da_hot: false },
      { id: "c1-21", hui_vien_id: "hv7", vi_tri: 21, trang_thai: "song", da_hot: false },
      { id: "c1-22", hui_vien_id: "hv6", vi_tri: 22, trang_thai: "song", da_hot: false },
    ],
    ky_list: Array.from({ length: 22 }, (_, i) => ({
      so_ky: i + 1,
      ngay: `2026-0${Math.floor(i/4)+1}-05`,
      chan_hot_id: i < 7 ? `c1-${[5,10,1,2,2,7,7][i]}` : undefined,
      hui_vien_hot: i < 7 ? ["Phạm Minh Tuấn","Trần Văn Hùng","Nguyễn Thị Mai","Trần Văn Hùng","Trần Văn Hùng","Vũ Đức Nam","Vũ Đức Nam"][i] : undefined,
      tien_hot: 5_000_000 * 22 - 100_000 * (22 - (i+1)),
      trang_thai: i < 7 ? "da_chot" : "chua_khui",
      tien_tham: 5_000_000,
      tien_thao: 100_000,
    })),
  },
  {
    id: "d2",
    ten: "Dây 3 triệu (22 chân)",
    menh_gia: 3_000_000,
    so_chan: 22,
    tien_thao_mac_dinh: 80_000,
    ky_hien_tai: 5,
    tong_ky: 22,
    ngay_ky_tiep: "2026-08-03",
    chu_ky: "thang",
    trang_thai: "hoat_dong",
    chans: [
      { id: "c2-1",  hui_vien_id: "hv3", vi_tri: 1,  trang_thai: "song", da_hot: true,  ky_hot: 2 },
      { id: "c2-2",  hui_vien_id: "hv5", vi_tri: 2,  trang_thai: "song", da_hot: false },
      { id: "c2-3",  hui_vien_id: "hv7", vi_tri: 3,  trang_thai: "song", da_hot: true,  ky_hot: 4 },
      { id: "c2-4",  hui_vien_id: "hv1", vi_tri: 4,  trang_thai: "song", da_hot: true,  ky_hot: 1 },
      { id: "c2-5",  hui_vien_id: "hv2", vi_tri: 5,  trang_thai: "song", da_hot: false },
      { id: "c2-6",  hui_vien_id: "hv6", vi_tri: 6,  trang_thai: "song", da_hot: false },
      { id: "c2-7",  hui_vien_id: "hv4", vi_tri: 7,  trang_thai: "song", da_hot: true,  ky_hot: 3 },
      { id: "c2-8",  hui_vien_id: "hv3", vi_tri: 8,  trang_thai: "chet", da_hot: false },
      { id: "c2-9",  hui_vien_id: "hv1", vi_tri: 9,  trang_thai: "song", da_hot: false },
      { id: "c2-10", hui_vien_id: "hv5", vi_tri: 10, trang_thai: "song", da_hot: false },
      { id: "c2-11", hui_vien_id: "hv7", vi_tri: 11, trang_thai: "song", da_hot: false },
      { id: "c2-12", hui_vien_id: "hv2", vi_tri: 12, trang_thai: "song", da_hot: false },
      { id: "c2-13", hui_vien_id: "hv6", vi_tri: 13, trang_thai: "song", da_hot: false },
      { id: "c2-14", hui_vien_id: "hv4", vi_tri: 14, trang_thai: "song", da_hot: false },
      { id: "c2-15", hui_vien_id: "hv1", vi_tri: 15, trang_thai: "song", da_hot: false },
      { id: "c2-16", hui_vien_id: "hv3", vi_tri: 16, trang_thai: "song", da_hot: false },
      { id: "c2-17", hui_vien_id: "hv5", vi_tri: 17, trang_thai: "song", da_hot: false },
      { id: "c2-18", hui_vien_id: "hv7", vi_tri: 18, trang_thai: "song", da_hot: false },
      { id: "c2-19", hui_vien_id: "hv2", vi_tri: 19, trang_thai: "song", da_hot: false },
      { id: "c2-20", hui_vien_id: "hv6", vi_tri: 20, trang_thai: "song", da_hot: false },
      { id: "c2-21", hui_vien_id: "hv4", vi_tri: 21, trang_thai: "song", da_hot: false },
      { id: "c2-22", hui_vien_id: "hv2", vi_tri: 22, trang_thai: "song", da_hot: false },
    ],
    ky_list: Array.from({ length: 22 }, (_, i) => ({
      so_ky: i + 1,
      ngay: `2026-0${Math.floor(i/4)+1}-03`,
      chan_hot_id: i < 4 ? `c2-${[4,1,7,3][i]}` : undefined,
      hui_vien_hot: i < 4 ? ["Nguyễn Thị Mai","Lê Thị Hoa","Phạm Minh Tuấn","Đỗ Thị Bích"][i] : undefined,
      tien_hot: 3_000_000 * 22 - 80_000 * (22 - (i+1)),
      trang_thai: i < 4 ? "da_chot" : "chua_khui",
      tien_tham: 3_000_000,
      tien_thao: 80_000,
    })),
  },
  {
    id: "d3",
    ten: "Dây tuần 1 triệu (38 chân)",
    menh_gia: 1_000_000,
    so_chan: 38,
    tien_thao_mac_dinh: 30_000,
    ky_hien_tai: 12,
    tong_ky: 38,
    ngay_ky_tiep: "2026-08-03",
    chu_ky: "tuan",
    trang_thai: "hoat_dong",
    chans: Array.from({ length: 38 }, (_, i) => ({
      id: `c3-${i+1}`,
      hui_vien_id: ["hv1","hv2","hv3","hv4","hv5","hv6","hv7"][i % 7],
      vi_tri: i + 1,
      trang_thai: i === 9 || i === 19 ? "chet" : "song",
      da_hot: i < 11,
      ky_hot: i < 11 ? i + 1 : undefined,
    })),
    ky_list: Array.from({ length: 38 }, (_, i) => ({
      so_ky: i + 1,
      ngay: `2026-0${Math.floor(i/5)+1}-${3 + (i%5)*7 > 28 ? (i%5)*7 - 25 : 3+(i%5)*7}`,
      chan_hot_id: i < 11 ? `c3-${i+1}` : undefined,
      hui_vien_hot: i < 11 ? HUI_VIEN[i % 7].ho_ten : undefined,
      tien_hot: 1_000_000 * 38 - 30_000 * (38 - (i+1)),
      trang_thai: i < 11 ? "da_chot" : "chua_khui",
      tien_tham: 1_000_000,
      tien_thao: 30_000,
    })),
  },
  {
    id: "d4",
    ten: "Dây 3 triệu (24 chân)",
    menh_gia: 3_000_000,
    so_chan: 24,
    tien_thao_mac_dinh: 80_000,
    ky_hien_tai: 3,
    tong_ky: 24,
    ngay_ky_tiep: "2026-08-03",
    chu_ky: "thang",
    trang_thai: "hoat_dong",
    chans: Array.from({ length: 24 }, (_, i) => ({
      id: `c4-${i+1}`,
      hui_vien_id: ["hv1","hv2","hv3","hv4","hv5","hv6","hv7"][i % 7],
      vi_tri: i + 1,
      trang_thai: "song",
      da_hot: i < 2,
      ky_hot: i < 2 ? i + 1 : undefined,
    })),
    ky_list: Array.from({ length: 24 }, (_, i) => ({
      so_ky: i + 1,
      ngay: `2026-0${Math.floor(i/2)+1}-03`,
      chan_hot_id: i < 2 ? `c4-${i+1}` : undefined,
      hui_vien_hot: i < 2 ? ["Nguyễn Thị Mai","Trần Văn Hùng"][i] : undefined,
      tien_hot: 3_000_000 * 24 - 80_000 * (24 - (i+1)),
      trang_thai: i < 2 ? "da_chot" : "chua_khui",
      tien_tham: 3_000_000,
      tien_thao: 80_000,
    })),
  },
]

// ---------- Phiếu thu–chi ----------
export interface PhieuChiTiet {
  day_hui_id: string
  ten_day: string
  so_ky: number
  so_chan: number
  tien_tham: number
  tien_thao: number
}

export interface Phieu {
  id: string
  loai: LoaiPhieu
  hui_vien_id: string
  ngay: string
  tong_tien: number
  da_thanh_toan: number
  trang_thai: TrangThai
  chi_tiet: PhieuChiTiet[]
  noi_dung_ck: string
  so_tk: string
  ngan_hang: string
  ten_tk: string
}

export const PHIEU_LIST: Phieu[] = [
  {
    id: "p1",
    loai: "chi",
    hui_vien_id: "hv4",
    ngay: "2026-07-05",
    tong_tien: 107_900_000,
    da_thanh_toan: 107_900_000,
    trang_thai: "du",
    noi_dung_ck: "HUI D1 KY5 C5 PHAM MINH TUAN",
    so_tk: "0123456789",
    ngan_hang: "Vietcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d1", ten_day: "Dây 5 triệu (22 chân)", so_ky: 5, so_chan: 1, tien_tham: 5_000_000, tien_thao: 100_000 },
    ],
  },
  {
    id: "p2",
    loai: "thu",
    hui_vien_id: "hv3",
    ngay: "2026-08-03",
    tong_tien: 5_920_000,
    da_thanh_toan: 3_000_000,
    trang_thai: "mot_phan",
    noi_dung_ck: "HUI D2 KY5 C1 LE THI HOA",
    so_tk: "9876543210",
    ngan_hang: "Techcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d2", ten_day: "Dây 3 triệu (22 chân)", so_ky: 5, so_chan: 1, tien_tham: 3_000_000, tien_thao: 80_000 },
      { day_hui_id: "d3", ten_day: "Dây tuần 1 triệu (38 chân)", so_ky: 12, so_chan: 2, tien_tham: 1_000_000, tien_thao: 30_000 },
    ],
  },
  {
    id: "p3",
    loai: "thu",
    hui_vien_id: "hv7",
    ngay: "2026-08-03",
    tong_tien: 8_820_000,
    da_thanh_toan: 0,
    trang_thai: "chua",
    noi_dung_ck: "HUI D2 KY5 C3 DO THI BICH",
    so_tk: "9876543210",
    ngan_hang: "Techcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d2", ten_day: "Dây 3 triệu (22 chân)", so_ky: 5, so_chan: 2, tien_tham: 3_000_000, tien_thao: 80_000 },
      { day_hui_id: "d1", ten_day: "Dây 5 triệu (22 chân)", so_ky: 8, so_chan: 1, tien_tham: 5_000_000, tien_thao: 100_000 },
    ],
  },
  {
    id: "p4",
    loai: "thu",
    hui_vien_id: "hv1",
    ngay: "2026-08-03",
    tong_tien: 4_760_000,
    da_thanh_toan: 4_760_000,
    trang_thai: "du",
    noi_dung_ck: "HUI D4 KY3 C1 NGUYEN THI MAI",
    so_tk: "9876543210",
    ngan_hang: "Techcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d4", ten_day: "Dây 3 triệu (24 chân)", so_ky: 3, so_chan: 1, tien_tham: 3_000_000, tien_thao: 80_000 },
      { day_hui_id: "d3", ten_day: "Dây tuần 1 triệu (38 chân)", so_ky: 12, so_chan: 1, tien_tham: 1_000_000, tien_thao: 30_000 },
    ],
  },
  {
    id: "p5",
    loai: "thu",
    hui_vien_id: "hv5",
    ngay: "2026-08-03",
    tong_tien: 3_920_000,
    da_thanh_toan: 0,
    trang_thai: "chua",
    noi_dung_ck: "HUI D2 KY5 C2 HOANG THI LAN",
    so_tk: "9876543210",
    ngan_hang: "Techcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d2", ten_day: "Dây 3 triệu (22 chân)", so_ky: 5, so_chan: 1, tien_tham: 3_000_000, tien_thao: 80_000 },
    ],
  },
  {
    id: "p6",
    loai: "chi",
    hui_vien_id: "hv3",
    ngay: "2026-07-03",
    tong_tien: 64_840_000,
    da_thanh_toan: 64_840_000,
    trang_thai: "du",
    noi_dung_ck: "HUI D2 KY2 C1 LE THI HOA",
    so_tk: "9876543210",
    ngan_hang: "Techcombank",
    ten_tk: "Nguyễn Thị Chủ Hụi",
    chi_tiet: [
      { day_hui_id: "d2", ten_day: "Dây 3 triệu (22 chân)", so_ky: 2, so_chan: 1, tien_tham: 3_000_000, tien_thao: 80_000 },
    ],
  },
]

// ---------- Helpers ----------
export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getHuiVien(id: string): HuiVien | undefined {
  return HUI_VIEN.find((h) => h.id === id)
}

export function getDayHui(id: string): DayHui | undefined {
  return DAY_HUI.find((d) => d.id === id)
}

// Ngày hôm nay là 03/08/2026 theo context
export const TODAY = "2026-08-03"

export function isKhomNay(day: DayHui): boolean {
  return day.ngay_ky_tiep === TODAY && day.trang_thai === "hoat_dong"
}

export const DAY_KHUI_HOM_NAY = DAY_HUI.filter(isKhomNay)
