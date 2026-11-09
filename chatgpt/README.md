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
