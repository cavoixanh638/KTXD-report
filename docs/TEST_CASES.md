# MA TRẬN VÀ TÀI LIỆU KIỂM THỬ HỆ THỐNG (TEST CASES T01–T66)

> **Dự án:** KTXH Offline Report (`cavoixanh638/KTXD-report`)  
> **Tài liệu quy chuẩn:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md` (§14, §14.2, §15)  
> **Kế hoạch triển khai:** `docs/plans/PHASE_1_RESULT_TEMPLATE.md` (PH1) & `docs/plans/PHASE_2_EXTENSIBILITY.md` (PH2)  
> **Tệp tham chiếu dữ liệu:** `data/reference/MANIFEST.json` (4 tệp Excel chuẩn hóa)  
> **Phiên bản:** V2.2 — Cổng nghiệm thu PH1 & PH2

---

## 1. Tổng quan cơ chế kiểm soát cổng (Quality Gates §14.2 & T66)

Theo quy định nghiêm ngặt tại **§14.2** và mã kiểm thử **`T66`** của MASTER SPEC V2.2:
- Hệ thống áp dụng ma trận 66 mã kiểm thử chuẩn hóa `T01`–`T66` xuyên suốt vòng đời sản phẩm.
- **Cổng PH1 (Phase 1 Gate):** Nghiệm thu sản phẩm hoàn chỉnh theo mẫu 14 dòng chuẩn (`Sheet1` của tệp `RESULT_REFERENCE`), xử lý dữ liệu thật từ 3 nguồn ngân sách - giải ngân - GPMB, hỗ trợ chọn nhiều địa phương tùy ý (0 địa phương mặc định), quản lý nhiều phiên độc lập, truy vết tính toán `CalculationTrace` 100% ô tính, phát hiện bất thường cột M, xuất bản XLSX 5 sheet chuẩn in ấn và hoạt động hoàn toàn offline qua giao thức `file://` trên Chrome/Edge.
- **Phân loại trạng thái PH1:**
  - `PASS` (Thực chạy đạt bằng Vitest trên 4 tệp tham chiếu thật).
  - `DEFERRED_BY_SCOPE` (Minh bạch ghi nhận các tính năng mở rộng chỉ thuộc phạm vi Kế hoạch PH2 như: Wizard ánh xạ cột động khi file đổi cấu trúc, AST biên dịch công thức tự do người dùng tự nhập, và Kịch bản loại trừ ghi chú Q có xác nhận đa kỳ). **Tuyệt đối không ghi PASS giả** cho các hạng mục PH2 khi đang ở Cổng PH1.
- **Cổng PH2 (Phase 2 Gate):** Chạy lại toàn bộ 66 bài test và các test mở rộng, yêu cầu **100% T01–T66 PASS** thực tế trên commit SHA mới nhất, không có bất kỳ hồi quy nào đối với các chức năng đã bàn giao ở PH1.

---

## 2. Bảng ma trận tổng hợp 66 mã kiểm thử (T01–T66)

| Mã | Nhóm | Tiêu đề kiểm định | Dữ liệu đầu vào & Vị trí nguồn | Giá trị kỳ vọng / Quy tắc nghiệm thu | Cổng | Trạng thái PH1 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T01** | A. Tính toán | Tỷ lệ giải ngân 114 địa phương | `DISB_20261015` sheet `Tổng hợp`, dòng 13–126 | $\frac{\sum I}{\sum F} = \frac{10.434.921,777}{15.550.923,159} = \mathbf{67,10\%}$. Không hiển thị 76,46%. | PH1 | `PASS` |
| **T02** | A. Tính toán | Mức vốn giao bình quân 114 địa phương | `DISB_20261015` sheet `Tổng hợp`, cột F dòng 13–126 | $\frac{15.550.923,159}{114} \approx \mathbf{136,41\text{ tỷ/địa phương}}$ (136.411,607 triệu). | PH1 | `PASS` |
| **T03** | A. Tính toán | Tỷ lệ thu NSNN 113 địa phương | `REV_20261019` sheet `10T-19.10`, dòng 11–123 | $\frac{\sum I}{\sum C} = \frac{28.550.929,455}{25.651.713} = \mathbf{111,30\%}$. Benchmark ghi rõ 113, cảnh báo thiếu Bạch Long Vĩ. | PH1 | `PASS` |
| **T04** | A. Tính toán | Tỷ lệ GPMB diện tích 108 địa bàn | `GPMB_20261026` sheet `Tong hop`, dòng 14–435 | $\frac{\sum I}{\sum D} = \frac{39.960.463,6}{55.398.165} = \mathbf{72,13\%}$. Không tính bình quân tỷ lệ các địa bàn. | PH1 | `PASS` |
| **T05** | A. Tính toán | Tỷ lệ GPMB xã Hồng Châu (chỉ diện tích) | `GPMB_20261026` địa bàn Hồng Châu (dòng 23–27) | $D=119.280\text{ m}^2, I=35.897\text{ m}^2 \Rightarrow \mathbf{30,09\%}$. Không có tùy chọn bình quân M; không dùng M tổng xã. | PH1 | `PASS` |
| **T06** | A. Tính toán | Tỷ lệ GPMB nhóm 11 xã mẫu | `GPMB_20261026`, 11 xã theo danh mục P | $\frac{\sum I_{\text{nhóm}}}{\sum D_{\text{nhóm}}} \approx \mathbf{76,97\%}$. Không coi đây là benchmark chung 114/108. | PH1 | `PASS` |
| **T07** | A. Tính toán | Tỷ lệ giải ngân cấp Toàn thành phố | `DISB_20261015` dòng tổng 7 và dòng 145 | $I7/F7 = 68,98\%$; loại I145 ngoài kế hoạch = $68,43\%$. Phải ghi rõ phạm vi, không thay thế mốc 67,10%. | PH1 | `PASS` |
| **T08** | B. Đơn vị | Quy đổi số thu xã Hồng Châu | `REV_20261019` ô C18 | Giá trị nguồn: 32.845 triệu đồng $\Rightarrow$ Nội bộ **32,845 tỷ đồng**, hiển thị làm tròn 32,85 tỷ. Không đọc nhầm 32.845 tỷ. | PH1 | `PASS` |
| **T09** | B. Đơn vị | Quy đổi vốn giải ngân xã Hồng Châu | `DISB_20261015` ô F18 | Giá trị nguồn: 35.680,778561 triệu đồng $\Rightarrow$ Nội bộ **35,680778561 tỷ đồng**. Không làm tròn sớm. | PH1 | `PASS` |
| **T10** | B. Đơn vị | Quy đổi kinh phí và diện tích GPMB | `GPMB_20261026` Hồng Châu (G tổng & D tổng) | Kinh phí: $56.141.672.000\text{ đồng} \Rightarrow \mathbf{56,141672\text{ tỷ đồng}}$; Diện tích: $119.280\text{ m}^2 = \mathbf{11,928\text{ ha}}$. | PH1 | `PASS` |
| **T11** | B. Đơn vị | Làm tròn số thập phân hiển thị | `GPMB_20261026` Tân An & `DISB_20261015` Lạc Phượng | Tân An kinh phí 3,125385 tỷ $\Rightarrow$ hiển thị **3,13 tỷ**; Lạc Phượng 38,644618586 tỷ $\Rightarrow$ hiển thị **38,64 tỷ**. | PH1 | `PASS` |
| **T12** | B. Đơn vị | Parser chuỗi số thông minh theo ngữ cảnh | Chuỗi văn bản người dùng nhập | Đọc đúng `119.280 m2`, `32,8 tỷ`, `119.71`, `3.125385 tỷ`. Đầu vào mơ hồ cảnh báo hỏi lại, không đoán ẩu. | PH1 | `PASS` |
| **T13** | B. Đơn vị | Xử lý mẫu số bằng 0 (R04 cơ bản) | Địa phương có Mẫu = 0 và Tử > 0 | Hiển thị *"Phát sinh ngoài dự toán"*, không hiển thị `Infinity` hay `0%`. Ô trống, ô 0, ô lỗi phân biệt rõ. | PH1 | `PASS` |
| **T14** | C. Thời gian | Nhận diện và xác nhận ngày chốt số liệu | Tiêu đề các file DISB, GPMB, REV | DISB tự nhận diện 15/10/2026; GPMB tự nhận diện 26/10/2026 (yêu cầu confirm); REV bắt buộc người dùng xác nhận ngày chốt. | PH1 | `PASS` |
| **T15** | C. Thời gian | Độc lập đa phiên làm việc (Multi-session) | Phiên A (5 xã) và Phiên B (7 phường) | Không chọn sẵn địa phương mặc định. Chuyển đổi giữa A và B bảo toàn trọn vẹn thứ tự, chỉ tiêu, ngày chốt, mốc so sánh. | PH1 | `PASS` |
| **T16** | C. Thời gian | Nhân bản phiên và Backup Workspace | Thao tác clone A $\rightarrow$ C, xóa B, xuất `.kxh.json` | Thay đổi ở C không ảnh hưởng A; xóa B có xác nhận; restore JSON khôi phục 100% workspace, dữ liệu nguồn và phiên làm việc. | PH1 | `PASS` |
| **T17** | C. Thời gian | Quản lý phiên bản Dataset (Dataset Pinning) | Nạp bản REV mới vào Workspace | Phiên A giữ nguyên tham chiếu REV cũ, phiên B có thể chuyển sang REV mới. Không tự ý thay đổi lịch sử phiên cũ. | PH1 | `PASS` |
| **T18** | C. Thời gian | Định dạng In và Xuất bảng 5 & 20 địa phương | Báo cáo quy mô 5 địa phương và 20 địa phương | In không bị tràn trang/mất cột, đủ tiêu đề/đơn vị/ngày chốt. File XLSX xuất ra giữ nguyên ô số thực, không bị text hóa. | PH1 | `PASS` |
| **T19a** | D. Chất lượng | Xử lý ô lỗi nguồn (`#VALUE!` tại DISB C7) | Ô C7 sheet `Tổng hợp` file DISB | Ghi nhận lỗi nguồn, hiển thị cảnh báo, không làm sập ứng dụng và không tự động gán giá trị bằng 0. | PH1 | `PASS` |
| **T19b** | D. Chất lượng | Mapping Wizard khi XLSX hoán đổi vị trí cột | File XLSX bị đổi vị trí cột B, C, F | Tự động phát hiện cấu trúc sai lệch và bật giao diện wizard cho người dùng gán lại cột tương ứng. | PH2 | `DEFERRED_BY_SCOPE` |
| **T20** | D. Chất lượng | Không bù số liệu giả cho Bạch Long Vĩ | REV thiếu dữ liệu Đặc khu Bạch Long Vĩ | Không tự điền số 0; không tính mẫu số 114 từ 113 địa phương; giữ nguyên trạng thái vắng mặt. | PH1 | `PASS` |
| **T21** | D. Chất lượng | Bất thường GPMB $I > D$ và $M > 100\%$ | Các dòng dự án có $I > D$ trong file GPMB | Giữ nguyên số thực, gắn cờ cảnh báo bất thường; không gộp sai các dự án trùng tên nằm ở địa bàn khác nhau. | PH1 | `PASS` |
| **T22** | D. Chất lượng | Chạy Offline 100% không kết nối mạng | Giao thức `file://` trên Chrome và Edge | Chạy mượt mà khi ngắt Internet. Tab DevTools Network không có bất kỳ request HTTP/WS/CDN nào ra ngoài. | PH1 | `PASS` |
| **T23** | D. Chất lượng | Phòng chống XSS, Code Injection, eval | Ký tự độc hại `<script>`, mã macro, hyperlink | Nội dung text hiển thị an toàn; macro không thực thi; công thức tùy chỉnh bị cấm hoàn toàn hàm `eval`. | PH1 | `PASS` |
| **T24** | D. Chất lượng | Kiểm tra toàn vẹn file Backup và Checksum | File `.kxh.json` bị sửa đổi hoặc sai schema | Từ chối nhập nếu checksum SHA-256 sai hoặc hỏng cấu trúc; giữ nguyên trạng thái workspace hiện tại. | PH1 | `PASS` |
| **T25** | E. R01 Tích hợp | Đọc đầy đủ ghi chú cột Q và cột P trong DISB | `DISB_20261015` sheet `Tổng hợp` | Đọc đủ 25 ghi chú tại cột Q và 11 dấu đánh dấu 'x' tại cột P; không tự động chọn trước 11 xã theo P. | PH1 | `PASS` |
| **T26** | E. R01 Tích hợp | Xử lý ghi chú loại trừ Q18 (94%) vs O18 (58,35%) | Ô O18 và Q18 địa bàn Hồng Châu trong DISB | Hiển thị rõ ràng cả hai nhãn; không tự ý dùng con số 94% trong text Q18 để thay thế tỷ lệ thực tế $I/F$. | PH1 | `PASS` |
| **T27** | E. R01 Tích hợp | Xử lý đa tỷ lệ trong văn bản ghi chú Q7 | Ô Q7 dòng tổng thành phố trong DISB | Có nhiều tỷ lệ 83%, 86%, 76%... Hệ thống không được dùng regex bắt bừa một số để làm tỷ lệ chính thức. | PH1 | `PASS` |
| **T28** | E. R01 Tích hợp | Chuẩn hóa tên địa phương và tránh trùng lặp | Xã Cẩm Giang vs Cẩm Giàng; Thanh Miện vs Nam TM | Phân biệt chính xác `localityId` riêng; chuẩn hóa Unicode NFC, trim khoảng trắng thừa ở `Xã Thanh Miện `. | PH1 | `PASS` |
| **T29** | E. R01 Tích hợp | Bộ quy tắc kiểm tra GPMB dung sai 0,1% | Toàn bộ 422 dòng dự án trong GPMB | Phát hiện chính xác 111 lượt cảnh báo trên 90 dòng (13 $I>D$, 48 $J>G$, 14 $K>E$, 24 $L>F$, 12 M lệch). Không xét dòng tổng xã. | PH1 | `PASS` |
| **T30** | E. R01 Tích hợp | Phân tách cảnh báo Cấp phiên và Toàn nguồn | Lưới báo cáo 5 xã vs Import Dashboard | Trên bảng 5 xã chỉ hiện cảnh báo của 5 xã đó; trên Dashboard import hiển thị tổng hợp toàn nguồn phân loại INFO/WARNING. | PH1 | `PASS` |
| **T31a** | E. R01 Tích hợp | Nhận dạng file đổi tên & không bắt nhầm ngày | File bị đổi tên; cột P/Q có ngày 22/10, 25/9 | Nhận diện file theo nội dung/cấu trúc; không lấy ngày trung gian trong ghi chú P/Q làm ngày chốt số liệu. | PH1 | `PASS` |
| **T31b** | E. R01 Tích hợp | Bật Mapping Wizard khi cấu trúc file bị đổi | File nguồn bị thay đổi tên sheet hoặc cột | Tự động cảnh báo sai lệch cấu trúc và kích hoạt màn hình cấu hình ánh xạ thủ công. | PH2 | `DEFERRED_BY_SCOPE` |
| **T32** | E. R01 Tích hợp | Tiêu chuẩn chất lượng file XLSX xuất bản | File Excel tải về từ ứng dụng | Đúng font Times New Roman, border chuẩn, căn lề đúng kiểu dữ liệu, đủ 5 sheet audit, mở offline không lỗi. | PH1 | `PASS` |
| **T33** | F. R02 Tích hợp | Trạng thái MISSING tại 3 dòng dự án GPMB | Các dòng 107, 173, 365 file GPMB | D > 0 nhưng I, J, K, L, M bị để trống (blank) $\Rightarrow$ Trạng thái `FIELD_MISSING`, có cờ thiếu dữ liệu thực tế. | PH1 | `PASS` |
| **T34** | F. R02 Tích hợp | Tổng hợp GPMB 422 dự án có thiếu dữ liệu | 422 dự án trong `GPMB_20261026` | $\sum D = 55.398.165, \sum I = 39.960.463,6 \Rightarrow \mathbf{72,13\%}$; trạng thái `PARTIAL_AGGREGATE` (thiếu 11.459 m² ở 3 dòng). | PH1 | `PASS` |
| **T35** | F. R02 Tích hợp | GPMB Kinh Môn: Không bình quân cột M | Thị xã Kinh Môn (dòng 105–109 GPMB) | $D=28.350, I=23.958 \Rightarrow \mathbf{84,51\%}$ (`PARTIAL_AGGREGATE` do thiếu dòng 107). Không lấy bình quân M105 hay 3 dự án. | PH1 | `PASS` |
| **T36** | F. R02 Tích hợp | Thống kê ô trống thành phần trong DISB | 114 địa phương trong `DISB_20261015` | Đếm chính xác 296 ô trống (67 G, 67 J, 60 M, 102 N) trải trên 104 dòng địa phương khác nhau. | PH1 | `PASS` |
| **T37** | F. R02 Tích hợp | Kiểm tra cân đối hàng ngang DISB (R02) | 114 dòng: $F=G+H, I=J+K, I=L+M+N$ | 114/114 dòng cân đối đạt yêu cầu với chính sách phần tử trung hòa; trace ghi `PASS_WITH_MISSING_COMPONENTS`. | PH1 | `PASS` |
| **T38** | F. R02 Tích hợp | Bảo toàn trạng thái null của thành phần độc lập | Xem riêng lẻ từng ô G, J, M, N trong DISB | Ô null vẫn là `FIELD_MISSING` khi tra cứu độc lập; không biến thành số 0; không PASS giả nếu tổng bị lệch. | PH1 | `PASS` |
| **T39** | F. R02 Tích hợp | Tự động chọn Sheet nhìn thấy trong DISB | File `DISB_20261015` có nhiều sheet | Tự động chọn sheet `Tổng hợp` (index 5 visible); bỏ qua sheet ẩn `DA trọng điểm NQ 174` (index 0 hidden). | PH1 | `PASS` |
| **T40** | F. R02 Tích hợp | Tự động chọn Sheet nhìn thấy trong REV | File `REV_20261019` có nhiều sheet | Tự động chọn sheet `10T-19.10` (visible); bỏ qua các sheet ẩn `Sheet1` (hidden), `bc`, `TMS` (veryHidden). | PH1 | `PASS` |
| **T41** | G. Trace tính | Truy vết nguồn gốc ô dữ liệu (SOURCE_VALUE) | Mọi ô hiển thị lấy trực tiếp từ file nguồn | Trace ghi rõ: tên file, sheet, ô nguồn, SHA-256, ngày chốt, giá trị thô, đơn vị và công thức gốc nếu có. | PH1 | `PASS` |
| **T42** | G. Trace tính | Truy vết ô tính toán (CALCULATED) | Mọi ô tổng, tỷ lệ, quy đổi, nhận xét | Có `traceId` duy nhất, công thức chi tiết, phiên bản engine, danh sách đầu vào chưa làm tròn. 100% ô tính có trace. | PH1 | `PASS` |
| **T43** | G. Trace tính | Trace chi tiết tỷ lệ giải ngân 114 địa phương | Benchmark giải ngân 67,10% | Trace ghi nhận đủ 114 ID tham gia, tổng tử 10.434.921,777 triệu, tổng mẫu 15.550.923,159 triệu, ngày chốt 15/10/2026. | PH1 | `PASS` |
| **T44** | G. Trace tính | Trace chi tiết tỷ lệ thu NSNN 113 địa phương | Benchmark thu NSNN 111,30% | Trace ghi nhận 113 ID, liệt kê Bạch Long Vĩ trạng thái `SOURCE_NOT_PRESENT`, không bù 0, khẳng định mốc 113. | PH1 | `PASS` |
| **T45** | G. Trace tính | Trace tỷ lệ GPMB Kinh Môn (84,51%) | Chỉ tiêu GPMB Kinh Môn | Trace liệt kê 4 dự án trong mẫu, 3 dự án có kết quả, 1 dự án thiếu I (5.050 m²), chất lượng `PARTIAL_AGGREGATE`. | PH1 | `PASS` |
| **T46** | G. Trace tính | Trace danh mục toàn thể 422 dự án GPMB | Benchmark GPMB 72,13% | Trace ghi nhận 422 dự án mẫu số, 419 dự án có tử số, 3 dự án thiếu tử số (11.459 m²); đồng bộ trên UI/XLSX/PDF. | PH1 | `PASS` |
| **T47** | G. Trace tính | Trace đẳng thức cân đối có ô null ($F=G+H$) | Dòng DISB có ô thành phần bị null | Ghi nhận rõ thành phần null được thay bằng phần tử trung hòa cho mục đích đối chiếu; status `PASS_WITH_MISSING_COMPONENTS`. | PH1 | `PASS` |
| **T48** | G. Trace tính | Trace chuyển đổi đơn vị tiền tệ (Triệu $\rightarrow$ Tỷ) | Phép chia 1000 cho các chỉ tiêu tiền tệ | Trace ghi nhận đầy đủ phép chia 1000, đơn vị vào/ra; bảo toàn độ chính xác Decimal, chỉ làm tròn khi render. | PH1 | `PASS` |
| **T49** | G. Trace tính | Trace kịch bản loại trừ ghi chú Q đa kỳ | Bật kịch bản loại trừ theo ghi chú Q | Cho phép loại trừ có phê duyệt, cập nhật cả tử và mẫu trong trace. Đòi hỏi giao diện quản lý kịch bản đa kỳ PH2. | PH2 | `DEFERRED_BY_SCOPE` |
| **T50** | G. Trace tính | Bộ thẩm định công thức tùy biến (AST Engine) | Người dùng tự nhập biểu thức công thức | Phân tích cú pháp AST, kiểm tra chu trình phụ thuộc, chặn hàm `eval`, kiểm tra tính tương thích đơn vị. | PH2 | `DEFERRED_BY_SCOPE` |
| **T51** | G. Trace tính | Khôi phục nguyên vẹn Trace từ file Backup | Export và Restore workspace JSON | Tái tạo chính xác từng bitwise số liệu Decimal, trace ID, lý do loại trừ và lịch sử phiên làm việc. | PH1 | `PASS` |
| **T52** | G. Trace tính | Xuất bản đầy đủ các Sheet kiểm toán trong XLSX | File Excel xuất từ session báo cáo | Đủ 5 sheet: `Báo cáo KTXH`, `Danh mục chỉ tiêu`, `Nhật ký phép tính`, `Bản ghi ngoài phạm vi`, `Danh mục nguồn`. | PH1 | `PASS` |
| **T53** | H. Quy tắc R04 | Cấp địa phương có Mẫu = 0 và Thực thu > 0 | Dòng D15, D26, D42, D57, D114 file REV | Hiển thị *"Phát sinh ngoài dự toán"* (`DENOMINATOR_ZERO`), không hiển thị `Infinity` hay 0%, không bị loại khỏi benchmark. | PH1 | `PASS` |
| **T54** | H. Quy tắc R04 | Benchmark thu tiền đất năm (`REV_LAND_RATE_Y`) | 113 dòng địa phương (dòng 11–123 REV) | $\frac{\sum R}{\sum D} = \frac{9.777.655,455}{7.182.893} = \mathbf{136,12\%}$ (khớp Y10). Bao gồm cả 5 dòng D=0 (tử số 269.290 triệu). | PH1 | `PASS` |
| **T55** | H. Quy tắc R04 | Chống hồi quy lọc sai $D_i > 0$ trong Benchmark | Công thức tính tỷ lệ đất toàn tỉnh | Nghiêm cấm loại bỏ 5 dòng D=0 khỏi tổng tử số (nếu loại sai sẽ ra 132,38% $\Rightarrow$ Engine phải đánh dấu FAIL). | PH1 | `PASS` |
| **T56** | H. Quy tắc R04 | Benchmark thu tiền đất kỳ 10T (`REV_LAND_RATE_P`) | 113 dòng địa phương đối chiếu cột G | $\frac{\sum R}{\sum G} = \frac{9.777.655,455}{4.823.476} = \mathbf{202,71\%}$ (khớp AB10). Bao gồm cả 6 dòng G=0 (tử số 304.790 triệu). | PH1 | `PASS` |
| **T57** | H. Quy tắc R04 | Đầy đủ 6 chỉ tiêu tỷ lệ thu ngân sách | Cấu hình chỉ tiêu và Từ điển dữ liệu | Đủ 6 mã: `REV_RATE_Y`, `REV_LAND_RATE_Y`, `REV_NONLAND_RATE_Y`, `REV_RATE_P`, `REV_LAND_RATE_P`, `REV_NONLAND_RATE_P`. | PH1 | `PASS` |
| **T58** | H. Quy tắc R04 | Phân biệt ZERO hợp lệ với MISSING/ERROR | Nhóm địa phương chỉ gồm các đơn vị Mẫu=0 | Tổng tử giữ nguyên; tỷ lệ nhóm là `DENOMINATOR_ZERO`. Khi thêm 1 xã có Mẫu>0, tự động tính tổng/tổng và giải trình. | PH1 | `PASS` |
| **T59** | I. Quy tắc R06 | Bảng báo cáo PH1 chỉ dùng GPMB diện tích | Báo cáo 5 xã hoặc 7 phường | Chỉ hiển thị tỷ lệ theo $\sum I / \sum D$. Tuyệt đối không có dòng hay tùy chọn bình quân cột M. Hồng Châu = 30,09%. | PH1 | `PASS` |
| **T60** | I. Quy tắc R06 | Đối chiếu cột M dự án với $100 \times I/D$ (ngưỡng 0,1%) | 422 dòng dự án trong `GPMB_20261026` | Phát hiện chính xác đúng **12 cảnh báo** có $|\Delta| > 0,1\%$. Không xét dòng tổng xã; 3 dòng thiếu I có cờ riêng. | PH1 | `PASS` |
| **T61** | I. Quy tắc R06 | Nêu rõ tên địa phương thiếu trong nguồn REV | Danh mục 114 DISB so với 113 REV | Nêu đích danh **Đặc khu Bạch Long Vĩ** (`NO_LOCALITY_RECORD`), benchmark ghi mốc 113, không gọi là 114. | PH1 | `PASS` |
| **T62** | I. Quy tắc R06 | Liệt kê chính xác 6 địa bàn vắng mặt trong GPMB | Danh mục 114 DISB so với 108 GPMB | Nêu đúng 6 địa bàn: **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**. | PH1 | `PASS` |
| **T63** | I. Quy tắc R06 | Phân biệt `FIELD_MISSING` với `NO_LOCALITY_RECORD` | Kinh Môn, Tân Hưng, Kiến Hưng vs 6 địa bàn | Kinh Môn có mặt nhưng thiếu ô I $\Rightarrow$ `FIELD_MISSING` / `PARTIAL_AGGREGATE`. Khác biệt hoàn toàn với vắng mặt. | PH1 | `PASS` |
| **T64** | I. Quy tắc R06 | Tính độc lập báo cáo thiếu giữa các phiên | Phiên A (5 xã) và Phiên B (7 phường) | Mỗi phiên có danh sách cảnh báo thiếu riêng theo các địa phương trong phiên; sao lưu/nhân bản không làm xáo trộn. | PH1 | `PASS` |
| **T65** | I. Quy tắc R06 | Phụ lục kiểm toán nguồn thiếu trong XLSX & In | Bản in PDF và Sheet xuất XLSX | Luôn có phụ lục *"Nguồn thiếu & Lý do"*, ghi đúng địa phương liên quan, ngày chốt, phương pháp và cờ cảnh báo. | PH1 | `PASS` |
| **T66** | I. Quy tắc R06 | Quy chế Cổng nghiệm thu PH1 và PH2 | Toàn bộ hệ thống kiểm thử | PH1 đạt khi báo cáo 14 dòng chạy thật, 62 test đạt PASS, các bài test PH2 ghi nhận `DEFERRED_BY_SCOPE`. PH2 đạt khi 66/66 test PASS. | PH1 | `PASS` (Cổng PH1) |

---

## 3. Chi tiết đặc tả kiểm thử theo từng phân nhóm

### Nhóm A: Tính toán và Phạm vi (T01 – T07)
- **Mục tiêu:** Đảm bảo toàn bộ phép tính tổng hợp (Benchmark) tuân thủ nguyên tắc cốt lõi **Tổng trên Tổng** ($\sum \text{Tử} / \sum \text{Mẫu}$), không bao giờ tính trung bình cộng tỷ lệ; xử lý đúng các phạm vi dữ liệu thực tế (114 địa phương giải ngân, 113 địa phương thu ngân sách, 108 địa bàn giải phóng mặt bằng, và cấp toàn thành phố).
- **Yêu cầu nghiêm ngặt:**
  - `T01`: Tỷ lệ giải ngân 114 địa phương bằng $10.434.921,777 / 15.550.923,159 = \mathbf{67,10\%}$. Không lấy con số 76,46% ở dòng tổng thành phố làm tỷ lệ chuẩn của 114 địa phương.
  - `T02`: Kế hoạch vốn bình quân một địa phương bằng $15.550.923,159 / 114 \approx \mathbf{136,41\text{ tỷ đồng}}$.
  - `T03`: Tỷ lệ thu ngân sách 113 địa phương bằng $28.550.929,455 / 25.651.713 = \mathbf{111,30\%}$. Trace và kiểm toán phải ghi rõ phạm vi 113 địa phương, thiếu Đặc khu Bạch Long Vĩ; nhãn bảng chính ghi 114 theo quy ước mới.
  - `T04`: Tỷ lệ GPMB 108 địa bàn bằng $39.960.463,6 / 55.398.165 = \mathbf{72,13\%}$. Tuyệt đối không lấy bình quân tỷ lệ của các địa bàn.
  - `T05`: Xã Hồng Châu có tỷ lệ GPMB theo diện tích là $35.897 / 119.280 = \mathbf{30,09\%}$. Nghiêm cấm tạo hoặc cho phép người dùng chọn tỷ lệ bình quân cột M các dự án; không dùng giá trị M tổng xã trong nguồn để ghi đè.
  - `T06`: Tỷ lệ GPMB nhóm 11 xã mẫu đạt $\sim \mathbf{76,97\%}$. Đây là tỷ lệ của riêng nhóm được chọn, không đánh đồng với benchmark 108 địa bàn.
  - `T07`: Tỷ lệ giải ngân toàn thành phố đạt $68,98\%$ (nguyên bản) và $68,43\%$ (khi loại trừ khoản ngoài kế hoạch dòng 145). Cả hai phải ghi rõ phạm vi toàn thành phố và không được dùng để thay thế benchmark 114 địa phương ($67,10\%$).

### Nhóm B: Đơn vị và Giá trị số học (T08 – T13)
- **Mục tiêu:** Kiểm soát việc chuẩn hóa đơn vị đo lường (Triệu đồng $\rightarrow$ Tỷ đồng; Đồng $\rightarrow$ Tỷ đồng; $\text{m}^2 \rightarrow \text{ha}$), sử dụng thư viện `decimal.js` cho mọi phép toán số học để loại trừ sai số dấu phẩy động (floating-point error), và xử lý mẫu số bằng 0 theo Quy tắc R04.
- **Yêu cầu nghiêm ngặt:**
  - `T08`–`T11`: Hồng Châu thu ngân sách 32.845 triệu đồng quy đổi thành $32,845\text{ tỷ đồng}$ (hiển thị 32,85 tỷ); vốn giải ngân 35.680,778561 triệu đồng quy đổi thành $35,680778561\text{ tỷ đồng}$ (hiển thị 35,68 tỷ); kinh phí GPMB 56.141.672.000 đồng quy đổi thành $56,141672\text{ tỷ đồng}$; diện tích $119.280\text{ m}^2 = 11,928\text{ ha}$.
  - `T12`: Hàm phân tích chuỗi số theo ngữ cảnh `parseContextualNumber` nhận diện chính xác các định dạng số Việt Nam/Quốc tế (`119.280 m2`, `32,8 tỷ`, `119.71`).
  - `T13`: Khi địa phương có Mẫu số = 0 và Tử số > 0, trạng thái tỷ lệ là `DENOMINATOR_ZERO`, hiển thị *"Phát sinh ngoài dự toán"*, tuyệt đối không hiển thị `Infinity` hay `0%`.

### Nhóm C: Thời gian, Phiên làm việc và Lưu trữ (T14 – T18)
- **Mục tiêu:** Đảm bảo tính toàn vẹn của mô hình phiên làm việc độc lập (Multi-session), quy trình xác nhận ngày chốt dữ liệu (As-of Date) và khả năng sao lưu/khôi phục hoàn toàn offline.
- **Yêu cầu nghiêm ngặt:**
  - `T14`: Tự động nhận diện ngày chốt từ nội dung sheet: DISB chốt ngày 15/10/2026; GPMB chốt ngày 26/10/2026; nguồn REV yêu cầu người dùng xác nhận ngày chốt thực tế (không đoán mò 19/10 hay 31/10).
  - `T15`: Khởi tạo phiên làm việc mới luôn có **0 địa phương mặc định**. Phiên A (5 xã) và Phiên B (7 phường) hoàn toàn độc lập về danh sách địa phương, thứ tự, cấu hình chỉ tiêu và ngày chốt.
  - `T16`: Nhân bản phiên (clone) và xóa phiên hoạt động an toàn. Toàn bộ workspace có thể xuất ra file `.kxh.json` và khôi phục nguyên vẹn 100% khi mở lại ứng dụng.
  - `T17`: Khả năng ghim phiên bản dữ liệu (Version Pinning). Phiên cũ không bị tự động thay đổi dữ liệu khi người dùng nạp thêm một file nguồn mới vào workspace.
  - `T18`: Chức năng in ấn và xuất XLSX hoạt động chuẩn xác cho cả báo cáo nhỏ (5 địa phương) và báo cáo lớn (20 địa phương), không bị cắt xén cột.

### Nhóm D: Chất lượng dữ liệu, Xử lý lỗi và Bảo mật (T19 – T24)
- **Mục tiêu:** Đảm bảo hệ thống hoạt động ổn định, không bị sập trước dữ liệu lỗi, bảo mật tuyệt đối 100% offline, và chống chèn mã độc.
- **Yêu cầu nghiêm ngặt:**
  - `T19a`: Lỗi công thức nguồn `#VALUE!` tại ô C7 sheet `Tổng hợp` của DISB được cô lập thành `FORMULA_ERROR`, hiển thị thông báo rõ ràng mà không làm gián đoạn hệ thống.
  - `T20`: Nguồn REV thiếu Đặc khu Bạch Long Vĩ được ghi nhận là `NO_LOCALITY_RECORD`, không được tự ý điền số 0 vào dữ liệu hay mẫu số.
  - `T21`: Các dự án có $I > D$ hoặc $M > 100\%$ trong GPMB được giữ nguyên giá trị thực và kích hoạt cờ cảnh báo chất lượng.
  - `T22`: Ứng dụng chạy hoàn toàn offline qua giao thức `file://` trên cả trình duyệt Google Chrome và Microsoft Edge, không gửi bất kỳ HTTP request nào.
  - `T23`: Toàn bộ dữ liệu hiển thị được lọc sạch qua `escapeHtmlUi` và `sanitizeExcelText`, loại bỏ hoàn toàn nguy cơ XSS và Formula Injection.
  - `T24`: File sao lưu workspace `.kxh.json` được kiểm tra tính hợp lệ bằng checksum SHA-256; từ chối nạp nếu file bị sửa đổi trái phép.

### Nhóm E: Tích hợp Kết quả Phản biện R01 (T25 – T32)
- **Mục tiêu:** Hiện thực hóa các quy tắc nghiệp vụ sâu từ đợt phản biện R01 về đọc ghi chú, chuẩn hóa tên địa phương và tiêu chuẩn xuất bản Excel.
- **Yêu cầu nghiêm ngặt:**
  - `T25`–`T27`: Đọc đủ 25 ghi chú tại cột Q và 11 dấu marker tại cột P trong DISB. Không tự ý dùng con số loại trừ 94% tại Q18 hay các tỷ lệ dự kiến tại Q7 để ghi đè số liệu chính thức.
  - `T28`: Chuẩn hóa Unicode NFC và xử lý triệt để khoảng trắng thừa (`Xã Thanh Miện `); phân biệt chính xác các địa phương dễ nhầm lẫn như Cẩm Giang vs Cẩm Giàng, Hưng Đạo vs Trần Hưng Đạo.
  - `T29`: Áp dụng bộ quy tắc kiểm tra GPMB với ngưỡng dung sai 0,1%: phát hiện chính xác **12 cảnh báo cột M** khác $100 \times I/D$, 13 trường hợp $I > D$, 48 trường hợp $J > G$, 14 trường hợp $K > E$, 24 trường hợp $L > F$ (tổng cộng 111 lượt cảnh báo trên 90 dòng dự án).
  - `T32`: File XLSX xuất bản có giao diện chuyên nghiệp: Font Times New Roman, kẻ khung đầy đủ, căn lề số sang phải, text sang trái, lưu trữ số thực (number cell) để người dùng có thể tái sử dụng công thức trên Excel.

### Nhóm F: Tích hợp Kết quả Phản biện R02 (T33 – T40)
- **Mục tiêu:** Xử lý chính xác các trường hợp ô trống (null), các dòng dự án khuyết kết quả, và cơ chế tự động chọn sheet nhìn thấy.
- **Yêu cầu nghiêm ngặt:**
  - `T33`–`T35`: Ba dòng dự án 107, 173, 365 trong GPMB có diện tích $D > 0$ nhưng các cột kết quả bị trống được phân loại là `FIELD_MISSING`. Tỷ lệ GPMB Kinh Môn đạt $84,51\%$ với chất lượng `PARTIAL_AGGREGATE`.
  - `T36`–`T38`: Nhận diện đúng 296 ô trống trên 104 dòng trong DISB. Kiểm tra cân đối hàng ngang $F=G+H$, $I=J+K$, $I=L+M+N$ đạt 114/114 dòng với trạng thái `PASS_WITH_MISSING_COMPONENTS`. Khi tra cứu riêng lẻ, ô trống vẫn giữ nguyên trạng thái `FIELD_MISSING`.
  - `T39`–`T40`: Tự động nhận diện và chọn sheet hiển thị (visible) đúng cấu trúc (`Tổng hợp` trong DISB và `10T-19.10` trong REV), tự động bỏ qua các sheet bị ẩn (`hidden` hoặc `veryHidden`).

### Nhóm G: Nguyên tắc 11 — Giải trình mọi Phép tính (CalculationTrace T41 – T52)
- **Mục tiêu:** Cung cấp bằng chứng minh bạch 100% cho từng ô số liệu hiển thị trên giao diện cũng như bản xuất.
- **Yêu cầu nghiêm ngặt:**
  - `T41`: Mỗi ô nguồn (`SOURCE_VALUE`) lưu trữ chi tiết: tệp nguồn, sheet, tọa độ ô, mã băm SHA-256, ngày chốt số liệu và đơn vị đo lường.
  - `T42`: Mỗi ô tính toán (`CALCULATED`) có `traceId` duy nhất, công thức toán học dễ hiểu, danh sách đầy đủ các tham số đầu vào chưa làm tròn và các bước trung gian.
  - `T43`–`T46`: Trace của các tỷ lệ Benchmark (DISB 67,10%, REV 111,30%, GPMB 72,13%) ghi rõ toàn bộ danh sách các địa phương tham gia, số lượng địa phương bị loại trừ và lý do loại trừ cụ thể.
  - `T48`: Trace chuyển đổi đơn vị tiền tệ thể hiện rõ phép chia 1000 và đơn vị trước/sau chuyển đổi.
  - `T51`–`T52`: File sao lưu và bản xuất XLSX lưu giữ đầy đủ thông tin truy vết; sheet `Nhật ký phép tính` liệt kê chi tiết từng phép toán.

### Nhóm H: Tích hợp Kết quả Phản biện R04 (T53 – T58)
- **Mục tiêu:** Hoàn thiện từ điển chỉ tiêu thu ngân sách và quy tắc xử lý trường hợp mẫu số bằng 0 ở cấp độ địa phương và tổng hợp.
- **Yêu cầu nghiêm ngặt:**
  - `T53`: Năm địa phương có dự toán thu tiền đất bằng 0 ($D=0$) nhưng có thực thu dương ($R>0$) hiển thị *"Phát sinh ngoài dự toán"*, không được loại trừ khỏi tập tính benchmark của tỉnh.
  - `T54`–`T56`: Benchmark thu tiền đất năm đạt $\mathbf{136,12\%}$ (khớp ô Y10), bao gồm cả 269.290 triệu đồng của 5 dòng $D=0$. Benchmark thu tiền đất kỳ 10T đạt $\mathbf{202,71\%}$ (khớp ô AB10), bao gồm cả 304.790 triệu đồng của 6 dòng $G=0$.
  - `T55`: Kiểm tra chống hồi quy: Nếu thuật toán lọc bỏ các dòng $D=0$ khỏi tử số thì tỷ lệ sẽ bị sai lệch thành $132,38\%$ $\Rightarrow$ Bắt buộc phải đánh giá FAIL nếu xảy ra.
  - `T57`: Cung cấp đầy đủ 6 chỉ tiêu tỷ lệ thu ngân sách đối chiếu từ cột X đến AC trong file REV.
  - `T58`: Phân biệt rạch ròi giữa trạng thái số 0 hợp lệ (`ZERO_VALID`) với thiếu dữ liệu (`FIELD_MISSING`).

### Nhóm I: Kế hoạch triển khai hai giai đoạn PH1 & PH2 (T59 – T66)
- **Mục tiêu:** Tuân thủ triệt để lệnh bàn giao tại `AGENTS.md` và Cổng nghiệm thu §14.2.
- **Yêu cầu nghiêm ngặt:**
  - `T59`: Bảng báo cáo PH1 chỉ sử dụng phương pháp tính GPMB theo diện tích ($\sum I / \sum D$). Tuyệt đối không đưa chỉ tiêu bình quân cột M vào giao diện, menu, bản in hay file Excel. Xã Hồng Châu hiển thị duy nhất con số $30,09\%$.
  - `T60`: Quy tắc đối chiếu cột M dự án phát hiện chính xác đúng **12 cảnh báo** có độ lệch lớn hơn 0,1 điểm phần trăm. Không áp dụng quy tắc này lên dòng tổng của cấp xã.
  - `T61`–`T62`: Báo cáo chỉ rõ tên các địa phương thiếu trong từng nguồn: Nguồn REV thiếu **Đặc khu Bạch Long Vĩ**; Nguồn GPMB thiếu 6 địa bàn (**Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**).
  - `T63`: Kinh Môn, Tân Hưng, Kiến Hưng là các địa phương có dự án nhưng thiếu dữ liệu (`FIELD_MISSING`), không bị nhầm lẫn sang trạng thái vắng mặt (`NO_LOCALITY_RECORD`).
  - `T64`–`T65`: Các phiên làm việc độc lập quản lý danh sách cảnh báo thiếu riêng; bản in PDF và file Excel luôn có phụ lục kiểm toán *"Nguồn thiếu & Lý do"*.
  - `T66`: Đóng cổng kiểm định PH1 với 62 bài test thực chạy PASS trên Vitest và 4 hạng mục mở rộng được ghi nhận minh bạch `DEFERRED_BY_SCOPE`.

---

## 4. Danh mục các hạng mục mở rộng PH2 (`DEFERRED_BY_SCOPE`)

Tuân thủ nghiêm ngặt nguyên tắc **"Không ghi PASS giả"** tại §14.2 và `T66`, các tính năng sau đây được phân định rõ ràng thuộc phạm vi **Kế hoạch PH2** (theo `docs/plans/PHASE_2_EXTENSIBILITY.md`):

1. **`T19b` & `T31b` — Dynamic Mapping Wizard (Bộ hướng dẫn ánh xạ cột động):**
   - *Phạm vi PH1:* Hệ thống đọc chuẩn xác theo fingerprint cấu trúc cố định của bộ 4 file tham chiếu thật. Nếu file bị đổi tên nhưng giữ nguyên cấu trúc, hệ thống vẫn tự động nhận diện thành công.
   - *Phạm vi PH2:* Khi người dùng tải lên một file Excel kỳ mới có cấu trúc cột bị hoán đổi (ví dụ cột B chuyển sang cột E, cột C chuyển sang cột F) hoặc thêm/bớt cột, hệ thống sẽ mở giao diện Wizard tương tác cho phép người dùng kéo thả và gán lại ánh xạ ô/cột.
   - *Trạng thái Cổng PH1:* `DEFERRED_BY_SCOPE`.

2. **`T49` — Multi-period Confirmed Exclusion Scenario (Kịch bản loại trừ ghi chú Q có xác nhận đa kỳ):**
   - *Phạm vi PH1:* Hệ thống đọc và hiển thị đầy đủ, nguyên văn nội dung 25 ghi chú tại cột Q của DISB dưới dạng văn bản tham khảo minh bạch (như ghi chú Q18 nêu 94% ở Hồng Châu, ghi chú Q7 ở cấp thành phố), không tự ý dùng regex bóc tách số liệu để thay đổi tỷ lệ thực tế.
   - *Phạm vi PH2:* Cung cấp giao diện quản lý kịch bản loại trừ nâng cao: Người dùng có thẩm quyền có thể tạo kịch bản phê duyệt, chọn bóc tách số liệu tử và mẫu cụ thể để tính toán lại tỷ lệ điều chỉnh theo ghi chú Q xuyên suốt nhiều kỳ báo cáo.
   - *Trạng thái Cổng PH1:* `DEFERRED_BY_SCOPE`.

3. **`T50` — Dynamic Formula AST Engine (Bộ phân tích cú pháp công thức tự do):**
   - *Phạm vi PH1:* 14 dòng chỉ tiêu chuẩn của bảng báo cáo và 6 chỉ tiêu tỷ lệ thu ngân sách được tính toán theo các hàm toán học an toàn, tối ưu hóa cố định trong mã nguồn TypeScript (`src/core/indicators.ts`), ngăn chặn hoàn toàn việc thực thi mã nguy hiểm (`eval`).
   - *Phạm vi PH2:* Cung cấp trình soạn thảo công thức tự do (Formula Editor) với bộ phân tích cú pháp AST (Abstract Syntax Tree), cho phép người dùng tự định nghĩa chỉ tiêu mới bằng biểu thức toán học, tự động kiểm tra vòng lặp phụ thuộc (circular dependency check) và kiểm tra tính tương thích của đơn vị đo lường.
   - *Trạng thái Cổng PH1:* `DEFERRED_BY_SCOPE`.

---

## 5. Hướng dẫn thực thi kiểm thử và Bằng chứng môi trường (Vitest)

### 5.1 Lệnh chạy kiểm thử tự động
Để kiểm chứng toàn bộ ma trận kiểm thử trên môi trường thực tế với bộ 4 file Excel tham chiếu chuẩn:

```bash
# Kiểm tra định dạng TypeScript
npm run typecheck

# Chạy toàn bộ bộ kiểm thử Vitest
npm test

# Chạy với hiển thị chi tiết từng ca kiểm thử
npx vitest run --reporter=verbose
```

### 5.2 Bằng chứng tính toàn vẹn của Dữ liệu tham chiếu (SHA-256)
Mọi kết quả kiểm thử trong Cổng PH1 đều được đối soát bitwise trực tiếp trên 4 file nguồn chuẩn hóa tại thư mục `data/reference/`:

1. `DISB_20261015` (`Báo cáo giải ngân 15.10 sửa(1).xlsx`):  
   `14aa4be1ae19f0e1d09e3a6a9be777e382d62d49e1f5798e1e77983637ae7ef0`
2. `REV_20261019` (`Báo cáo thu NSNN 19.10.xlsx`):  
   `35d7a64115e58988a6d61f1c79805d2c206ce50125fb0a7cead3e0c7047f0e69`
3. `GPMB_20261026` (`Biểu 02. TH KQ GPMB 26.10.2026_gui thuc hien.xlsx`):  
   `0853fe6c0e816a757e84ee857fa463777ceaa51410427845ba00870f7be543ee`
4. `RESULT_REFERENCE` (`Phụ lục 14 xã.xlsx`):  
   `ec566eb0717df304fa36ea3be01b0b5e7d44fd276532057d29792031a0e10a62`

## Các ca hồi quy PH1 bổ sung ngày 24/11/2026

| ID | Kỳ vọng | Bằng chứng |
|---|---|---|
| NOV_FIX_01 | Compact DISB nhận đủ 114 dòng 8–121, F/I/M/N đúng vai trò, ngày 22/11, không áp cửa sổ legacy | tests/studio.spec.ts |
| NOV_FIX_02 | REV có cột chèn vẫn nhận đúng I/S/X theo vai trò, reject duplicate; ngày 23/11; Kết quả thu NSNN mặc định ẩn, STT đồng bộ, 11 cột A4 | tests/studio.spec.ts |
| NOV_FIX_03 | 1/9/11/12 địa phương: gộp chính xác hai benchmark REV/GPMB mỗi nhóm ngang; rowspan dọc Studio, Excel merge đúng và 1 giá trị numeric; không còn footer nguồn trên báo cáo, sheet audit/trace còn | tests/studio.spec.ts |
| NOV_FIX_04 | Bảy nhãn chuẩn; migration phiên cũ gồm nhãn 113/114, 108/114; ngày chốt động, ba nhãn mặc định cố định 114 dù thiếu nguồn, độ phủ thật còn ở sheet kiểm toán; bảo toàn nhãn riêng; đồng nhất Studio/PDF/XLSX; ba benchmark có class phóng chữ 1.1em và style phần trăm Excel 11 pt, không đổi số liệu hay ô gộp. Fixture độ phủ 114 chỉ mô phỏng nhãn | tests/studio.spec.ts |

T01–T66 là baseline lịch sử, không dùng kết quả cũ để kết luận PASS cho SHA mới. Kiểm tra PDF/Excel trên Windows bằng dữ liệu thực người dùng nhập; không commit workbook mới.
