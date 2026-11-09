# Document Studio PH1 — kiểm thử và bàn giao ngày 09/11/2026

**Nhánh triển khai:** `ai/ktxh-document-studio-20261109`. **SHA code và test đã kiểm:** `a82d5f3ed3f6a29e4f7c70cfe044816962ef9ae8`.
**Kết quả CI:** [GitHub Actions #42657463064](https://github.com/cavoixanh638/KTXD-report/actions/runs/42657463064) — **SUCCESS**, kiểm thử Chromium `file://` với 3 workbook gốc; artifact trực tiếp trong [CI #42657463064](https://github.com/cavoixanh638/KTXD-report/actions/runs/42657463064) gồm ảnh màn hình 5 địa phương theo hai hướng, PDF A4 và XLSX. Bản build offline đã commit: `chatgpt/dist/index.html`.

## Đã kiểm chứng trong CI theo phạm vi test

- Kiểm SHA-256 **4/4** workbook tham chiếu, không sửa nguồn; nhập ba file theo thứ tự GPMB → REV → DISB bằng nhận diện fingerprint/sheet, yêu cầu xác nhận ngày + lý do trước khi ghi dữ liệu.
- Node `core.test.cjs` và `studio_layout.test.cjs`: **14/14 test PASS** (10 lõi, 4 bố cục), giữ phép tính và trace PH1, kiểm từng ô xuất hiện đúng một lần trong kế hoạch trang với 1, 5, 11, 40, 114 địa phương.
- Trình duyệt Chromium `file://`: đối chiếu 11 xã độc lập PASS; tạo phiên 0 địa phương, nạp ba nguồn thật, chọn 5 xã, kiểm có kết quả 14 dòng, đổi hai hướng bảng, mở/đóng trace, xuất XLSX 8 sheet có số numeric, tạo PDF A4, tạo/nhân bản phiên và xác nhận tự lưu sau ~3.8 giây rồi reload phục hồi 3 phiên.
- Không phát sinh request HTTP(S)/WS ra ngoài trong browser smoke. Bản XLSX có sheet audit và nguồn thiếu từ engine hiện có.

## Phạm vi vẫn cần nghiệm thu bổ sung

- Chưa kiểm trực tiếp trên **Microsoft Edge chạy Windows**, chưa đo độ vừa trang/tính chính xác WYSIWYG PDF bằng đối chiếu pixel thủ công đối với 20/114 địa phương; bộ chia trang dùng ước lượng chiều rộng chữ và chiều cao dòng, có thể cần tối ưu cho chỉ tiêu dài.
- **Đã bổ sung bài đối chiếu độc lập 11 xã** từ file mẫu và 3 workbook gốc bằng Decimal trong `tests/studio_11_compare.py`; xuất Excel numeric và so từng ô thuộc 12 dòng chỉ tiêu số: **PASS** tại workflow #42657463064. Hai dòng nhận xét văn bản và tính đúng pixel của PDF vẫn cần nghiệm thu riêng.
- Chưa có chức năng điều chỉnh vị trí từng địa phương bằng kéo-thả hoặc kiểm thử xung đột sửa đồng thời từ hai cửa sổ; IndexedDB chỉ là lưu tạm, file .kxh.json SHA-256 vẫn là bản sao lưu đáng tin cậy.
- Ngày REV=19/10/2026 trong bài thử là **giả định QA, chưa được xác nhận ngày chốt hành chính**; không dùng kết quả kiểm thử làm báo cáo chính thức.
- PH2 ngoài phạm vi. Chưa nghiệm thu PH1 trọn bộ T01–T66, trạng thái chính thức **PARTIAL_PASS / PH1_GATE_PENDING**.

## Module giao nộp

`src/studio-layout.js`, `src/studio-ui.js`, `src/studio-storage.js`, `src/studio.css`, sửa `build.mjs`, `template.html`, `src/xlsx-writer.js`; giữ nguyên `core.js` và ba profile nguồn, giữ nguyên mã gốc `src/ui.js` nhưng tắt bootstrap để tránh chạy hai UI. Test `tests/studio_layout.test.cjs`, `tests/studio_browser_test.py`. CI `.github/workflows/ktxh-document-studio.yml`.

**Không merge vào main.** Thực thi tiếp trên nhánh riêng, chỉ chốt gate PH1 khi bổ sung hồi quy 11 xã, kiểm tra Edge, PDF in và session đa trường hợp.
