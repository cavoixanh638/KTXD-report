# Sổ tay Hướng dẫn Sử dụng Ứng dụng KTXH Offline

> **Dành cho:** Cán bộ tổng hợp, Chuyên viên phòng ban, Lãnh đạo đối soát báo cáo  
> **Phiên bản:** 2.2.0 (Dual-Pane Live Studio)  
> **Đặc tính:** Chạy Offline 100%, Không cần cài đặt server, Bảo mật tuyệt đối trên máy tính nội bộ

---

## 1. Giới thiệu & Khởi động Ứng dụng

**KTXH Offline** là phần mềm chuyên dụng hỗ trợ tổng hợp nhanh Báo cáo Chỉ tiêu Kinh tế - Xã hội các xã, phường, đặc khu từ 3 nguồn dữ liệu bảng tính Excel:
1. **Báo cáo Giải ngân đầu tư công (DISB)**
2. **Báo cáo Thu ngân sách nhà nước (REV)**
3. **Báo cáo Giải phóng mặt bằng (GPMB)**

### Cách khởi động:
- Ứng dụng được đóng gói thành một file duy nhất: `dist/index.html`.
- **Không cần cài đặt Node.js hay phần mềm máy chủ**.
- Chỉ cần nhấp đúp chuột (Double click) vào file `dist/index.html` hoặc chuột phải chọn `Open with` $\rightarrow$ `Microsoft Edge` hoặc `Google Chrome`.
- Bạn có thể ngắt kết nối mạng Internet hoàn toàn, ứng dụng vẫn hoạt động 100% trơn tru và bảo mật.

---

## 2. Giao diện Tổng thể (Dual-Pane Live Studio)

Giao diện gồm 3 khu vực chính:
- **Thanh tiêu đề (Topbar trên cùng):** Chuyển đổi phiên làm việc, đổi tên phiên, sao lưu, phục hồi dữ liệu, nút bật/tắt bảng điều khiển, in PDF và xuất Excel.
- **Cột điều khiển bên trái (Sidebar 332px):** Chứa 3 khối cài đặt: Nguồn dữ liệu, Chọn xã/phường và Tùy chỉnh bảng.
- **Bàn vẽ xem trước trực tiếp (Canvas trung tâm):** Mô phỏng tờ báo cáo giấy A4 ngang theo mẫu hành chính chuẩn mực. Mọi thay đổi bên cột trái sẽ cập nhật ngay lập tức lên tờ giấy này.

> [!TIP]
> **Mở rộng không gian làm việc**: Khi cần xem toàn bộ bảng báo cáo nhiều cột hoặc đối soát số liệu, hãy nhấn nút `[|] Bật/tắt điều khiển` trên Topbar (hoặc ấn tổ hợp phím `Ctrl + B`). Cột trái sẽ thu gọn về 0px, giải phóng toàn bộ màn hình cho tờ báo cáo.

---

## 3. Quản lý Phiên làm việc (Session)

Một cán bộ có thể quản lý nhiều báo cáo khác nhau (ví dụ: *Báo cáo tháng 9, Báo cáo tháng 10, Báo cáo chuyên đề 5 xã trọng điểm...*). Hệ thống hỗ trợ quản lý đa phiên độc lập hoàn toàn:

### 3.1. Tạo phiên mới & Mặc định an toàn
- Nhấn nút `+` cạnh danh sách phiên trên Topbar để tạo phiên mới.
- **Quy tắc an toàn**: Phiên mới tạo luôn có **0 địa phương mặc định**. Người dùng chủ động chọn đúng những xã cần báo cáo, tránh nhầm lẫn số liệu của kỳ trước.

### 3.2. Đổi tên phiên làm việc
- Chọn phiên cần đổi tên từ danh sách thả xuống.
- Nhấn vào nút chiếc bút chì `Sửa tên` ngay cạnh tên phiên.
- Nhập tên gợi nhớ (ví dụ: *Báo cáo Họp Ban Thường vụ Huyện ủy*) rồi nhấn `Lưu tên`.

### 3.3. Nhân bản & Xóa phiên
- **Nhân bản**: Nhấn nút `Nhân bản` để sao chép nguyên vẹn cấu hình (nguồn dữ liệu, danh sách xã đã chọn, cách sắp xếp cột) sang một phiên mới để tiếp tục chỉnh sửa.
- **Xóa phiên**: Nhấn nút `Xóa` để loại bỏ phiên không còn sử dụng.

### 3.4. Sao lưu & Phục hồi dữ liệu (.kxh.json)
- **Sao lưu (Backup)**: Nhấn `Sao lưu` để tải file `.kxh.json` về máy. File này chứa toàn bộ cấu hình, dữ liệu các phiên và mã băm kiểm tra (SHA-256) chống giả mạo.
- **Phục hồi (Restore)**: Nhấn `Phục hồi` và chọn file `.kxh.json` đã lưu từ trước để khôi phục lại trạng thái làm việc bất kỳ lúc nào.

---

## 4. Quản lý Nguồn Dữ liệu Độc lập theo Từng Phiên

Mỗi phiên làm việc có thể sử dụng các file Excel hoàn toàn riêng biệt. Ví dụ: Phiên tháng 9 dùng file tháng 9, Phiên tháng 10 nạp file tháng 10 mà không bị ghi đè dữ liệu của nhau.

Ở **Khối 1: Nguồn dữ liệu** trên Sidebar:
1. **Xem thông tin nguồn**:
   - Hệ thống hiển thị rõ tên file hiện tại, ngày chốt số liệu và tỷ lệ địa phương có số liệu (độ phủ).
2. **Nạp file Excel mới**:
   - Nhấn nút `Chọn file Excel khác...` tại nguồn tương ứng (Giải ngân, Thu ngân sách hoặc GPMB).
   - Chọn file `.xlsx` trên máy tính của bạn. Hệ thống sẽ đọc dữ liệu trực tiếp trong trình duyệt, phân tích cấu trúc và gán riêng cho phiên đang mở.
3. **Chuyển đổi dataset đã lưu**:
   - Nếu bạn đã nạp nhiều file trong máy, chỉ cần mở danh sách chọn dataset để chuyển đổi qua lại mà không cần tải lại file.
4. **Điều chỉnh ngày chốt số liệu (as-of date)**:
   - Bạn có thể sửa ngày chốt hiển thị trên bảng báo cáo (ví dụ: `15/10/2026`). Ngày này sẽ được in đậm rõ nét trên dòng tiêu đề chỉ tiêu tương ứng.

---

## 5. Lựa chọn & Sắp xếp Xã, Phường (Địa phương)

Ở **Khối 2: Địa phương** trên Sidebar:

### 5.1. Tìm kiếm nhanh không dấu
- Gõ tên xã cần tìm vào ô tìm kiếm (ví dụ gõ: `binh giang` hoặc `nam sach`).
- Danh sách lập tức lọc ra các xã phù hợp mà không cần gõ dấu tiếng Việt.

### 5.2. Chọn địa phương vào báo cáo
- Tích vào hộp kiểm trước tên xã/phường để đưa cột của xã đó vào bảng báo cáo A4.
- Bỏ tích để loại bỏ cột xã đó khỏi báo cáo.

### 5.3. Sắp xếp thứ tự cột linh hoạt trực tiếp
- Khi một xã được tích chọn, ngay bên cạnh tên xã sẽ hiển thị **Huy hiệu số thứ tự** (ví dụ: `1`, `2`, `3`...).
- Để chuyển đổi vị trí cột:
  - Nhấn nút mũi tên **`▲` (Lên)**: Đẩy xã lên trên danh sách $\rightarrow$ Cột xã đó sẽ dịch sang bên trái trên bảng báo cáo.
  - Nhấn nút mũi tên **`▼` (Xuống)**: Đẩy xã xuống dưới danh sách $\rightarrow$ Cột xã đó sẽ dịch sang bên phải trên bảng báo cáo.
- Bạn có thể tùy ý xếp các xã trọng điểm lên đầu hoặc xếp theo cụm địa bàn công tác một cách trực quan.

---

## 6. Tùy chỉnh Bảng Báo cáo & Thể thức In ấn

Ở **Khối 3: Tùy chỉnh bảng** trên Sidebar:

### 6.1. Thay đổi Tiêu đề và Phụ đề
- **Tiêu đề chính**: Bạn có thể sửa trực tiếp nội dung dòng chữ in hoa trên đầu bảng (ví dụ: *KẾT QUẢ TỔNG HỢP MỘT SỐ CHỈ TIÊU KTXH CỦA CÁC XÃ, PHƯỜNG*).
- **Phụ đề kỳ báo cáo**: Ghi rõ kỳ tổng hợp (ví dụ: *Tháng 10 năm 2026* hoặc *Quý IV năm 2026*).

### 6.2. Bật / Tắt các dòng chỉ tiêu linh hoạt
Để tờ báo cáo ngắn gọn, vừa vặn với mục đích cuộc họp, bạn có thể tích chọn bật hoặc tắt các dòng:
- **Kết quả thu NSNN (đến ngày …)**: mặc định ẩn; bật để hiện sau dự toán, STT 2, các STT tiếp theo tự dịch.
- **Tỷ lệ thu NSNN trung bình**: bật nếu cần; hai tỷ lệ chung REV/GPMB gộp ô toàn bộ địa phương và hiển thị một lần mỗi nhóm.
- **Số dự án chưa hoàn thành GPMB** và **Dự án NQ 11**: có thể ẩn/hiện; STT phụ thuộc dòng thu thực hiện.

### 6.3. Căn chỉnh thẩm mỹ trang in
- **Độ rộng cột địa phương**: Khổ A4 ngang tự co tối đa 11 địa phương/cụm; nếu vượt giới hạn, dùng AUTO (dọc) hoặc chọn ngang để chia nhóm. Danh sách dự án dài có thể phát sinh trang theo chiều cao.
- **Cỡ chữ chi tiết dự án (Dòng 9)**: Cho phép chuyển đổi giữa `10px` và `11px` để danh sách dự án hiển thị gọn gàng, đẹp mắt.
- **Ngắt danh sách dự án sang Trang 2**: Khi danh sách dự án tại Dòng 9 quá dài, hãy tích chọn mục này. Hệ thống sẽ tự động chuyển toàn bộ Dòng 8 & 9 sang Trang 2 độc lập khi in hoặc xuất PDF, giữ cho Trang 1 nguyên vẹn 7 chỉ tiêu tài chính đầu tiên.

---

## 7. Soi vết Tính toán & Minh bạch Số liệu (Calculation Trace)

Để phục vụ công tác giải trình với đoàn kiểm tra hoặc giải thích cho lãnh đạo cơ quan:
- **Nhấp chuột vào bất kỳ ô số liệu nào** trên bảng báo cáo A4.
- Một cửa sổ giải trình sẽ lập tức xuất hiện, cung cấp đầy đủ thông tin:
  1. **Công thức tính toán**: Ghi rõ phép tính (ví dụ: `SUM(giải ngân) / SUM(kế hoạch) * 100`).
  2. **Tử số & Mẫu số chi tiết**: Số liệu thành phần cụ thể.
  3. **Danh sách đưa vào tính toán**: Các địa phương hoặc dự án tham gia phép tính.
  4. **Danh sách loại trừ & Lý do**: Vì sao một xã hoặc dự án không được tính (ví dụ: `Mẫu số bằng 0`, `Không có số liệu trong kỳ`).
  5. **Nguồn gốc dữ liệu**: Tên file Excel gốc, tên Sheet, địa chỉ ô dữ liệu và mã kiểm tra SHA-256.

> [!TIP]
> Nhấn phím `Esc` để đóng nhanh cửa sổ soi vết tính toán.

---

## 8. Xuất Báo cáo & Lưu trữ

### 8.1. In ấn hoặc Lưu thành file PDF (Khổ A4 ngang)
1. Nhấn nút **`In / Lưu PDF`** trên Topbar.
2. Trình duyệt sẽ mở hộp thoại in chuẩn:
   - **Đích đến (Destination)**: Chọn máy in văn phòng của bạn hoặc chọn `Save as PDF` (Lưu dưới dạng PDF).
   - **Bố cục (Layout)**: Mặc định là `Landscape` (Khổ ngang).
   - **Tỷ lệ (Scale)**: Để mặc định hoặc chọn `Fit to paper` nếu cần.
3. Nhấn `Print` hoặc `Save`. File PDF xuất ra sẽ hoàn toàn sạch sẽ, không có bất kỳ nút bấm hay thanh điều khiển nào, đúng chuẩn mẫu công văn hành chính.

### 8.2. Xuất bảng tính Excel (.xlsx) 5 Sheet Kiểm toán
1. Nhấn nút **`Xuất Excel`** trên Topbar.
2. Hệ thống sẽ tự động tạo và tải về file `.xlsx` gồm **5 sheet chuyên biệt**:
   - **Sheet 1 (`Báo cáo`)**: Bảng chính theo tùy chọn hiển thị, gộp hai tỷ lệ chung, không có ghi chú nguồn cuối bảng.
   - **Sheet 2 (`Nguồn thiếu & lý do`)**: Phạm vi nguồn, kỳ chốt, tên file, danh sách thiếu và lý do.
   - **Sheet 3 (`Danh mục công thức`)**: Công thức, đơn vị, quy tắc tính.
   - **Sheet 4 (`Nhật ký phép tính`)**: Trace và giá trị trước/sau tính, tử/mẫu, nguồn ô, kỳ.
   - **Sheet 5 (`Bản ghi không tính`)**: Bản ghi loại trừ, cảnh báo và lý do.

---

## 9. Khắc phục Sự cố Thường gặp (FAQ)

| Hiện tượng | Nguyên nhân | Hướng dẫn xử lý |
| :--- | :--- | :--- |
| **Bảng báo cáo không hiện xã nào** | Phiên làm việc mới được mặc định 0 xã để đảm bảo an toàn | Tích chọn các xã cần báo cáo ở Khối 2 trên Sidebar bên trái |
| **Bảng bị tràn sang ngang khi in** | Số lượng xã chọn quá nhiều so với khổ giấy A4 | Điều chỉnh độ rộng cột ở Khối 3 xuống `75px` hoặc `80px` |
| **Cảnh báo ngày chốt màu vàng ở Nguồn REV** | File thu ngân sách không ghi rõ ngày chốt số liệu tự động | Nhập ngày chốt thực tế (ví dụ: `19/10/2026`) vào ô cảnh báo và nhấn `Xác nhận ngày` |
| **Tờ báo cáo bị thu nhỏ quá mức** | Sidebar bên trái đang chiếm chỗ | Nhấn nút `[|] Bật/tắt điều khiển` trên Topbar để đóng Sidebar |

## Lưu ý khi chuyển sang dữ liệu tháng 11/2026

Nhập lại file giải ngân 22/11 và thu NSNN 23/11 trong đúng phiên, kiểm tra độ phủ và ngày chốt ở Khối 1. Dữ liệu đã nhập bằng bộ ánh xạ cũ có thể sai tỷ lệ thu đất/không đất hoặc thiếu 5 địa phương; không chỉnh tay tỷ lệ để bù lỗi nguồn. Khi cần giải trình, bấm vào ô số liệu hoặc mở các sheet kiểm toán; không còn ghi chú nguồn cuối bảng chính.

### Tên bảy chỉ tiêu hiện hành

| Mã chỉ tiêu | Nhãn chuẩn trên bảng chính (114 địa phương) |
|---|---|
| `REV_BENCHMARK_RATE` | Tỷ lệ thu NSNN trung bình của 114 địa phương (đến ngày 23/11/2026) |
| `REV_RATE_Y` | Tỷ lệ thu NSNN của từng địa phương so với dự toán |
| `DISB_PLAN` | Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung |
| `DISB_BENCHMARK_RATE` | Tỷ lệ giải ngân trung bình của 114 địa phương (đến ngày 22/11/2026) |
| `GPMB_BUDGET` | Kinh phí phân bổ GPMB cho từng địa phương |
| `GPMB_AREA_PLAN` | Diện tích phải GPMB của từng địa phương |
| `GPMB_BENCHMARK_AREA_RATE` | Tỷ lệ GPMB trung bình của 114 địa phương (đến ngày 24/11/2026) |

Ngày chốt là dữ liệu động theo nguồn của phiên, không cố định các ngày minh họa. Theo yêu cầu trình bày mới nhất của chủ dự án, cả ba nhãn benchmark mặc định ghi cố định `trung bình của 114 địa phương`, không ghi `113/114 địa phương có dữ liệu` hoặc `108/114 địa phương có dữ liệu` trên bảng chính. Đây là tên quy ước của chỉ tiêu trên báo cáo, không phải xác nhận nguồn đủ dữ liệu; độ phủ thực tế, tên đơn vị thiếu, phạm vi tính toán và cảnh báo vẫn lưu đầy đủ trong quản lý nguồn, CalculationTrace và các sheet kiểm toán. Phương pháp vẫn tổng/tổng, không AVERAGE tỷ lệ; mọi cảnh báo chất lượng và trace vẫn giữ nguyên. Khi bật REV_BENCHMARK_RATE, REV_RATE_Y là dòng con không lặp ngày; khi không bật, dòng tỷ lệ từng địa phương giữ ngày chốt như trước. Chỉ di chuyển các tên mặc định/nhãn cũ đã nhận diện; bảo toàn nhãn riêng do người dùng đặt.

Sau khi pull và build, mở lại phiên cũ để tên mặc định tự chuyển sang mẫu mới; không cần tạo phiên lại. Nếu đã tự đặt tên khác, tên riêng vẫn được giữ.

Chỉ tăng cỡ chữ giá trị của ba tỷ lệ trung bình REV/DISB/GPMB: Studio/grid và bản in/PDF dùng `1.1em` (tăng 10% so với số liệu thông thường), Excel dùng 11 pt thay vì 10 pt, định dạng phần trăm và căn giữa giữ nguyên. Không tăng cỡ chữ nhãn chỉ tiêu hoặc giá trị của từng địa phương; tiếp tục gộp REV/GPMB, không thay đổi chính sách gộp DISB. Nhãn mặc định cũ theo độ phủ được tự chuyển sang mẫu 114; giữ tên riêng của người dùng.
