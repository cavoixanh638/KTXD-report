# Trạng thái triển khai — KTXH Offline Report

- **Ngày:** 2026-11-09.
- **Trạng thái chung:** `SPEC_V2_1_FINAL_READY / NOT_IMPLEMENTED`.
- **Master spec:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_1_FINAL.md` (18 mục, 58 bài kiểm thử T01–T58).
- **Nguồn lịch sử:** V1, V2.0, review R01–R04. Trước khi làm gì đọc Master V2.1.
- **Ứng dụng chạy được:** Chưa có. **Các bài kiểm thử runtime T01–T58:** chưa chạy. Script kiểm toán nguồn R01/R02 chỉ xác minh số liệu tham chiếu, KHÔNG phải test ứng dụng.
- **GitHub:** connector user `cavoixanh638` hoạt động. Đã tìm thấy repository **Private** mới `cavoixanh638/KTXD-report` (created 2026-11-09 11:03:18 UTC), có quyền push, ban đầu trống. Khác tên `KTXH-Offline-Report` dự kiến cũ (404). Trạng thái lưu hồ sơ: `GITHUB_VERIFIED`; initial commit `b2990b1981512a62bd9b7c26b4995a7d7202ba3a`, commit chứa đặc tả V2 và 20 tệp `04f6d6694274e951fb14bdc7687b7ffd120a5cf5`; đã fetch xác nhận README, AGENTS, Master Spec V2, R01–R03 và mã audit.

| Pha | Nội dung | Trạng thái |
|---|---|---|
| P0 | Chốt schema/fingerprint/unit/formula/trace/test fixtures, PoC Excel style | `NOT_STARTED` |
| P1 | Offline `index.html` shell | `NOT_STARTED` |
| P2 | Excel adapters REV/DISB/GPMB, P/Q, hidden sheet, date | `NOT_STARTED` |
| P3 | Decimal, benchmark SUM/SUM, null policy, CalculationTrace | `NOT_STARTED` |
| P4 | Workspace, nhiều phiên, backup và version binding | `NOT_STARTED` |
| P5 | Báo cáo tùy chỉnh, UI trace và cảnh báo | `NOT_STARTED` |
| P6 | Excel styled + audit, PDF, backup/restore | `NOT_STARTED` |
| P7 | T01–T58, E2E offline Chrome/Edge, báo cáo nghiệm thu | `NOT_STARTED` |

## Quy tắc checkpoint

Sau từng pha ghi: branch/HEAD SHA (nếu repo), tệp thay đổi, bản nguồn SHA dùng test, công thức/trace thay đổi, test thực chạy PASS/FAIL, bug còn mở và người xác nhận. Không kế thừa PASS của SHA khác. Không báo triển khai xong khi chưa có chứng cứ runtime.

- **R04:** Đã kiểm toán nguồn REV trên 113 địa phương; 5 dòng D=0,R>0 = 269.290 triệu và 6 dòng G=0,R>0 = 304.790 triệu; tỷ lệ tổng/tổng đúng 136,12% và 202,71%. Bổ sung REV_LAND_RATE_P, §6A.3a và T53–T58. Kiểm chứng nguồn ≠ PASS runtime; app vẫn NOT_IMPLEMENTED.

- **Publish R04:** đặc tả V2.1, review R04, mã audit và manifest ban đầu đã được commit `e01efafbca3b787aee18797418271717b309cae0` trên `main`, và kiểm tra đọc lại nội dung qua GitHub. Mọi điều chỉnh tiếp theo giữ lịch sử commit; chưa kiểm thử webapp.

## R05 — Bàn giao 4 tệp nguồn thực tế

Ngày 09/11/2026, theo yêu cầu rõ ràng của chủ dự án, đã đưa 4 tệp Excel gốc (DISB/REV/GPMB/RESULT_REFERENCE) vào `data/reference/` trong GitHub Private. SHA-256 và Git blob SHA-1 ở `data/reference/MANIFEST.json`, chương trình kiểm tra `tools/verify_reference_files.py`. Bốn tệp này dùng để chạy kiểm thử; các bản nguồn khác chưa được phép upload. **P0–P7 và runtime tests vẫn chưa được thực hiện.**
