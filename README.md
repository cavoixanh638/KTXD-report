# KTXH Offline Report — Báo cáo KTXH mở trực tiếp bằng trình duyệt

**Tình trạng:** `MASTER_V2.2 / PHASE_1_NOT_STARTED / PHASE_2_NOT_STARTED / APP_NOT_IMPLEMENTED`.  
**Repository:** `cavoixanh638/KTXD-report` (Private). Đây là nơi bàn giao, tên sản phẩm là KTXH Offline.

## BẮT ĐẦU Ở ĐÂY — BA TÀI LIỆU CÓ HIỆU LỰC

1. **[MASTER SPEC V2.2 — yêu cầu chung và công thức](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md)**: chuẩn nghiệp vụ duy nhất, 66 mã kiểm thử T01–T66.
2. **[KẾ HOẠCH CON 1 — bản báo cáo theo mẫu 14 dòng](docs/plans/PHASE_1_RESULT_TEMPLATE.md)**: ưu tiên thi công trước, hoàn thành app có thể dùng, hiển thị, tính, tùy chỉnh, lưu nhiều phiên, cảnh báo, giải trình phép tính, xuất Excel/PDF, sao lưu.
3. **[KẾ HOẠCH CON 2 — mở rộng và tổng quát hóa](docs/plans/PHASE_2_EXTENSIBILITY.md)**: mở rộng nhập cấu trúc Excel mới, formula editor, báo cáo nhiều mẫu/kỳ và xuất nâng cao, **sau nghiệm thu PH1**.

AI/Codex đọc ba tài liệu trên, [AGENTS.md](AGENTS.md), và bốn file Excel gốc tại `data/reference/` trước khi lập trình. **Không lập ứng dụng chỉ có giao diện mà thiếu tính toán thật**; không tự công bố DONE khi chưa có test chạy thực tế.

## QUYẾT ĐỊNH MỚI R06

- **GPMB chỉ tính tỷ lệ theo diện tích**: `SUM(I)/SUM(D)`, dùng số đã ghi nhận và đánh cờ partial khi thiếu I. **Bỏ hoàn toàn** bình quân tỷ lệ dự án khỏi bảng chính, chỉ tiêu, tùy chọn, Excel/PDF. Cột M của **dòng dự án** vẫn được kiểm tra với `100*I/D`; 12 dòng nguồn lệch hơn 0,1 điểm phần trăm phải có cờ warning và truy vết.
- **Nêu đích danh địa phương chưa có bản ghi theo từng nguồn**, không chỉ đếm N. So với danh mục 114 từ DISB: thu NSNN thiếu **Đặc khu Bạch Long Vĩ**; GPMB thiếu **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**. Xem [audit nguồn](docs/data_checks/REFERENCE_COVERAGE_20261109.json). Không suy luận không có dự án từ không có bản ghi.
- Giữ đầy đủ các quy tắc cũ: benchmark tỷ lệ tổng/tổng thay vì AVERAGE; zero mẫu số cấp dòng vẫn tính vào tổng/tổng nếu numeric; 113/108 không đổi nhãn 114; đơn vị theo cột; ngày chốt độc lập; mọi ô tính có `CalculationTrace`, included/excluded/skip-reason.
- Không chọn sẵn xã/phường khi mở phiên. Có thể tạo nhiều phiên, ví dụ phiên A gồm 5 xã, phiên B gồm 7 phường, lưu/restore độc lập.

## DỮ LIỆU ĐƯỢC BÀN GIAO TRỰC TIẾP

Bốn workbook **gốc không chỉnh sửa** trong [data/reference](data/reference/README.md):

- [Báo cáo giải ngân 15.10 sửa(1).xlsx](data/reference/Báo%20cáo%20giải%20ngân%2015.10%20sửa(1).xlsx) — 114 địa phương.
- [Bc thu 10 thang-19.10-BC (1)(1).xlsx](data/reference/Bc%20thu%2010%20thang-19.10-BC%20(1)(1).xlsx) — 113 địa phương.
- [PL01_Tổng hợp DA_26.12.26(1).xlsx](data/reference/PL01_Tổng%20hợp%20DA_26.12.26(1).xlsx) — 108 địa bàn, 422 dự án.
- [Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx](data/reference/Kết%20quả%20Tổng%20hợp%20chỉ%20tiêu%20KTXH%2011%20xã.xlsx) — mẫu bố cục **không chọn sẵn 11 xã**.

Trước khi chạy kiểm thử dùng `python tools/verify_reference_files.py` (**4/4 SHA-256 PASS**) và `python tools/audit_phase_scope.py` (xác nhận 1/6 địa phương thiếu và 12 dòng M khác I/D). Không commit thêm nguồn hành chính mới, bản sao lưu có dữ liệu cá nhân hoặc bí mật lên GitHub; repo luôn Private.

## TRẠNG THÁI VÀ NHẬT KÝ

- [Trạng thái thực hiện PH1/PH2](docs/status/PROJECT_STATUS.md)
- [Danh mục phiên bản/kiểm thử](docs/status/SPEC_V2_2_MANIFEST.json)
- [Nhật ký phản biện](docs/reviews/REVIEW_LEDGER.md) và [R06](docs/reviews/REVIEW_R06_20261109.md)
- [V2.1 lịch sử](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_1_FINAL.md), [V2.0 lịch sử](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_FINAL.md). **Không dùng V2.1 làm kế hoạch hiện hành.**

**Chưa có webapp chạy được và chưa có bài test runtime PASS.** Các script kiểm toán nguồn chỉ xác nhận dữ liệu mẫu, không phải bằng chứng triển khai ứng dụng.
