# AGENTS.md — Lệnh bàn giao cho mọi AI/Codex triển khai KTXH Offline

## THỨ TỰ ƯU TIÊN BẮT BUỘC

1. Đọc **toàn bộ** [`MASTER V2.2`](docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md). Đây là tài liệu quy phạm duy nhất hiện hành.
2. Đọc **[`Kế hoạch con 1`](docs/plans/PHASE_1_RESULT_TEMPLATE.md)**, triển khai đúng nội dung PH1 và nghiệm thu trước. PH1 phải cho người dùng dùng được bảng 14 dòng thực tế, không phải mockup.
3. Đọc **[`Kế hoạch con 2`](docs/plans/PHASE_2_EXTENSIBILITY.md)** để giữ ranh giới kiến trúc, nhưng **chỉ bắt đầu PH2 sau khi PH1 đã đạt gate có bằng chứng**.
4. Đọc bốn nguồn Excel gốc tại `data/reference/` và `data/reference/MANIFEST.json`; xác minh SHA; xem [audit nguồn](docs/data_checks/REFERENCE_COVERAGE_20261109.json). Không tự suy đoán nguồn không có; kiểm chứng workbook gốc và danh mục corpus.
5. V1/V2.0/V2.1, review R01–R05 và amendments đã gỡ khỏi cây tệp hiện hành, chỉ còn trong lịch sử Git. P0–P7 cũ đã thay bằng PH1/PH2. **Chỉ MASTER V2.2 và hai kế hoạch con là tài liệu thi công**; tạo review/issue mới nếu muốn sửa quy tắc nghiệp vụ.

## CÁC QUY TẮC KHÔNG THỂ ĐỔI

- Offline 100%, `file://.../dist/index.html` dùng Chrome và Edge không cần server/internet/CDN/đăng nhập.
- Phiên mới **0 địa phương mặc định**; chọn 1/N địa phương tùy ý; nhiều session cùng tồn tại, version và backup/restore độc lập.
- **GPMB CHỈ THEO DIỆN TÍCH:** `SUM(I recorded)/SUM(D)` trên các dự án trong phạm vi. **Không tạo bất kỳ dòng, chế độ, phép tính hoặc lựa chọn “bình quân tỷ lệ dự án”** trong bảng báo cáo hay bản xuất. Cột M chỉ giữ raw và đánh dấu M khác `100*I/D` ở **dòng dự án**, ngưỡng >0,1 điểm %; tránh tính trên dòng tổng xã; thiếu I vẫn là MISSING.
- **Cập nhật 24/11/2026 bắt buộc:** đọc mục cập nhật quy phạm trong MASTER; REV theo ngữ nghĩa tiêu đề (không lấy R/W cố định), DISB_TOTAL_LOCALITY_V2 đọc đủ dòng địa phương; A4 ngang 11 cột; Kết quả thu NSNN tùy chọn mặc định ẩn/đánh lại STT; ba benchmark REV/DISB/GPMB gộp ô; không footer nguồn trong bảng chính, giữ sheet audit/trace. Không hoàn nguyên các quy tắc này.
- **Nguồn thiếu phải có TÊN**: tham chiếu 114 DISB, thiếu REV **Đặc khu Bạch Long Vĩ**; thiếu GPMB **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**. Danh sách này chỉ áp dụng bộ Excel mẫu; dữ liệu mới phải tính lại. Không suy luận lý do kinh tế/hành chính khi chỉ thấy thiếu dòng.
- Trạng thái `NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`, `ERROR`, `DATE_UNVERIFIED` tách biệt. Dòng DISB có null thành phần không có nghĩa thiếu toàn bộ địa phương.
- **Benchmark mọi tỷ lệ = SUM(tử số)/SUM(mẫu số)** trong cùng phạm vi và kỳ; không AVERAGE tỷ lệ xã/phường; mẫu số 0 **cấp địa phương** không loại dòng khỏi SUM tổng nếu cả tử và mẫu đều numeric. Mốc thu 113 và GPMB 108 giữ độ phủ thực trong kiểm toán; chỉ nhãn bảng chính ghi 114 theo quy ước. City-total là phạm vi khác.
- Mọi phép tính (kể cả trung gian/nhận xét) có `CalculationTrace` chứa công thức, tử/mẫu, nguồn ô/SHA, tập included/excluded và từng lý do, đơn vị, ngày chốt, rounding, chất lượng. Không PASS nếu chỉ có số cuối.
- Tệp nguồn nguyên vẹn, không thực thi macro/VBA, không `eval`, không external request; không tự upload Excel mới từ app; chỉ thêm mẫu nguồn gốc đúng phạm vi chủ dự án cho phép theo corpus.

## THỨ TỰ THI CÔNG VÀ NGHIỆM THU

- **PH1:** PH1-01…PH1-06 trong kế hoạch con 1. Đọc 3 nguồn, tạo **14 dòng tương ứng dòng 3–16 Sheet1** của tệp mẫu với dữ liệu thật, chọn xã bất kỳ, chỉnh hiển thị/cách tính đã chốt, kiểm tra missing và M, xem trace, in/XLSX, backup/restore. Các test chỉ thuộc PH2 ghi rõ `DEFERRED_BY_SCOPE`, tuyệt đối không ghi PASS giả.
- **PH2:** PH2-01…PH2-06 theo kế hoạch con 2; mở rộng import động, template, AST công thức và chứng cứ QA. Sau PH2, toàn bộ T01–T66 phải PASS trên SHA hiện tại.
- Sau mỗi gói cập nhật `docs/status/PROJECT_STATUS.md`: branch, HEAD SHA, dataset SHA, module/files thay đổi, test thực chạy PASS/FAIL/DEFERRED, điều kiện chưa đạt, cảnh báo còn mở; không kế thừa PASS từ SHA trước khi sửa code.
- Không tự đánh dấu DONE khi chưa có commit, test kết quả và bằng chứng offline. Không thay số liệu nguồn để làm test PASS.

## KHỞI TẠO

Repository: `cavoixanh638/KTXD-report` (Public theo xác nhận chủ dự án 25/11/2026). Sản phẩm tên KTXH Offline. Xem trạng thái PH1/PH2 mới nhất tại docs/status/PROJECT_STATUS.md và manifest. Bốn workbook đã có ở `data/reference/`; test source audit không tương đương test app runtime.

## Bổ sung bàn giao cuối ngày 24/11/2026

Bảy tên chỉ tiêu tại mục 3 của cập nhật PH1 trong MASTER là chuẩn bắt buộc. Không hoàn nguyên tên cũ; nhãn mặc định ba benchmark ghi cố định 114 địa phương nhưng ngày chốt và phạm vi phép tính/độ phủ vẫn động theo nguồn. Không đưa số 113/114 hay 108/114 vào nhãn bảng chính. Tăng cỡ chữ giá trị benchmark 10% trên web/in và 11 pt trong Excel, không tăng cỡ chữ nhãn hoặc chỉ tiêu cá thể. Giữ nhãn riêng của người dùng, migration nhãn mặc định, công thức tổng/tổng, trace và ô gộp REV/DISB/GPMB. Chạy `NOV_FIX_04` cùng toàn bộ test khi sửa phần này.

## Bắt buộc khi bàn giao bản chạy

Bản chạy duy nhất `dist/index.html` được theo dõi trực tiếp trong Git; người dùng clone hoặc Fetch/Pull origin nhánh phân phối rồi mở file bằng Chrome/Edge, không cần cài Node.js, npm, chạy build hoặc mở server. GitHub Actions hiện có trên nhánh `ai/november-source-report-fix-20261124` (và `main` sau khi được merge) chạy xác minh 4 nguồn tham chiếu, typecheck, build, test và chỉ sau khi đạt mới commit riêng file HTML đã build bằng GITHUB_TOKEN. Không force-push; bot push không kích hoạt lại CI. Các nhánh khác chỉ phân phối sau khi được hợp nhất hoặc build có chủ đích. Không commit `node_modules`, dữ liệu phiên cá nhân hoặc đầu ra khác. Mẫu nguồn do chủ dự án cung cấp được lưu riêng theo corpus, không nhúng thêm vào HTML. HTML chỉ nhúng ba workbook tham chiếu đã được cho phép; không đưa dữ liệu phiên cá nhân vào repo. Nếu CI thất bại hoặc push bị từ chối, chưa công bố bản mới là sẵn sàng. Bản build thủ công chỉ dành cho phát triển.

Ba chỉ tiêu tỷ lệ trung bình REV/DISB/GPMB đều gộp toàn bộ cột địa phương trong mỗi nhóm/trang ngang, gộp hàng trong Studio dọc và merge ô giá trị trong Excel. Mỗi nhóm/trang chỉ hiển thị một kết quả, căn giữa; giữ cỡ chữ lớn hơn 10% (Excel 11 pt), trace chung, công thức và phạm vi nguồn. Không gộp chỉ tiêu riêng từng địa phương.

## Nạp nguồn mới nhất (25/11/2026)

Nút Nạp 3 file mới nhất chọn độc lập DISB/REV/GPMB trong kho dataset của workspace theo ngày chốt hợp lệ đã xác nhận; không quét ổ đĩa. DISB giữ phạm vi tổng vốn hoặc phân cấp của phiên hiện tại; nếu chưa có DISB mặc định tổng vốn. Loại nguồn sai mapping, ngày chưa xác minh, lỗi BLOCKER hoặc ERROR trường tính chính; không loại chỉ vì thiếu vài địa phương. Ưu tiên nguồn thực tế; chỉ dùng mẫu SHA gốc nếu chưa có nguồn thực tế tương thích. Cùng ngày và chưa có metadata phiên bản chính thức, chọn nội dung khác SHA được nhập lần đầu gần nhất, cảnh báo nhiều bản; nhập lại cùng SHA không làm mới thứ hạng. Cùng SHA có ngày chốt xác nhận mâu thuẫn thì không tự chọn. Tên file không quyết định ngày chốt. Preview tên file, ngày, độ phủ, phạm vi, nguồn mẫu/cảnh báo; chỉ nạp khi đủ ba nguồn và người dùng xác nhận. Không thay dữ liệu các phiên khác. Tạo phiên mới có tùy chọn 3 nguồn mới nhất; không thay đổi mặc định dùng nguồn phiên đang mở. Ngày chốt DISB/GPMB không còn fallback tháng 10/tên file; nguồn cũ có bằng chứng A1 không đủ phải xác nhận tại Khối 1. Không tự suy ngày từ hạn dự án CSV. Không hoàn nguyên nút sang nạp file mẫu hoặc dùng reverse().find cho chức năng này.

Bảo toàn ngày xác nhận và thời điểm nhập đầu khi nhập lại cùng SHA/mapping; xác nhận ngày hợp lệ đồng bộ metadata/provenance, không tự upload dữ liệu từ app; mẫu thực tế được lưu theo quy định corpus.

## Xác minh nguồn và lưu mẫu (25/11/2026)

Tuân thủ MASTER mục 6–7; không hạ cấp gate chỉ vì file có ô số, không dùng % chênh lệch giữa kỳ để chọn/loại cột. Giữ nguồn cũ khi import lỗi. Bắt buộc chạy NOV_FIX_06/07 và toàn bộ corpus trước khi publish HTML.

### 7. Kho file Excel nguồn để kiểm thử hồi quy

Giữ nguyên byte của 4 workbook tham chiếu (3 nguồn và 1 mẫu kết quả) đã lưu `data/reference/` và kiểm chứng SHA-256/Git blob SHA-1; không ghi đè, không thay bằng báo cáo xuất ra. `data/reference/SOURCE_CORPUS.json` đăng ký ba nguồn gốc kèm ánh xạ và số liệu kỳ vọng đối chiếu độc lập; `data/reference/corpus/` dành cho mọi phiên bản mẫu nguồn thực tế được chủ dự án cung cấp và cho phép lưu. Mỗi file mới đăng ký đường dẫn, loại nguồn, sheet, ngày chốt/bằng chứng, kích thước, SHA-256, Git blob SHA-1, số địa phương/dự án, cột đúng và golden values xác minh trực tiếp từ file; không lấy đầu ra importer làm kỳ vọng. CI kiểm tra mọi mục, cấm file ngoài danh mục và trùng nội dung. Chỉ ba nguồn tham chiếu cũ được nhúng vào HTML hiện tại; corpus mới chỉ dùng test. App offline không tự gửi file nguồn lên GitHub. **Ngày 25/11/2026, chủ dự án xác nhận giữ repository Public và cho phép lưu các mẫu nguồn của dự án để kiểm thử.** Chỉ thêm file gốc có byte truy cập được và thuộc phạm vi đã cho phép; không công bố dữ liệu ngoài dự án, thông tin cá nhân, bí mật, thông tin đăng nhập hoặc backup phiên. Không tự động upload từ app. Các file gốc chưa truy cập được phải xin chủ dự án gửi lại; không tuyên bố đã lưu khi chỉ có tên hoặc kết quả xuất. Không xóa bốn file gốc khi chưa có chỉ đạo.

Áp dụng MASTER mục 8: luôn dùng địa chỉ cột/dòng thực đã xác minh; không fallback DISB/REV theo cột cố định khi header dịch; không dùng % biến động giữa kỳ. Nếu có workbook nhiều loại nguồn, cần chọn đúng ô. Đọc SOURCE_CORPUS.json và bổ sung các pending originals khi có đúng byte gốc. Chạy toàn bộ regression trước khi công bố HTML.
