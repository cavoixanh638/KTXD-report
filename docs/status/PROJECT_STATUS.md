# CHECKPOINT — WebApp KTXH Offline (MASTER V2.2)

- **Ngày cập nhật đặc tả:** 2026-11-09; repository: `cavoixanh638/KTXD-report` (Private); nhánh triển khai tham chiếu: `main`.
- **Tài liệu có hiệu lực:** [`MASTER V2.2`](../specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md), [`PH1`](../plans/PHASE_1_RESULT_TEMPLATE.md), [`PH2`](../plans/PHASE_2_EXTENSIBILITY.md).
- **Trạng thái tổng:** `PLANNED / NO_APPLICATION_BUILD / NO_RUNTIME_TESTS_PASSED`.
- **Bốn file nguồn:** `data/reference/`, SHA trong `data/reference/MANIFEST.json`; người dùng đã cho phép commit đúng bốn file gốc. R06 đối chiếu nguồn: 114 DISB, 113 REV (thiếu Bạch Long Vĩ), 108 GPMB (thiếu 6 tên), 422 dự án và 12 M nguồn lệch I/D >0,1 điểm %; xem `docs/data_checks/REFERENCE_COVERAGE_20261109.json`. **Chỉ là source audit, chưa phải test runtime.**

## KẾ HOẠCH CON 1 — ưu tiên thực hiện trước

| Gói | Đầu ra | Trạng thái | Bằng chứng |
|---|---|---|---|
| PH1-01 | Nhập 3 file theo profile cố định, metadata/source version/ngày chốt | `NOT_STARTED` | Chưa có |
| PH1-02 | 14 dòng chỉ tiêu theo `RESULT_REFERENCE`, công thức, Decimal và benchmark | `NOT_STARTED` | Chưa có |
| PH1-03 | Source coverage có tên và cờ mismatch M/I/D | `NOT_STARTED` | Chưa có |
| PH1-04 | Chọn địa phương + multi-session + tùy chỉnh | `NOT_STARTED` | Chưa có |
| PH1-05 | CalculationTrace từ mọi ô | `NOT_STARTED` | Chưa có |
| PH1-06 | Offline UI thật, XLSX/PDF/in, backup/restore, nghiệm thu PH1 | `NOT_STARTED` | Chưa có |

**Gate PH1:** chỉ chuyển PH2 khi các gói PH1 được nghiệm thu trên một commit SHA có bản chạy được; không dùng ảnh screenshot để tuyên bố tính đúng.

## KẾ HOẠCH CON 2 — sau khi PH1 nghiệm thu

| Gói | Đầu ra | Trạng thái | Bằng chứng |
|---|---|---|---|
| PH2-01 | Mapping wizard, file/layout mới, hidden sheet nâng cao | `BLOCKED_BY_PH1` | Chưa có |
| PH2-02 | Công thức AST, template linh hoạt | `BLOCKED_BY_PH1` | Chưa có |
| PH2-03 | Nhiều kỳ/phiên bản, so sánh có điều kiện | `BLOCKED_BY_PH1` | Chưa có |
| PH2-04 | Bộ mẫu mở rộng, chọn hiển thị nâng cao | `BLOCKED_BY_PH1` | Chưa có |
| PH2-05 | QC/trace nâng cao, kịch bản ghi chú Q | `BLOCKED_BY_PH1` | Chưa có |
| PH2-06 | Xuất nâng cao, hồi quy tất cả T01–T66, nghiệm thu PH2 | `BLOCKED_BY_PH1` | Chưa có |

## QUY TẮC CẬP NHẬT CHECKPOINT

Sau mỗi gói điền: branch/HEAD SHA thực kiểm, file sửa, fixture SHA, test IDs PASS/FAIL/DEFERRED có chứng cứ, lỗi còn mở, lý do khác biệt nguồn, người nghiệm thu, ảnh hưởng lên gói khác. Không nhận `DONE` chỉ do AI khẳng định hoặc do source audit PASS. Các phiên bản V2.1 và pha P0–P7 cũ **chỉ là lịch sử, đã được thay bằng hai kế hoạch PH1/PH2**.

## LỊCH SỬ

- R01–R04: phản biện phép tính/nguồn, trace, zero denominator và chỉ tiêu REV_LAND_RATE_P.
- R05: bàn giao đủ bốn workbook thực tế vào repo Private.
- **R06:** bỏ bình quân tỷ lệ GPMB trong report, thêm M/I/D source mismatch; ghi tên địa phương thiếu theo nguồn; chia 2 kế hoạch con và mở rộng test tới T66. **Các bài test runtime chưa chạy.**

## DỌN HỒ SƠ CŨ

- Đã bỏ 17 tệp đặc tả/biên bản/manifest/kết quả kiểm toán cũ hoặc trùng khỏi nhánh `main`; chỉ dùng MASTER V2.2 + PH1/PH2. Xem `docs/reviews/REVIEW_LEDGER.md`.
- Các tệp bị bỏ vẫn có trong [commit trước khi dọn](https://github.com/cavoixanh638/KTXD-report/tree/875e10a02eb056879525fb6ae54d0719880b9484), không viết lại lịch sử Git.
- Bốn workbook nguồn, SHA manifest, nguồn coverage và các script kiểm tra vẫn giữ nguyên.
