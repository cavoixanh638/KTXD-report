# AGENTS.md — chỉ dẫn bắt buộc cho mọi AI triển khai KTXH Offline

## Ưu tiên tài liệu

1. Bắt buộc đọc **toàn bộ** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_FINAL.md` trước khi phân công hoặc chỉnh code. **V2 là nguồn yêu cầu DUY NHẤT để triển khai.**
2. `KTXH_OFFLINE_SPEC_V1.md`, R01, R02 và các amendment cũ chỉ là tài liệu lịch sử. Nếu có xung đột, dùng V2; tạo issue / review mới để đề xuất sửa V2, không tự ghép hoặc tự chỉnh quy tắc nghiệp vụ.
3. Bản V2 là kế hoạch, không phải sản phẩm chạy được. Không báo PASS cho mã nguồn hoặc runtime trước khi thực chạy kiểm thử.

## Điều kiện bất biến

- Chạy hoàn toàn offline từ `dist/index.html`, mở trực tiếp trên Chrome/Edge, không cần backend, CDN, API key hay đăng nhập.
- Phiên mới **không chọn sẵn địa phương**. Có thể tạo nhiều phiên riêng biệt, ghim version dữ liệu, sao lưu/khôi phục độc lập.
- Tỷ lệ benchmark = `SUM(numerator)/SUM(denominator)` trên cùng tập dữ liệu/phạm vi/ngày, không AVERAGE phần trăm địa phương. Với GPMB mặc định tỷ lệ theo diện tích, bình quân dự án chỉ là tham khảo khác phương pháp.
- Phải phân biệt 114 địa phương giải ngân, 113 địa phương thu NSNN, 108 địa bàn GPMB và tổng thành phố. Không gọi nhầm phạm vi và không tự tạo 0 cho địa phương thiếu.
- Thời điểm chốt **riêng mỗi file**, bắt xác nhận nếu không rõ; quy đổi chính xác đồng/triệu/tỷ và m²/ha.
- **MỌI phép tính** (kể cả trung gian, tổng, chênh lệch, benchmark và nhận xét) có `CalculationTrace`: công thức, giá trị đầu vào, tử-mẫu, phương pháp, số bản ghi tham gia, bản ghi bỏ qua và **lý do từng dòng**, nguồn, ngày, đơn vị, null-policy, làm tròn và chất lượng; có thể mở từ ô và truy vết ở file xuất.
- Giữ null khác 0. GPMB thiếu I tại 107/173/365 là MISSING, aggregate recorded 72,13% phải PARTIAL. DISB 296 thành phần trống chỉ được trung hòa **trong phép kiểm tra cân đối ngang**, vẫn MISSING ở source.
- Nhận dạng đúng sheet visible/fingerprint: DISB `Tổng hợp` index 5, REV `10T-19.10`; không tự pick `SheetNames[0]` khi sheet đầu ẩn. P/Q DISB phải được nhập đầy đủ, Q có nhiều kịch bản không được tự thay I/F.
- Không auto-join địa phương theo tìm kiếm không dấu; NFC + loại + tên có dấu + ngữ cảnh, alias phải có xác nhận.
- Không đưa workbook Excel người dùng, dữ liệu hành chính nội bộ, sao lưu hoặc bí mật lên GitHub. Các script audit chỉ đọc bộ nguồn tại máy người chạy.

## Quy trình P0–P7

- Lập checkpoint tại `docs/status/PROJECT_STATUS.md` sau từng pha, ghi commit SHA/branch (nếu có repo), file thay đổi, test chạy thật, bằng chứng PASS/FAIL và vấn đề còn mở.
- Không kế thừa PASS của file/commit khác. Chỉ DONE khi T01–T52 PASS thực tế, webapp offline thực tế chạy trên Chrome/Edge, xuất XLSX có style và audit, PDF và backup/restore toàn bộ phiên.
- Nếu nguồn khác SHA hoặc thay bố cục: chạy lại adapter-fingerprint/mapping và cập nhật fixture; không điều chỉnh code để hardcode số kỳ vọng.
- Với phản biện mới, tạo `docs/reviews/REVIEW_R03_YYYYMMDD.md` hoặc R04 tiếp theo, có điều khoản V2, nguồn/cell, phương pháp kiểm, tác động và test mới. Không sửa/xóa review trước đó.

## Trạng thái ban đầu

- `SPEC_V2_FINAL_READY / APP_NOT_IMPLEMENTED`.
- GitHub connector xác thực tài khoản `cavoixanh638`; repository chính: `cavoixanh638/KTXD-report` (Private). Tên sản phẩm là KTXH Offline. Không được tự nhận đã commit hoặc đưa file lên GitHub khi chưa ghi và đọc lại thành công.
