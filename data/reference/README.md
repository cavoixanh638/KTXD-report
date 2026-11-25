# 4 tệp Excel nguồn đã bàn giao cho AI triển khai

**Quyền truy cập:** Repository GitHub `cavoixanh638/KTXD-report` ở chế độ **Public** theo xác nhận của chủ dự án ngày 25/11/2026. Bốn file gốc đã lưu từ 09/11/2026 phải giữ nguyên byte. Mẫu nguồn gốc khác thuộc phạm vi dự án được phép bổ sung theo `SOURCE_CORPUS.json` và `corpus/README.md`; không đưa dữ liệu ngoài phạm vi, bí mật, thông tin cá nhân hoặc backup phiên lên GitHub.

## Tệp gốc

- [`Báo cáo giải ngân 15.10 sửa(1).xlsx`](Báo%20cáo%20giải%20ngân%2015.10%20sửa(1).xlsx) — `DISB_20261015`, SHA-256 `3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c`
- [`Bc thu 10 thang-19.10-BC (1)(1).xlsx`](Bc%20thu%2010%20thang-19.10-BC%20(1)(1).xlsx) — `REV_10M_2026`, SHA-256 `b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f`
- [`PL01_Tổng hợp DA_26.12.26(1).xlsx`](PL01_Tổng%20hợp%20DA_26.12.26(1).xlsx) — `GPMB_20261026`, SHA-256 `d393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f`
- [`Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx`](Kết%20quả%20Tổng%20hợp%20chỉ%20tiêu%20KTXH%2011%20xã.xlsx) — `RESULT_REFERENCE`, SHA-256 `bd19d2d910619d36dab5e3332ad9c8a491e3652b631e65b81e62bb23e6a4ec51`

## Hướng dẫn cho AI

1. Đọc [Master V2.2](../../docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md), mục 2 và các adapter; giữ nguyên cả tệp Excel trong thư mục này.
2. Chạy `python tools/verify_reference_files.py` từ thư mục gốc. **Phải PASS 4/4**, kiểm tra toàn bộ byte và ZIP/container của XLSX.
3. Nạp qua `data/reference/<tên file gốc>`; không đổi tên, chuyển đổi `.csv` hoặc lưu lại bằng thư viện Excel. Xác nhận SHA-256 trong `MANIFEST.json` trước khi chạy kiểm thử.
4. Trường hợp mẫu nguồn gốc mới được cung cấp: lưu riêng trong corpus, ghi SHA/manifest, golden values được kiểm chứng trực tiếp, không ghi đè fixture. Không tự upload từ app.
5. `RESULT_REFERENCE` là mẫu định dạng/tiêu chí, **không phải số liệu chuẩn cho công thức**. Các tài liệu thu/giải ngân/GPMB có kỳ và phạm vi khác nhau, xem đặc tả.
6. Repo Public được chủ dự án xác nhận; chỉ công bố đúng mẫu đã được cho phép. Không đưa bí mật, dữ liệu ngoài phạm vi hoặc bản sao lưu phiên vào log CI/dịch vụ ngoài.
