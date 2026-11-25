# CHECKPOINT — WebApp KTXH Offline (MASTER V2.2)

- **Ngày cập nhật:** 2026-11-24
- **Repository:** `cavoixanh638/KTXD-report` (Private)
- **Nhánh triển khai hiện tại:** `ai/november-source-report-fix-20261124` (kế thừa `gemini`; không merge main)
- **Tài liệu có hiệu lực:** [`MASTER V2.2`](../specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md), [`PH1`](../plans/PHASE_1_RESULT_TEMPLATE.md), [`PH2`](../plans/PHASE_2_EXTENSIBILITY.md).
- **Trạng thái tổng:** `MASTER_V2.2 / PH1_DOCUMENT_STUDIO_WYSIWYG_IMPLEMENTED / PH2_NOT_STARTED`.
- **Hệ thống Tài liệu Mới:**
  - `docs/README.md`: Mục lục & Bản đồ điều hướng tài liệu toàn hệ thống.
  - `docs/guides/USER_GUIDE.md`: Sổ tay hướng dẫn người dùng chi tiết (cán bộ, chuyên viên, lãnh đạo).
  - `docs/guides/DEVELOPER_GUIDE.md`: Sổ tay lập trình, kiến trúc mã nguồn, quy trình build và test.
  - `docs/design/DUAL_STUDIO_ARCHITECTURE.md`: Đặc tả kiến trúc Dual-Pane Studio (Phương án 5).
  - `docs/design/UI_UX_DESIGN_SYSTEM.md`: Chuẩn UI/UX Design System, Typography, Icon SVG nội bộ, phím tắt.
  - `docs/design/OPTIONS_COMPARISON.md`: Đánh giá 5 phương án thiết kế UI/UX và các tinh gọn đã chốt.
  - `docs/design/mockups/`: Lưu trữ ảnh demo 5 phương án và ảnh chụp thực tế màn hình app.
- **Dọn dẹp thư mục dự án:**
  - Xóa 4 tệp Excel trùng lặp ở thư mục gốc (`Báo cáo giải ngân 15.10 sửa(1).xlsx`, `Báo cáo thu 10 thang-19.10-BC (1)(1).xlsx`, `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx`, `Tổng hợp DA_26.12.26(1).xlsx`), chỉ giữ 4 tệp chuẩn trong `data/reference/`.
  - Xóa thư mục thừa `chatgpt/` và thư mục rỗng `docs/screenshots/`.
- **Bốn file nguồn tham chiếu (`data/reference/MANIFEST.json` — 4/4 SHA-256 PASS):**
  - `DISB_20261015`: `3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c` (114 địa phương, ngày chốt `2026-10-15`, sheet `Tổng hợp` index 5 `visible`, 7 sheet `hidden`).
  - `REV_10M_2026`: `b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f` (113 địa phương, thiếu `Đặc khu Bạch Long Vĩ`, sheet `10T-19.10` `visible`, ngày chốt yêu cầu người dùng xác nhận).
  - `GPMB_20261026`: `d393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f` (108 địa bàn, 422 dòng dự án, ngày chốt `2026-10-26`, thiếu 6 địa bàn: `Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ`; 3 dự án thiếu I tại dòng `107, 173, 365`; 12 dự án có cột M lệch `100*I/D > 0,1 điểm %`).
  - `RESULT_REFERENCE`: `bd19d2d910619d36dab5e3332ad9c8a491e3652b631e65b81e62bb23e6a4ec51` (Mẫu bố cục 14 dòng `Sheet1` dòng 3–16; không chọn sẵn 11 xã và không lấy mốc 76% hay 70,8% cũ).

## KẾ HOẠCH CON 1 — Trạng thái thực thi & Nghiệm thu Runtime

| Gói | Đầu ra | Module / Files thay đổi | Trạng thái | Bằng chứng thực chạy |
|---|---|---|---|---|
| **PH1-01** | Nhập 3 file theo profile cố định, fingerprint, chọn đúng visible sheet, xác minh SHA-256 và ngày chốt độc lập | `src/core/sourceReaders.ts`, `src/adapters/*.ts` | `PASS` | `T14, T19, T31, T39, T40` PASS trong `tests/ph1.spec.ts` |
| **PH1-02** | 14 dòng chỉ tiêu theo `RESULT_REFERENCE` (dòng 3–16), Decimal.js 40 chữ số, quy đổi đơn vị, benchmark tổng/tổng & quy tắc R04 mẫu số = 0 | `src/core/decimal.ts`, `src/core/indicators.ts`, `src/core/calculationTrace.ts` | `PASS` | `T01–T13, T53–T59` PASS (`DISB 114 = 67,10%`, `Vốn BQ = 136,41 tỷ`, `REV 113 = 111,30%`, `Thu đất năm = 136,12%`, `Thu đất kỳ = 202,71%`, `GPMB 108 = 72,13%`, `Hồng Châu GPMB = 30,09%`, `Kinh Môn GPMB = 84,51%`) |
| **PH1-03** | Kiểm toán nguồn thiếu có tên (`NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`) & cờ đối chiếu M/I/D dòng dự án GPMB | `src/core/coverage.ts`, `src/core/warnings.ts` | `PASS` | `T20, T21, T25–T30, T33–T38, T60–T63` PASS (12 warning M/I/D, 111 lượt cảnh báo/90 dòng dự án, 296 ô trống DISB trên 104 dòng đạt `PASS_WITH_MISSING_COMPONENTS`) |
| **PH1-04** | Chọn địa phương NFC có dấu (tìm kiếm không dấu), đa phiên độc lập (0 địa phương mặc định), tùy chỉnh bảng | `src/core/localities.ts`, `src/core/sessions.ts`, `src/backup/workspace.ts` | `PASS` | `T15, T16, T17, T24, T28, T51, T64` PASS (Phiên A 5 xã, Phiên B 7 phường, clone, ghim version dataset, checksum SHA-256 `.kxh.json`) |
| **PH1-05** | Hồ sơ giải trình phép tính `CalculationTrace` cho 100% ô tính và ô nguồn | `src/core/calculationTrace.ts`, `src/ui/cellInspector.ts` | `PASS` | `T41–T48` PASS (Quét 100% ô trong bảng 14 dòng đều có `traceId`, công thức, số hạng Decimal gốc, included/excluded, zeroDenominatorContributors, SHA-256) |
| **PH1-06** | WebApp Document Studio `dist/index.html` chạy trực tiếp qua `file://` Chrome/Edge tắt mạng, xuất XLSX 5 sheet (kiểm chứng `openpyxl`), in/PDF phân trang A4 ngang chuẩn văn bản hành chính | `src/app/main.ts`, `src/ui/reportStudio.ts`, `src/ui/reportGrid.ts`, `src/export/xlsx.ts`, `src/export/print.ts`, `src/styles/main.css`, `tools/build.mjs` | `PASS` | `T18, T22, T23, T32, T52, T65, T66` PASS; kiểm chứng bằng `openpyxl` và Microsoft Edge Headless (`docs/evidence/EDGE_HEADLESS_DOM_DUMP.html`, `docs/evidence/SCREENSHOT_STUDIO_APP.png`, `docs/evidence/BAO_CAO_KTXH_A4_PRINT.pdf`) |

## KẾT QUẢ KIỂM THỬ RUNTIME (`T01`–`T66` & STUDIO SUITE)

- **Lệnh kiểm thử:** `npm run typecheck; npm test; npm run build` (kèm kiểm chứng Edge Headless CDP trên `file:///.../dist/index.html`)
- **Bộ kiểm thử runtime tại checkpoint 14/11 (lịch sử):** 3 test suites, **43/43 tests PASS** (`tests/ph1.spec.ts` 18 tests, `tests/studio.spec.ts` 24 tests, `tests/export-evidence.spec.ts` 1 test).
- **Tinh chỉnh giao diện, tìm kiếm và công thức tính đã hoàn thiện:**
  1. Loại bỏ hoàn toàn khối cơ quan chủ quản (Sở KH&ĐT), quốc hiệu tiêu ngữ và dòng ngày chốt số liệu meta ở đầu trang báo cáo.
  2. Loại bỏ phụ đề và huy hiệu phiên ở đầu báo cáo; căn giữa tiêu đề chính `TÌNH HÌNH THỰC HIỆN MỘT SỐ CHỈ TIÊU KINH TẾ - XÃ HỘI CỦA CÁC ĐỊA PHƯƠNG`.
  3. Loại bỏ các dòng ghi chú phụ/dòng mẫu dưới tên chỉ tiêu trong các bảng.
  4. Loại bỏ phần chân trang: ghi chú phương pháp tính & dữ liệu nguồn (Master V2.2 & R06) và khối chữ ký (Người lập biểu, Thủ trưởng đơn vị), chỉ giữ đánh số trang gọn gàng.
  5. Đổi tên chỉ tiêu `DISB_PLAN`: "Kế hoạch vốn đầu tư công sau điều chỉnh" $\to$ **"Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND"** (đã bổ sung cơ chế di chuyển `migrateLegacySessionLabels` tự động cập nhật ngay lập tức các phiên cũ lưu trong `localStorage`).
  6. Đổi tên chỉ tiêu `DISB_COMPARISON_LABEL`: "Nhận xét tỷ lệ giải ngân" $\to$ **"Kết quả giải ngân so với tỷ lệ trung bình"**.
  7. Đổi tên chỉ tiêu `GPMB_COMPARISON_LABEL`: "Đánh giá GPMB" $\to$ **"Kết quả GPMB so với tỷ lệ trung bình"**.
  8. Đổi tên chỉ tiêu `REV_RATE_Y`: **"Tỷ lệ thu NSNN so với dự toán (đến ngày 19/10/2026)"**.
  9. Đổi tên chỉ tiêu `DISB_BENCHMARK_RATE`: **"Tỷ lệ giải ngân chung của các địa phương (đến ngày 15/10/2026)"**.
  10. Đổi tên chỉ tiêu `GPMB_BENCHMARK_AREA_RATE`: **"Tỷ lệ GPMB trung bình của các địa phương (đến ngày 26/10/2026)"** (hiển thị sạch `72,13%`, không còn chuỗi cảnh báo).
  11. Đổi tên chỉ tiêu `GPMB_AREA_RATE`: **"Tỷ lệ GPMB của từng địa phương"**.
  12. Lược bỏ dòng "So với mức vốn giao bình quân một địa phương" khỏi bảng báo cáo Document Studio và bản in.
  13. Kế hoạch vốn đầu tư công sau điều chỉnh (`DISB_PLAN`) tự động tính và hiển thị số tăng/giảm/giữ nguyên so với kế hoạch ban đầu (Cột F so với Cột C, ví dụ Xã Kiến Thụy: `2101,33 tỷ (tăng 38,25 tỷ)`, Xã Hồng Châu: `35,68 tỷ (giữ nguyên)`).
  14. Tất cả các cụm từ "(đến ngày...)" trên tiêu đề chỉ tiêu đều được in đậm tự động.
  15. Các số gốc Decimal chưa làm tròn trên popover và inspector hiển thị tối đa 4 chữ số sau dấu thập phân.
  16. Các chỉ tiêu có đơn vị tỷ đồng hiển thị kèm chữ `tỷ` ngay bên cạnh số liệu (`formatReportCellValue`).
  17. Sửa triệt để lỗi nhảy con trỏ tìm kiếm địa phương: lọc danh sách in-place không tải lại toàn trang và tự động bảo lưu focus/selectionRange của ô nhập liệu.
  18. Xóa nhãn phân loại thừa (`Xã`, `Phường`, `Đặc khu`) ở tiêu đề cột khi tên đã có chữ Xã/Phường; xóa cột `Loại` ở bố cục bảng dọc.
  19. So sánh tỷ lệ GPMB trực tiếp với mốc trung bình 108 địa bàn: loại bỏ giới hạn "Chưa đủ cơ sở đánh giá", tính trực tiếp độ lệch điểm phần trăm.
  20. Chuẩn hóa kết quả so sánh giải ngân và GPMB: đổi dấu +/- thành dấu >/<, hiển thị rõ mức độ `cao hơn (>X,XX%)`, `thấp hơn (<X,XX%)` hoặc `tương đương (0,00%)` (ví dụ: `thấp hơn (<47,05%)`, `cao hơn (>25,99%)`).
  21. Các dòng chỉ tiêu không có số thứ tự (dòng phụ con) được định dạng chữ nghiêng (`font-style: italic;`) và không in đậm (`font-weight: normal;`).
  22. Riêng GPMB ghi nhận mặc định 6 địa bàn (`Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ`) không có số liệu nguồn, và hiển thị rõ ràng trên ô báo cáo là **"Không có nhiệm vụ GPMB"** thay vì "Chưa có số liệu" hay để trống.
  23. Tự động bổ sung đơn vị diện tích (`m2` hoặc `ha` theo cài đặt phiên) vào giá trị diện tích GPMB (ví dụ: `550.046 m2`).
  24. Thêm dòng chữ nhỏ in nghiêng ngay dưới tiêu đề báo cáo chính (tùy chỉnh nội dung, bật/tắt hiển thị linh hoạt trong form cài đặt tiêu đề).
  25. **Đồng bộ tuyệt đối giữa giao diện WebApp trực tiếp và bản in/PDF (WYSIWYG)**:
      - Thiết lập `table-layout: fixed`, padding lề giấy `8mm 10mm` chuẩn xác trên cả WebApp và `@page print`, cố định cột STT (30px) và Chỉ tiêu (240px), phân bổ đều tuyệt đối độ rộng các cột địa phương.
      - Loại bỏ nút bút chì `✎` lộ diện trên tiêu đề ở trạng thái bình thường (chỉ hiện mờ khi hover để bấm sửa, ẩn hoàn toàn khi in).
      - Loại bỏ các biểu tượng cảnh báo `⚠` và ghi chú `📝` chen ngang giữa nội dung ô tính trong bảng Document Studio. Chuyển sang chấm chỉ báo tinh tế ở góc ô và mở chi tiết khi nhấp chuột (Cell Inspector), giữ cho bảng xem trước trên web luôn phẳng, sạch, đúng chuẩn văn bản hành chính như bản in ra giấy.
      - **Sửa triệt để lỗi chữ tràn ô (Wrap text & zero-bleed)**: thiết lập `box-sizing: border-box; overflow: hidden; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;` cho toàn bộ các ô trong bảng, đảm bảo căn giữa chữ, ngắt dòng êm ái và tuyệt đối không bao giờ tràn qua viền sang ô khác.
  26. **Phương án 3 — Quản lý & hiển thị các dự án GPMB chưa hoàn thành (Option 3)**:
      - **Dòng trong Bảng tổng hợp:**
        - **Dòng STT 8:** Đổi tên thành **"Số dự án chưa hoàn thành GPMB"** (có STT 8, in đậm, người dùng có thể nhấp ✎ để sửa nhãn). Ô tương ứng từng địa phương hiển thị:
          - 6 địa bàn không có số liệu GPMB: `"Không có nhiệm vụ GPMB"`.
          - Địa phương có toàn bộ dự án đã xong 100% (ví dụ Xã An Phú): `"Đã hoàn thành"`.
          - Địa phương có dự án chưa xong: hiển thị số lượng cụ thể (ví dụ Xã Nam Sách: `"4 dự án"`, Xã Trần Phú: `"2 dự án"`, Xã Hợp Tiến: `"1 dự án"`).
        - **Dòng con ngay dưới dòng 8:** Không có STT, tiêu đề in nghiêng **"Tên dự án chưa hoàn thành GPMB"**; các dự án được liệt kê trực tiếp trong ô ứng với từng xã theo đúng định dạng `tên dự án - tỷ lệ hoàn thành - hạn hoàn thành` (nhiều dự án được đánh số `1. ...`, `2. ...` xuống dòng rõ ràng, có nút ✎ trên web để sửa nhanh).
      - **Nút hiện lại Bảng phụ lục chi tiết:** Khi người dùng bấm ẩn bảng chi tiết dự án, hệ thống giữ nút **`👁 Hiện bảng chi tiết danh mục dự án GPMB (X dự án)`** ngay tại vị trí phụ lục và trong bảng Cài đặt tiêu đề, giúp người dùng bật/tắt bảng linh hoạt bất kỳ lúc nào.
      - **Bảng phụ lục danh mục dự án chưa hoàn thành:** Hiển thị trực tiếp ngay dưới Bảng tổng hợp (trên Web, bản in A4 và tệp xuất XLSX) với đúng 5 cột theo yêu cầu: `STT | Địa phương | Tên dự án | Tỷ lệ hoàn thành | Hạn hoàn thành` (và nút thao tác trên Web). Tuyệt đối không hiển thị các cột diện tích, kinh phí thừa. Tự động lấy hạn hoàn thành từ Cột H file nguồn GPMB.
      - **Khả năng chỉnh sửa chủ động:** Bấm nút `✎ Sửa` trên từng dự án để sửa Tên dự án, Tỷ lệ hoàn thành, Hạn hoàn thành, hoặc đánh dấu Ẩn dự án; có nút `+ Thêm dự án` để thêm dự án mới và nút `Khôi phục mặc định`. Dữ liệu chỉnh sửa được lưu kiên định vào cấu hình phiên (`session.settings.projectOverrides` và `session.settings.customProjects`) và sao lưu nguyên vẹn trong `.kxh.json`.
      - **Bảo toàn tính độc lập (Non-interference):** Giữ nguyên vẹn 100% 14 dòng chỉ tiêu gốc (`TEMPLATE_14_ROWS_DEFAULT`), các mốc benchmark và không làm thay đổi hay xê dịch bất kỳ cột, dòng không liên quan nào khi nạp thêm dữ liệu khác.
  22. **In ấn & Xuất PDF chuẩn văn bản hành chính:** Loại bỏ hoàn toàn ký hiệu cảnh báo ⚠, biểu tượng ghi chú 📝, thông tin số trang ("Trang 1 / 1") và các bảng phụ lục (Coverage Audit, Trace, M-mismatch) khi in; bản in và xuất PDF chỉ in đúng 1 trang Báo cáo tổng hợp sạch sẽ, chuẩn xác.
  23. **Sắp xếp thứ tự địa phương linh hoạt:** Mặc định đưa các địa phương được chọn lên đầu danh sách (`SELECTED_FIRST`); bổ sung thanh công cụ sắp xếp thứ tự cột báo cáo (nút di chuyển ▲/▼, sắp xếp A→Z, Z→A, đảo ngược và gỡ bỏ ✕ trực tiếp).
  24. **Giao diện Nhập nguồn thu gọn (Compact One-Screen):** Thiết kế lại thanh kéo thả compact và hiển thị 3 nguồn dữ liệu (DISB, REV, GPMB) theo dạng lưới 3 cột ngang (`.card-grid-3`), gom gọn kiểm toán nguồn thiếu dạng pills giúp toàn bộ trang hiển thị trọn vẹn trên 1 màn hình không cần cuộn; khắc phục lỗi thanh cuộn cho khu vực làm việc trung tâm.
  25. **Loại bỏ hiển thị số trang:** Đã gỡ bỏ toàn bộ dòng chữ "Trang 1 / 1" ở cuối báo cáo trong cả giao diện Document Studio lẫn bản in theo yêu cầu.
  26. **Bộ đọc tự động GPMB Bảng phẳng CSDL (`GPMB_FLAT`):** Hỗ trợ nhận diện và nạp trực tiếp cả tệp `.xlsx` và `.csv` dạng bảng phẳng (flat table) có cột định danh `Phường xã`, tự động nhận dạng các cột diện tích (`Tổng DT GPMB`, `DT đã thu hồi`), tiền phân bổ và tỷ lệ để gom nhóm theo địa bàn và tính toán đúng công thức `SUM(I)/SUM(D)`.
  27. **Điều chỉnh ngày chốt số liệu & Tự động đồng bộ báo cáo:** Cho phép người dùng chỉnh sửa trực tiếp ngày chốt của cả 3 nguồn (DISB, REV, GPMB) trong thẻ dữ liệu nguồn; hệ thống tự động cập nhật ngày chốt vào các tiêu đề chỉ tiêu tương ứng trong bảng báo cáo A4, bản in và bản xuất Excel (`(đến ngày DD/MM/YYYY)`).
  28. **Bổ sung Dòng 9 — Dự án theo NQ 11 có khó khăn, vướng mắc:**
      - Thêm dòng chính STT 9: tiêu đề mặc định **"Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc"** (có nút ✎ để người dùng chủ động đổi tên dòng và nút `+ Thêm` toàn cục).
      - Mô hình nhập liệu và hiển thị theo mẫu dòng 8: ô tương ứng mỗi địa phương hiển thị danh sách dự án với 3 thông tin quan trọng `Tên dự án - Nội dung khó khăn, vướng mắc / Tiến độ - Hạn hoàn thành` (chi tiết đến tháng, ví dụ `Hạn tháng 11/2026`). Nếu địa phương chưa có dự án NQ 11, hiển thị dấu `-` cùng nút `+ Thêm` nhanh tiện lợi.
      - Có hộp thoại popup thêm mới và chỉnh sửa/xóa dự án NQ 11 linh hoạt.
      - Cỡ chữ phần chi tiết dự án (bộ nút `[-A]` / `[+A]` và thanh trượt cỡ chữ trong form Cài đặt tiêu đề) áp dụng đồng bộ cho cả dòng 8 và dòng 9.
      - Khi bật tùy chọn tách trang (`Tách riêng từ dòng 8 sang trang khác`), cả dòng 8 (kèm dòng con) và dòng 9 cùng được chuyển sang Trang 2 gọn gàng, vừa khít khổ A4 ngang.
      - Đồng bộ hiển thị 100% trên Web Studio, bản in A4 (`window.print()`) và tệp xuất Excel (Sheet 1).
  29. **Hiển thị tỷ lệ tổng số dự án dòng 8:** Bổ sung hiển thị rõ `X/Y dự án chưa hoàn thành` (ví dụ: `2/4 dự án chưa hoàn thành`, `4/4 dự án chưa hoàn thành`, hoặc `Hoàn thành 1/1 dự án` khi 100% dự án đã hoàn thành).
  30. **Hạn hoàn thành chi tiết đến tháng:** Chuẩn hóa toàn bộ thời hạn hoàn thành của các dự án GPMB và NQ 11 chi tiết đến tháng (ví dụ: `Hạn tháng 11/2026`, chuyển đổi từ "Trong năm 2026" hoặc ngày cụ thể).
  31. **Tùy chỉnh độ rộng cột Chỉ tiêu & Tự động chia đều cột xã:** Cho phép tùy chỉnh chiều rộng cột `Chỉ tiêu / Kết quả thực hiện` (mặc định 240px, có thể tăng/giảm từ 160px–600px). Chiều rộng cột STT giữ nguyên (30px), phần chiều rộng thừa hoặc thiếu sẽ tự động phân bổ đều về các cột của các xã/phường.
  32. **Căn giữa tiêu đề báo cáo:** Khi tùy chọn ẩn dòng chữ nhỏ in nghiêng dưới tiêu đề, hệ thống tự động ẩn hoàn toàn phần ghi chú và căn giữa tuyệt đối tiêu đề báo cáo chính.
  33. **Căn lề trên (Top Align) đồng bộ cho Dòng 8, Dòng con dưới Dòng 8 và Dòng 9:** Khắc phục lỗi trùng thuộc tính `style` HTML trong `reportStudio.ts`, đồng bộ `vertical-align: top` trên toàn bộ cột (STT, Chỉ tiêu, các xã/phường) ở cả Web Studio (`main.css`), bản in (`print.ts`) và tệp Excel (`xlsx.ts`, `vertical="top"`).
  34. **Hỗ trợ mẫu Giải ngân Vốn phân cấp cấp xã (`DISB_PHAN_CAP_XA_V1`) & bỏ phần so sánh đầu năm khi nguồn thiếu cột trước điều chỉnh:** Tự động nhận diện bảng 12 cột (`A–L`, dòng `8–121`, ngày chốt từ `A1`, tổng KHV ở cột `C`, giải ngân ở cột `G`, tỷ lệ ở `K`, ghi chú QĐ 4581 ở `L`, kiểm tra cân đối `C=D+E+F` và `G=H+I+J`); tự động bỏ ghi chú so sánh `(tăng/giảm/giữ nguyên)` trên dòng `DISB_PLAN` (STT 3) khi nguồn không có cột trước ĐC hoặc khi tắt tùy chọn `showDisbPlanAdjustmentComparison`, đồng bộ cập nhật động mốc chuẩn (`79,43%`) và ngày chốt trên giao diện, Studio, In và XLSX.
  35. **Khắc phục triệt để lỗi treo khởi tạo `file://` khi `indexedDB.open` bị treo/chặn hoặc cache cũ hỏng (`storage.ts`, `sessions.ts`, `main.ts`, `build.mjs`):** Đặt timeout (`600ms` mở DB, `1000ms` transaction) và bắt `onblocked` + đóng kết nối DB sau khi xong; thêm cơ chế lưu dự phòng phiên nhẹ (`KTXH_OFFLINE_SESSIONS_COMPACT_V2_2`) trong `localStorage`; bổ sung `sanitizeWorkspace` tự vá dữ liệu cache/phiên cũ thiếu trường, bọc `try/catch` toàn bộ `initWorkspace()` bao gồm cả `this.render()`, tự nạp bù từng nguồn nhúng bị thiếu, và gắn watchdog + nút khôi phục cache trên `#app`.
  36. **Hỗ trợ chuẩn mẫu Giải ngân Vốn phân cấp cấp xã 15 cột (`DISB_PHAN_CAP_XA_V2`) & khôi phục so sánh vốn đầu năm (`types.ts`, `sourceReaders.ts`, `coverage.ts`, `calculationTrace.ts`, `reportGrid.ts`, `cellInspector.ts`, `main.ts`):** Phân tách dứt khoát giữa mẫu 12 cột không có KHV đầu năm (`DISB_PHAN_CAP_XA_V1`, `A–L`) và mẫu 15 cột có đủ KHV đầu năm (`C–E`), KHV sau điều chỉnh (`F–I`), giải ngân (`J–M`), tỷ lệ (`N`), ghi chú QĐ 4581 (`O`, `DISB_PHAN_CAP_XA_V2`, kiểm tra cân đối `C=D+E`, `F=G+H+I`, `J=K+L+M`); khôi phục tự động ghi chú so sánh `(tăng/giảm/giữ nguyên)` trên Dòng 3 (`DISB_PLAN`), đồng bộ nhãn ngày chốt `(đến ngày 08/11/2026)` trên Dòng 4 (`DISB_BENCHMARK_RATE`) và mốc chuẩn `79,43%` trên Studio, In/PDF và XLSX.
  37. **Bổ sung tùy chọn hiển thị dòng Tỷ lệ thu NSNN chung (`REV_BENCHMARK_RATE` / `showRevBenchmarkRow`, `types.ts`, `indicators.ts`, `sessions.ts`, `calculationTrace.ts`, `main.ts`):** Mặc định giữ nguyên 14 dòng mẫu chuẩn (`TEMPLATE_14_ROWS_DEFAULT`); khi người dùng bật tùy chọn ở panel *Tiêu đề* hoặc tab *Mốc chuẩn & Chỉ tiêu*, tự động chèn dòng tỷ lệ hoàn thành thu NSNN chung (`SUM(thu) / SUM(dự toán)`, `111,30%` trên bộ mẫu `113/114`, ghi nhận thiếu `Đặc khu Bạch Long Vĩ` trong `CalculationTrace`, không ghi 114) ngay trước `REV_RATE_Y`, đồng bộ Studio, In/PDF, XLSX và `CalculationTrace`.
  38. **Chuẩn hóa tiêu đề các chỉ tiêu theo mẫu báo cáo mới & tự động chuyển STT 2 khi bật Tỷ lệ thu NSNN chung (`indicators.ts`, `sessions.ts`, `calculationTrace.ts`, `main.ts`):** Cập nhật nhãn mặc định và di chuyển nhãn phiên cũ (`migrateLegacySessionLabels`) sang các tiêu đề chuẩn mới (`Dự toán thu NSNN giao từng địa phương tại QĐ 5055`, `Tỷ lệ thu NSNN chung của các địa phương (đến ngày ...)`, `Tỷ lệ thu NSNN của từng xã so với dự toán (đến ngày ...)`, `Kế hoạch vốn đầu tư công sau điều chỉnh, bổ sung`, `Tỷ lệ giải ngân của từng địa phương`, `Kinh phí phân bổ GPMB cho từng xã`, `Diện tích phải GPMB của từng xã`); đồng thời khi bật `showRevBenchmarkRow`, dòng `REV_BENCHMARK_RATE` tự động nhận STT `2` (in đậm `.doc-row-primary`) và dòng `REV_RATE_Y` chuyển sang không có STT (in nghiêng `.doc-row-sub`) đồng thời lược bỏ phần `(đến ngày ...)` để tránh lặp ngày chốt, đồng bộ trên Web Studio, In/PDF và XLSX mà không làm biến đổi cấu hình gốc trong `session.templateRows`.
  39. **Đồng bộ định dạng xuất Excel (`.xlsx`) sát giao diện Webapp (`xlsx.ts`, `sourceReaders.ts`):** Đồng bộ tỷ lệ độ rộng cột (`STT=6`, `Chỉ tiêu` theo `indicatorColumnWidthPx`, cột địa phương co giãn theo cấu hình và khổ trang A4/A3), tự động tính chiều cao từng dòng (`ht`/`customHeight`) theo chữ xuống dòng và cỡ chữ dự án (`uncompletedProjectsFontSizePt`), phân biệt kiểu chữ đậm cho dòng có STT và in nghiêng cho dòng con, căn giữa tiêu đề & số liệu, căn trên (`vertical="top"`) nền trắng cho Dòng 8 và Dòng 9, định dạng rich-text giữ nguyên Tiêu đề (đậm) + Phụ đề (nghiêng) trên Hàng 1 và định dạng số giữ nguyên giá trị số thực kèm đơn vị (`tỷ`, `m2`, `%`) để tính toán Excel trực tiếp.
  40. **Bỏ chọn ô bằng phím `Esc` & giải thích phương pháp tự tìm ô Excel nguồn (`cellInspector.ts`, `main.ts`, `main.css`):** Khi đang chọn ô trên bảng báo cáo (kể cả khi đã đóng popup chỉ còn viền xanh `.doc-cell-active` hoặc đang mở panel Truy vết), nhấn `Esc` (hoặc nút `×` khi không ghim panel) sẽ xóa sạch trạng thái chọn `activeTraceId` và bỏ focus để nhìn bảng báo cáo rõ ràng; đồng thời khi bấm vào bất kỳ ô nào, cả popup nổi và hồ sơ giải trình `CalculationTrace` đều hiển thị chi tiết phương pháp tự động nhận diện sheet/mẫu (`DISB_V1`/`DISB_PHAN_CAP_XA_V1`/`DISB_PHAN_CAP_XA_V2`, `REV_V1`, `GPMB_V1`/`GPMB_FLAT`), dò dòng địa phương hoặc gom nhóm dự án theo Unicode NFC và ánh xạ chính xác cột/ô giá trị nguồn.
  41. **Khắc phục lỗi Trang 1 bản in/PDF chỉ hiện tiêu đề còn cả bảng bị đẩy sang Trang 2 (`main.css`, `print.ts`):** Loại bỏ `page-break-inside: avoid` khỏi `.print-page-chunk`, `.print-table` và `.doc-appendix-projects` (giữ `break-inside: auto` cho bảng cùng `thead { display: table-header-group }` để lặp tiêu đề cột khi sang trang), bổ sung `break-after: avoid` cho `.print-title-center`, đặt lại `min-height: 0 !important; height: auto !important; overflow: visible !important` trên `html, body` trong `@media print`, và xuất quy tắc `@page` động theo khổ giấy/hướng in của phiên.
  42. **Thiết kế lại giao diện vỏ điều khiển theo Phương án 5 (Dual-Pane Live Studio) & Cô lập hoàn toàn nguồn dữ liệu theo từng phiên (`types.ts`, `sessions.ts`, `icons.ts`, `reportStudio.ts`, `main.ts`, `main.css`):**
      - Thay vỏ điều khiển 7 tab cũ bằng giao diện 2 cột trực tiếp: thanh trên sáng 48px (nút bật/tắt sidebar duy nhất `#btn-toggle-sidebar`, chuyển/sửa tên/tạo/nhân bản/xóa phiên qua `renameReportSession`, sao lưu/khôi phục `.kxh.json`, In/PDF, Xuất Excel) + thanh điều khiển trái 332px có thể thu gọn về 0px gồm 3 khối accordion (*1. Nguồn dữ liệu phiên*, *2. Địa phương chọn*, *3. Tùy chỉnh bảng gọn*) cập nhật trực tiếp lên tờ A4 bên phải.
      - Loại bỏ 6 trường không sử dụng (`Cơ quan cấp trên`, `Đơn vị ban hành`, `Căn lề tiêu đề`, `Cỡ chữ tiêu đề`, `In hoa toàn bộ tiêu đề`, `Hiển thị khu vực chữ ký`), bỏ dải nút chọn mẫu thừa (`5 xã / 7 phường / 11 xã / Tất cả / Về 0`), gộp sắp xếp thứ tự cột (`1..N` và `▲`/`▼`) trực tiếp vào dòng tích chọn địa phương (loại bỏ danh sách chip trùng lặp và bỏ nhãn loại thừa khi tên đã có tiền tố `Xã`/`Phường`/`Đặc khu`), thay toàn bộ emoji vỏ điều khiển bằng SVG inline offline (`src/ui/icons.ts`), bổ sung `:focus-visible` và giữ nguyên `.a4-paper-sheet` Times New Roman cùng `@media print`.
      - Cô lập nguồn dữ liệu theo từng phiên: nạp file Excel / chọn nguồn trong kho / nạp bộ tham chiếu / sửa ngày chốt chỉ áp dụng cho phiên đang mở (`rebindSessionDataset`, `clearSessionDatasetBinding`, `updateDatasetAsOfDateForSession`, `getSessionLocalitiesBaseline`), hỗ trợ tạo phiên trống chưa gắn nguồn (`allowEmptySources`) hoặc kế thừa chính xác nguồn đang mở (`exactBindings`). Đồng bộ live Right Drawer `Cảnh báo`/`Truy vết` và liên thông nút `Kiểm toán nguồn`, hợp nhất ô xác nhận ngày chốt `REV` không bị lặp, bổ sung nút `×` xóa nhanh ô tìm kiếm và làm sạch code/DOM thừa từ kiến trúc 7 tab cũ.
      - Kiểm chứng đầy đủ bằng **43/43 tests PASS** (bổ sung test 23 & 24 trong `tests/studio.spec.ts`) và chạy thử E2E thực tế bằng Microsoft Edge Headless trên `dist/index.html` (`0` boot errors, `0` runtime errors).
- **Bằng chứng JSON xuất tự động từ runtime:** [`docs/data_checks/PH1_ACCEPTANCE_EVIDENCE_20261109.json`](../data_checks/PH1_ACCEPTANCE_EVIDENCE_20261109.json) (chứa bảng đối chiếu 14 dòng cho Phiên A 5 xã và Phiên B 7 phường cùng trạng thái từng mã `T01`–`T66`).
- **Minh chứng Microsoft Edge Headless Offline (`file://`):**
  - [`docs/evidence/EDGE_HEADLESS_DOM_DUMP.html`](../evidence/EDGE_HEADLESS_DOM_DUMP.html) (2.04 MB DOM dump xác nhận khởi chạy JS & Document Studio hoàn chỉnh).
  - [`docs/evidence/SCREENSHOT_STUDIO_APP.png`](../evidence/SCREENSHOT_STUDIO_APP.png) (Ảnh chụp giao diện Document Studio A4 ngang).
  - [`docs/evidence/BAO_CAO_KTXH_A4_PRINT.pdf`](../evidence/BAO_CAO_KTXH_A4_PRINT.pdf) (Bản in PDF A4 ngang thực tế chuẩn văn bản hành chính).
- **Tổng hợp 66 mã kiểm thử:**
  - **PASS thực chạy trong PH1:** **64/66 mã** (`T01`–`T48`, `T51`–`T66`; trong đó `T19` và `T31` đã PASS phần xử lý `#VALUE! C7`, nhận diện theo fingerprint khi đổi tên file và phát hiện `BLOCKER_MAPPING_REQUIRED` khi đổi cột).
  - **DEFERRED_BY_SCOPE sang PH2 (ghi nhận minh bạch theo `T66` và §14.2, không ghi PASS giả):**
    - `T49`: Kịch bản loại trừ theo ghi chú Q có xác nhận tử/mẫu đa kỳ (trong PH1 đã gắn nhãn `UNVERIFIED_NOTE` và chặn tự động thay tỷ lệ `I/F`).
    - `T50`: Trình soạn công thức tùy chỉnh AST tự do (thuộc `PH2-02`; trong PH1 đã khóa cứng công thức kiểm chứng và cấm `eval`).
    - Phần giao diện `Mapping Wizard` tương tác động khi đổi vị trí cột của `T19`/`T31` (thuộc `PH2-01`).

## KẾ HOẠCH CON 2 — Chờ mở khóa sau khi chủ dự án nghiệm thu Gate PH1

| Gói | Đầu ra | Trạng thái |
|---|---|---|
| PH2-01 | Mapping wizard tương tác động cho file/layout mới, hidden sheet nâng cao | `DEFERRED_BY_SCOPE (PH2)` |
| PH2-02 | Công thức AST tự do, template linh hoạt (`T50`) | `DEFERRED_BY_SCOPE (PH2)` |
| PH2-03 | Nhiều kỳ/phiên bản, so sánh có điều kiện | `DEFERRED_BY_SCOPE (PH2)` |
| PH2-04 | Bộ mẫu mở rộng, chọn hiển thị nâng cao | `DEFERRED_BY_SCOPE (PH2)` |
| PH2-05 | QC/trace nâng cao, kịch bản ghi chú Q có xác nhận tử/mẫu (`T49`) | `DEFERRED_BY_SCOPE (PH2)` |
| PH2-06 | Xuất nâng cao, hồi quy tất cả T01–T66 100% PASS, nghiệm thu PH2 | `DEFERRED_BY_SCOPE (PH2)` |


## 2026-11-24 — nhánh sửa yêu cầu báo cáo tháng 11 (tách từ `gemini`)

- Người dùng phát hiện 109/114 địa phương và hai tỷ lệ thu đất/không đất sai vì ánh xạ cột mẫu tháng 10. Đã thêm nhận diện cấu trúc tổng hợp giải ngân tháng 11 và ánh xạ REV theo ngữ nghĩa tiêu đề; chặn schema không rõ thay vì suy đoán. Không commit hai workbook mới do chưa được phép; chỉ thêm fixture tổng hợp giả lập.
- A4 ngang 11 địa phương, co cột có giới hạn, xuất/in cùng quy tắc; tùy chọn `showRevRealizedRow` mặc định tắt, dòng số 2 lấy thực thu lũy kế và đánh lại số thứ tự trên cả ba đầu ra. Dữ liệu cũ có nguy cơ phải nhập lại, không âm thầm sửa giá trị nguồn.
- Bằng chứng kiểm thử nhánh trước chỉnh sửa ô gộp: SHA `2a4606ad652dc1b3c89514ed99fa209f096e4523`, [workflow 45323195268](https://github.com/cavoixanh638/KTXD-report/actions/runs/45323195268) SUCCESS. Không coi là PASS cho SHA mới.

### 24/11/2026 — Cập nhật bảng và tài liệu hệ thống

- Mã thay đổi: `b4288a96dcfb55e72e632d19bd9c56cea6cf7295`, nhánh `ai/november-source-report-fix-20261124`.
- Files: src/core/indicators.ts, src/ui/reportStudio.ts, src/ui/reportGrid.ts, src/export/print.ts, src/export/xlsx.ts, tests/studio.spec.ts; đồng bộ MASTER, PH1, SOURCE_MAPPINGS, CALCULATION_RULES, DATA_DICTIONARY, TEST_CASES, hướng dẫn, design, manifest và AGENTS.
- Gộp 2 benchmark REV/GPMB (colspan nhóm, rowspan Studio dọc, merge Excel). Bỏ footer nguồn trên bảng chính; sheet 2 giữ metadata phạm vi động, không xóa audit. Kiểm thử mới NOV_FIX_03.
- [CI 45343442429](https://github.com/cavoixanh638/KTXD-report/actions/runs/45343442429): SUCCESS (job 138272250471): 4/4 workbook SHA/ZIP PASS, typecheck PASS, build PASS, 3/3 suites và 46/46 tests PASS, artifact dist/index.html đã được upload. Bằng chứng chỉ áp dụng SHA mã `b4288a96dcfb55e72e632d19bd9c56cea6cf7295`; commit tài liệu `278932808c8ab7d2acdb4212d30ed58a0823f798` không đổi runtime. Windows Chrome/Edge in thực tế: NOT_RUN. Không đổi dữ liệu tham chiếu/SHA workbook; không đưa tệp tháng 11 vào repo.
- PH2 không bắt đầu; nghiệm thu chính thức PH1 vẫn cần chủ dự án kiểm tra.

### 24/11/2026 — Chốt bảy tên chỉ tiêu và đồng bộ tài liệu

- Nhánh `ai/november-source-report-fix-20261124`; SHA mã nguồn đã kiểm thử `ee22c0a29d997d4ccd6861bad7997ec845168d90`. Đổi tên bảy chỉ tiêu theo MASTER mục 3; migration phiên cũ, giữ nhãn tùy chỉnh, ngày và độ phủ động; không sửa công thức. Files runtime: indicators.ts, sessions.ts, calculationTrace.ts, main.ts, tests/studio.spec.ts.
- [CI 45344789386](https://github.com/cavoixanh638/KTXD-report/actions/runs/45344789386), job 138276626023: **47/47 tests PASS**, 3/3 suites, typecheck/build PASS, 4/4 source workbooks SHA/ZIP PASS; artifact `KTXH-offline-November-fix` ID 14897019361 đã upload. NOV_FIX_04 kiểm thử nhãn và ba đầu ra, không xác nhận độ phủ của file tháng 11 thực tế (fixture metadata mô phỏng).
- Đồng bộ MASTER/PH1, checksum manifest, từ điển, quy tắc tính, test cases, hướng dẫn, UI/UX, AGENTS và mục lục. Các checkpoint, review và bằng chứng cũ giữ nguyên tính lịch sử. Commit tài liệu nối tiếp SHA trên không thay đổi runtime; không kế thừa PASS cho thay đổi runtime về sau.
- Windows Chrome/Edge in trực tiếp và nghiệm thu với workbook tháng 11 thực tế: NOT_RUN trong lần CI này. Không đổi/commit thêm workbook. PH2 chưa bắt đầu, chưa merge main.

### Điều chỉnh trình bày tỷ lệ trung bình (yêu cầu tiếp theo của chủ dự án)

- SHA runtime: `c29a056c815421cd02a56a2e5e3cebcc25e586c8`, nhánh `ai/november-source-report-fix-20261124`. Ba nhãn benchmark mặc định cố định 114 địa phương, ngày chốt động; migration tự sửa nhãn cũ theo độ phủ. Độ phủ thực tế vẫn lưu ở trace/nguồn/audit, không đổi công thức. Tăng cỡ chữ giá trị benchmark 10% (web, PDF), 11 pt (XLSX). Giữ nguyên ô gộp REV/GPMB và tiêu đề/cỡ chữ khác.
- CI [45442571960](https://github.com/cavoixanh638/KTXD-report/actions/runs/45442571960): 47/47 tests PASS; 3/3 suites, typecheck/build PASS, 4/4 source workbooks PASS. Job 138617443634. Artifact 14943004728. NOV_FIX_04 đã được mở rộng để kiểm tra nhãn cố định, độ phủ audit, style font, các đầu ra. In thực tế Windows: NOT_RUN; workbook tháng 11 thực tế chưa nghiệm thu trong CI. Không merge main.

### Bổ sung gộp DISB và bản phân phối chạy sẵn

- Bổ sung `DISB_BENCHMARK_RATE` vào `isSharedReportIndicator` để cả ba tỷ lệ trung bình dùng ô gộp trên Studio/grid, bản in, XLSX; cập nhật NOV_FIX_03/04 cho 1/9/11/12 địa phương, dọc/ngang, giá trị và trace chung, font, audit.
- Theo dõi duy nhất `dist/index.html` trong Git. CI hiện tại publish HTML sau kiểm thử; không tự tạo vòng lặp hoặc force-push. Đã kiểm chứng GitHub Actions publish thành công; xem bằng chứng tiếp theo. Windows thực tế NOT_RUN; không merge main.

#### Bằng chứng 25/11/2026

- SHA triển khai và kiểm thử: `25f27edf7aeda0acfb95c0751b33620a3dbdd740`; [CI 45584135248](https://github.com/cavoixanh638/KTXD-report/actions/runs/45584135248), job 139101284007: SUCCESS, 47/47 tests PASS, 3/3 suites, typecheck/build PASS, 4/4 workbook PASS.
- GitHub Actions đã push commit `f8f2f98b215c161fe682962650437983c6b6deb4` chỉ chứa `dist/index.html`; kiểm chứng file tồn tại trong tree, kích thước 2.295.061 byte, Git blob `12c1a67a7c6f4d84d0442dad5c1e775850258a11`, SHA-256 từ build log `1689d28108f231a1cab4f15ed8119cfca7bc417a9ba6ae1ed0a10fdbdb845c6b`. Artifact 15007133001. Không cần npm khi clone/pull nhánh phân phối. Chỉ commit tài liệu sau bản chạy không thay đổi runtime.
- Trạng thái: CI_PASS_OFFLINE_BUNDLE_PUBLISHED; Windows/Edge in trực tiếp và nghiệm thu dữ liệu tháng 11 của người dùng NOT_RUN. Chưa merge main. Nếu người dùng có bản HTML local bị sửa, sao lưu rồi bỏ thay đổi local riêng tệp đó trước khi pull; không xóa hồ sơ phiên hoặc workbook cá nhân.

### Chuẩn hóa nhãn kinh phí GPMB của phiên cũ

- Nhãn chuẩn đã có trong MASTER và template. Bổ sung alias chính xác `Kinh phí phân bổ GPMB cho từng phường` trong `normalizeLocalityReportLabel` cho GPMB_BUDGET, không thay đổi phép tính hoặc dữ liệu. Kiểm thử NOV_FIX_04 mở rộng kiểm tra nhãn phiên cũ và ba đầu ra; giữ nhãn tùy chỉnh khác.
- CI [45586482726](https://github.com/cavoixanh638/KTXD-report/actions/runs/45586482726), SHA `c1ad458304c4ab167fc86663b786cc29ed8afc31`: SUCCESS; 47/47 test PASS, 4/4 workbook PASS, typecheck/build PASS. HTML tự publish tại `0339b9fdcd8203bf3fdb4afc7243543f3bfd8f3a`, SHA-256 `cccb9be41332273a0de0ac8bcb200cf28f72811dde563a2dcfec60f25014b702`. Đã kiểm tra tree có file `dist/index.html` (2.295.223 byte). Windows in trực tiếp: NOT_RUN. Chỉ cần Pull origin, không chạy npm.

### Nạp 3 file mới nhất (25/11/2026)

Nút Nạp 3 file mới nhất chọn độc lập DISB/REV/GPMB trong kho dataset của workspace theo ngày chốt hợp lệ đã xác nhận; không quét ổ đĩa. DISB giữ phạm vi tổng vốn hoặc phân cấp của phiên hiện tại; nếu chưa có DISB mặc định tổng vốn. Loại nguồn sai mapping, ngày chưa xác minh, lỗi BLOCKER hoặc ERROR trường tính chính; không loại chỉ vì thiếu vài địa phương. Ưu tiên nguồn thực tế; chỉ dùng mẫu SHA gốc nếu chưa có nguồn thực tế tương thích. Cùng ngày và chưa có metadata phiên bản chính thức, chọn nội dung khác SHA được nhập lần đầu gần nhất, cảnh báo nhiều bản; nhập lại cùng SHA không làm mới thứ hạng. Cùng SHA có ngày chốt xác nhận mâu thuẫn thì không tự chọn. Tên file không quyết định ngày chốt. Preview tên file, ngày, độ phủ, phạm vi, nguồn mẫu/cảnh báo; chỉ nạp khi đủ ba nguồn và người dùng xác nhận. Không thay dữ liệu các phiên khác. Tạo phiên mới có tùy chọn 3 nguồn mới nhất; không thay đổi mặc định dùng nguồn phiên đang mở. Ngày chốt DISB/GPMB không còn fallback tháng 10/tên file; nguồn cũ có bằng chứng A1 không đủ phải xác nhận tại Khối 1. Không tự suy ngày từ hạn dự án CSV.

- Mã: latestSources.ts, sourceReaders.ts, sessions.ts, main.ts, CSS, NOV_FIX_05. CI và publish HTML: PENDING.

- CI đầu tiên của `a3860a578bb49eba58ef39b7df0894cf991666d3`: [45595093052](https://github.com/cavoixanh638/KTXD-report/actions/runs/45595093052) SUCCESS, 48/48 PASS, 4/4 workbook PASS, HTML `9e567b96a925772d55c591ed6d226cd7fae9486a`. Bổ sung gia cố trùng SHA/ngày xác nhận và đồng bộ MASTER/PH1, checksum. CI gia cố [45595464837](https://github.com/cavoixanh638/KTXD-report/actions/runs/45595464837) tại `0fc745421ed72bb592094759308b28358dee2586`: SUCCESS, 48/48 tests PASS (NOV_FIX_05 bao gồm trùng SHA và xác nhận ngày), 3/3 suites, 4/4 workbook PASS, typecheck/build PASS.

- HTML tự publish tại `25234ec65f98f93f72e5c62ddbc4f7950b9f2be2`; tree xác nhận `dist/index.html` 2.307.605 byte, SHA-256 `91ed08fddd008e9a9727bd5c6ac2ae2e3b50be6e248fbd80394211319f7419ae`, artifact 15012891402. MASTER/PH1 và hướng dẫn đồng bộ. Người dùng chỉ Pull origin và mở lại HTML. Nghiệm thu thao tác trực tiếp trên Windows và bộ nguồn riêng của người dùng: NOT_RUN; không có metadata phiên bản điều chỉnh chính thức nên dùng ngày chốt + first-import/SHA, cảnh báo khi cùng ngày. Chưa merge main.

### Source Schema Guard V1 (đang kiểm thử)

Kiểm tra đầy đủ vai trò tiêu đề profile DISB/GPMB phân nhóm; REV và GPMB phẳng ánh xạ theo tiêu đề duy nhất. Lưu số cột có nội dung, header fingerprint, map, đơn vị, kiểm tra chéo và lịch sử nguồn đã xác minh cùng năm/phạm vi. Không dùng % biến động cố định, không đoán cột; chặn cấu trúc không xác minh, cảnh báo nguồn cần đối chiếu, giữ phiên cũ. Bỏ giới hạn GPMB 422 dự án. Bản cũ chưa có guard cần nhập lại gốc (trừ fixture SHA/sheet chính xác). NOV_FIX_06/07, CI PENDING. Không thêm workbook thực tế vào repo đang public.
