# KTXH Offline Report — WebApp báo cáo KTXH mở bằng trình duyệt

**Trạng thái:** `SPEC_V2_1_FINAL_READY / APP_NOT_IMPLEMENTED`.

Ứng dụng dự kiến chạy **100% offline từ `index.html` trên Chrome/Edge**, nhập báo cáo thu NSNN, giải ngân và GPMB từ Excel. Người dùng chọn **bất kỳ** xã/phường/đặc khu và số lượng theo nhu cầu, không chọn sẵn đơn vị nào, lưu nhiều phiên báo cáo độc lập, tùy chỉnh chỉ tiêu và xuất báo cáo Excel/PDF.

## Đặc tả cuối cùng — nguồn yêu cầu duy nhất

**[KTXH OFFLINE MASTER SPEC V2.1 (CURRENT)](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_1_FINAL.md)**

Bản V2.1 (gồm 18 mục, T01–T58) hợp nhất kế hoạch ban đầu và các kết luận phản biện R01, R02; bổ sung **nguyên tắc mọi phép tính phải giải trình được** qua công thức, tử/mẫu, tập bản ghi được tính/bị bỏ, lý do, đơn vị, ngày chốt, nguồn ô, làm tròn và trạng thái dữ liệu. AI tiếp quản chỉ cần đọc V2.1 + `AGENTS.md`, không tự ghép các bản cũ. **Đặc biệt:** ZERO mẫu số ở cấp đơn vị vẫn được cộng vào benchmark tổng/tổng nếu tử/mẫu là số hợp lệ (R04).

## Những yêu cầu không thể bỏ

- Tỷ lệ chung/bình quân phải tính `SUM(tử số)/SUM(mẫu số)` cùng phạm vi; không lấy AVERAGE tỷ lệ địa phương.
- ZERO mẫu số của địa phương không đồng nghĩa loại khỏi mốc gộp; có thể cá nhân không có tỷ lệ nhưng tổng nhóm vẫn có tỷ lệ. Thu đất năm 113 địa phương: 136,12%; kỳ: 202,71%; không tự loại 5/6 địa phương phát sinh ngoài dự toán/kế hoạch.
- GPMB mặc định theo tổng diện tích, cho phép xem bình quân tỷ lệ dự án dưới nhãn khác phương pháp.
- Minh bạch phạm vi số liệu: 114 địa phương giải ngân, 113 địa phương thu, 108 địa bàn GPMB hoặc thành phố (không coi tương đương).
- Đơn vị theo cột: thu/giải ngân triệu đồng, GPMB kinh phí đồng, diện tích m²; ngày chốt từng file, không suy đoán.
- Nhận dạng sheet visible/fingerprint, đọc P/Q ghi chú giải ngân, ghép địa phương đúng dấu; xử lý null khác zero, partial aggregate và cảnh báo.
- Mỗi ô số, tổng, tỷ lệ, so sánh và nhận xét phải truy xuất được `CalculationTrace`; dữ liệu xuất có danh mục công thức, nhật ký phép tính và danh sách bản ghi bỏ qua.
- Nhiều phiên độc lập, backups lưu file và khôi phục không mất dữ liệu, build không request Internet.

## Dự án và lịch sử quyết định

- [Chỉ dẫn AI/agent](AGENTS.md) — nguyên tắc triển khai và điều kiện nghiệm thu.
- [Trạng thái/checkpoint](docs/status/PROJECT_STATUS.md) — tiến độ P0–P7.
- [Review ledger](docs/reviews/REVIEW_LEDGER.md), [R01](docs/reviews/REVIEW_R01_20261109.md), [R02](docs/reviews/REVIEW_R02_20261109.md), [R03 — hợp nhất V2](docs/reviews/REVIEW_R03_20261109.md), [R04 — ZERO mẫu số và REV_LAND_RATE_P](docs/reviews/REVIEW_R04_20261109.md).
- [V1 (lịch sử)](docs/specs/KTXH_OFFLINE_SPEC_V1.md), [đề xuất R01 (lịch sử)](docs/specs/SPEC_AMENDMENT_PROPOSED_R01.md), [đề xuất R02 (lịch sử)](docs/specs/SPEC_AMENDMENT_PROPOSED_R02.md).
- [Audit R01](tools/audit_review_round1.py), [Audit R02](tools/audit_review_round2.py), [Audit R04](tools/audit_review_round4.py); 4 tệp nguồn chuẩn nằm trong [data/reference](data/reference/README.md), kiểm tra SHA trước khi chạy; không đưa các tệp khác lên repo.

## Dữ liệu kiểm thử có thể dùng ngay

**Bốn file Excel tham chiếu đã được đưa lên GitHub Private**, không còn cần xin lại bản gốc qua chat:

- [Báo cáo giải ngân 15.10 sửa(1).xlsx](data/reference/Báo%20cáo%20giải%20ngân%2015.10%20sửa(1).xlsx) — `DISB_20261015`
- [Bc thu 10 thang-19.10-BC (1)(1).xlsx](data/reference/Bc%20thu%2010%20thang-19.10-BC%20(1)(1).xlsx) — `REV_10M_2026`
- [PL01_Tổng hợp DA_26.12.26(1).xlsx](data/reference/PL01_Tổng%20hợp%20DA_26.12.26(1).xlsx) — `GPMB_20261026`
- [Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx](data/reference/Kết%20quả%20Tổng%20hợp%20chỉ%20tiêu%20KTXH%2011%20xã.xlsx) — `RESULT_REFERENCE`

- [Danh mục gốc và SHA-256](data/reference/MANIFEST.json) / [hướng dẫn](data/reference/README.md).
- `python tools/verify_reference_files.py` phải kiểm tra đủ **4/4 PASS** trước khi chạy T01–T58.
- Dữ liệu chỉ được dùng theo phạm vi, ngày chốt và đơn vị của từng file; giữ nguyên byte gốc. **Không upload thêm tệp khác** nếu chưa được phép.

## Bảo mật và trạng thái GitHub

Repository chính đang kết nối: **`cavoixanh638/KTXD-report` (Private)**, mới được tạo trong lúc kiểm tra. Đây là tên repository thực tế, khác tên `KTXH-Offline-Report` dự kiến trước đó; **KTXH Offline Report** là tên sản phẩm. Chủ dự án đã cho phép commit chính xác **4 tệp Excel gốc** tại `data/reference/` để AI có thể tái lập; không thêm dữ liệu khác và không đổi repo sang Public. Trạng thái commit cập nhật tại [PROJECT_STATUS](docs/status/PROJECT_STATUS.md).

**Phiên bản V2.0 lưu đối chiếu:** [Master V2.0 (historical)](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_FINAL.md). Chỉ V2.1 có hiệu lực triển khai.
