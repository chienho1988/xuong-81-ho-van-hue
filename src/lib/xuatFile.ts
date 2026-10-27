// Xuất bảng đơn thiếu ra Excel và PDF (mục 9b của thiết kế).
//
// Xuất ĐÚNG những dòng đang hiện trên màn hình — cái chị thấy là cái chị nhận được.
//
// Hai thư viện nặng (xlsx, pdfmake) chỉ nạp khi thật sự bấm xuất, bằng import động:
// như vậy phần dựng dòng ở dưới vẫn chạy được trong bộ test của Node.

import type { Order } from "./mockData.ts";

export interface DongDonThieu {
  maDon: string;
  maVanDon: string;
  tenKhach: string;
  soDienThoai: string;
  mauMa: string;
  soLuong: number;
  hanMay: string;
  trangThai: "Chờ may" | "Đang may" | "Xong";
}

type BanDoSanPham = Record<string, { name: string } | undefined>;

export function dungDongDonThieu(
  orders: Order[],
  products: BanDoSanPham,
): DongDonThieu[] {
  return orders.map((o) => {
    const daMay = (o.quantity ?? 0) - (o.remaining_quantity ?? 0);
    const trangThai: DongDonThieu["trangThai"] =
      o.status === "done" || o.remaining_quantity === 0
        ? "Xong"
        : daMay > 0
          ? "Đang may"
          : "Chờ may";

    return {
      maDon: o.pancake_order_id ?? "",
      // Mã vận đơn chỉ sinh ra khi đơn được đẩy sang đơn vị vận chuyển.
      maVanDon: o.pancake_tracking_code ?? "",
      tenKhach: o.pancake_customer_name ?? "",
      soDienThoai: o.pancake_customer_phone ?? "",
      mauMa:
        o.pancake_sku ||
        `${products[o.product_id]?.name ?? "Sản phẩm"} · ${o.color} · ${o.size}`,
      soLuong: o.remaining_quantity ?? 0,
      hanMay: o.due_date ?? "",
      trangThai,
    };
  });
}

const TIEU_DE = [
  "Mã đơn",
  "Mã vận đơn",
  "Tên khách",
  "Số điện thoại",
  "Sản phẩm thiếu",
  "Số lượng",
  "Hạn may",
  "Trạng thái",
] as const;

function thanhMang(d: DongDonThieu) {
  return [
    d.maDon,
    d.maVanDon,
    d.tenKhach,
    d.soDienThoai,
    d.mauMa,
    d.soLuong,
    d.hanMay,
    d.trangThai,
  ];
}

export async function xuatExcel(dong: DongDonThieu[], tenFile: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([[...TIEU_DE], ...dong.map(thanhMang)]);
  // Mỗi cột một ô riêng để chị còn lọc và tính tiếp được.
  sheet["!cols"] = [10, 18, 20, 14, 28, 9, 12, 11].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Đơn thiếu");
  XLSX.writeFile(wb, tenFile);
}

// Lấy phần ngày trong tiêu đề để đặt tên file; tsconfig target es5 không cho
// dùng cờ regex `u`, nên tách bằng cách đơn giản.
function ngayTrongTieuDe(tieuDe: string): string {
  const m = tieuDe.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "tat-ca";
}

export async function xuatPdf(dong: DongDonThieu[], tieuDe: string) {
  // pdfmake chứ không phải jsPDF: font mặc định của jsPDF không có dấu tiếng Việt,
  // tên khách sẽ ra "Trõn Song V?nh Th?y". Roboto của pdfmake thì đủ dấu.
  const pdfMakeMod: any = await import("pdfmake/build/pdfmake");
  const vfsMod: any = await import("pdfmake/build/vfs_fonts");
  const pdfMake = pdfMakeMod.default ?? pdfMakeMod;
  // pdfmake 0.3 nạp font qua addVirtualFileSystem; 0.2 thì gán thẳng .vfs.
  // Nhận cả hai để nâng gói sau này không vỡ.
  const vfs = vfsMod.default ?? vfsMod;
  const bang = vfs?.pdfMake?.vfs ?? vfs?.vfs ?? vfs;
  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(bang);
  } else {
    pdfMake.vfs = bang;
  }

  const tong = dong.reduce((t, d) => t + d.soLuong, 0);

  pdfMake
    .createPdf({
      pageOrientation: "landscape",
      pageSize: "A4",
      content: [
        { text: tieuDe, style: "tieuDe" },
        {
          table: {
            headerRows: 1,
            widths: [50, 85, 95, 70, "*", 45, 60, 55],
            body: [
              TIEU_DE.map((t) => ({ text: t, style: "oTieuDe" })),
              ...dong.map((d) => thanhMang(d).map((x) => String(x))),
              [
                { text: "TỔNG", colSpan: 5, alignment: "right", bold: true },
                "",
                "",
                "",
                "",
                { text: String(tong), bold: true },
                "",
                "",
              ],
            ],
          },
          layout: "lightHorizontalLines",
          fontSize: 9,
        },
      ],
      styles: {
        tieuDe: { fontSize: 14, bold: true, margin: [0, 0, 0, 10] },
        oTieuDe: { bold: true, fillColor: "#ECEFF1" },
      },
      defaultStyle: { font: "Roboto", fontSize: 9 },
    })
    .download(`don-thieu-${ngayTrongTieuDe(tieuDe)}.pdf`);
}
