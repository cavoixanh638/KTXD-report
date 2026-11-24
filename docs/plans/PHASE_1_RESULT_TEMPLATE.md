# KẾ HOẠCH CON 1 — BÁO CÁO KTXH THEO MẪU KẾT QUẢ TỔNG HỢP

**Mã:** KTXH-PH1 / **Phiên bản:** V2.2 / **Trạng thái:** PLANNED_NOT_IMPLEMENTED  
**Ưu tiên:** HOÀN THÀNH SẢN PHẨM DÙNG ĐƯỢC TRƯỚC, KHÔNG CHỈ DỰNG DEMO.  
**Tài liệu chủ quản:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md`. Nếu có mâu thuẫn, theo Master V2.2; báo cáo vấn đề chứ không tự bỏ điều kiện dữ liệu.

## 1. Đầu ra và giới hạn

Đầu ra là **webapp thực sự chạy offline trên Chrome/Edge, mở `dist/index.html` trực tiếp bằng `file://`**, dùng bốn file tham chiếu trong `data/reference/`; tệp `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx` là **mẫu bố cục/chỉ tiêu, không phải tập xã mặc định**. Người sử dụng nhập ba file nguồn hoặc phục hồi bộ hồ sơ đã nhập; tạo số lượng phiên tùy ý, mỗi phiên chọn bất kỳ số lượng xã/phường/đặc khu nào. Giai đoạn 1 phải nhập được **đúng cấu trúc nguồn đã chốt**, không bắt buộc nhận dạng mọi Excel lạ. Tối ưu tốc độ có thể làm sau nhưng dữ liệu không được tính sai.

**Không có trong Phase 1:** bộ thiết kế hoàn toàn tùy ý cho hàng trăm nguồn mới, trình xây công thức đa bước bằng AST tùy ý, mapping wizard cho mọi thay đổi layout, dashboard nhiều biểu đồ và phân tích xu hướng liên kỳ; các nội dung này thuộc kế hoạch con 2. **Không được đẩy sang giai đoạn 2**: tính chuẩn, xử lý MISSING, ngày chốt, truy vết CalculationTrace, danh sách thiếu nguồn, cảnh báo M/I/D, multi-session, sao lưu/khôi phục, xuất báo cáo theo mẫu, bảo mật offline.

## 2. Dòng chỉ tiêu cố định gốc cần dựng được (14 dòng, sheet `RESULT_REFERENCE!Sheet1`)

| Dòng mẫu | Chỉ tiêu người dùng thấy (cho đổi tên) | Cách tạo từ nguồn, dạng dữ liệu | Quy tắc hiển thị |
|---:|---|---|---|
| 3 | Dự toán thu NSNN năm | REV C theo địa phương → tỷ đồng | Số, đơn vị tách khỏi giá trị |
| 4 | Tỷ lệ thu NSNN so với dự toán | REV I/C × 100 | %; nếu C=0: không chia, giải trình |
| 5 | Trong đó: tỷ lệ thu tiền sử dụng đất | REV R/D × 100 | %; nếu D=0,R>0: phát sinh ngoài dự toán |
| 6 | Tỷ lệ thu không gồm tiền đất | REV W/E × 100 | %; không tính trùng các sắc thuế chi tiết |
| 7 | Kế hoạch vốn đầu tư công sau điều chỉnh | DISB F theo địa phương → tỷ đồng | Số |
| 8 | So với mức vốn giao bình quân một địa phương | So F với `SUM(F của 114)/114` | Mốc tiền tuyệt đối, không AVERAGE tỷ lệ |
| 9 | Tỷ lệ giải ngân chung của 114 địa phương | DISB `SUM(I13:I126)/SUM(F13:F126)` × 100 | 67,10% theo nguồn mẫu, không lấy 76% từ bảng gốc |
| 10 | Tỷ lệ giải ngân của địa phương | DISB I/F × 100 | %; chú thích Q/P nếu có |
| 11 | Nhận xét tỷ lệ giải ngân | So dòng 10 với mốc dòng 9 theo ngưỡng cấu hình | Cảnh báo sai khác phương pháp/ngày, có lý do |
| 12 | Kinh phí phân bổ GPMB | GPMB tổng G các dự án thuộc địa phương → tỷ đồng | Giữ nguyên tổng VND để tính |
| 13 | Diện tích phải GPMB | GPMB tổng D các dự án thuộc địa phương → m² | Có thể chọn ha và định dạng |
| 14 | Tỷ lệ GPMB của danh mục địa bàn có dữ liệu | GPMB `SUM(I dự án)/SUM(D dự án)` trên phạm vi nguồn hiện có | 72,13% trên 108 địa bàn, PARTIAL; **không ghi 70,8% của 114** |
| 15 | Tỷ lệ GPMB địa phương theo diện tích | GPMB `SUM(I dự án)/SUM(D dự án)` | **Phương pháp duy nhất được hiển thị**; không có lựa chọn bình quân tỷ lệ M |
| 16 | Đánh giá GPMB | So dòng 15 với mốc hợp lệ và phù hợp | Nếu thiếu thành phần hoặc khác phạm vi/ngày: chưa đủ cơ sở, không tự kết luận |

Cho ẩn/hiện và thay thứ tự 14 dòng, tạo nhóm và sao chép/đổi nhãn chỉ tiêu, nhưng không đổi công thức nền một cách âm thầm. Không chép 11 tên xã và mốc 76%, 70,8% từ bảng mẫu làm dữ liệu mặc định.

## 3. Luồng sử dụng chính — bắt buộc có đủ từ bản đầu

1. **Mở app:** Trang quản lý phiên; có nút `Tạo báo cáo`. Phiên mới mở với **0 địa phương** và mẫu 14 dòng.
2. **Nhập nguồn:** Chọn DISB, REV, GPMB; xác minh SHA fixture khi chạy test; hiện tên tệp, sheet được nhận diện, đơn vị theo cột, phạm vi 114/113/108, và ngày chốt độc lập. Thu NSNN chưa chắc ngày chốt: yêu cầu nhập/xác nhận trước khi chính thức tính.
3. **Chọn đơn vị:** Lọc xã/phường/đặc khu, tìm không dấu chỉ trong tìm kiếm, chọn N bất kỳ; ghép dữ liệu theo tên NFC chính xác có dấu + loại; phân biệt Cẩm Giang / Cẩm Giàng, Hưng Đạo / Trần Hưng Đạo.
4. **Bảng kết quả:** Cột trái STT/Chỉ tiêu ghim, địa phương ở các cột ngang, cuộn khi nhiều xã; số tiền, %, diện tích có đơn vị nhất quán; tất cả dòng 3–16 theo mẫu có thể hiển thị; người dùng tùy chỉnh trong mục 4.
5. **Chi tiết ô:** Bấm ô, mở `CalculationTrace` nêu công thức, tử/mẫu, danh sách dự án hoặc nguồn địa phương, số gốc, quy đổi, làm tròn, ngày và file/sheet/cell, bản ghi bị bỏ và lý do; phép tính không có trace là FAIL.
6. **Cảnh báo và ghi chú:** Chỉ báo cờ liên quan xã đang chọn; Q của DISB giữ nguyên văn, tỷ lệ điều chỉnh nếu có chỉ là ghi chú/chưa xác minh; M GPMB **chỉ dùng để đối chiếu I/D theo từng dòng dự án**, không tạo tỷ lệ trung bình dự án.
7. **Lưu phiên:** Có 5 xã ở A, 7 phường ở B; đổi phiên/nhân bản/đặt tên; export file backup toàn workspace, restore từ file; không coi lưu trình duyệt là backup bền vững.
8. **Xuất:** XLSX có ô số thực, kiểu tiền/%/diện tích, tối thiểu trình bày giống bảng mẫu; in/lưu PDF bằng trình duyệt, phân trang, ngày chốt/coverage/ghi chú/cảnh báo; file xuất kèm audit phép tính và thông tin nguồn theo quy định Master.

## 4. Tùy chỉnh bắt buộc trong giai đoạn 1

- Tên phiên, mô tả, danh sách/thứ tự địa phương; tạo, nhân bản, chuyển, xóa có xác nhận; không giới hạn cố định N=11.
- Tiêu đề chính, tên/nhóm/thứ tự dòng; ẩn/hiện dòng và nhóm; chọn đơn vị tỷ đồng/triệu đồng, m²/ha và số chữ số; định dạng dấu phân cách; font/cỡ chữ, chiều rộng cột, căn lề, màu nhóm, màu trạng thái; lưu trong session.
- Mốc so sánh đúng nghiệp vụ (114 nếu đủ, 113/108 nếu không đủ ghi rõ `tham khảo`, city-total nếu có nguồn đúng và người dùng xác nhận); ngưỡng nhận xét và từ ngữ `cao hơn`, `thấp hơn`, `chưa đủ cơ sở` có thể sửa.
- Cho phép sử dụng lại hoặc nhân bản chỉ tiêu hiện có với cùng bộ công thức đã kiểm chứng; **không cần** bộ AST công thức tự do ở giai đoạn 1. Người dùng không thể đổi nhãn phạm vi 108/113 thành 114 hoặc tắt truy vết.
- Có thể xuất chỉ địa phương và chỉ tiêu đang chọn, phục hồi đúng cấu hình sau khi đóng trình duyệt và mở backup.

## 5. GPMB — chỉ một phương pháp tỷ lệ, riêng cờ đối chiếu cột M

- Mọi tỷ lệ GPMB dùng tổng I (diện tích đã GPMB *đã ghi nhận*) / tổng D (diện tích phải GPMB) × 100. Giữ D của dự án có I trống, không đóng góp vào tổng I đã ghi nhận và gắn PARTIAL_AGGREGATE; **không** tự biến I trống thành 0 đã xác nhận.
- Chỉ xét **dòng dự án** có A là STT số, `D>0` và I, M là số hợp lệ. `expected_pct=100*I/D`, `difference_pp=source_M-expected_pct`. Nếu `abs(difference_pp)>0,1` điểm phần trăm → `WARNING_MISMATCH`; nếu lệch nhỏ → INFO tùy ngưỡng; thiếu I/M → `MISSING_COMPONENT`, D<=0/không hợp lệ → `UNCOMPUTABLE`, không tính tỷ lệ so sánh. Không so sánh M ở dòng tổng xã với I/D vì dòng đó mang ý nghĩa khác.
- Trên 422 dự án mẫu có 12 dự án sai khác >0,1 điểm phần trăm; cung cấp danh sách dự án, địa phương, sheet, dòng, M, I, D, tỷ lệ tính lại và chênh lệch. Không tự sửa ô M. Không hiển thị bất kỳ dòng hoặc tùy chọn `Bình quân tỷ lệ dự án` nào trên bảng báo cáo, bảng mốc chuẩn hay tệp xuất.

## 6. Thông tin nguồn thiếu — bắt buộc báo tên, không chỉ số lượng

- Danh mục kiểm tra trong bộ fixture là 114 địa phương từ DISB; đây là **baseline tham chiếu trong bộ mẫu**, không tự nhận là danh mục pháp lý vĩnh viễn cho mọi kỳ.
- REV 113: thiếu bản ghi của **Đặc khu Bạch Long Vĩ**.
- GPMB 108: thiếu bản ghi của **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**.
- DISB 114: không thiếu địa phương ở cấp bản ghi, nhưng vẫn có ô thành phần trống. GPMB có dự án thiếu kết quả I tại dòng 107 (Kinh Môn), 173 (Tân Hưng), 365 (Kiến Hưng) — **khác** với địa phương hoàn toàn không có bản ghi.
- UI Import hiển thị bảng `Địa phương | Nguồn | Tình trạng | Trường/dòng thiếu | Lý do có thể khẳng định | Thời điểm`; báo cáo đang chọn chỉ liệt kê thiếu liên quan phiên; khi xuất có phụ lục nguồn thiếu. Quy ước: `NO_LOCALITY_RECORD` (không có dòng trong file), `FIELD_MISSING` (có dòng nhưng ô trống), `PARTIAL_AGGREGATE` (có dự án nhưng thiếu thành phần), `ZERO_VALID`, `ERROR`, `DATE_UNVERIFIED`, `UNMATCHED`. Không suy luận 'không có dự án' từ 'không có bản ghi'.
- Tỷ lệ benchmark được tính theo tổng/tổng trên **phạm vi có dữ liệu**, ghi N được tính, N kỳ vọng, tên các địa phương không có nguồn, các dòng bị bỏ và vì sao; không bù 0, không đổi tên 113/108 thành 114.

## 7. Cấu trúc module tối thiểu và quy tắc khóa đầu ra

`src/core/sourceReaders.ts` (ba profile cố định, chọn sheet đúng); `src/core/localities.ts` (ID, matching), `src/core/coverage.ts`, `src/core/indicators.ts`, `src/core/decimal.ts`, `src/core/calculationTrace.ts`, `src/core/warnings.ts`, `src/core/sessions.ts`, `src/ui/reportGrid.ts`, `src/ui/cellInspector.ts`, `src/export/xlsx.ts`, `src/export/print.ts`, `src/backup/workspace.ts` (đặt tên tương đương được chấp nhận, nhưng phải tách trách nhiệm). Mọi con số dùng chung một engine cho UI và tệp xuất; không nhúng ô sai thành dữ liệu cố định trong source code.

Ở đầu vào, tệp Excel không được phép chạy VBA, macro hoặc external link; chuỗi trong ô phải escape; không dùng `eval`. `dist/index.html` tự chứa thư viện offline; runtime cấm yêu cầu Internet. Thông tin dữ liệu thuộc quyền người dùng, không tự gửi ra ngoài.

## 8. Bàn giao, kiểm thử và tiêu chí PASS — cổng PH1

| Mã | Công việc | Có thể nghiệm thu khi |
|---|---|---|
| PH1-01 | Đọc 4 workbook cố định và fingerprint + phiên bản nguồn | SHA nguồn đúng; chọn đúng visible sheet; ngày chốt yêu cầu xác nhận; import không sửa Excel |
| PH1-02 | 14 dòng mẫu + Decimal/units + benchmark | Tính đủ từng dòng 3–16 từ nguồn; thu 113, giải ngân 114, GPMB 108; tử/mẫu và mốc đúng |
| PH1-03 | QC GPMB + tình trạng nguồn thiếu | 12 sai khác M/I/D được đánh dấu; thiếu REV 1, GPMB 6; 3 dự án I trống là PARTIAL, không tự thành 0 |
| PH1-04 | Chọn đơn vị/multi-session/tùy chỉnh | Phiên A 5 xã + phiên B 7 phường, không mặc định xã, đổi nhãn/bố cục/ngưỡng, chuyển/backup/restore không mất |
| PH1-05 | Xem CalculationTrace mọi ô | Từ từng kết quả giải trình được các bản ghi tham gia, số hạng, loại trừ, nguyên nhân, thời điểm, đơn vị |
| PH1-06 | Báo cáo hoàn chỉnh offline | In/PDF, XLSX đúng numeric/style mẫu, phụ lục nguồn thiếu/audit; tắt mạng mở bằng `file://` Chrome/Edge vẫn chạy |

Bộ test gốc T01–T58 dùng lại, với T05/T35/T45 được sửa theo Master V2.2; các ca mới T59–T66 nằm ở Master. **Không tự công bố PH1 DONE** khi chỉ có giao diện hoặc số liệu copy từ bảng mẫu. Báo cáo nghiệm thu PH1 cần bảng đối chiếu 14 dòng, số liệu 5/7 địa phương, bằng chứng QA xuất và log runtime; các bài test đòi mapping động hay formula editor tự do chuyển kiểm ở PH2 và ghi rõ `DEFERRED_BY_SCOPE`, không ghi PASS giả. Mọi lỗi tính toán, thiếu nguồn, mốc sai phạm vi, trace thiếu, mất session, offline không chạy đều là `BLOCKER` của PH1.

**Điều kiện chuyển PH2:** người dùng đã có sản phẩm theo mẫu và bằng chứng nghiệm thu PH1 trên commit SHA cụ thể; PH2 phát triển trên nền PH1, không dựng lại các phần đã PASS trừ khi thay đổi có ảnh hưởng và kiểm chứng hồi quy.

## 24/11/2026 — Điều chỉnh PH1 đã chốt

Tuân thủ mục **Cập nhật quy phạm PH1 ngày 24/11/2026** trong MASTER hiện hành. Không dùng mô tả R/W và dòng 13–126 của file tháng 10 làm mặc định cho file tháng 11. PH1 hỗ trợ REV nhận diện tiêu đề ngữ nghĩa, DISB_TOTAL_LOCALITY_V2, ngày chốt độc lập, dòng Kết quả thu NSNN tùy chọn mặc định ẩn/đánh lại STT, A4 ngang tối đa 11 địa phương/cụm, ô gộp hai benchmark REV/GPMB và bỏ footer nguồn bảng chính. Các sheet kiểm toán và trace vẫn bắt buộc. Các test NOV_FIX_01…03 bổ sung cho T01–T66; nghiệm thu theo SHA mới, không kế thừa PASS cũ. Mẫu 14 dòng là cơ sở, tùy chọn có thể tăng/giảm dòng hiển thị. Không triển khai PH2 trong đợt này.
