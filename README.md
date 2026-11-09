# KTXH Offline Report — WebApp báo cáo KTXH mở bằng trình duyệt

**Trạng thái:** `SPEC_V2_FINAL_READY / APP_NOT_IMPLEMENTED`.

Ứng dụng dự kiến chạy **100% offline từ `index.html` trên Chrome/Edge**, nhập báo cáo thu NSNN, giải ngân và GPMB từ Excel. Người dùng chọn **bất kỳ** xã/phường/đặc khu và số lượng theo nhu cầu, không chọn sẵn đơn vị nào, lưu nhiều phiên báo cáo độc lập, tùy chỉnh chỉ tiêu và xuất báo cáo Excel/PDF.

## Đặc tả cuối cùng — nguồn yêu cầu duy nhất

**[KTXH OFFLINE MASTER SPEC V2.0 (FINAL)](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_FINAL.md)**

Bản V2 (gồm 18 mục, T01–T52) hợp nhất kế hoạch ban đầu và các kết luận phản biện R01, R02; bổ sung **nguyên tắc mọi phép tính phải giải trình được** qua công thức, tử/mẫu, tập bản ghi được tính/bị bỏ, lý do, đơn vị, ngày chốt, nguồn ô, làm tròn và trạng thái dữ liệu. AI tiếp quản chỉ cần đọc V2 + `AGENTS.md`, không tự ghép V1 và amendments.

## Những yêu cầu không thể bỏ

- Tỷ lệ chung/bình quân phải tính `SUM(tử số)/SUM(mẫu số)` cùng phạm vi; không lấy AVERAGE tỷ lệ địa phương.
- GPMB mặc định theo tổng diện tích, cho phép xem bình quân tỷ lệ dự án dưới nhãn khác phương pháp.
- Minh bạch phạm vi số liệu: 114 địa phương giải ngân, 113 địa phương thu, 108 địa bàn GPMB hoặc thành phố (không coi tương đương).
- Đơn vị theo cột: thu/giải ngân triệu đồng, GPMB kinh phí đồng, diện tích m²; ngày chốt từng file, không suy đoán.
- Nhận dạng sheet visible/fingerprint, đọc P/Q ghi chú giải ngân, ghép địa phương đúng dấu; xử lý null khác zero, partial aggregate và cảnh báo.
- Mỗi ô số, tổng, tỷ lệ, so sánh và nhận xét phải truy xuất được `CalculationTrace`; dữ liệu xuất có danh mục công thức, nhật ký phép tính và danh sách bản ghi bỏ qua.
- Nhiều phiên độc lập, backups lưu file và khôi phục không mất dữ liệu, build không request Internet.

## Dự án và lịch sử quyết định

- [Chỉ dẫn AI/agent](AGENTS.md) — nguyên tắc triển khai và điều kiện nghiệm thu.
- [Trạng thái/checkpoint](docs/status/PROJECT_STATUS.md) — tiến độ P0–P7.
- [Review ledger](docs/reviews/REVIEW_LEDGER.md), [R01](docs/reviews/REVIEW_R01_20261109.md), [R02](docs/reviews/REVIEW_R02_20261109.md), [R03 — hợp nhất V2](docs/reviews/REVIEW_R03_20261109.md).
- [V1 (lịch sử)](docs/specs/KTXH_OFFLINE_SPEC_V1.md), [đề xuất R01 (lịch sử)](docs/specs/SPEC_AMENDMENT_PROPOSED_R01.md), [đề xuất R02 (lịch sử)](docs/specs/SPEC_AMENDMENT_PROPOSED_R02.md).
- [Audit R01](tools/audit_review_round1.py), [Audit R02](tools/audit_review_round2.py); nguồn Excel phải ở máy người thực thi, không đưa vào repo.

## Bảo mật và trạng thái GitHub

Repository chính đang kết nối: **`cavoixanh638/KTXD-report` (Private)**, mới được tạo trong lúc kiểm tra. Đây là tên repository thực tế, khác tên `KTXH-Offline-Report` dự kiến trước đó; **KTXH Offline Report** là tên sản phẩm. Không upload dữ liệu Excel gốc hoặc bản sao lưu có dữ liệu thực nếu không được cho phép. Trạng thái commit cập nhật tại [PROJECT_STATUS](docs/status/PROJECT_STATUS.md).