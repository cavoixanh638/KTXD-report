# Sổ tay Lập trình, Bảo trì & Kiến trúc Kỹ thuật (Developer Guide)

> **Dành cho:** Lập trình viên TypeScript, Kỹ sư phần mềm, AI Agent tiếp quản dự án  
> **Phiên bản:** 2.2.0  
> **Quy chuẩn bắt buộc:** MASTER V2.2, AGENTS.md, Offline 100%, TypeScript Strict Mode

---

## 1. Cấu trúc Thư mục Dự án

```
cavoixanh638/KTXD-report/
├── .agents/                    # Bộ công cụ kỹ năng AI (bị bỏ qua bởi git qua .gitignore)
├── data/
│   └── reference/              # 4 tệp Excel gốc bất biến (bảo vệ bằng SHA-256)
│       ├── Báo cáo giải ngân 15.10 sửa(1).xlsx
│       ├── Bc thu 10 thang-19.10-BC (1)(1).xlsx
│       ├── PL01_Tổng hợp DA_26.12.26(1).xlsx
│       ├── Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx
│       └── MANIFEST.json       # Bảng băm SHA-256 và kích thước tệp gốc
├── dist/
│   └── index.html              # Bản build tệp đơn duy nhất (~2.2MB), chạy offline hoàn toàn
├── docs/                       # Tài liệu hệ thống toàn diện
│   ├── README.md               # Mục lục điều hướng tài liệu
│   ├── design/                 # Tài liệu thiết kế UI/UX & Kiến trúc Studio
│   │   ├── DUAL_STUDIO_ARCHITECTURE.md
│   │   ├── UI_UX_DESIGN_SYSTEM.md
│   │   ├── OPTIONS_COMPARISON.md
│   │   └── mockups/            # Ảnh chụp các phương án thiết kế
│   ├── guides/                 # Sổ tay hướng dẫn
│   │   ├── USER_GUIDE.md       # Sổ tay người dùng
│   │   └── DEVELOPER_GUIDE.md  # Sổ tay lập trình (tệp này)
│   ├── specs/                  # Đặc tả quy chuẩn kỹ thuật
│   ├── plans/                  # Kế hoạch thi công PH1 & PH2
│   ├── status/                 # Báo cáo tiến độ & hiện trạng
│   ├── reviews/                # Nhật ký soát xét
│   ├── data_checks/            # Bằng chứng kiểm toán dữ liệu nguồn
│   └── evidence/               # Bằng chứng xuất bản in & DOM
├── src/                        # Mã nguồn TypeScript
│   ├── adapters/               # Bộ đọc và chuẩn hóa dữ liệu từ Excel
│   │   ├── disbursement.ts     # Bộ đọc nguồn Giải ngân (DISB)
│   │   ├── revenue.ts          # Bộ đọc nguồn Thu ngân sách (REV)
│   │   └── gpmb.ts             # Bộ đọc nguồn Giải phóng mặt bằng (GPMB)
│   ├── app/
│   │   └── main.ts             # Điểm khởi nhập (Entrypoint), Event Bus & Điều phối Studio
│   ├── backup/
│   │   └── workspace.ts        # Cơ chế đóng gói và giải nén sao lưu .kxh.json
│   ├── core/                   # Các module xử lý logic nghiệp vụ cốt lõi
│   │   ├── calculationTrace.ts # Cấu trúc đối soát vết tính toán minh bạch
│   │   ├── coverage.ts         # Phân tích độ phủ địa phương theo từng nguồn
│   │   ├── decimal.ts          # Xử lý số học chính xác, tránh lỗi làm tròn JavaScript
│   │   ├── indicators.ts       # Định nghĩa 14 dòng chỉ tiêu và động cơ tính toán
│   │   ├── localities.ts       # Danh mục địa phương chuẩn và xử lý tìm kiếm không dấu
│   │   ├── sessions.ts         # Quản lý phiên, cách ly dữ liệu từng phiên
│   │   ├── sourceReaders.ts    # Đọc cấu trúc nhị phân workbook bằng thư viện XLSX
│   │   ├── storage.ts          # Tầng lưu trữ bộ nhớ (IndexedDB kèm fallback LocalStorage)
│   │   ├── types.ts            # Khai báo kiểu dữ liệu toàn hệ thống
│   │   ├── uncompletedProjects.ts # Xử lý trích xuất danh sách dự án dở dang Dòng 9
│   │   └── warnings.ts         # Quản lý hệ thống cảnh báo nghiệp vụ
│   ├── export/                 # Module xuất báo cáo
│   │   ├── print.ts            # Định dạng và chuẩn bị DOM in ấn A4
│   │   └── xlsx.ts             # Tạo workbook Excel 5 sheet kiểm toán
│   ├── styles/
│   │   └── main.css            # Toàn bộ CSS giao diện, tokens và quy chuẩn in ấn @media print
│   └── ui/                     # Các thành phần giao diện người dùng
│       ├── cellInspector.ts    # Ngăn kéo (Drawer) và Popover soi vết tính toán
│       ├── icons.ts            # Thư viện icon vector SVG inline nội bộ
│       ├── reportGrid.ts       # Bàn cờ hiển thị bảng 14 dòng
│       └── reportStudio.ts     # Khung Studio hai cột (Dual-Pane) và tương tác
├── tests/                      # Bộ kiểm thử tự động
│   ├── ph1.spec.ts             # Bộ 18 kịch bản kiểm thử tích hợp MASTER V2.2 (T01-T66)
│   ├── studio.spec.ts          # Bộ 24 kịch bản kiểm thử giao diện Studio & WYSIWYG
│   └── export-evidence.spec.ts # Sinh lại tệp bằng chứng PDF và XLSX mới nhất
├── tools/                      # Công cụ tự động hóa & Kiểm toán dữ liệu
│   ├── build.mjs               # Script build đóng gói đơn file HTML bằng esbuild
│   ├── verify_reference_files.py # Script kiểm tra SHA-256 của 4 tệp Excel gốc
│   └── audit_*.py              # Các công cụ kiểm toán độc lập
├── AGENTS.md                   # Chỉ thị tối cao cho AI tiếp quản
├── package.json
└── tsconfig.json
```

---

## 2. Quy trình Phát triển & Các Lệnh Thường dùng

### Cài đặt môi trường
Dự án sử dụng Node.js (khuyến nghị >= 18.x) và npm:
```bash
npm install
```

### Các lệnh kiểm tra chất lượng mã nguồn:
1. **Kiểm tra kiểu dữ liệu TypeScript (Zero errors):**
   ```bash
   npm run typecheck
   ```
2. **Chạy toàn bộ 43 test suite tự động (Vitest):**
   ```bash
   npm test
   ```
3. **Xác thực toàn vẹn 4 tệp dữ liệu Excel mẫu:**
   ```bash
   python tools/verify_reference_files.py
   ```
4. **Đóng gói ra bản phân phối duy nhất `dist/index.html`:**
   ```bash
   npm run build
   ```

---

## 3. Kiến trúc Đóng gói Đơn Tệp (Single-File Distribution — `tools/build.mjs`)

Để đảm bảo nguyên tắc **Offline 100%**, người dùng cuối không cần máy chủ, không cần cài Node.js, không cần kết nối mạng. Toàn bộ ứng dụng được đóng gói thành đúng 1 tệp `dist/index.html`:

1. `tools/build.mjs` sử dụng `esbuild` biên dịch TypeScript (`src/app/main.ts`) thành một chuỗi JavaScript duy nhất.
2. Đọc toàn bộ nội dung `src/styles/main.css` và nhúng trực tiếp vào thẻ `<style>` trong HTML.
3. Nhúng mã JavaScript vào thẻ `<script>` trong HTML.
4. Tệp đầu ra `dist/index.html` có dung lượng ~2.2MB (đã bao gồm parser bảng tính XLSX, động cơ tính toán và toàn bộ CSS/SVG).

---

## 4. Các Quy tắc Nghiệp vụ Bất biến (Inviolable Rules)

Bất kỳ AI hoặc lập trình viên nào phát triển tiếp đều **bắt buộc tuân thủ 100% các quy tắc sau (theo MASTER V2.2 & AGENTS.md)**:

1. **GPMB CHỈ THEO DIỆN TÍCH**:
   $$\text{Tỷ lệ GPMB} = \frac{\sum I_{\text{đã ghi nhận}}}{\sum D_{\text{thu hồi}}}$$
   - Tính trên toàn bộ dự án thuộc phạm vi địa phương được chọn.
   - **Tuyệt đối không tạo bất kỳ dòng, chế độ hoặc phép tính "bình quân tỷ lệ dự án"** trong bảng báo cáo hay bản xuất.
   - Cột M chỉ giữ raw và đánh dấu M khác $100 \times I/D$ ở dòng dự án nếu vượt ngưỡng $>0.1$ điểm %; không tính bình quân M trên dòng tổng xã. Thiếu I vẫn là `MISSING`.
2. **BENCHMARK MỌI TỶ LỆ = SUM/SUM**:
   - Tất cả các tỷ lệ ở cột Toàn huyện / Toàn thành phố đều phải tính bằng:
     $$\text{Benchmark} = \frac{\sum \text{Tử số}}{\sum \text{Mẫu số}}$$
   - Tuyệt đối không lấy `AVERAGE` tỷ lệ của các xã/phường.
   - Xã có mẫu số bằng 0 không bị loại khỏi phép cộng tổng nếu cả tử và mẫu đều là số hợp lệ.
3. **PHIÊN MỚI 0 ĐỊA PHƯƠNG MẶC ĐỊNH**:
   - Khi tạo một phiên làm việc mới, danh sách địa phương được chọn mặc định là rỗng (`[]`). Người dùng phải chủ động tích chọn xã cần báo cáo.
4. **CÁCH LY NGUỒN DỮ LIỆU THEO TỪNG PHIÊN**:
   - Mỗi phiên lưu trữ cấu hình dataset riêng trong trường `datasetOverrides`. Việc nạp file hoặc thay đổi dataset trong một phiên không được phép làm thay đổi số liệu của các phiên khác.
5. **NGUỒN THIẾU PHẢI CÓ TÊN**:
   - Không được quy chụp thiếu dữ liệu là do kinh tế/hành chính. Hệ thống phân định rạch ròi các trạng thái: `NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`, `ERROR`, `DATE_UNVERIFIED`.
6. **MỌI PHÉP TÍNH PHẢI KÈM `CalculationTrace`**:
   - Mọi ô số liệu khi hiển thị đều phải có cấu trúc `CalculationTrace` đi kèm, ghi rõ: công thức, tử số, mẫu số, tập hợp included, tập hợp excluded và lý do, đơn vị, ngày chốt, nguồn ô và mã SHA-256. Không nghiệm thu nếu chỉ trả về số cuối.

---

## 5. Hướng dẫn Mở rộng & Bổ sung Tính năng

### 5.1. Thêm một dòng chỉ tiêu mới
1. Mở `src/core/indicators.ts`.
2. Khai báo mã chỉ tiêu và nhãn trong danh sách chỉ tiêu chuẩn.
3. Định nghĩa hàm tính toán trả về giá trị số học kèm `CalculationTrace`.
4. Cập nhật `src/adapters/` nếu chỉ tiêu cần đọc thêm cột mới từ các file Excel nguồn.
5. Cập nhật `src/export/xlsx.ts` để đồng bộ chỉ tiêu mới vào Sheet 1 của file xuất Excel.
6. Thêm kịch bản kiểm thử trong `tests/studio.spec.ts`.

### 5.2. Thêm một Adapter cho nguồn Excel có cấu trúc mới
1. Mở thư mục `src/adapters/`.
2. Tạo file adapter mới kế thừa giao diện đọc dữ liệu chuẩn (`SourceAdapter`).
3. Đọc dữ liệu nhị phân thông qua `parseXlsxBytes` trong `src/core/sourceReaders.ts`.
4. Trích xuất tên xã/phường, chuẩn hóa tên thông qua `canonicalName` và `searchKey` trong `src/core/localities.ts`.
5. Đăng ký adapter vào luồng nạp dữ liệu trong `src/app/main.ts`.

## Bảo trì PH1 — 24/11/2026

Xem mục cập nhật quy phạm trong MASTER. `resolveRevenueHeader` và `DISB_SCHEMA_PROFILES.DISB_TOTAL_LOCALITY_V2` thay logic cố định khi nhận mẫu mới. Không bỏ provenance hoặc bỏ kiểm tra duplicate. `reportMainStt`, `formatRevRealizedRowLabel` điều khiển dòng thực thu. `horizontalPageCapacity` và `horizontalFit` dùng chung giữa Studio/print. `isSharedReportIndicator` là nguồn duy nhất của chính sách gộp ba benchmark; dùng trong reportGrid, reportStudio, print, xlsx. Không ghi đè số liệu tính để phục vụ gộp. Sheet 2 lưu thông tin nguồn chuyển khỏi footer; bốn sheet audit giữ nguyên. Kiểm thử NOV_FIX_01–03; workflow November source and report fixes chạy typecheck/build/test; báo QA theo SHA.

### Bảo trì nhãn chỉ tiêu (24/11/2026)

`normalizeLocalityReportLabel` và `formatBenchmarkReportLabel` trong `src/core/indicators.ts` chuẩn hóa bảy tên theo MASTER, cập nhật ngày, cố định nhãn 114 địa phương trên bảng chính. `syncReportLabelsWithDatasetDates`/`migrateLegacySessionLabels` đồng bộ phiên cũ; `evaluateSessionReport` dùng bản sao row config khi render. Không hardcode ngày tháng 11 hoặc thay đổi độ phủ thực; cố định 114 chỉ ở nhãn mặc định. Không ghi đè nhãn tùy chỉnh khác. `isReportBenchmarkRate` áp dụng class `report-benchmark-value` cho số liệu và style XLSX 34/35 (11 pt). `NOV_FIX_04` kiểm tra migration, độ phủ kiểm toán, ngày, định dạng và cả ba đầu ra.

### Phân phối HTML tự động

Bản chạy duy nhất `dist/index.html` được theo dõi trực tiếp trong Git; người dùng clone hoặc Fetch/Pull origin nhánh phân phối rồi mở file bằng Chrome/Edge, không cần cài Node.js, npm, chạy build hoặc mở server. GitHub Actions hiện có trên nhánh `ai/november-source-report-fix-20261124` (và `main` sau khi được merge) chạy xác minh 4 nguồn tham chiếu, typecheck, build, test và chỉ sau khi đạt mới commit riêng file HTML đã build bằng GITHUB_TOKEN. Không force-push; bot push không kích hoạt lại CI. Các nhánh khác chỉ phân phối sau khi được hợp nhất hoặc build có chủ đích. Không commit `node_modules`, các tệp nguồn người dùng nhập hay đầu ra khác. HTML chỉ nhúng ba workbook tham chiếu đã được cho phép; không đưa dữ liệu phiên cá nhân vào repo. Nếu CI thất bại hoặc push bị từ chối, chưa công bố bản mới là sẵn sàng. Bản build thủ công chỉ dành cho phát triển.

Ba chỉ tiêu tỷ lệ trung bình REV/DISB/GPMB đều gộp toàn bộ cột địa phương trong mỗi nhóm/trang ngang, gộp hàng trong Studio dọc và merge ô giá trị trong Excel. Mỗi nhóm/trang chỉ hiển thị một kết quả, căn giữa; giữ cỡ chữ lớn hơn 10% (Excel 11 pt), trace chung, công thức và phạm vi nguồn. Không gộp chỉ tiêu riêng từng địa phương. `isSharedReportIndicator` là điểm cấu hình duy nhất; kiểm thử NOV_FIX_03/04.

Migration `normalizeLocalityReportLabel` cho `GPMB_BUDGET` nhận diện chính xác cả nhãn cũ `Kinh phí phân bổ GPMB cho từng xã` và `Kinh phí phân bổ GPMB cho từng phường`, chuẩn hóa sang `Kinh phí phân bổ GPMB cho từng địa phương`. Giữ nhãn tùy chỉnh không khớp chính xác. NOV_FIX_04 kiểm tra cả render và migration, PDF/XLSX.
