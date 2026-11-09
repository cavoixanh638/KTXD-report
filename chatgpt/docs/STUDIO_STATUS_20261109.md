# Document Studio PH1 — kiểm thử và bàn giao ngày 09/11/2026

## BỔ SUNG GIAO DIỆN 4 BƯỚC — 10/11/2026

- **Code SHA đã chạy kiểm thử:** `36e792535309bd3d459d60a2aa3cfc1efd43cc6f`.
- **CI [#42664445254](https://github.com/cavoixanh638/KTXD-report/actions/runs/42664445254) — SUCCESS**: build một file HTML khớp bản commit, 14 test lõi/định dạng, smoke `file://` ba XLSX gốc với nhập partial/duplicate/ngày nguồn, tạo 3 phiên và phục hồi, cùng phép đối chiếu độc lập 11 xã × 12 chỉ tiêu số bằng Decimal; [artifact #13696680078](https://github.com/cavoixanh638/KTXD-report/actions/runs/42664445254/artifacts/13696680078) gồm ảnh màn hình, PDF A4 và XLSX.
- **UI:** bỏ điều hướng 7 tab, thay bằng 4 nhóm rõ ràng nằm ở thanh trên: Chọn phiên, Nhập/cập nhật Excel, Chọn địa phương, Xuất Excel/PDF. Bộ chọn địa phương và bản xem trước là không gian chính; trang quản lý phiên/nguồn vẫn truy cập trực tiếp bằng nút tương ứng, không cần tab.
- **Thiết kế ít dùng:** ở biểu tượng ⚙, có nhóm định dạng nâng cao và chỉ tiêu thu gọn mặc định. Người dùng có thể lưu `work.studioDefaults` (settings + rows) để phiên mới kế thừa mẫu và vẫn khởi tạo 0 địa phương; thiết lập được tự lưu và đi cùng backup JSON.
- **Nhập ngày nguồn:** ngày được xác minh trực tiếp trong `A1` của DISB/GPMB mới được tự điền kèm căn cứ; REV giữ thủ công. Trường căn cứ không cho nhập chỉ một chuỗi ngày. Các workbook đã nhập cùng SHA không yêu cầu nhập lại, có thể nhập riêng các nguồn hợp lệ rồi bổ sung phần thiếu.
- **Chưa chốt PH1 DONE:** chưa nghiệm thu Edge Windows thật, kiểm tra trực quan phân trang nhiều số lượng địa phương, kịch bản đồng thời đa tab, các kiểm thử PH1 chưa chạy. Không đổi dữ liệu gốc, không merge PR.

---


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
