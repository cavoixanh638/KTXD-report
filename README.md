# KTXH Offline Report — Báo cáo KTXH mở trực tiếp bằng trình duyệt

> **Tình trạng:** `MASTER_V2.2 / PHASE_1_COMPLETED / DUAL_STUDIO_LIVE / 43_TESTS_PASS`  
> **Repository:** `cavoixanh638/KTXD-report` (Private)  
> **Sản phẩm:** KTXH Offline (Bản dựng tệp đơn: `dist/index.html` ~2.2MB, chạy 100% offline qua `file://`)

---

## 1. KHỞI ĐỘNG NHANH ỨNG DỤNG

Ứng dụng **không yêu cầu cài đặt máy chủ (Node.js/Web Server)** và **không kết nối Internet**:
1. Vào thư mục `dist/` trong thư mục dự án.
2. Nhấp đúp chuột vào file **`dist/index.html`** (hoặc mở bằng Microsoft Edge / Google Chrome).
3. Sử dụng ngay: tạo phiên làm việc, nạp nguồn dữ liệu, tích chọn xã, xem trước báo cáo A4 trực tiếp và xuất file Excel / PDF.

📖 **Xem tài liệu hướng dẫn chi tiết:**
- 👤 **Người dùng (Cán bộ / Lãnh đạo):** [Sổ tay Hướng dẫn Sử dụng](docs/guides/USER_GUIDE.md)
- 💻 **Lập trình viên / AI bảo trì:** [Sổ tay Lập trình & Kiến trúc](docs/guides/DEVELOPER_GUIDE.md)
- 🎨 **Thiết kế & UI/UX:** [Kiến trúc Dual-Pane Studio](docs/design/DUAL_STUDIO_ARCHITECTURE.md) | [Quy chuẩn UI/UX & Icons](docs/design/UI_UX_DESIGN_SYSTEM.md) | [So sánh 5 Phương án](docs/design/OPTIONS_COMPARISON.md)
- 📚 **Mục lục toàn bộ tài liệu:** [docs/README.md](docs/README.md)

---

## 2. BỐ CỤC DỰ ÁN ĐÃ ĐƯỢC CHUẨN HÓA

```
cavoixanh638/KTXD-report/
├── dist/index.html          # Bản ứng dụng chạy trực tiếp bằng trình duyệt (file://)
├── docs/                    # Hệ thống tài liệu kỹ thuật, hướng dẫn và bằng chứng
│   ├── README.md            # Mục lục điều hướng tài liệu toàn hệ thống
│   ├── guides/              # Sổ tay hướng dẫn người dùng & lập trình viên
│   ├── design/              # Hồ sơ thiết kế giao diện Studio, bảng màu, icon SVG inline
│   ├── specs/               # Quy chuẩn MASTER V2.2 và tài liệu nghiệp vụ
│   ├── plans/               # Kế hoạch con PH1 & PH2
│   ├── status/              # Nhật ký trạng thái dự án (PROJECT_STATUS.md)
│   ├── reviews/             # Hồ sơ soát xét R01 - R06
│   ├── data_checks/         # Bằng chứng kiểm toán nguồn Excel mẫu
│   └── evidence/            # Bằng chứng in PDF và xuất XLSX thực tế
├── data/reference/          # 4 tệp Excel gốc bất biến (bảo vệ bằng SHA-256)
├── src/                     # Mã nguồn TypeScript (core, adapters, ui, export, styles)
├── tests/                   # 43 kịch bản kiểm thử tự động (Vitest)
└── tools/                   # Bộ công cụ đóng gói build.mjs và script kiểm tra SHA-256
```

---

## 3. CÁC QUY TẮC NGHIỆP VỤ BẤT BIẾN (MASTER V2.2)

- **Offline 100%**: Tuyệt đối không dùng CDN, không tải font bên ngoài (Google Fonts), không có external request. Toàn bộ icon dùng SVG inline.
- **Phiên mới 0 địa phương mặc định**: Mỗi phiên làm việc mới luôn khởi tạo với 0 địa phương để đảm bảo an toàn, tránh lấy nhầm số liệu.
- **Nguồn dữ liệu độc lập theo từng phiên**: Mỗi phiên có thể gắn với một bộ file Excel riêng biệt (`datasetOverrides`), ngày chốt số liệu độc lập.
- **GPMB CHỈ THEO DIỆN TÍCH**: Công thức $\frac{\sum I_{\text{đã ghi nhận}}}{\sum D_{\text{thu hồi}}}$. Tuyệt đối không tạo dòng, chế độ hay phép tính "bình quân tỷ lệ dự án".
- **Benchmark mọi tỷ lệ = SUM/SUM**: Tất cả các chỉ tiêu tỷ lệ toàn huyện/thành phố đều bằng tổng các tử số chia tổng các mẫu số; không tính AVERAGE tỷ lệ của các xã.
- **Nguồn thiếu phải có tên**: Phân định rõ ràng các trạng thái `NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`, `ERROR`.
- **Mọi ô số liệu phải có `CalculationTrace`**: Mọi phép tính đều có thể truy vết nguồn gốc ô, công thức, tử số, mẫu số, tập hợp included/excluded và lý do cụ thể.

---

## 4. LỆNH KIỂM THỬ VÀ ĐÓNG GÓI

```bash
# Kiểm tra kiểu dữ liệu TypeScript (Zero errors)
npm run typecheck

# Chạy toàn bộ 43 test suite tự động (Vitest)
npm test

# Xác thực toàn vẹn 4 tệp Excel mẫu
python tools/verify_reference_files.py

# Đóng gói ra bản phân phối duy nhất dist/index.html
npm run build
```

---

## 5. DỮ LIỆU GỐC ĐƯỢC BẢN QUYỀN

Bốn workbook gốc không chỉnh sửa lưu tại [data/reference](data/reference/README.md):
- `data/reference/Báo cáo giải ngân 15.10 sửa(1).xlsx` (SHA-256: `3ba33b...`) — 114 địa phương.
- `data/reference/Bc thu 10 thang-19.10-BC (1)(1).xlsx` (SHA-256: `b41227...`) — 113 địa phương.
- `data/reference/PL01_Tổng hợp DA_26.12.26(1).xlsx` (SHA-256: `d393c3...`) — 108 địa bàn, 422 dự án.
- `data/reference/Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx` (SHA-256: `bd19d2...`) — Mẫu chuẩn 14 dòng.

## Bản cập nhật PH1 ngày 24/11/2026

Các thay đổi nguồn tháng 11, 11 cột A4 ngang, dòng thực thu NSNN tùy chọn, ô gộp REV/DISB/GPMB, bỏ footer nguồn và bảy tên chỉ tiêu chuẩn mới được quy định trong [MASTER V2.2 hiện hành](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md). Xem [PROJECT_STATUS](docs/status/PROJECT_STATUS.md) để biết commit và kết quả CI thực tế. Nhánh cập nhật: `ai/november-source-report-fix-20261124`.

Điều chỉnh trình bày tiếp theo: ba tiêu đề trung bình mặc định ghi 114 địa phương, giá trị tỷ lệ trung bình tăng nhẹ cỡ chữ, giữ nguyên phép tính và độ phủ thật trong kiểm toán. Phiên cũ tự cập nhật nhãn mặc định.

## Cập nhật không phải chạy lệnh

Sau khi CI hoàn tất, chỉ cần **Fetch origin → Pull origin**, sau đó mở `dist/index.html`. Clone mới cũng có sẵn file. Không cần Node.js hay npm để sử dụng. Các lệnh ở mục 4 chỉ dành cho lập trình viên. Xem trạng thái CI/commit bản chạy trong PROJECT_STATUS.

## Nạp 3 file mới nhất

Chọn ba nguồn đã nhập theo ngày chốt xác nhận, giữ phạm vi giải ngân; xem trước và xác nhận chỉ cho phiên đang mở. Khi cùng ngày mà chưa xác định bản chính thức, ưu tiên nội dung được nhập lần đầu gần nhất và cảnh báo. Nguồn thiếu ngày phải xác nhận, không lấy ngày theo tên file. Không quét thư mục máy tính.
