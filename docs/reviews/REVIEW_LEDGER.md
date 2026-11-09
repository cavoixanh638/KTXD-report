# Nhật ký phản biện — WebApp KTXH Offline

**Đặc tả quy phạm hiện hành:** [MASTER V2.2](../specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md) cùng [Kế hoạch PH1](../plans/PHASE_1_RESULT_TEMPLATE.md) và [Kế hoạch PH2](../plans/PHASE_2_EXTENSIBILITY.md). V1/V2.0/V2.1 giữ nguyên làm lịch sử.

| Round | Ngày | Hồ sơ | Kết luận chính | Trạng thái |
|---|---|---|---|---|
| R01 | 09/11/2026 | `REVIEW_R01_20261109.md` | Nhập P/Q giải ngân; ghép tên địa phương; cảnh báo; xuất Excel | `INTEGRATED` |
| R02 | 09/11/2026 | `REVIEW_R02_20261109.md` | GPMB 3 dự án thiếu I; 296 ô trống DISB; trạng thái sheet ẩn | `INTEGRATED` |
| R03 | 09/11/2026 | `REVIEW_R03_20261109.md` | Mọi phép tính có CalculationTrace, công thức, included/excluded và lý do | `INTEGRATED` |
| R04 | 09/11/2026 | `REVIEW_R04_20261109.md` | ZERO mẫu số cấp đơn vị vẫn tham gia benchmark SUM/SUM; chỉ tiêu REV_LAND_RATE_P | `INTEGRATED` |
| R05 | 09/11/2026 | `REVIEW_R05_20261109.md` | Đưa đúng 4 workbook nguồn gốc vào GitHub Private có SHA-256, README và kiểm tra | `INTEGRATED` |
| **R06** | **09/11/2026** | **`REVIEW_R06_20261109.md`** | **GPMB chỉ tính theo diện tích; M nguồn dùng QC I/D; ghi tên địa phương thiếu từng nguồn; tách PH1/PH2; T59–T66** | `INTEGRATED_V2.2 / APP_NOT_IMPLEMENTED` |

**Quy tắc phản biện tiếp:** dùng mã R07 trở đi, nêu điều khoản MASTER V2.2, bằng chứng file/sheet/cell/SHA, tác động PH1/PH2 và test, hướng khắc phục và quyết định. Không viết đè review cũ. Nếu AI phát hiện thay đổi quy tắc nghiệp vụ, lập change request; không âm thầm sửa công thức. Đã được chủ dự án cho phép lưu **đúng 4 workbook** gốc tại `data/reference/` trên repo Private, không tự đưa thêm tệp khác vào GitHub.
