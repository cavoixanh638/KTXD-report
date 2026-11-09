# KẾ HOẠCH CON 2 — MỞ RỘNG HỆ THỐNG BÁO CÁO KTXH TÙY BIẾN

**Mã:** KTXH-PH2 / **Phiên bản:** V2.2 / **Trạng thái:** PLANNED_DEPENDS_ON_PH1.  
**Tài liệu chủ quản:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md`; **đầu vào bắt buộc:** báo cáo nghiệm thu và commit SHA của Kế hoạch con 1 tại `docs/plans/PHASE_1_RESULT_TEMPLATE.md`.

## 1. Mục tiêu và ràng buộc

Mở rộng ứng dụng từ báo cáo mẫu 14 dòng thành **bộ tạo báo cáo offline nhiều mẫu, nhiều kỳ, nhiều phiên bản nguồn và biểu thức chỉ tiêu linh hoạt**, nhưng vẫn dùng bộ tính toán, bộ nhớ phiên, bộ chứng cứ dữ liệu và `CalculationTrace` đã nghiệm thu PH1. **Không được thay đổi quy tắc bất biến**: tỷ lệ là tổng/tổng, GPMB chỉ tính theo diện tích, không lấy bình quân tỷ lệ dự án; mọi sai khác cột M phải có cờ; thiếu địa phương ghi tên và lý do; nguồn có ngày chốt, đơn vị theo cột; không công bố số thiếu là 0.

Không lập backend, đăng nhập, đồng bộ cloud, OCR, AI tự sinh báo cáo hay tính năng ngoài mục tiêu trừ khi có change request được duyệt. Không làm lại toàn bộ UI PH1 khi chỉ cần thêm chức năng.

## 2. Hạng mục PH2 bắt buộc

| Mã | Tính năng | Kết quả và tiêu chí |
|---|---|---|
| PH2-01 | Import đa mẫu, ánh xạ cột / sheet | Workbook khác tên/đổi vị trí cột/gộp tiêu đề: wizard ánh xạ tới field ID; hiển thị preview, kiểm tra fingerprint; manual select hidden/veryHidden có lý do; lưu mapping profile theo phiên bản |
| PH2-02 | Từ điển chỉ tiêu + công thức tùy chỉnh | Trình soạn công thức an toàn dạng AST (không eval), kiểm tra đơn vị, kiểu, tập bản ghi và ngày; hỗ trợ `SUM`, `RATIO_OF_SUMS`, chênh lệch, so sánh có điều kiện; chặn tỷ lệ trung bình dự án trong chỉ tiêu GPMB chính thức; mỗi công thức có version, trace và policy |
| PH2-03 | Quản lý nguồn đa kỳ / đa phiên bản | Nhập nhiều kỳ cho một nguồn, tạo snapshot, giữ version binding theo session; đối chiếu số liệu khi được phép so cùng kỳ và cùng định nghĩa; không âm thầm thay đổi số trong báo cáo đã khóa |
| PH2-04 | Bộ mẫu và tùy chỉnh nâng cao | Lập nhiều template mới, thêm/bớt nhóm/chỉ tiêu, cài ngưỡng và biểu thức nhận xét, lọc/sắp xếp đa tiêu chí, chế độ bảng rộng, template riêng cho thu/giải ngân/GPMB hoặc hỗn hợp; không có danh sách xã mặc định |
| PH2-05 | Kiểm tra và truy vết mở rộng | Kịch bản Q giải ngân có chứng cứ tử/mẫu, nhiều kiểu cảnh báo, kiểm tra import lạ, số liệu thành phố có phạm vi độc lập; coverage matrix theo kỳ/nguồn/field, xác nhận nguyên nhân thiếu có audit, cấm xóa dấu vết |
| PH2-06 | Xuất nâng cao và chất lượng | Excel kiểu hành chính với style/font/print areas/A4-A3/sheet audit, PDF nhiều cột/chú giải, backup/version migrations/checksum và schema, chạy offline và kiểm thử bảo mật nâng cao |

## 3. Cách sử dụng khả năng mở rộng mà không làm sai kế hoạch PH1

1. **Nguồn mới:** Người dùng thêm Excel lạ; hệ thống chỉ nhận khi mapping/metadata/ngày đủ cơ sở. Khi thiếu, lưu `PENDING_MAPPING` và không đưa vào benchmark. Ghi mọi đổi mapping kèm thời điểm, lý do, fingerprint.
2. **Chỉ tiêu mới:** Người dùng chọn trường dữ liệu, đơn vị, công thức; preview 3 ví dụ và tập bản ghi được tính; `CalculationTrace` phải được tạo trước khi chỉ tiêu chính thức có hiệu lực. Cấu hình khác định nghĩa của chỉ tiêu chuẩn không được ghi đè chỉ tiêu chuẩn.
3. **Mốc mới:** Mốc city-total chỉ được dùng khi có cặp tử/mẫu chính thức và phạm vi hợp lệ. N=113/108 không đổi thành 114; danh sách địa phương thiếu được ghi theo dataset và phiên bản, không mặc định giữ đúng danh sách tháng 10/2026 cho nguồn mới.
4. **Nhận xét, màu, bố cục:** Người dùng tự điều chỉnh nhưng không che chất lượng dữ liệu; nguồn thiếu/khác ngày/khác phạm vi vẫn hiện trên báo cáo xuất.
5. **Cảnh báo M:** Chỉ kiểm M nguồn so với tỷ lệ I/D của **dòng dự án**, không so M dòng tổng địa phương và không sinh bất kỳ chức năng `AVERAGE_PROJECT_REFERENCE` để hiển thị báo cáo.

## 4. Đầu vào / dữ liệu kiểm thử PH2

- Bốn workbook đã giao tại `data/reference/`, SHA trong `data/reference/MANIFEST.json`.
- Mẫu nhân tạo, không chứa dữ liệu nội bộ mới: đổi vị trí cột, đổi tên file, sheet hidden, dòng thiếu, D=0, I=MISSING, tên tiếng Việt đồng âm khi bỏ dấu, ghi chú P/Q nhiều tỷ lệ, dữ liệu mới có date khác.
- Snapshot kết quả PH1 làm **golden regression baseline**: tỷ lệ REV/DISB/GPMB, tên địa phương thiếu, danh sách 12 cảnh báo M, trace và số liệu xuất Excel/PDF.

## 5. Các gói thực hiện và checkpoint

- **PH2-A:** khảo sát thay đổi và đóng băng interface PH1, ký checklist không regress; commit profile importer v2.
- **PH2-B:** AST chỉ tiêu, mapping/validation và template nâng cao; unit tests và audit dạng diff.
- **PH2-C:** multi-period versioning, trace/coverage mở rộng, các kịch bản Q và mốc city-total có kiểm chứng.
- **PH2-D:** XLSX/PDF định dạng nâng cao, backup/migration, bảo mật offline, tối ưu hiệu năng.
- **PH2-E:** chạy lại **toàn bộ T01–T66** + test mở rộng, kiểm thử Chrome/Edge offline, đối chiếu workbook xuất và bản backup, cập nhật checkpoint.

Mỗi checkpoint ghi branch, commit SHA, nguồn SHA, những bài test chạy thật, kết quả PASS/FAIL, ảnh hưởng tới PH1 và lỗi còn mở. Không tự đánh dấu test PH1 PASS cho commit mới nếu code thay đổi ảnh hưởng phép tính mà không kiểm thử lại.

## 6. Tiêu chí nghiệm thu PH2

PH2 DONE khi: (a) các hạng mục PH2-01…06 hoạt động thực tế, (b) không mất tính đúng của PH1, (c) tất cả T01–T66 trên SHA hiện tại được kiểm chứng, (d) không có phép tính/ghi chú loại trừ nào thiếu trace, (e) source 113/108 và các ngày/chênh lệch được ghi đúng trên mọi báo cáo, (f) backup/restore và thay phiên bản không mất lịch sử, (g) bản build `dist/index.html` vẫn mở trực tiếp bằng `file://` khi tắt Internet. Nếu chưa có bằng chứng runtime, trạng thái là `NOT_VERIFIED`, không dùng nhãn DONE.
