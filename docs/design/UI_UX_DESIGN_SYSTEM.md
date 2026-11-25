# Hệ thống Thiết kế UI/UX & Quy chuẩn Trực quan (Design System)

> **Quy chuẩn UI/UX & Accessibility KTXH Offline**  
> **Dự án:** KTXH Offline Report (`cavoixanh638/KTXD-report`)  
> **Tiêu chuẩn:** Offline 100%, Không Font/CDN mạng, Chuẩn công văn hành chính, WCAG 2.1 AA

---

## 1. Nguyên tắc Cốt lõi (Design Principles)

1. **Chuẩn mực Hành chính Nhà nước**: Tờ báo cáo in ra phải đạt chuẩn tối đa về thẩm mỹ văn bản quy phạm: nền trắng, mực đen sẫm, phông chữ `Times New Roman`, đường kẻ bảng đơn nét rõ ràng, không màu mè làm mất tính trang nghiêm.
2. **Vỏ điều khiển Hiện đại & Thân thiện**: Khung điều khiển (Topbar, Sidebar, Popover) sử dụng phong cách giao diện hiện đại, rõ ràng, phân cấp thị giác tốt để cán bộ không bị mỏi mắt sau nhiều giờ làm việc.
3. **Tuyệt đối Offline (Zero External Assets)**: Không tải bất kỳ font chữ từ Google Fonts, không CDN, không icon font (FontAwesome, Material Icons...). Toàn bộ icon được vẽ bằng vector SVG inline nhúng trực tiếp trong mã nguồn.
4. **Trực quan & Tối thiểu thao tác (Low Cognitive Load)**: Sắp xếp các tác vụ theo đúng luồng tư duy công việc thực tế. Loại bỏ triệt để các ô nhập liệu, danh sách và nút bấm trùng lặp.
5. **Tiếp cận Đa phương thức (Accessibility & Keyboard-First)**: Đảm bảo độ tương phản màu sắc đạt chuẩn WCAG AA (>4.5:1 cho văn bản thường), hỗ trợ đầy đủ phím tắt và chỉ báo tiêu điểm bàn phím (`:focus-visible`).

---

## 2. Hệ thống Màu sắc (Color Tokens)

Toàn bộ biến màu được định nghĩa tập trung trong `src/styles/main.css`:

```css
:root {
  /* Vỏ ứng dụng (App Shell) */
  --bg-app: #f1f5f9;              /* Slate-100: Nền tổng thể */
  --bg-surface: #ffffff;          /* Nền thẻ, thanh công cụ */
  --bg-sidebar: #f8fafc;          /* Slate-50: Nền cột điều khiển trái */
  --border-subtle: #e2e8f0;       /* Slate-200: Đường viền ngăn cách */
  --border-focus: #3b82f6;        /* Blue-500: Viền khi chọn */
  
  /* Màu chữ (Typography) */
  --text-main: #0f172a;           /* Slate-900: Chữ chính, độ tương phản 13.8:1 */
  --text-muted: #475569;          /* Slate-600: Chữ phụ, độ tương phản 5.2:1 */
  --text-dim: #64748b;            /* Slate-500 */
  
  /* Màu nhận diện thương hiệu & Hành động chính (Primary) */
  --primary: #1d4ed8;             /* Blue-700: Nút chính, tương phản 7.2:1 */
  --primary-hover: #1e40af;       /* Blue-800 */
  --primary-soft: #eff6ff;        /* Blue-50: Nền highlight */
  
  /* Màu trạng thái cảnh báo & Thông tin */
  --success-bg: #ecfdf5;          /* Emerald-50 */
  --success-text: #065f46;        /* Emerald-800 */
  --warning-bg: #fffbeb;          /* Amber-50 */
  --warning-text: #92400e;        /* Amber-800 */
  --danger-bg: #fef2f2;           /* Red-50 */
  --danger-text: #991b1b;           /* Red-800 */
}
```

---

## 3. Quy chuẩn Kiểu chữ (Typography)

Hệ thống phân chia rạch ròi 2 không gian kiểu chữ:

| Không gian | Họ phông chữ (Font Family) | Cỡ chữ & Trọng số | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Vỏ điều khiển (App Shell)** | `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` | `11px - 14px`, 400/500/600 | Hiển thị sắc nét trên màn hình máy tính Windows, tối ưu tốc độ render cục bộ |
| **Báo cáo A4 (.a4-paper-sheet)** | `"Times New Roman", Times, serif` | Tiêu đề: `16px Bold`<br>Bảng: `11px Regular`<br>Dự án: `10px/11px` | Đạt chuẩn thể thức văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP) |

---

## 4. Từ điển Icon Vector SVG Inline (`src/ui/icons.ts`)

Thay vì dùng emoji hoặc font icon bên ngoài dễ bị lỗi ô vuông trên máy tính công vụ hoặc vi phạm chính sách offline, hệ thống xây dựng thư viện icon SVG nội bộ cực nhẹ, sắc nét ở mọi độ phân giải:

| Tên biến Icon | Kích thước | Minh họa trực quan | Vị trí áp dụng |
| :--- | :--- | :--- | :--- |
| `iconSidebarToggle` | 18x18 | Khung chia 2 cột | Nút bật/tắt Sidebar trên Topbar |
| `iconArrowUp` | 14x14 | Mũi tên hướng lên `▲` | Đẩy cột địa phương sang trái |
| `iconArrowDown` | 14x14 | Mũi tên hướng xuống `▼` | Đẩy cột địa phương sang phải |
| `iconPrint` | 16x16 | Máy in tài liệu | Nút In / Lưu PDF A4 ngang |
| `iconExcel` | 16x16 | Bảng tính & lưới ô | Nút Xuất Excel 5 sheet |
| `iconSearch` | 14x14 | Kính lúp tìm kiếm | Ô tìm kiếm địa phương không dấu |
| `iconSettings` | 16x16 | Bánh răng cấu hình | Đầu mục Khối 3 Tùy chỉnh bảng |
| `iconDatabase` | 16x16 | Ổ đĩa / Khối dữ liệu | Đầu mục Khối 1 Nguồn dữ liệu |
| `iconPin` | 16x16 | Bản đồ & ghim vị trí | Đầu mục Khối 2 Chọn địa phương |
| `iconEdit` | 14x14 | Cây bút chì | Nút Đổi tên phiên trên Topbar |
| `iconDownload` | 14x14 | Mũi tên tải xuống | Nút Sao lưu phiên (.kxh.json) |
| `iconUpload` | 14x14 | Mũi tên tải lên | Nút Phục hồi phiên từ file |
| `iconInfo` | 14x14 | Chữ `i` trong hình tròn | Huy hiệu chú thích & Vết tính toán |
| `iconCheck` | 14x14 | Dấu tích hoàn thành | Trạng thái nguồn dữ liệu hợp lệ |
| `iconAlert` | 14x14 | Tam giác cảnh báo | Cảnh báo ngày chốt cần xác nhận |

---

## 5. Quy chuẩn Tương tác & Phím tắt (Interactions & Shortcuts)

### 5.1. Phím tắt Bàn phím (Keyboard Navigation)
- `Ctrl + B` (hoặc `Cmd + B`): Bật/tắt nhanh Sidebar bên trái để phóng to hoặc thu nhỏ vùng xem trước tờ báo cáo A4.
- `Esc`: Đóng ngay lập tức Popover soi vết tính toán hoặc Hộp thoại Modal đang mở.
- `Tab` / `Shift + Tab`: Di chuyển tiêu điểm bàn phím qua các nút bấm, ô nhập liệu theo thứ tự tự nhiên (Logical Tab Order).
- `Space` / `Enter`: Kích hoạt nút bấm hoặc tích chọn hộp kiểm đang có tiêu điểm.

### 5.2. Chỉ báo Tiêu điểm Rõ ràng (`:focus-visible`)
Mọi phần tử tương tác đều có vòng viền tiêu điểm màu xanh đậm `2px solid #3b82f6` kèm khoảng đệm `2px offset`, đảm bảo người dùng điều khiển bằng phím luôn biết rõ mình đang đứng ở ô nào.

---

## 6. Tiêu chuẩn Thể thức Bảng in Hành chính (Print Specifications)

Khi người dùng nhấn `In / Lưu PDF` hoặc ấn `Ctrl + P`, mã CSS in ấn chuyên dụng `@media print` được kích hoạt tự động:

- **Khổ giấy:** `@page { size: A4 landscape; margin: 10mm 8mm 10mm 8mm; }` (Khổ A4 nằm ngang, lề tiêu chuẩn).
- **Loại bỏ vỏ điều khiển:** Toàn bộ Topbar, Sidebar, các nút thao tác, thanh cuộn đều bị ẩn (`display: none !important`).
- **Giữ nguyên định dạng bảng:**
  - `page-break-inside: avoid` trên từng hàng chỉ tiêu để tránh bị cắt ngang chữ.
  - Cột đầu tiên (Nội dung chỉ tiêu) tự động co giãn tỷ lệ hợp lý, các cột địa phương phân bổ đều nhau.
  - Đường kẻ bảng `border: 1px solid #000000` sắc nét trên bản in thật và bản PDF xuất ra.
- **Tùy chọn ngắt Trang 2:** Khi bật tùy chọn *Ngắt danh sách dự án sang Trang 2*, hệ thống tự động chèn thuộc tính `page-break-before: always` trước Dòng 8 và 9, giúp bản in 2 trang vô cùng ngăn nắp và sạch sẽ.

## Điều chỉnh bố cục 24/11/2026

A4 ngang tối đa 11 cột địa phương/cụm, co bề rộng tự động; 1 địa phương dùng ô thường. Ba dòng tỷ lệ chung REV/DISB/GPMB gộp toàn bộ cột địa phương trong nhóm và căn giữa; Studio dọc gộp các hàng địa phương trong nhóm. Nhãn chỉ tiêu, STT và các dòng số liệu cá thể giữ nguyên. Ô gộp vẫn mở inspector theo trace chung. Bỏ đoạn ghi chú nguồn cuối bảng ở mọi đầu ra bảng chính; thông tin nguồn chuyển sang khối quản lý nguồn và sheet/phụ lục kiểm toán riêng. Dòng thực thu NSNN tùy chọn đặt sau dự toán, STT tự tính; không thay đổi template cũ.

### Tên chỉ tiêu chuẩn (24/11/2026)

Tuân thủ bảng bảy nhãn mới trong MASTER. Dùng `từng địa phương` thay vì `từng xã` cho bốn chỉ tiêu cá thể; ba benchmark dùng `trung bình của 114 địa phương` trên bảng chính, ghi đủ độ phủ thực trong kiểm toán. Ngày chốt tự động; giữ ô gộp REV/DISB/GPMB, không thêm footer nguồn. Chỉ tăng cỡ chữ giá trị của ba tỷ lệ trung bình REV/DISB/GPMB: Studio/grid và bản in/PDF dùng `1.1em` (tăng 10% so với số liệu thông thường), Excel dùng 11 pt thay vì 10 pt, định dạng phần trăm và căn giữa giữ nguyên. Không tăng cỡ chữ nhãn chỉ tiêu hoặc giá trị của từng địa phương; gộp cả ba benchmark REV/DISB/GPMB. Nhãn mặc định cũ theo độ phủ được tự chuyển sang mẫu 114; giữ tên riêng của người dùng.

### Nạp 3 file mới nhất

Nút liên kết Khối 1 và empty state mở modal cùng style `proj-modal-dialog`. Mỗi nhóm nguồn có card tên file/ngày chốt/độ phủ, DISB có phạm vi, mẫu và nhiều phiên bản cùng ngày có cảnh báo; nguồn loại nằm trong details. Nút Nạp 3 nguồn vô hiệu khi thiếu ứng viên; Cancel/Escape/đóng nền không thay phiên. Tạo phiên mới hiện lựa chọn LATEST kèm preview; ô xác nhận ngày dùng chung cho cả DISB/REV/GPMB, không điền ngày mẫu khi chưa xác minh.
