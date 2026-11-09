# NHẬT KÝ QUYẾT ĐỊNH — KTXH Offline

**Tài liệu thi công hiện hành:** [MASTER V2.2](../specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md), [PH1](../plans/PHASE_1_RESULT_TEMPLATE.md), [PH2](../plans/PHASE_2_EXTENSIBILITY.md). 66 test T01–T66. Không dùng bản cũ làm yêu cầu hiện hành.

| Vòng | Nội dung đã đưa vào kế hoạch hiện hành |
|---|---|
| R01 | Ghi chú P/Q giải ngân; ghép chính xác tên địa phương; cảnh báo và xuất Excel. |
| R02 | Phân biệt ô trống và số 0; 3 dự án GPMB thiếu I; sheet ẩn; kiểm tra dữ liệu thành phần. |
| R03 | Mọi phép tính đều có CalculationTrace, công thức, thành phần được tính/bỏ qua và lý do. |
| R04 | Dòng có mẫu số 0 vẫn tham gia benchmark SUM/SUM khi dữ liệu hợp lệ; đủ 6 tỷ lệ thu NSNN. |
| R05 | Đưa đúng 4 workbook gốc vào repo Private, lưu SHA-256 và cách kiểm tra. |
| [R06](REVIEW_R06_20261109.md) | Chỉ tính GPMB theo diện tích; kiểm tra M/I/D; nêu tên địa phương thiếu; tách kế hoạch PH1/PH2. |
| R07 — dọn repository | Gỡ 17 tệp cũ/đã hợp nhất/đã thay thế; sửa liên kết và README nguồn, chỉ giữ tài liệu đang có hiệu lực. |

**Lưu lịch sử không gây rối:** Các đặc tả V1/V2.0/V2.1, amendment, review R01–R05 và kết quả audit cũ đã được loại khỏi nhánh `main`, nhưng **không xóa lịch sử Git**. Có thể truy cập tại [commit trước khi dọn](https://github.com/cavoixanh638/KTXD-report/tree/875e10a02eb056879525fb6ae54d0719880b9484). Tất cả quyết định nghiệp vụ đã hợp nhất trong MASTER V2.2; các số liệu kiểm chứng trọng yếu vẫn còn tại [REFERENCE_COVERAGE](../data_checks/REFERENCE_COVERAGE_20261109.json) và các script nguồn trong `tools/`.

**Phản biện tiếp:** Dùng mã R08 trở đi; dẫn điều khoản V2.2, file/sheet/ô/SHA, ảnh hưởng PH1/PH2 và test, quyết định, lý do. Không thay đổi nguồn Excel hoặc tuyên bố runtime PASS nếu chưa có bằng chứng.
