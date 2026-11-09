# ChatGPT — khu vực triển khai độc lập PH1

Thư mục `chatgpt/` là nơi ChatGPT triển khai **Kế hoạch PH1** của ứng dụng KTXH Offline. Mục đích là tránh xung đột mã nguồn và tài liệu khi có nhiều AI cùng tham gia.

## Nguồn và quy tắc ưu tiên

1. Đọc `/README.md`, `/AGENTS.md`, `/docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md`, `/docs/plans/PHASE_1_RESULT_TEMPLATE.md`.
2. Đối chiếu phạm vi PH2 ở `/docs/plans/PHASE_2_EXTENSIBILITY.md`; không thực hiện trước gate PH1.
3. **Dùng chung, không sao chép hay sửa** bốn tệp Excel gốc trong `/data/reference/`. SHA-256 và mô tả có tại `/data/reference/MANIFEST.json`; audit dùng chung ở `/docs/data_checks/REFERENCE_COVERAGE_20261109.json`.
4. Code, test, bản build, bằng chứng, checkpoint của ChatGPT đều nằm trong `chatgpt/`; không ghi đè thư mục/nhánh của AI khác.
5. Khi phối hợp hoặc chuyển giao, chỉ tích hợp bằng commit/PR có diff, test, nguồn SHA và hồ sơ kiểm chứng rõ ràng. Không tự nhận PASS/DONE nếu chưa có kiểm thử runtime.

## Bố cục khu vực này

- `src/`: bộ đọc 3 nguồn và bộ tính toán, UI, quản lý phiên, xuất dữ liệu.
- `tests/`: unit/integration/offline, test trên các tệp nguồn chung.
- `dist/index.html`: một tệp HTML chạy bằng `file://`, chỉ có sau khi build.
- `docs/STATUS.md`: tiến độ PH1-01…PH1-06, SHA và bằng chứng kiểm thử.
- `package.json`, `build.mjs`: công cụ build dành cho người phát triển, **không** cần ở máy người dùng.

Thư mục `chatgpt/` không chứa bản sao dữ liệu nội bộ. Tài liệu chuẩn của dự án vẫn đặt ở cấp repository; ChatGPT chỉ tham chiếu và tuân thủ.

**Trạng thái hiện tại:** khởi tạo không gian làm việc cho PH1; nghiệm thu chỉ sau khi có app và test được xác minh.
