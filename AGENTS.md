# AGENTS.md — Lệnh bàn giao cho mọi AI/Codex triển khai KTXH Offline

## THỨ TỰ ƯU TIÊN BẮT BUỘC

1. Đọc **toàn bộ** [`MASTER V2.2`](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md). Đây là tài liệu quy phạm duy nhất hiện hành.
2. Đọc **[`Kế hoạch con 1`](docs/plans/PHASE_1_RESULT_TEMPLATE.md)**, triển khai đúng nội dung PH1 và nghiệm thu trước. PH1 phải cho người dùng dùng được bảng 14 dòng thực tế, không phải mockup.
3. Đọc **[`Kế hoạch con 2`](docs/plans/PHASE_2_EXTENSIBILITY.md)** để giữ ranh giới kiến trúc, nhưng **chỉ bắt đầu PH2 sau khi PH1 đã đạt gate có bằng chứng**.
4. Đọc bốn nguồn Excel gốc tại `data/reference/` và `data/reference/MANIFEST.json`; xác minh SHA; xem [audit nguồn](docs/data_checks/REFERENCE_COVERAGE_20261109.json). Không tự suy đoán nguồn không có vì đã được commit repo Private.
5. V1/V2.0/V2.1, review R01–R05 và amendments đã gỡ khỏi cây tệp hiện hành, chỉ còn trong lịch sử Git. P0–P7 cũ đã thay bằng PH1/PH2. **Chỉ MASTER V2.2 và hai kế hoạch con là tài liệu thi công**; tạo review/issue mới nếu muốn sửa quy tắc nghiệp vụ.

## CÁC QUY TẮC KHÔNG THỂ ĐỔI

- Offline 100%, `file://.../dist/index.html` dùng Chrome và Edge không cần server/internet/CDN/đăng nhập.
- Phiên mới **0 địa phương mặc định**; chọn 1/N địa phương tùy ý; nhiều session cùng tồn tại, version và backup/restore độc lập.
- **GPMB CHỈ THEO DIỆN TÍCH:** `SUM(I recorded)/SUM(D)` trên các dự án trong phạm vi. **Không tạo bất kỳ dòng, chế độ, phép tính hoặc lựa chọn “bình quân tỷ lệ dự án”** trong bảng báo cáo hay bản xuất. Cột M chỉ giữ raw và đánh dấu M khác `100*I/D` ở **dòng dự án**, ngưỡng >0,1 điểm %; tránh tính trên dòng tổng xã; thiếu I vẫn là MISSING.
- **Nguồn thiếu phải có TÊN**: tham chiếu 114 DISB, thiếu REV **Đặc khu Bạch Long Vĩ**; thiếu GPMB **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**. Danh sách này chỉ áp dụng bộ Excel mẫu; dữ liệu mới phải tính lại. Không suy luận lý do kinh tế/hành chính khi chỉ thấy thiếu dòng.
- Trạng thái `NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`, `ERROR`, `DATE_UNVERIFIED` tách biệt. Dòng DISB có null thành phần không có nghĩa thiếu toàn bộ địa phương.
- **Benchmark mọi tỷ lệ = SUM(tử số)/SUM(mẫu số)** trong cùng phạm vi và kỳ; không AVERAGE tỷ lệ xã/phường; mẫu số 0 **cấp địa phương** không loại dòng khỏi SUM tổng nếu cả tử và mẫu đều numeric. Mốc thu 113 và GPMB 108 không được ghi nhãn 114, city-total là phạm vi khác.
- Mọi phép tính (kể cả trung gian/nhận xét) có `CalculationTrace` chứa công thức, tử/mẫu, nguồn ô/SHA, tập included/excluded và từng lý do, đơn vị, ngày chốt, rounding, chất lượng. Không PASS nếu chỉ có số cuối.
- Tệp nguồn nguyên vẹn, không thực thi macro/VBA, không `eval`, không external request; không upload thêm Excel mới lên repo ngoài 4 tệp được chủ dự án cho phép.

## THỨ TỰ THI CÔNG VÀ NGHIỆM THU

- **PH1:** PH1-01…PH1-06 trong kế hoạch con 1. Đọc 3 nguồn, tạo **14 dòng tương ứng dòng 3–16 Sheet1** của tệp mẫu với dữ liệu thật, chọn xã bất kỳ, chỉnh hiển thị/cách tính đã chốt, kiểm tra missing và M, xem trace, in/XLSX, backup/restore. Các test chỉ thuộc PH2 ghi rõ `DEFERRED_BY_SCOPE`, tuyệt đối không ghi PASS giả.
- **PH2:** PH2-01…PH2-06 theo kế hoạch con 2; mở rộng import động, template, AST công thức và chứng cứ QA. Sau PH2, toàn bộ T01–T66 phải PASS trên SHA hiện tại.
- Sau mỗi gói cập nhật `docs/status/PROJECT_STATUS.md`: branch, HEAD SHA, dataset SHA, module/files thay đổi, test thực chạy PASS/FAIL/DEFERRED, điều kiện chưa đạt, cảnh báo còn mở; không kế thừa PASS từ SHA trước khi sửa code.
- Không tự đánh dấu DONE khi chưa có commit, test kết quả và bằng chứng offline. Không thay số liệu nguồn để làm test PASS.

## KHỞI TẠO

Repository: `cavoixanh638/KTXD-report` (Private). Sản phẩm tên KTXH Offline. Hiện `MASTER_V2.2_PLAN_ONLY / PH1_NOT_STARTED / PH2_NOT_STARTED`. Bốn workbook đã có ở `data/reference/`; test source audit không tương đương test app runtime.
