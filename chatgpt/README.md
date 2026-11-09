# KTXH Offline — Document Studio PH1 (nhánh triển khai mới)

**Bản chạy trực tiếp:** [`dist/index.html`](dist/index.html). Mở bằng Chrome/Edge từ thư mục đã tải, đường dẫn `file://`, không yêu cầu server, tài khoản hay Internet. Nguồn và báo cáo không truyền ra mạng.

**Hướng dẫn nhanh:** tải file HTML, mở trình duyệt, bấm **+ Phiên mới** (không chọn sẵn địa phương); vào **Dữ liệu nguồn** để nhập 3 XLSX cùng lúc hoặc lần lượt (tự nhận diện REV/DISB/GPMB), xác nhận ngày chốt và căn cứ; trở lại **Báo cáo tổng hợp** để chọn các địa phương; dùng thanh **Bố cục** (tự động / ngang / dọc) và **Khổ giấy** để xem trước A4; bấm các ô để xem trace, sau đó **Xuất Excel** hoặc **In/PDF**. Khi làm xong, bấm **Sao lưu hồ sơ** để tải tệp `.kxh.json` có kiểm checksum. Tự lưu qua IndexedDB chỉ là lưu tạm, không thay thế file backup.

**Nguồn thật:** dùng đúng 3 workbook tại `../data/reference/`, không thêm file nội bộ vào repo. Ngày chốt của REV `10T-19.10` vẫn cần kiểm tra và xác nhận theo chứng cứ hành chính, không tự nhận 19/10 hay 31/10 là ngày chốt.

**Đánh giá QA mới:** [trạng thái triển khai](docs/STUDIO_STATUS_20261109.md) và [workflow kiểm thử](../.github/workflows/ktxh-document-studio.yml). Mọi bằng chứng phải gắn SHA; chưa phải nghiệm thu cuối cùng PH1/PH2. Ứng dụng sử dụng nguyên calculation engine của PH1 và bổ sung module `studio-*` để giữ kết quả số.

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
