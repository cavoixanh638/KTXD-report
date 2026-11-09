# KTXH Offline — Giao diện làm việc nhanh PH1

**Bản chạy trực tiếp:** [`dist/index.html`](dist/index.html) — mở trên Chrome/Edge theo `file://`, không cần Internet, không cần máy chủ. Dữ liệu người dùng ở trên máy.

**Quy trình 4 bước trên thanh trên cùng:**
1. **Phiên làm việc:** Chọn phiên cũ trong danh sách; nút `+` tạo phiên mới (mặc định 0 địa phương), `⋯` để đổi tên/nhân bản/đóng/xóa và sao lưu/khôi phục.
2. **Dữ liệu Excel:** Xem ba nhãn nguồn Giải ngân / Thu NSNN / GPMB; bấm **Nhập / cập nhật** để chọn các XLSX cùng lúc hoặc lần lượt, nhận dạng từ sheet. DISB/GPMB có ngày rõ ở tiêu đề A1 sẽ được điền căn cứ; REV bắt buộc kiểm chứng ngày chốt và căn cứ, không tự đoán theo tên file. Nguồn đã có cùng SHA được bỏ qua; nhập từng nguồn hợp lệ không bị cản bởi file khác chưa đủ ngày.
3. **Địa phương:** Danh sách xã/phường/đặc khu chung cạnh bản xem trước. Tìm không dấu, chọn nhiều dòng hoặc **Chọn lọc**. Nút **Chọn / sửa** ở trên đưa con trỏ về bộ chọn; không xóa bộ lọc khi đánh dấu.
4. **Xuất báo cáo:** Bấm **Excel** hoặc **In / PDF** ngay ở thanh trên. Bấm từng ô kết quả để xem nguồn, công thức và `CalculationTrace`.

**Thiết lập ít sử dụng:** biểu tượng **⚙** mở trang thiết kế mẫu; mặc định chỉ hiển thị tiêu đề, khổ in và bố cục, các định dạng nâng cao/danh sách chỉ tiêu/chất lượng trong mục có thể mở rộng. Bấm **Lưu làm mẫu mặc định** để các phiên mới kế thừa thiết kế (không tự chọn địa phương). Không cần sửa mẫu mỗi khi lập báo cáo.

**Lưu ý dữ liệu:** bốn workbook nguyên gốc ở `../data/reference/`, không đưa thêm nguồn nội bộ lên GitHub. REV ghi kỳ “10 tháng” nhưng ngày chốt hành chính chưa được xác minh; 19/10/2026 trong kiểm thử là giả định QA, không phải dữ liệu chính thức.

**Chống mất dữ liệu:** IndexedDB tự lưu sau vài giây, nhưng vẫn cần sử dụng **`⋯` → Lưu toàn bộ hồ sơ** để tải bản `.kxh.json` SHA-256, đặc biệt trước khi thay tệp HTML. Giữ file sao lưu độc lập.

**QA:** [Trạng thái kỹ thuật](docs/STUDIO_STATUS_20261109.md) · [Workflow GitHub Actions](../.github/workflows/ktxh-document-studio.yml) · [Draft PR #1](https://github.com/cavoixanh638/KTXD-report/pull/1). Chưa tuyên bố PH1/PH2 hoàn thành toàn bộ khi chưa đủ gate.

---

# ChatGPT PH1 — KTXH Offline (cô lập mã nguồn, dùng chung dữ liệu)

Đây là vùng thực thi **Kế hoạch PH1** của ChatGPT trong repository `cavoixanh638/KTXD-report`. Mọi phần đã commit ở đây thuộc nhánh `chatgpt/ph1-20261109`, không sửa phần do AI khác sở hữu.

## Mở ứng dụng

Tải bản build từ `chatgpt/dist/index.html`, mở trực tiếp trong Chrome hoặc Edge. Ứng dụng là một file HTML tự chứa JSZip v3.10.1, bộ đọc XLSX, số học thập phân và mã UI; không yêu cầu server, tài khoản hoặc Internet. **Bản chạy chưa được nghiệm thu PH1 trên workbook thật** tại thời điểm checkpoint khởi đầu.

Tại mục **Nguồn dữ liệu**, nạp ba file `.xlsx` dùng chung ở `../data/reference/` theo đúng profile nguồn: DISB (`Tổng hợp`), REV (`10T-19.10`), GPMB (`Tổng hợp theo địa bàn`). Nguồn REV bắt buộc tự điền **ngày chốt đã xác minh và lý do**; không tự suy luận ngày từ tên file. Tạo phiên mới với 0 địa phương, chọn phạm vi, xem bảng 14 dòng và nhấn từng ô để xem CalculationTrace. Xuất XLSX có 8 sheet (bao gồm trace và missing), in/Save as PDF trong trình duyệt, sao lưu tệp `.kxh.json` có SHA-256.

**Nguồn Excel gốc dùng chung:** `/data/reference/` của repository (không đặt bản sao trong `chatgpt/`). File mẫu `Kết quả Tổng hợp` chỉ dùng làm template 14 dòng, không chọn sẵn 11 xã. Không upload thêm tệp nội bộ vào GitHub.

## Tự build và kiểm thử

```sh
cd chatgpt
node build.mjs
node --test tests/core.test.cjs
python tests/make_synthetic.py
python tests/browser_test.py
# Chỉ khi checkout có 4 workbook gốc từ repository riêng tư:
python tests/real_browser_test.py
```

Build sử dụng `chatgpt/vendor/jszip.min.js` đã vendored, không gọi npm, không tải CDN. Bộ thử trình duyệt cần `playwright`, `openpyxl` và Chromium ở môi trường nhà phát triển/CI. `dist/index.html` là bản build tạo từ các tệp `src/`, không tự chỉnh sửa trực tiếp.

## Ranh giới và trạng thái

- **PH1**: ba reader cố định, 14 dòng, Decimal, tổng/tổng, coverage có tên, kiểm M/I/D dòng dự án, các phiên độc lập, trace, backup, XLSX và bản in/PDF. Các ngoại lệ dữ liệu phải có cảnh báo.
- **PH2 (để sau)**: mapping workbook bất kỳ, formula AST, nhiều kỳ và template mở rộng, v.v.
- Xem [`docs/STATUS.md`](docs/STATUS.md) để phân biệt test có chạy, kiểm thử dữ liệu giả, và gate còn thiếu. Không dựa vào việc có HTML để coi PH1 hoàn thành.

## Quyền sử dụng mã thư viện

`vendor/jszip.min.js` là JSZip v3.10.1, được phân phối theo lựa chọn MIT/GPLv3; giấy phép tại `vendor/JSZIP_LICENSE.md`. Không có đường dẫn CDN hoặc kết nối mạng trong runtime. Phần tính tiền/diện tích là số thập phân chính xác bằng BigInt, không phụ thuộc `Number` khi cộng/chia, chỉ làm tròn ở bước hiển thị.
