# ChatGPT PH1 — Checkpoint triển khai và QA

- **Repository:** `cavoixanh638/KTXD-report` (private).
- **Branch riêng:** `chatgpt/ph1-20261109`.
- **Đường dẫn sở hữu:** `chatgpt/**`. Không sửa `data/reference/**`, Master V2.2, PH2 hoặc thư mục của AI khác.
- **Base:** main `9de185118330f357f0bd006e4245a4f3036d2a12` (gồm commit tạo thư mục); xem branch HEAD trên GitHub để lấy commit chính xác sau mỗi lần đẩy.
- **Dữ liệu tham chiếu dùng chung:** DISB `3ba33b3...`, REV `b41227d...`, GPMB `d393c3c...`, mẫu `bd19d2d...` theo `data/reference/MANIFEST.json`. Không có workbook gốc trong môi trường local; chỉ đọc ở CI checkout private khi chạy real fixture.
- **Trạng thái tổng:** `PH1_IMPLEMENTED_CANDIDATE / NOT_VERIFIED_WITH_REAL_WORKBOOKS / NOT_ACCEPTED`. Không được báo PH1 DONE.

## Kiểm thử có bằng chứng trong môi trường local

1. `node --test tests/core.test.cjs` **10/10 PASS**: BigInt Decimal, phiên mới 0 xã, 14 dòng, tỷ lệ REV gồm mẫu số 0, GPMB partial giữ D, trace, coverage, backup checksum và kiểm chống bù 0.
2. `python tests/make_synthetic.py` dựng riêng 114 DISB / 113 REV / 108 GPMB và 422 dự án **synthetic**, không chép dữ liệu thật vào repo.
3. `python tests/browser_test.py` đã **PASS** trên Chromium qua `page.set_content` do chính sách browser chạy thử chặn `file://` trong container hiện tại; thực thi import cả 3 `.xlsx` synthetic, chọn 1 địa phương, dựng đủ 14 dòng, mở trace, xuất `.xlsx` và mở lại bằng `openpyxl` để xác minh 8 sheet và giá trị numeric.
4. SHA-256 thuần JS được kiểm với vector chuẩn SHA-256 `abc`, và đối chiếu hash 3 workbook synthetic bằng Python `hashlib`: **PASS**.

**Chưa kiểm chứng:** chạy `file://` trên Chrome/Edge thật, đúng SHA-256 của 4 workbook gốc, 12 cảnh báo từ 422 dự án thật, các benchmark thực 67,10% / 111,30% / 72,13%, so kết quả 5 xã và 7 phường, toàn bộ backup/restore khi đóng browser, phân trang in A4/A3 thực tế, xuất PDF, đầy đủ T01–T66. Bài test PH2 phải ghi `DEFERRED_BY_SCOPE`.

## PH1-01…PH1-06 — tiến độ hiện tại

| Mã | Đầu ra hiện có | Tình trạng |
|---|---|---|
| PH1-01 | XLSX reader XML/ZIP, SHA-256, 3 profile, nhận diện sheet visible, xác nhận ngày | `IMPLEMENTED / SYNTHETIC_BROWSER_PASS / REAL_FIXTURE_PENDING` |
| PH1-02 | 14 dòng, BigInt Decimal, tỷ lệ tổng/tổng, 3 mốc, đơn vị | `IMPLEMENTED / UNIT_PASS / REAL_FIXTURE_PENDING` |
| PH1-03 | Coverage có tên và trạng thái, M/I/D chỉ dòng dự án, GPMB PARTIAL | `IMPLEMENTED / SYNTHETIC_PASS / REAL_12_WARNING_PENDING` |
| PH1-04 | 0 địa phương mặc định, tạo/nhân bản/chuyển phiên, đổi nhãn/ẩn/hiện/thứ tự/đơn vị/ngưỡng | `IMPLEMENTED / REGRESSION_PENDING` |
| PH1-05 | Mỗi ô có traceId, danh sách nguồn, toán hạng, included/excluded, source SHA, date | `IMPLEMENTED / TRACE_AUDIT_REAL_PENDING` |
| PH1-06 | HTML offline self-contained, XLSX với sheets trace & thiếu, CSS print, JSON backup checksum | `IMPLEMENTED / FILE_URL_EDGE_CHROME_AND_PDF_PENDING` |

## Lỗi/rủi ro chưa đóng

- **BLOCKER Gate:** chưa có bằng chứng mở file:// trên Chrome/Edge với cả 3 workbook nguồn thực. Môi trường container chặn điều hướng file:// bằng chính sách quản trị; không suy diễn runtime đã PASS.
- **BLOCKER Gate:** chưa có audit số thật 14 dòng / 5 xã / 7 phường / nguồn thiếu 1 + 6 / GPMB 12 mismatch từ bản build.
- Print/PDF nhiều cột rộng cần nghiệm thu phân trang thực tế và đối chiếu với mẫu.
- PH1 chưa chấp nhận các nguồn thay bố cục tùy ý; đây là ranh giới PH2.

## Quy trình cập nhật

Sau khi chạy CI real fixture và offline browser, điền commit SHA được kiểm, phiên bản dataset SHA thực, kết quả T01–T66 có mã `PASS/FAIL/DEFERRED_BY_SCOPE` và log rõ. Nếu code sửa sau đó phải chạy lại các test bị ảnh hưởng, không thừa kế PASS chỉ từ checkpoint cũ.
