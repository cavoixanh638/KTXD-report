# ĐẶC TẢ CHỦ QUẢN V2.2 — WEBAPP BÁO CÁO KTXH OFFLINE

**Mã tài liệu:** KTXH-OFFLINE-MASTER-SPEC-2.2  
**Ngày lập:** 09/11/2026  
**Lần hiệu chỉnh:** R06 (09/11/2026), chốt GPMB chỉ theo diện tích, coverage ghi tên địa phương thiếu dữ liệu, chia triển khai thành hai kế hoạch con (PH1/PH2).  
**Nguồn lịch sử:** V1, V2.0, V2.1 và các tài liệu phản biện R01–R05 đã được hợp nhất vào bản hiện hành; các bản cũ được gỡ khỏi cây tệp `main` để tránh nhầm và vẫn có thể truy xuất qua lịch sử Git. Bốn Excel nguồn giữ nguyên SHA tại `data/reference/`.  
**Trạng thái:** MASTER V2.2 HIỆN HÀNH, kèm hai kế hoạch con PH1 và PH2. **Chưa lập trình và chưa nghiệm thu ứng dụng.**  
**Ngôn ngữ giao diện:** Tiếng Việt.  
**Nền tảng:** Chrome/Edge trên Windows, chạy offline, không cần đăng nhập, không có backend hoặc truyền dữ liệu ra Internet.

> **Lệnh bàn giao cho AI triển khai:** Đọc **MASTER V2.2 này**, sau đó đọc đúng **hai kế hoạch con** [`PH1`](../plans/PHASE_1_RESULT_TEMPLATE.md) và [`PH2`](../plans/PHASE_2_EXTENSIBILITY.md), cùng `AGENTS.md` và bốn `.xlsx` tại `data/reference/`. **Chỉ triển khai PH1 trước**: phải dựng được bảng 14 dòng của mẫu Kết quả Tổng hợp, có số liệu tính thật, truy vết, tùy chỉnh, lưu nhiều phiên, xuất báo cáo offline. PH2 mở rộng sau khi PH1 có bằng chứng nghiệm thu. Test bắt buộc toàn dự án `T01–T66`; test PH1 theo phạm vi giai đoạn và các điều kiện chặn phải PASS thực chạy. Tuyệt đối không hiển thị chỉ tiêu bình quân tỷ lệ dự án GPMB; cột M chỉ dùng đối chiếu với `100*I/D` **ở dòng dự án**. Không mặc định xã/phường, không tự tính trung bình % địa phương, không sửa nguồn gốc.

## 1. Mục tiêu, phạm vi và các nguyên tắc không được vi phạm

1. Người dùng mở ứng dụng bằng trình duyệt khi máy không có Internet. Trải nghiệm chính phải hoạt động từ gói tải về, không yêu cầu cài Python/Node, tài khoản, API key hay truy cập CDN.
2. Khi tạo một phiên báo cáo mới, danh sách địa phương **rỗng**. Người dùng tìm kiếm và chọn 1, 5, 7, 11, 114 hoặc số lượng bất kỳ; cho phép chọn xã, phường, đặc khu hoặc phối hợp. Bảng mẫu 11 xã chỉ là **template chỉ tiêu**, tuyệt đối không phải danh sách địa phương được chọn sẵn.
3. Một **workspace** chứa nhiều **phiên báo cáo** (session) có tên, danh sách địa phương, thứ tự, chỉ tiêu, cách so sánh và bản nguồn liên kết riêng. Có thể làm báo cáo 5 xã, chuyển sang báo cáo 7 phường, quay về báo cáo 5 xã mà không mất thiết lập và không trộn dữ liệu. Không hạn chế cứng số phiên ở 2, 3 hoặc 5.
4. **GPMB chỉ có một cách tính tỷ lệ báo cáo:** `SUM(diện tích I đã ghi nhận) / SUM(diện tích phải GPMB D) × 100`, phân biệt `PARTIAL_AGGREGATE` nếu thiếu I. **BỎ hẳn chỉ tiêu, công thức, dòng và lựa chọn “bình quân tỷ lệ từng dự án”** khỏi UI báo cáo, template, mốc so sánh và bản xuất. Cột M gốc vẫn được giữ để **kiểm tra sai khác so với `100*I/D` trên từng dòng dự án**; chênh trên 0,1 điểm phần trăm phải đánh dấu, nêu nguồn, chênh lệch và phương pháp. Không áp so sánh này cho dòng tổng địa phương hoặc dự án thiếu D/I/M.
5. Mọi **tỷ lệ chuẩn chung/mốc so sánh** của thu, giải ngân và GPMB phải = **tổng tử số chia tổng mẫu số trong cùng phạm vi**, KHÔNG = `AVERAGE` tỷ lệ của từng địa phương. Nếu tính **mức vốn bình quân một đơn vị** (tỷ đồng/đơn vị) thì công thức đúng là tổng vốn chia số đơn vị hợp lệ; đây là mức bình quân tuyệt đối, không phải bình quân tỷ lệ.
6. Mỗi ô số liệu có giá trị gốc, đơn vị gốc, giá trị chuẩn hóa, công thức hoặc quy tắc tính, nguồn file/sheet/cell và thời điểm chốt riêng. Thiếu, chưa xác định, 0, và lỗi phải là bốn trạng thái khác nhau.
7. Mỗi tệp có ngày chốt độc lập; tự trích ngày khi rõ ràng, người dùng xác nhận; khi không rõ/không nhất quán phải yêu cầu nhập và ghi lại cách xác nhận, không tự đoán.
8. Báo cáo phải ghi rõ **mốc so sánh áp dụng cho 114, 113, 108 địa bàn hay toàn thành phố** và **liệt kê TÊN từng địa phương chưa có bản ghi theo TỪNG NGUỒN**, nêu tình trạng và nguyên nhân có thể khẳng định (ví dụ `NO_LOCALITY_RECORD`: không có bản ghi trong tệp, **không suy diễn là không có phát sinh**). Cần tách tình huống có địa phương nhưng thiếu ô dữ liệu (`FIELD_MISSING`) hoặc dự án thiếu thành phần (`PARTIAL_AGGREGATE`) khỏi tình huống không có địa phương. Không nâng phạm vi tính toán của số liệu chưa đủ thành '114 xã, phường'; nhãn mặc định bảng chính được quy ước ghi 114 địa phương theo mục 3, độ phủ thực nằm trong kiểm toán. Không coi số giải ngân toàn thành phố là mốc của 114 địa phương.
9. Không tự điền số 0 khi không có dữ liệu; không tự cộng khoản không cùng kỳ, cùng phạm vi hoặc cùng phương pháp; không lấy trung bình phần trăm đã làm tròn.
10. Người dùng thay đổi được phần lớn nội dung bảng thông qua cấu hình mà không cần sửa code: địa phương, chỉ tiêu, công thức an toàn, đơn vị, thứ tự, nhãn, điều kiện nhận xét, màu, hiển thị, khổ in và template.

11. **MỌI phép tính** (kể cả tổng từng cột, từng dòng, tỷ lệ, chuyển đổi đơn vị, bình quân, điều chỉnh, chênh lệch và mốc so sánh) phải có **hồ sơ giải trình phép tính** (*Calculation Trace*): biểu thức, quy tắc/phiên bản, số gốc chưa làm tròn, tử/mẫu, toán hạng, đơn vị, quy tắc gộp, tập bản ghi được tính, tập bị loại/bỏ qua với lý do, số lượng và độ lớn ảnh hưởng, nguồn cụ thể, ngày chốt, xử lý null/0/lỗi, dung sai và quy tắc làm tròn; hỗ trợ mở xem từ từng ô và xuất ra báo cáo kiểm toán. Không có trace hợp lệ thì chỉ tiêu tính toán không được coi là PASS. Dữ liệu gốc đơn lẻ không có công thức nhưng vẫn cần chỉ rõ **'Giá trị nhập trực tiếp từ nguồn, không phải kết quả tính'** cùng provenance.
12. Mỗi kết quả phải gắn **trạng thái chất lượng**: đầy đủ, thiếu thành phần, ngoài phạm vi, mẫu số bằng 0, có giả định hay lỗi. Không âm thầm loại bản ghi hoặc chuyển ô trống thành số 0. Khi áp dụng phép cộng nguồn có ô trống, chỉ cho phép tái tạo phép cộng với diễn giải đầy đủ quy tắc và cờ dữ liệu thiếu.
13. Nguồn dữ liệu, danh sách địa phương, công thức và lựa chọn người dùng phải có phiên bản/historic/audit. Tùy chỉnh được nội dung báo cáo nhưng không được xóa dấu vết, cố ý che phạm vi hoặc vô hiệu hóa tính minh bạch của phép tính trong phần xuất chính thức.

**Quan hệ với lịch sử:** V1, V2.0, V2.1, R01–R05 và các amendment không còn ở nhánh `main`, nhưng vẫn được bảo toàn trong lịch sử commit Git. Kể từ R06, dùng **MASTER V2.2 + hai kế hoạch con PH1/PH2**; nếu mâu thuẫn, MASTER V2.2 có ưu tiên cao nhất, tiếp đến kế hoạch con phù hợp phạm vi. Đề xuất thay nghiệp vụ phải có review/issue và chứng cứ; tuyệt đối không sửa lại nguồn để làm test PASS. **Đây là kế hoạch, chưa có app runtime.**

## 2. Bốn tệp Excel nghiệp vụ đầu vào

Các tệp chính đã có trong cuộc trao đổi:

| Mã nguồn | Tên tệp | Sheet cần phân tích | Đơn vị | Phạm vi | Ngày chốt |
|---|---|---|---|---|---|
| `DISB_20261015` | `Báo cáo giải ngân 15.10 sửa(1).xlsx` | `Tổng hợp` | Triệu đồng | 114 địa phương + nhóm khác ở dòng tổng thành phố | 15/10/2026 (tiêu đề ô A1) |
| `REV_10M_2026` | `Bc thu 10 thang-19.10-BC (1)(1).xlsx` | `10T-19.10` | Triệu đồng | 113 địa phương | Kỳ '10 tháng đầu năm 2026', **chưa chứng minh được ngày chốt cụ thể** |
| `GPMB_20261026` | `PL01_Tổng hợp DA_26.12.26(1).xlsx` | `Tổng hợp theo địa bàn` | m², đồng, tổ chức, hộ | 108 địa bàn, 422 dòng dự án | 26/10/2026 (tiêu đề A1; tên tệp không phù hợp hoàn toàn) |
| `RESULT_REFERENCE` | `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx` | `Sheet1` | Tỷ đồng, m², tỷ lệ và văn bản | 11 xã | Trộn nhiều thời điểm | MẪU TRÌNH BÀY, KHÔNG LÀ NGUỒN SỰ THẬT CHO CÔNG THỨC |

**Vị trí 4 tệp Excel gốc trên GitHub:** [`data/reference/`](../../data/reference/README.md), danh sách và SHA-256 tại [`data/reference/MANIFEST.json`](../../data/reference/MANIFEST.json). Bốn tệp được chủ dự án yêu cầu commit để AI khác có thể kiểm thử tự chủ (R05, 09/11/2026); ngày 25/11/2026 chủ dự án xác nhận repo Public và cho phép lưu thêm mẫu nguồn đúng phạm vi dự án. Người thực thi phải chạy `python tools/verify_reference_files.py` và đối chiếu **4/4 SHA-256 PASS** trước khi dùng fixtures. Không tải thêm dữ liệu hành chính hoặc bản sao lưu phiên làm việc lên GitHub nếu chưa có yêu cầu rõ ràng. Khi kiểm thử dùng **đường dẫn thật** `data/reference/<tên file gốc>` và đối chiếu đúng SHA, không phỏng đoán đường dẫn theo tên rút gọn.

Nguồn thu có 113/114 địa phương so với nguồn giải ngân, thiếu Đặc khu Bạch Long Vĩ. Nguồn GPMB có danh mục tại 108 địa bàn, không được suy luận sáu địa bàn còn lại là 0% hoặc 100%. **Phải hiện tên từng địa phương thiếu**, chi tiết §2.2 và `docs/data_checks/REFERENCE_COVERAGE_20261109.json`. Giải ngân tổng thành phố (`Tổng hợp!7`) gồm đơn vị ngoài khối địa phương; giải ngân khối địa phương nằm ở `Tổng hợp!12`.

### 2.1 Khóa kiểm chứng bộ nguồn tham chiếu

Các SHA-256 dưới đây là của đúng những tệp được dùng để kiểm thử (4 tệp nguồn tham chiếu cụ thể đã được người dùng yêu cầu lưu trong repo tại `data/reference/`; xem quy tắc công bố mẫu nguồn tại mục 7, không tự động gửi các tệp hành chính khác):

| Hồ sơ | SHA-256 |
|---|---|
| `DISB` | `3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c` |
| `REV` | `b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f` |
| `GPMB` | `d393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f` |
| `RESULT_REFERENCE` | `bd19d2d910619d36dab5e3332ad9c8a491e3652b631e65b81e62bb23e6a4ec51` |

- Tên file có thể thay đổi; nhận dạng theo **fingerprint của sheet + header + cột + định dạng**, không dựa vào basename. Test fixture nạp bằng đường dẫn tham số. Khi SHA khác, xác minh lại dữ liệu kỳ vọng và ghi lý do; không âm thầm coi đã PASS.
- Với tệp thu, tiêu đề "10 tháng" và chuỗi `19.10` không xác định chắc ngày chốt; ứng dụng yêu cầu người dùng nhập/xác nhận thực tế. Ngày 22/10 ở cột P, ngày QĐ 25/9 ở cột Q của giải ngân không phải ngày chốt.
- `RESULT_REFERENCE` chỉ là mẫu giao diện/chỉ tiêu, không phải nguồn đối chiếu số liệu chính thức.

### 2.2 Danh sách nguồn thiếu và cách giải thích (bộ tham chiếu 2026)

Dùng **114 tên địa phương trong `DISB Tổng hợp!B13:B126` làm danh mục đối chiếu của CHÍNH BỘ TỆP MẪU**, không tự coi đây là danh mục pháp lý vĩnh viễn. Ghép bằng Unicode NFC, trim/gộp khoảng trắng, **giữ dấu tiếng Việt và loại đơn vị**; không auto-join theo chuỗi bỏ dấu. Tập tên vắng mặt có bằng chứng qua `openpyxl`, file audit [`REFERENCE_COVERAGE_20261109.json`](../data_checks/REFERENCE_COVERAGE_20261109.json).

| Nguồn | Có bản ghi / tập 114 | Địa phương **không có bản ghi trong tệp** | Nguyên nhân có thể chứng minh |
|---|---:|---|---|
| DISB | 114/114 | Không có địa phương nào thiếu dòng | Tất cả 114 tên đều có dòng; **không có nghĩa mọi trường dữ liệu đều đầy đủ** |
| REV | 113/114 | **Đặc khu Bạch Long Vĩ** | `NO_LOCALITY_RECORD` — tên không xuất hiện trong danh sách địa phương của sheet `10T-19.10` |
| GPMB | 108/114 | **Phường Lưu Kiếm; Phường Ái Quốc; Xã Hùng Thắng; Xã Thái Tân; Xã Tân Minh; Đặc khu Bạch Long Vĩ** | `NO_LOCALITY_RECORD` — không có dòng nhóm địa bàn trong phụ lục GPMB |

**Không kết luận nguyên nhân hành chính/kinh tế** khi chỉ có bằng chứng vắng bản ghi: không ghi `không có dự án`, `không phát sinh`, `đã hoàn thành` hoặc `0%`. Ba dự án GPMB ở Kinh Môn (107), Tân Hưng (173), Kiến Hưng (365) có **dòng dự án nhưng I trống**, phải đánh cờ `FIELD_MISSING` và `PARTIAL_AGGREGATE`, không được đưa các địa phương đó vào nhóm 'không có bản ghi'. Một địa phương có dòng mà trường chỉ tiêu trống: ghi rõ tên, **tên trường và ô nguồn**, không chỉ báo tỷ lệ thiếu tổng nguồn. `ZERO_VALID` tách khỏi `FIELD_MISSING`.

**Phụ lục trạng thái bắt buộc trong UI và file xuất:** `Tên địa phương | Nguồn | Trường/chỉ tiêu | Trạng thái | Bằng chứng (file/sheet/cell) | Nguyên nhân/diễn giải có căn cứ | Kỳ chốt | Tác động phép tính`. Ở trang Import có bảng đầy đủ toàn nguồn; tại session và báo cáo xuất chỉ liệt kê các địa phương/nguồn liên quan, kèm mốc benchmark N/114. Với dữ liệu kỳ khác phải **tính lại danh sách**, không hardcode sáu tên này cho tương lai.

## 3. Khái niệm nghiệp vụ và phạm vi benchmark

### 3.1 Phạm vi bắt buộc lưu trên mỗi mốc chuẩn

- `SELECTED_UNITS`: chỉ các địa phương người dùng đang chọn trong phiên.
- `LOCALITIES_FULL_114`: toàn bộ 114 địa phương; **chỉ khả dụng khi cùng chỉ tiêu có dữ liệu hợp lệ đủ 114 đơn vị**.
- `LOCALITIES_AVAILABLE_N`: N đơn vị có dữ liệu thực tế trong nguồn (ví dụ 113 đối với thu, 108 đối với GPMB). Bắt buộc hiển thị N, số thiếu, danh sách thiếu, và cảnh báo không phải full 114.
- `PROJECT_PORTFOLIO_CITY`: tổng danh mục dự án GPMB thuộc nguồn hiện có, không tự đồng nhất với tỷ lệ toàn bộ 114 đơn vị hành chính.
- `CITY_TOTAL_OFFICIAL`: số liệu tổng thành phố có cùng định nghĩa tử số, mẫu số, kỳ và nguồn tin xác định; **khác** mức tổng hợp địa phương; chỉ dùng nếu xác minh phù hợp.
- `MANUAL_CONFIRMED`: người dùng tự nhập benchmark và khai báo giá trị tử số, mẫu số, phạm vi, ngày chốt, văn bản nguồn và lý do. Không cho nhập một tỷ lệ trần trụi rồi gọi đó là benchmark chuẩn.

### 3.2 Thứ tự chọn mốc mặc định

1. Nếu đủ 114 đơn vị của chỉ tiêu cùng kỳ, cùng định nghĩa: tự chọn `LOCALITIES_FULL_114`; tính tổng/tổng.
2. Nếu không đủ 114 mà có **tổng thành phố chính thức cùng định nghĩa**: giới thiệu `CITY_TOTAL_OFFICIAL` và ghi rõ là **mốc toàn thành phố**, không ghi 'bình quân 114 địa phương'. Người dùng phải xác nhận sử dụng vì phạm vi khác.
3. Nếu chỉ có N đơn vị đang có dữ liệu (N<114): hiển thị `LOCALITIES_AVAILABLE_N` như **mốc tham khảo**, không tự dùng để kết luận đạt/chưa đạt so với 114; yêu cầu người dùng chọn rõ nếu muốn dùng.
4. Nếu không có mốc tương thích: hiển thị `Chưa có mốc so sánh` và không sinh nhận xét đạt/thấp.
5. Bảng cho phép user đổi mốc sang `SELECTED_UNITS` hoặc `MANUAL_CONFIRMED`, nhưng phải hiển thị tên phạm vi và ngày chốt trên bảng và bản xuất.

**Trường hợp thực tế:**

- Giải ngân 114 địa phương: tỷ lệ chung = `SUM(I13:I126) / SUM(F13:F126)` = **67,10%**. Bình quân cộng riêng tỷ lệ từng địa phương khoảng 76,46% **không được** dùng làm chuẩn; dòng tổng thành phố (46.150,30 tỷ vốn; 31.833,88 tỷ đã giải ngân) là phạm vi khác.
- Thu 113 địa phương: `SUM(I11:I123)/SUM(C11:C123)` = **111,30%** (các chỉ tiêu khác lấy đúng tử/mẫu tương ứng); khi làm mốc phải gọi '113 địa phương có dữ liệu', không gọi 114 hoặc toàn bộ thu NSNN thành phố. Muốn mốc 114 phải bổ sung dữ liệu còn thiếu hoặc nhập nguồn chính thức khác.
- GPMB danh mục tại 108 địa bàn: `SUM(diện tích đã)/SUM(diện tích phải)` = **72,13%**. Gắn nhãn 'tỷ lệ theo diện tích của danh mục tại 108 địa bàn có số liệu'. Không dùng `AVERAGE(M)` của 108 hàng tổng địa bàn.
- Bình quân **mức kế hoạch vốn của một địa phương**: `SUM(F13:F126)/114` = xấp xỉ **136,41 tỷ đồng/địa phương**. Công thức chia số đơn vị hợp lệ này chỉ dành cho giá trị tuyệt đối, không dùng để tính tỷ lệ giải ngân.

### 3.3 Đặc điểm khoản giải ngân ngoài kế hoạch

Nguồn giải ngân có dòng 145: giải ngân **251.163 triệu đồng** ngoài kế hoạch vốn thành phố giao; dòng tổng 7 cộng khoản này vào giải ngân nhưng không có kế hoạch tương ứng. Cần ghi hai tỷ lệ riêng nếu người dùng chọn mốc toàn thành phố:
- **Theo cách hiển thị nguồn:** I7/F7 ≈ 68,98%.
- **Theo phạm vi giải ngân thuộc kế hoạch:** (I7 - I145)/F7 ≈ 68,43%; ghi rõ cách loại trừ.  
Không áp phép loại trừ của dòng 145 vào nguồn giải ngân khối 114 địa phương nếu không chứng minh dòng 145 đã nằm trong I12.

### 3.4 Điều kiện phù hợp của mốc so sánh

Trước khi tính bất kỳ benchmark nào, kiểm tra cùng chỉ tiêu, cùng đơn vị đã chuẩn hóa, cùng tử/mẫu theo định nghĩa, cùng ngày chốt hoặc có xác nhận khác kỳ, cùng phạm vi đơn vị/project không cộng trùng, và tình trạng thiếu nguồn. Tính tỷ lệ theo `ratio(SUM(numerator), SUM(denominator))` trên **cùng tập bản ghi hợp lệ**, không lấy trung bình % hoặc tách điều kiện lọc tử số và mẫu số. **Giá trị mẫu số của một dòng bằng 0 là HỢP LỆ khi số 0 được ghi rõ trong nguồn:** dòng đó phải ở trong cả hai tập cộng để xây dựng benchmark, dù tỷ lệ của riêng dòng không xác định. Chỉ đánh giá mẫu số 0 ở cấp độ **tổng mẫu số** sau khi gộp; `DENOMINATOR_ZERO` ở cấp dòng không tự động biến dòng thành `EXCLUDED`. Chi tiết và phản ví dụ tại §6A.3a, T53–T58. Kết quả luôn hiển thị nhãn phạm vi `N hợp lệ / N kỳ vọng`, số thiếu và lý do từng phần tử bị loại/không có nguồn.

Nếu chọn `CITY_TOTAL_OFFICIAL`, phải có **cặp tử số, mẫu số thành phố độc lập có nguồn** và hồ sơ tương thích; chỉ có một tỷ lệ do người khác gõ không đủ để xác minh. Nếu người dùng nhập tỷ lệ tạm, ghi là `MANUAL_UNVERIFIED`, không được biến thành mốc chuẩn để đánh giá tự động. Ngưỡng cảnh báo hoặc nhận xét không thay đổi công thức benchmark.

## 4. Ánh xạ nguồn chi tiết (data adapters)

### 4.1 `REV` – Thu NSNN (sheet `10T-19.10`)

- Tiêu đề kỳ: `A3`; đơn vị: `AC5` = triệu đồng; tiêu đề cột dòng 8; dòng tổng `10`; địa phương dòng **11–123**.
- Khóa địa phương: cột `B` (tên). Với các file phiên bản mới, dùng kiểm tra tiêu đề thay vì tuyệt đối tin dòng 11.
- `annual_total_budget` = `C`; `annual_land_budget` = `D`; `annual_nonland_budget` = `E`.
- `period_total_plan` = `F`; `period_land_plan` = `G`; `period_nonland_plan` = `H`.
- `actual_total_revenue` = `I`; `actual_nonstate_sector` = `J`; thuế GTGT `K`; TTĐB `L`; TNDN `M`; tài nguyên `N`; các sắc thuế/khoản thu còn lại `O:V`; `actual_land_revenue` = `R`; `actual_nonland_revenue` = `W`.
- `X:AC` là tỷ lệ có sẵn để đối chiếu, **không làm nguồn tính chính**. Tái tính từ số tiền: `X=I/C`, `Y=R/D`, `Z=W/E`, `AA=I/F`, `AB=R/G`, `AC=W/H`. Chú giải ở `AC9` bị ghi nhầm; tin phép tính thực tế `W/H`. Riêng `D=0,R>0` và `G=0,R>0`, tỷ lệ **cấp địa phương** không xác định, nhưng số thu `R` phải được cộng vào **tử số mốc gộp**. Nguồn kiểm chứng: `Y10=R10/D10`, `AB10=IFERROR(R10/G10,"")`.
- Mọi giá trị tiền ở nguồn là **triệu đồng**. Quy đổi tỷ đồng: chia 1.000.
- Quy tắc kiểm: `C=D+E`, `F=G+H`, `I=J+O+P+Q+R+S+T+U+V`, `W=I-R`, `J=K+L+M+N` (sai số theo ngưỡng). Không cộng `K:N` hai lần khi tính `I`.
- Không suy luận '10 tháng' = đã chốt 31/10 khi sheet/tên file có `19.10`; yêu cầu xác minh ngày tại wizard.

**Chính sách dữ liệu thiếu REV:** Tổng của 113 địa phương không được gán cho 114; bản ghi không có không được tự tạo 0. Nếu có cột nguồn là công thức lỗi, đánh dấu lỗi cho đúng chỉ tiêu thay vì dùng ô cached lỗi. Các khoản K:N là chi tiết của J; không cộng hai lần trong tổng I. Chỉ tiêu và benchmark phải trỏ đến field ID, không trỏ tuyệt đối ô nếu cấu trúc nguồn thay đổi.

### 4.2 `DISB` – Giải ngân (sheet `Tổng hợp`)

- Ngày báo cáo: A1 = đến hết 15/10/2026; đơn vị A2 = triệu đồng; dòng tổng thành phố 7; dòng tổng **khối địa phương 12**; các địa phương dòng **13–126**; tên tại `B`.
- `initial_total_plan` = `C` (có lỗi `#VALUE!` ở một số ô tổng, không dùng khi lỗi); `initial_city_component`=`D`; `initial_local_component`=`E`.
- `adjusted_total_plan`=`F`; phần dự án khối TP `G`; phần phân cấp cấp xã `H`.
- `disbursed_total`=`I`; chi tiết theo nguồn `J` (khối TP), `K` (cấp xã); theo nội dung `L` (xây lắp/tư vấn/QLDA), `M` (bồi thường GPMB), `N` (khác).
- `O` là tỷ lệ từ nguồn để kiểm tra; **tái tính bằng I/F**, không bình quân O của các địa phương.
- Kiểm tra `F=G+H`, `I=J+K`, `I=L+M+N`. Cột C có nhiều ô cached `#VALUE!`; không cho giá trị lỗi trở thành 0.
- Toàn bộ tiền: **triệu đồng**; quy đổi tỷ đồng = ÷1.000.
- Sheet ẩn có nhiều `#REF!`; không tự lấy dữ liệu sheet ẩn để thay cho bảng chính. Khi user chọn sheet ẩn phải quét lỗi và hiển thị phạm vi không đáng tin cậy.

**Hai cột DISB bổ sung bắt buộc (R01):**

- `P` = `inspectionMarker` ("Chủ tịch đi 22/10"), là nhãn phân nhóm/kiểm tra hành chính, **không** phải ngày chốt dữ liệu và không được dùng chọn sẵn 11 xã. Bộ nguồn tham chiếu có 11 địa phương có dấu.
- `Q` = `officialNote` (ghi chú nguyên văn), bảo toàn xuống dòng, ký tự và vị trí ô; bộ nguồn có **25/114 địa phương** có ghi chú. Ghi chú chứa diễn giải loại trừ vốn bổ sung QĐ 4004 ngày 25/9, đường sắt/Vinspeed và các điều kiện khác.
- Ghi chú có thể chứa **nhiều tỷ lệ có điều kiện**. Giữ chuỗi nguyên văn, có thể dò thông tin dạng `adjustedScenario[]` để gợi ý nhưng trạng thái ban đầu phải là `UNVERIFIED_NOTE`; chỉ khi xác định được tử/mẫu, phạm vi, danh sách loại trừ, ngày chốt và người dùng xác nhận thì mới có `VERIFIED_ADJUSTED_SCENARIO`. Không dùng regex nhặt một % rồi tự thay `I/F`.
- Ví dụ: `O18≈58,35%`, ghi chú `Q18` nói **94% khi loại vốn bổ sung**; phải hiện 58,35% tính lại từ I/F và chú thích 94% là tỷ lệ điều chỉnh theo ghi chú, chưa có tử/mẫu để tự kiểm chứng. `Q7` có nhiều tỷ lệ và `5%` tiết kiệm chi; không được coi tất cả là tỷ lệ giải ngân.

**Quy tắc null DISB (R02):**

- Trên 114 dòng địa phương có 296 ô trống ở `G=67`, `J=67`, `M=60`, `N=102`, trên **104 dòng địa phương khác nhau**. Các ô đó giữ `MISSING`, không được thay trạng thái `ZERO`.
- Khi **chỉ kiểm tra cân đối ngang** `F=G+H`, `I=J+K`, `I=L+M+N`, cho phép `SUM` cộng các thành phần số đã ghi nhận và xem các ô MISSING như phần tử trung hòa phép cộng **có kiểm soát**; yêu cầu ô tổng hợp lệ, ít nhất một thành phần số, không có thành phần lỗi/invalid và chênh lệch trong dung sai. Trạng thái trả về `PASS_WITH_MISSING_COMPONENTS` kèm danh sách ô MISSING, không phải `PASS_COMPLETE`.
- Nếu có lỗi công thức, số không hợp lệ, tất cả thành phần trống hoặc tổng không khớp thì không được PASS. Không áp quy tắc này vào phép chia, phép tính độc lập hay sang nguồn khác.
- Tại bảng báo cáo, ô thành phần MISSING vẫn hiển thị "Chưa có số liệu"; tùy chọn `0 suy ra từ cân đối` phải có nhãn suy diễn và bật thủ công.

### 4.3 `GPMB` – Giải phóng mặt bằng (sheet `Tổng hợp theo địa bàn`)

- Dòng 1 chứa ngày 26/10/2026; tiêu đề cột dòng 2. Dòng dữ liệu từ 3 đến 532.
- Địa bàn được khai báo bằng **dòng nhóm**: cột `B` = tên xã/phường/đặc khu, cột `A` trống; tiếp theo là các dòng dự án có `A` là STT số 1 đến 422. Mỗi dự án gán với địa bàn gần nhất phía trên; dòng tổng địa bàn chỉ dùng đối chiếu tổng.
- Tên dự án = `B`; loại vốn = `C`; diện tích phải GPMB m² = `D`; số tổ chức phải thu hồi = `E`; số hộ phải thu hồi = `F`; kinh phí phân bổ VND = `G`; hạn hoàn thành `H`.
- Diện tích đã GPMB m² = `I`; kinh phí đã chi VND = `J`; tổ chức đã GPMB = `K`; hộ đã GPMB = `L`; tỷ lệ báo cáo = `M` (có thể là 100 thay vì 1); trạng thái = `N`; nghị quyết 11 = `O`; nhóm = `P`.
- `gpmb_area_rate` của địa bàn/nhóm = `SUM(I_project_rows ghi nhận) / SUM(D_project_rows)`; đây là **phương pháp DUY NHẤT** cho báo cáo. Không tính và không hiển thị `gpmb_project_average_reference`, `gpmb_project_average_recalculated`, `GPMB_AVG_PROJECTS` hoặc `AVERAGE_PROJECT_REFERENCE` như một chỉ tiêu phụ.
- **Đối chiếu chất lượng M nguồn ở cấp dòng dự án**: chỉ xét A là STT dự án, D>0, I và M là numeric; `m_recomputed_pct=100*I/D`, `m_delta_pp=M-m_recomputed_pct`. **Nếu `abs(m_delta_pp)>0,1` điểm phần trăm**, phát `WARNING_M_RATIO_MISMATCH` kèm localityId, projectId, địa chỉ D/I/M, ngày chốt, giá trị nguồn và giá trị tính lại; không tự sửa M hoặc I/D. Nếu lệch nhỏ/đúng do làm tròn: INFO tùy nhu cầu. Thiếu D/I/M, D<=0: trạng thái không thể đối chiếu, **không** tính là khớp. Dòng tổng địa bàn M có cách tính khác, không đưa vào kiểm tra dự án M/I/D.
- Trong nguồn cũ M ở các dòng tổng địa bàn có thể lấy `AVERAGE` các dự án; chỉ giữ làm **thông tin provenance của tệp gốc** khi giải thích vì sao bảng cũ không cùng cách tính, **không** sinh một con số thay thế tỷ lệ theo diện tích trên UI/Excel/PDF.
- Diện tích là **m²**; khi xuất ha: ÷10.000. Tiền G/J là **đồng**, khi xuất tỷ đồng: ÷1.000.000.000; khi xuất triệu: ÷1.000.000. Hộ/tổ chức là số đếm không có đơn vị tiền.
- Nếu có nhiều dòng trùng tên dự án ở nhiều địa bàn: không tự xóa trùng bởi vì mỗi dòng có thể là phần diện tích phân bổ theo địa bàn. Mã dòng dự án = `sourceDatasetId + sheet + rowNumber`.
- Cảnh báo: `I>D`, `J>G`, `K>E`, `L>F`, `M` lệch `100*I/D`, thiếu D/I, hoàn thành N nhưng phần trăm chưa đạt, quá hạn nhưng chưa đạt. Đưa cảnh báo để xác minh, không tự động sửa số liệu.

**Chính sách partial GPMB (R02):**

- Ba dòng dự án `107` (STT85, Kinh Môn), `173` (STT137, Tân Hưng), `365` (STT292, Kiến Hưng) có `D>0` nhưng `I/J/K/L/M` thiếu; tổng D của 3 dòng = **11.459 m²**. Giữ trạng thái `MISSING` tại từng ô, cảnh báo dự án chưa có kết quả.
- Để **tái tạo số nguồn theo cách Excel SUM**, `recordedDoneArea = SUM(giá trị I đã có)`, `declaredArea = SUM(giá trị D đã có, kể cả dự án thiếu I)`; tỷ lệ được gắn trạng thái **`PARTIAL_AGGREGATE`** và nhãn **"tỷ lệ theo diện tích đã ghi nhận, còn dự án thiếu dữ liệu"**, không khẳng định đây là tỷ lệ hoàn thành thực tế đầy đủ.
- GPMB 108 địa bàn: `D=55.398.165 m²`, `I_ghi_nhận=39.960.463,6 m²`, tỷ lệ nguồn tái hiện 72,13% có cờ partial. Kinh Môn: `D=32.609`, `I=27.559`, tỷ lệ theo số đã ghi nhận 84,51%, trong khi `M105` báo bình quân 100% (chỉ 3/4 dự án có M). Tất cả đều phải giải trình số dự án đã tính/bỏ qua và vì sao. Dòng M105=100 ở nguồn là minh chứng cảnh báo cách dùng tỷ lệ tổng xã sai, **không là tỷ lệ báo cáo**.
- Không được tính hoặc xuất **bình quân tỷ lệ M**; bảng kiểm tra chất lượng chỉ liệt kê dự án có M lệch I/D, thông tin raw M và các dòng chưa đủ dữ liệu để kiểm tra.
- Một chỉ tiêu có phần tử thiếu nhưng vẫn trả được tỷ lệ tái hiện từ dữ liệu ghi nhận không được tự sinh kết luận đạt/chưa đạt như số đầy đủ. Nếu cho phép đánh giá có điều kiện, phải có phê duyệt chủ động và chú thích chất lượng trong bản xuất.

### 4.3a Chọn đúng sheet và đọc tệp nhiều sheet (R02)

- Giải ngân có 8 sheet: 5 sheet đầu ở trạng thái `hidden`, sheet `Tổng hợp` nằm tại **index 5**, tổng cộng có 1 sheet `visible` và 7 `hidden`.
- Thu NSNN có 4 sheet: `10T-19.10` `visible`; `Sheet1` `hidden`; `bc`, `TMS` `veryHidden`. GPMB có 1 sheet visible.
- Đọc metadata `sheetName`, `sheetIndex`, `visibility`, `schemaFingerprint` và đánh giá cấu trúc. **Không dùng `SheetNames[0]`.** Tự chọn trong các sheet visible có fingerprint phù hợp và duy nhất. Không có hoặc có nhiều ứng viên → yêu cầu chọn thủ công.
- Người dùng có thể mở sheet hidden/veryHidden trong chế độ chuyên sâu **sau xác nhận**; phải lưu lại lý do và không mặc định dùng sheet đó làm số liệu báo cáo chính. Không tự phát hiện ngày chốt từ ngày trong note/QĐ ở sheet khác.
- Adapter lưu `selectedSheetVisibility`, `autoDetected`, `manualSelectionReason`, `selectedFingerprint`. Các trường này cũng xuất hiện trong trace.

### 4.4 `RESULT_REFERENCE` – Bảng mẫu 11 xã

- Sheet1 có A1:M16; C:M là 11 xã; tiêu đề 1, địa phương dòng 2.
- Hệ thống lưu **template chỉ tiêu** kế thừa nội dung các dòng 3–16, nhưng khi mở phiên mới không preselect C:M.
- Các giá trị cũ tại dòng 9 (76%) và 14 (70,8%) là **tham chiếu lịch sử, không dùng làm benchmark mặc định**. Tỷ lệ dòng 15 trong mẫu không phải lúc nào là tỷ lệ diện tích, nên phải tái tính theo dữ liệu nguồn. Nhận xét dòng 11/16 tính lại từ benchmark mới.

## 5. Danh mục chỉ tiêu mặc định (có thể thêm/bớt/chỉnh)

Mỗi chỉ tiêu phải có `id`, `label`, `sourceType`, `fieldOrFormula`, `originalUnit`, `displayUnit`, `precision`, `aggregationPolicy`, `benchmarkPolicy`, `datePolicy`, `warnings`.

| ID | Tên chỉ tiêu | Phép tính theo địa phương | Định dạng |
|---|---|---|---|
| `REV_BUDGET_Y` | Dự toán thu NSNN năm | `C/1000` | tỷ đồng |
| `REV_REALIZED` | Tổng thu NSNN lũy kế | `I/1000` | tỷ đồng |
| `REV_RATE_Y` | Tỷ lệ tổng thu so với dự toán năm | `I/C` | % |
| `REV_RATE_P` | Tỷ lệ tổng thu so với kế hoạch kỳ | `I/F` | % |
| `REV_LAND_RATE_Y` | Tỷ lệ thu tiền sử dụng đất | `R/D` | % |
| `REV_LAND_RATE_P` | Tỷ lệ thu tiền sử dụng đất so với kế hoạch kỳ | `R/G` | %; khi `G=0, R>0` ghi *Phát sinh ngoài kế hoạch*, không gán 0% |
| `REV_NONLAND_RATE_Y` | Tỷ lệ thu không gồm tiền sử dụng đất | `W/E` | % |
| `REV_NONLAND_RATE_P` | Tỷ lệ thu không gồm đất so với kế hoạch kỳ | `W/H` | % |
| `DISB_PLAN` | Kế hoạch đầu tư công sau điều chỉnh | `F/1000` | tỷ đồng |
| `DISB_PAID` | Đã giải ngân | `I/1000` | tỷ đồng |
| `DISB_RATE` | Tỷ lệ giải ngân | `I/F` | % |
| `DISB_GPMB_PAID` | Giải ngân bồi thường/GPMB | `M/1000` | tỷ đồng |
| `DISB_PLAN_PER_UNIT` | Vốn bình quân mỗi địa phương (mốc) | `SUM(F)/N` | triệu hoặc tỷ đồng/địa phương |
| `GPMB_BUDGET` | Kinh phí được phân bổ GPMB | `SUM(G)/1e9` | tỷ đồng |
| `GPMB_PAID` | Kinh phí đã chi GPMB | `SUM(J)/1e9` | tỷ đồng |
| `GPMB_AREA_PLAN` | Diện tích phải GPMB | `SUM(D)` | m² hoặc ha |
| `GPMB_AREA_DONE` | Diện tích đã GPMB | `SUM(I)` | m² hoặc ha |
| `GPMB_AREA_RATE` | Tỷ lệ hoàn thành theo diện tích | `SUM(I)/SUM(D)` | %; mặc định |
| `GPMB_M_SOURCE_MISMATCH` | Cờ sai khác tỷ lệ M nguồn theo từng **dự án** | `M - (100*I/D)` | điểm phần trăm; chỉ kiểm tra chất lượng, không phải chỉ tiêu báo cáo |
| `GPMB_BUDGET_RATE` | Tỷ lệ chi GPMB so với phân bổ | `SUM(J)/SUM(G)` | %; khác tỷ lệ diện tích |
| `COMPARISON_LABEL` | Nhận xét so với mốc chuẩn | Quy tắc được cấu hình | text |

**Tất cả tỷ lệ chuẩn chung** đều phải tái tính từ tổng tử số và tổng mẫu số, kể cả tỷ lệ đất, không đất, giải ngân, diện tích và chi GPMB. Ví dụ `REV_LAND_RATE_Y_benchmark = SUM(R)/SUM(D)`; `GPMB_AREA_RATE_benchmark = SUM(I_project)/SUM(D_project)`.

## 6. Quy định đơn vị, tỷ lệ, làm tròn và tính toán

1. Nội bộ lưu tiền dưới dạng giá trị chính xác nhất có thể, sử dụng thư viện số thập phân (ví dụ `decimal.js` đóng gói offline), không lưu tiền dưới dạng chuỗi chứa `tỷ`.
2. Mọi giá trị theo nguồn có `rawNumericValue` và `rawUnit` ở cấp **từng trường/cột**, không đơn giản suy luận 'cả workbook cùng một đơn vị': GPMB có đồng, m², người và tỷ lệ trong cùng sheet.
3. Quy tắc quy đổi: `1 tỷ đồng = 1.000 triệu = 1.000.000.000 đồng`; `1 ha = 10.000 m²`; tỉ số dưới dạng fraction nội bộ (0.671), hiển thị `67,10%`. Riêng GPMB M gốc thường lưu như 67.1 chứ không phải 0.671, phải nhận biết theo schema cột này.
4. Giữ số gốc **không làm tròn** cho phép tính và phép cộng. Chỉ làm tròn khi hiển thị hoặc xuất; mặc định 2 chữ số cho tỷ đồng, 2 chữ số cho %, 0 chữ số cho m²/hộ/tổ chức; người dùng tùy chỉnh.
5. Input có thể có dấu phân cách Việt Nam `119.280` (m²) hoặc `32,8` (tỷ), nhưng một số nguồn có `119.71` (dấu chấm thập phân). Parser trước hết ưu tiên số numeric thực từ `.xlsx`; với chuỗi, áp dụng format của cột, nếu nhập mơ hồ thì yêu cầu xác nhận, không tự diễn giải.
6. Mẫu số bằng 0: nếu tử = 0 ⇒ **Không có cơ sở tính tỷ lệ**; nếu tử > 0 ⇒ **Có phát sinh ngoài dự toán/kế hoạch**, không hiển thị `∞%`. Thiếu mẫu số ⇒ **Thiếu dữ liệu**. Lỗi công thức ⇒ **Lỗi nguồn**. Tách trạng thái `VALUE`, `ZERO`, `MISSING`, `FORMULA_ERROR`, `INVALID`, `NOT_APPLICABLE`.
7. Cảnh báo tỷ lệ >100% **không tự sửa về 100%** (có thể có điều chỉnh quy mô). Không tự chuyển tỷ lệ 110% thành 100%; chỉ cảnh báo và cho phép ghi chú.
8. Sai khác do làm tròn phải xét trên số gốc. Đối chiếu số tiền dùng ngưỡng do người dùng điều chỉnh (ví dụ 0,01 triệu đồng hoặc 0,01 tỷ đồng sau chuẩn hóa), không gắn một ngưỡng cho mọi đơn vị.
9. So sánh tỷ lệ dùng **điểm phần trăm** khi tính chênh lệch, không gọi sự khác biệt 30% và 78% là chênh lệch 48% theo nghĩa tăng trưởng tương đối.
10. Công thức tùy chỉnh chỉ chấp nhận cú pháp an toàn theo danh sách hàm `SUM`, `DIV`, `ADD`, `SUB`, `MUL`, `IF`, `MIN`, `MAX`, so sánh, toán tử và tham chiếu tới `metric.id`; tuyệt đối không dùng `eval`, Function constructor hoặc thực thi mã tùy ý từ Excel.

## 6A. HỒ SƠ PHÉP TÍNH BẮT BUỘC (CALCULATION TRACE) — NGUYÊN TẮC SỐ 11

### 6A.1 Mọi con số đều thuộc một trong hai loại

1. **Giá trị nguồn (SOURCE_VALUE):** không phát sinh công thức trong ứng dụng. Phải ghi rõ `đọc trực tiếp`, tệp, SHA-256, sheet, ô, giá trị nguyên bản, kiểu dữ liệu, đơn vị, công thức Excel gốc (nếu có), giá trị cached, ngày chốt và trạng thái. Nếu giá trị nguồn là ô Excel có công thức, phải phân biệt **công thức nguồn** với **công thức nghiệp vụ ứng dụng**. Phải hiển thị nguyên văn công thức Excel nguồn, tham chiếu ô/range phụ thuộc nếu xác định được, cache số và trạng thái `SOURCE_FORMULA_VERIFIED` hoặc `SOURCE_FORMULA_UNVERIFIED`. **Không được coi cache bằng chứng công thức nguồn đã tính đúng** khi không thể tái kiểm tra hoặc công thức có liên kết ngoài.
2. **Giá trị tính toán (CALCULATED):** bắt buộc có `CalculationTrace`, kể cả chuyển đơn vị, tổng nhóm, mốc, tỷ lệ, chênh lệch, nhận xét, trung bình vốn/địa phương, kịch bản loại trừ và tổng các ô bảng. Không chấp nhận một kết quả chỉ có số cuối mà không có trace.

UI có thể hiển thị giản lược để dễ dùng nhưng người dùng phải xem được toàn bộ nội dung bằng **click một ô → Xem cách tính → Xem toàn bộ thành phần và loại trừ**. Mỗi ô được cấp `traceId` cố định theo `datasetVersion + sessionRevision + indicatorId + localityId/scope + policyVersion`. Màn hình và tệp xuất phải cùng tham chiếu tới một trace đã tính.

### 6A.2 Hợp đồng dữ liệu bắt buộc của một CalculationTrace

```ts
type ValueState =
  | 'VALUE' | 'ZERO' | 'MISSING' | 'FORMULA_ERROR'
  | 'INVALID' | 'NOT_APPLICABLE' | 'OUT_OF_SCOPE';
type CalculationQuality =
  | 'COMPLETE' | 'PARTIAL_AGGREGATE' | 'PASS_WITH_MISSING_COMPONENTS'
  | 'INSUFFICIENT_COMPONENTS' | 'DENOMINATOR_ZERO'
  | 'SOURCE_ERROR' | 'INCOMPARABLE_SCOPE' | 'MANUAL_UNVERIFIED';
type ExclusionReason =
  | 'OUT_OF_SCOPE' | 'SOURCE_NOT_PRESENT' | 'MISSING_INPUT' | 'FORMULA_ERROR'
  | 'INVALID_INPUT' | 'DUPLICATE_IDENTIFIER'
  | 'NO_VALID_DENOMINATOR' | 'UNCONFIRMED_MATCH'
  | 'DATE_MISMATCH' | 'USER_EXCLUDED_WITH_REASON'
  | 'SCENARIO_EXCLUSION' | 'NOT_APPLICABLE';
interface CalculationTrace {
  traceId: string;
  indicatorId: string;
  resultKind: 'SOURCE_VALUE'|'CALCULATED';
  result: { exactDecimal: string|null; displayedText: string;
            canonicalUnit: string; displayUnit: string; state: ValueState };
  formula: { formulaId: string; formulaVersion: string;
             readableExpression: string; expressionTree: object;
             method: string; roundingPolicy: string; tolerancePolicy: string };
  scope: { type: string; sourceDatasetIds: string[];
           selectedLocalityIds: string[]; expectedCount?: number;
           matchingPolicyId: string; asOfDates: string[] };
  operands: Array<{ role: string; fieldId: string; exactValue: string|null;
                    unit: string; state: ValueState; sources: SourceCellRef[] }>;
  population: { eligibleCount: number; includedCount: number;
                excludedCount: number; missingCount: number;
                includedRecordIds: string[]; excludedRecordIds: string[] };
  // R06: nêu ĐÍCH DANH địa phương/ô bị thiếu theo từng nguồn, không chỉ missingCount.
  coverageDetails: Array<{ localityId: string; localityName: string;
               sourceDatasetId: string; fieldId?: string;
               status: 'NO_LOCALITY_RECORD'|'FIELD_MISSING'|
                       'PARTIAL_AGGREGATE'|'ZERO_VALID'|'ERROR'|
                       'DATE_UNVERIFIED'|'UNMATCHED';
               reason: string; sourceSheet?: string; sourceCell?: string;
               asOfDate?: string; impactOnComputation?: string }>;

  exclusions: Array<{ recordId: string; affectedOperand: string;
                       reasonCode: ExclusionReason; explanation: string;
                       sourceCell?: string; sourceValue?: string|null }>;
  // R04: ZERO mẫu số ở cấp dòng là bản ghi ĐƯỢC TÍNH trong benchmark.
  // Đây là metadata của included, không được ghi sang exclusions.
  zeroDenominatorContributors?: Array<{ recordId: string;
                        numeratorFieldId: string; denominatorFieldId: string;
                        numeratorExactDecimal: string; denominatorExactDecimal: '0';
                        numeratorSource: SourceCellRef; denominatorSource: SourceCellRef }>;
  steps: Array<{ operation: string; inputs: string[]; output: string|null;
                 inputUnit?: string; outputUnit?: string; reason: string }>;
  quality: { status: CalculationQuality; warningIds: string[];
             missingDeclaredAmount?: string; coverageRatio?: string;
             approvedByUser?: boolean; approvalReason?: string };
  sourceRefs: SourceCellRef[];
  createdAt: string; engineVersion: string; datasetHashes: string[];
}
interface SourceCellRef {
  datasetId: string; fileName: string; fileSha256: string;
  sheetName: string; sheetIndex: number; sheetVisibility: string;
  address: string; sourceFormula?: string; sourceFormulaDependencies?: string[];
  sourceFormulaVerification?: 'VERIFIED'|'UNVERIFIED'|'NOT_APPLICABLE';
  cachedValue?: string|number|null;
  asOfDate: string; mappingVersion: string;
}
```

Nếu nhiều nghìn dòng, cho phép lưu `includedRecordIds` ở một index bất biến và tải chi tiết khi người dùng mở, nhưng **không được chỉ giữ tổng số mà bỏ mất danh sách và nguyên nhân**. Khi xuất gói audit, danh sách phải phục hồi được đầy đủ kể cả chạy offline. Chuỗi Decimal là giá trị chính xác, không phải số đã làm tròn.

### 6A.3 Quy tắc chọn, bỏ qua và công thức gộp

| Phép toán | Bản ghi được tính | Cách xử lý thiếu/0 | Bản ghi không tính và lý do bắt buộc |
|---|---|---|---|
| `SUM(field)` | Bản ghi trong phạm vi có giá trị số hợp lệ | `0` hợp lệ được tính; `MISSING` không góp số; nếu thiếu thành phần đánh cờ partial; tất cả thiếu → không trả 0 giả | Mỗi bản ghi ngoài phạm vi, lỗi công thức, invalid hoặc missing được ghi riêng theo reason code; nêu ảnh hưởng tới độ đầy đủ |
| `RATIO(SUM(A),SUM(B))` | Cùng tập bản ghi có **A và B đều là số hợp lệ, bao gồm B_i=0 hợp lệ**; khác biệt GPMB recorded xem dòng kế tiếp | Kiểm tra `SUM(B)==0` **sau khi gộp**, không loại bản ghi chỉ vì `B_i=0`; missing/invalid phải theo policy có trace | Bản ghi A_i>0, B_i=0 vẫn đóng góp A_i vào tổng tử và 0 vào tổng mẫu. `DENOMINATOR_ZERO` của tỷ lệ đơn vị **không phải lý do loại dòng** khỏi mốc chung; giải trình cả bản ghi included có mẫu số bằng 0, và danh sách excluded thực tế |
| `GPMB_RECORDED_AREA_RATIO` | D của tất cả dự án D hợp lệ trong phạm vi; I số đã ghi nhận | Nếu I thiếu, tiếp tục giữ D trong mẫu số và đánh cờ partial; **không ghi I=0 vào nguồn** | Ghi chính xác 3 dòng thiếu và tổng diện tích liên quan; nhãn là tỷ lệ *đã ghi nhận* |
| `GPMB_M_SOURCE_CHECK` | Chỉ các **dòng dự án**, D>0, I/M là số hợp lệ | `delta_pp=M−100*I/D`; không tính tỷ lệ dự án thay cho tỷ lệ theo diện tích địa bàn | Thiếu D/I/M hoặc D<=0 có reason; các dòng M lệch >0,1 điểm % có warning và địa chỉ ô; không so dòng tổng xã |
| `DISB_IDENTITY_CHECK` | Ô tổng và các thành phần số cùng hàng | Null có thể trung hòa **chỉ trong kiểm tra cân đối**, status PASS_WITH_MISSING_COMPONENTS | Liệt kê mọi ô bỏ qua, lý do `MISSING_INPUT`, không dùng trị suy diễn này trong DIV |
| `CITY_ADJUSTED_SCENARIO` | Chỉ dòng thuộc kịch bản có xác nhận | Loại trừ theo văn bản/điều kiện xác minh | Danh sách dòng/khoản bị loại, quyết định/văn bản, ngày, ảnh hưởng cả tử và mẫu |
| `PERCENT_POINT_DIFF` | Hai tỷ lệ cùng định nghĩa/phạm vi/ngày hoặc được xác nhận | Chênh lệch = (r1-r2)*100 điểm % (với tỷ lệ dạng fraction) | Nếu không tương thích: không sinh nhận xét, lý do `INCOMPARABLE_SCOPE` |
| `UNIT_CONVERSION` | Một giá trị hợp lệ theo cột nguồn | Giá trị số gốc × hệ số chuẩn hóa; 0 vẫn 0; thiếu vẫn thiếu | Công thức phải ghi rõ ví dụ `x triệu / 1000 = x tỷ` và đơn vị nguồn/đích |

### 6A.3a Quy tắc ưu tiên P0 — phân biệt phép chia cấp đơn vị và phép chia tổng/tổng (R04)

**Tách ba bài toán:** (1) đọc giá trị nguồn `ZERO/MISSING/ERROR`, (2) đánh giá **tỷ lệ của một đơn vị**, (3) tính **tỷ lệ cho một phạm vi nhiều đơn vị**. Không chuyển một lỗi chia cục bộ thành điều kiện lọc cho phép cộng tổng. Đây là yêu cầu quy phạm, cần thực hiện trong engine, schema `CalculationTrace`, danh mục chỉ tiêu và cả bản xuất.

1. Ở cấp dòng `i`, nếu `B_i=0` là số **ZERO** và `A_i>0` hợp lệ thì `A_i/B_i` không xác định (`DENOMINATOR_ZERO`) và hiển thị `Phát sinh ngoài dự toán` hoặc `Phát sinh ngoài kế hoạch` theo loại mốc; **không** tính là 0%, Infinity hay 100%. Nếu `A_i=0`, `B_i=0` thì là `KHÔNG CÓ CƠ SỞ TÍNH TỶ LỆ`, không phải tỷ lệ đạt 0%.
2. Với benchmark `SUM(A_i)/SUM(B_i)`, điều kiện tham gia **mỗi dòng** là A và B có giá trị số hợp lệ, cùng phạm vi, cùng đơn vị quy đổi và ngày chốt tương thích. Điều kiện **không phải** `B_i>0` hoặc `A_i/B_i` tồn tại. Dòng có `B_i=0` vẫn tham gia cả hai SUM; đóng góp vào mẫu số bằng **0 có nguồn** và vào tử số bằng giá trị `A_i` của dòng đó. Chỉ sau khi gộp mới xét `SUM(B_i)>0`; nếu tổng mẫu số bằng 0 thì không trả tỷ lệ %, kể cả tổng tử số dương.
3. `NO_VALID_DENOMINATOR` hoặc `DENOMINATOR_ZERO` tại **một dòng riêng lẻ** chỉ mô tả trạng thái phép chia dòng đó, tuyệt đối không được đưa vào `excludedRecordIds` của benchmark chỉ vì `B_i=0`. `MISSING/ERROR/INVALID` là các trạng thái khác, có thể không đáp ứng điều kiện theo policy và phải có giải trình loại trừ. Nếu nguồn có số âm/điều chỉnh bất thường, không tự loại; kiểm tra điều kiện nghiệp vụ và cảnh báo riêng.
4. `CalculationTrace` cho benchmark bắt buộc lưu `includedRecordIds` đủ các dòng có mẫu số 0, danh sách `zeroDenominatorContributors` (ID, file/sheet/cell, `A_i`, `B_i=0`, tổng đóng góp vào tử số), tổng tử số, tổng mẫu số, trạng thái số liệu, quy tắc lọc, nguyên nhân loại trừ **thực tế** và đối chiếu dòng tổng nguồn. Trong giao diện, có mục `Phát sinh ngoài dự toán/kế hoạch nhưng vẫn tính vào tổng`.
5. **Không được** dựng benchmark bằng `AVERAGE(LOCAL_RATE_i)`, `SUM(R_i WHERE D_i>0)/SUM(D_i WHERE D_i>0)`, hoặc loại những dòng có `LOCAL_RATE_i=DENOMINATOR_ZERO`. Cần tái tính trực tiếp từ **hai cột số tiền** sau chuẩn hóa.

**Bằng chứng đối chứng nguồn REV (dòng 11–123; đơn vị triệu đồng):**

| Quy tắc | Ô nguồn | Dòng ZERO với R>0 | Tổng R trên nhóm ZERO | Tử số toàn nguồn | Mẫu số toàn nguồn | Tỷ lệ đúng | Sai nếu loại dòng ZERO |
|---|---|---:|---:|---:|---:|---:|---:|
| Thu đất so với dự toán năm | `R/D`; kết quả `Y10` | D15,D26,D42,D57,D114 = 0 | 269.290 | 9.777.655,455 | 7.182.893 | **136,12%** | 132,38% |
| Thu đất so với kế hoạch 10 tháng | `R/G`; kết quả `AB10` | G15,G26,G28,G42,G57,G114 = 0 | 304.790 | 9.777.655,455 | 4.823.476 | **202,71%** | 196,39% |

Với mẫu số dự toán năm, năm dòng có `D_i=0,R_i>0`: dòng 15 Tiên Lãng (218.436), 26 Việt Khê (10.932), 42 Vĩnh Thuận (18.704), 57 Hồng An (18.921), 114 Hùng Thắng (2.297). Với kế hoạch kỳ có thêm dòng 28 An Khánh (`G=0`, `R=35.500`). Tổng 113 địa phương đã được đối chiếu với `D10/G10/R10`, không tự tạo dữ liệu cho địa phương thứ 114.

**Phạm vi tùy chọn:** Nếu người dùng chọn riêng một tập mà `SUM(B)==0`, vẫn hiển thị **tổng thu thực tế** (có thể dương) nhưng tỷ lệ tổng là `DENOMINATOR_ZERO`, không sinh nhận xét đạt/vượt %. Nếu tập khác có tổng mẫu số dương, áp cùng quy tắc và ghi đủ đóng góp từ dòng mẫu số bằng 0. Không được coi ZERO là MISSING hoặc tự bỏ qua.

**Mặc định làm tròn thập phân `ROUND_HALF_UP` ở bước trình bày (có thể cấu hình và phải lưu mode trong trace); phép tính dùng Decimal giá trị gốc.** Không được tính bằng các giá trị % đã làm tròn. Thao tác `ROUND` là một bước cuối độc lập trong trace, bao gồm số chữ số, quy tắc làm tròn, số trước/sau và độ lệch (nếu có). Không được bỏ một dòng vì lệch ngưỡng rồi giấu nó trong số tổng.

### 6A.4 Thứ tự tính và điều kiện kết luận

1. Đọc raw và ghi loại SOURCE_VALUE, xác minh metadata.
2. Áp dụng bộ lọc phạm vi theo đơn vị hành chính, dự án, phiên bản nguồn và kỳ; ghi lý do loại từng dòng.
3. Chuẩn hóa đơn vị + Decimal, ghi từng bước; không tính từ chuỗi giao diện.
4. Chọn tập bản ghi hợp lệ **theo một chính sách nghiệp vụ có mã version**, tạo tập included/excluded; ghi trạng thái riêng cho mỗi toán hạng.
5. Tính các bước trung gian, kiểm tra mẫu số, tỷ lệ, dung sai, partial/coverage.
6. Tạo trace cho các bước, cho số tổng và cho kết quả cuối, xác định label/nhận xét từ quality + benchmark tương thích.
7. Chỉ sau đó định dạng và làm tròn; tạo cùng dữ liệu cho UI/XLSX/PDF. Người dùng có thể mở mọi bước và kiểm chứng số liệu nguồn.

Các kết luận `đạt`, `cao hơn`, `thấp hơn`, `rất thấp` là **kết quả của một quy tắc có trace**: `ruleId`, giá trị thực, mốc, phép so sánh, ngưỡng, tập dữ liệu, chất lượng nguồn, ngoại lệ và lý do. Nếu partial/khác phạm vi/ngày hoặc không có mốc hợp lệ, **mặc định không phát sinh nhận xét khẳng định**; có thể hiển thị *"Chưa đủ cơ sở đánh giá"*.

### 6A.5 Ví dụ chuẩn về giải trình phép tính

**Ví dụ A — GPMB phường Kinh Môn:** `D=32.609`, `I_ghi_nhận=27.559` ⇒ `27.559/32.609*100=84,51%` (hiển thị); 4 dòng dự án trong mẫu số; 3 có M, 1 dự án tại dòng 107 `D=5.050`, `I=MISSING`. Kết quả **PARTIAL_AGGREGATE**, không được gọi là tỷ lệ hoàn thành thực tế đã xác nhận; `M105=100%` của nguồn chỉ là dữ kiện lịch sử **không đưa vào báo cáo hoặc tạo bình quân thay thế**.

**Ví dụ B — Giải ngân 114 địa phương:** mẫu `r=13..126` ở `Tổng hợp`, `SUM(I)=10.434.921,777 triệu`, `SUM(F)=15.550.923,159 triệu`; `r=SUM(I)/SUM(F)≈67,10%`. Cần ghi đủ 114 dòng được tính, 0 bị loại nếu đủ F/I, phạm vi, ngày chốt 15/10/2026 và hệ số đổi triệu→tỷ. **Không** hiển thị 76,46% như benchmark chung.

**Ví dụ C — Thu 113 địa phương:** `SUM(I)=28.550.929,455 triệu`, `SUM(C)=25.651.713 triệu`, `111,30%`; 113 dòng có dữ liệu, **thiếu Bạch Long Vĩ trong phạm vi kỳ vọng 114**, ghi lý do ngoài phạm vi nguồn. Không gọi là "thu NSNN toàn thành phố".

**Ví dụ D — Ô trống giải ngân:** `F=G+H` nếu G trống, F/H có số và F=H thì đối chiếu PASS_WITH_MISSING_COMPONENTS; xem ô G riêng vẫn MISSING, **không** ghi G=0 do nguồn xác nhận.

### 6A.6 Đảm bảo khả năng truy vết trong giao diện và file xuất

- **Trên màn hình:** mỗi số/nhận xét có nút hoặc hành vi click/keyboard để xem `Công thức`, `Diễn giải`, `Số hạng`, `Tử-mẫu`, `Đã tính (N)`, `Không tính (N + lý do)`, `Nguồn và ngày`, `Làm tròn`, `Cảnh báo`, `Lịch sử chỉnh sửa`. Bảng dùng icon nhẹ hoặc đánh dấu truy xuất, không rải cả công thức vào từng ô khiến giao diện khó đọc.
- **XLSX:** sheet `Báo cáo` là bảng đẹp; kèm **bắt buộc** sheet `Nguồn thiếu & lý do` (tên địa phương, nguồn, trường thiếu, kỳ, bằng chứng, nguyên nhân xác định được) và sheet `Danh mục công thức` (ID, mô tả, quy tắc null, quy đổi) và `Nhật ký phép tính` (traceId cho TỪNG ô tính, số trước/sau, tử/mẫu, phạm vi, thời gian, chất lượng). Sheet `Bản ghi không tính` liệt kê từng dòng bỏ qua và lý do. Không được tắt cả ba sheet trên khi xuất bản báo cáo chính thức; có thể ẩn các sheet phụ ở chế độ visible/hidden theo tùy chọn nhưng không xóa. Với bản in/PDF sạch, không chèn đoạn ghi chú nguồn ở cuối bảng; phương pháp và mã trace được lưu trong hồ sơ giải trình, hỗ trợ xuất phụ lục trace riêng kèm bản in.
- **Backup:** lưu toàn bộ policy và source/provenance đủ để **tái tạo trace** sau khi restore; trace có version và checksum để phát hiện sai khác. Nếu dữ liệu/logic cập nhật, kết quả trace phải tạo mới, không giả vờ trace cũ còn hợp lệ.
- **Kiểm thử:** so sánh trace tái tính với kết quả số học cho từng phép, kiểm tra danh sách included/excluded có lý do, đầu ra XLSX/PDF có thông tin phương pháp/nguồn; thao tác click từ ô báo cáo mở được đúng traceId.


## 7. Quy tắc ngày chốt và kỳ báo cáo

Mỗi dataset lưu tối thiểu:

```json
{
  "reportPeriodLabel": "10 tháng đầu năm 2026",
  "reportPeriodStart": "2026-01-01",
  "reportPeriodEnd": "2026-10-31",
  "asOfDate": null,
  "asOfDateStatus": "REQUIRES_USER_CONFIRMATION",
  "asOfDateEvidence": "Sheet 10T-19.10, title 10 tháng; không có ngày chốt rõ ràng",
  "confirmedByUser": false,
  "confirmedAt": null
}
```

`reportPeriodEnd` trong ví dụ là mốc kỳ danh nghĩa **không phải** xác nhận đã chốt 31/10. Hai trường `reportPeriodEnd` và `asOfDate` không được đồng nhất tự động. Đối với báo cáo thu, wizard chỉ hoàn thành khi người dùng nhập/xác nhận `asOfDate`; nếu không có đủ bằng chứng, dùng `asOfDateStatus=MANUAL_CONFIRMED` kèm lý do.

Quy trình nhập ngày:
1. Tìm trong tiêu đề sheet và nhãn `đến hết ngày`; đối chiếu sheet, tên tệp và các ghi chú.
2. Ngày rõ và không mâu thuẫn ⇒ điền sẵn, hiển thị cho người dùng xác nhận (không bắt gõ lại).
3. Thiếu, mơ hồ hoặc xung đột ⇒ ô ngày trống + cảnh báo + **bắt nhập** trước khi bấm `Hoàn tất nhập`.
4. Với nguồn thu `10T-19.10`, không được tự chọn 19/10/2026 hoặc 31/10/2026. Nếu người dùng xác nhận 19/10 là dữ liệu sơ bộ kỳ 10 tháng thì lưu cả nhãn kỳ và ngày chốt, có cảnh báo khác nhau về khái niệm.
5. Không sử dụng ngày tạo/sửa file hay ngày hiện tại làm ngày chốt. Ngày cập nhật trong hệ thống là `importedAt` riêng.
6. Mỗi chỉ tiêu trong báo cáo hiển thị nhãn nguồn/kỳ khi cần; không in đoạn ghi chú nguồn ở cuối bảng chính. Kỳ, phạm vi và chứng cứ nguồn phải lưu trong dữ liệu kiểm toán/trace, sheet phụ hoặc phụ lục riêng, theo cập nhật PH1 ngày 24/11/2026. Cảnh báo kỳ không xác minh và khác phạm vi vẫn áp dụng.
7. Khi so sánh benchmark với số địa phương: mặc định phải cùng `datasetVersion`, `reportPeriod` và `asOfDate`; trường hợp khác phải có xác nhận và chú thích rõ là so sánh khác thời điểm.

## 8. Kiến trúc kỹ thuật

### 8.1 Build và chạy

- Mã nguồn viết TypeScript (ưu tiên) hoặc JavaScript rõ module; bundler (`esbuild` hoặc cấu hình tương đương) tạo **một** `dist/index.html` chứa JS/CSS và tài nguyên cần thiết được nhúng trong file. Không tham chiếu CDN, Google Fonts, API hoặc các file module từ `file://` có thể gặp lỗi CORS.
- Dùng thư viện đọc/ghi XLSX được đóng gói vào file build (chọn một thư viện có hỗ trợ browser và kiểm tra bản quyền khi triển khai); tuyệt đối không chạy macro VBA, external links hoặc công thức Excel tùy ý.
- Không bắt người dùng cài Python, Node hoặc chạy local server. Chỉ môi trường **build** của lập trình viên mới cần Node/npm. Không dùng PWA/Service Worker làm điều kiện chạy bản `file://`.
- Dùng `window.print()` và CSS `@media print` để in/Save to PDF bằng trình duyệt; xuất XLSX ở browser bằng Blob/download. Tất cả vẫn chạy khi ngắt mạng.
- Không thu thập telemetry; không `fetch`, XMLHttpRequest, WebSocket tới Internet; mã nguồn chỉ thao tác `File` do người dùng chọn, xử lý trong bộ nhớ, lưu local khi được phép.

### 8.2 Cấu trúc mã nguồn bắt buộc

```text
kxh-offline/
  README.md
  docs/
    SPEC.md                  # tài liệu này
    DATA_DICTIONARY.md       # schema fields/units
    SOURCE_MAPPINGS.md       # phiên bản adapter + mapping cell
    CALCULATION_RULES.md     # định nghĩa benchmark, tỷ lệ
    TEST_CASES.md            # ma trận QA và bằng chứng
  src/
    app/                     # navigation, page state
    import/                  # import wizard, xlsx-reader, validation
    adapters/revenue.ts
    adapters/disbursement.ts
    adapters/gpmb.ts
    domain/                  # models, units, geography, dates
    calculation/             # aggregator, ratios, benchmarks, decimal
    quality/                 # validation & anomaly detection
    sessions/                # workspace, save/restore, version pinning
    report/                  # grid, builder, custom formula, comments
    export/                  # xlsx, print, audit, backup
    styles/
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  dist/index.html             # chỉ xuất hiện sau build
```

### 8.3 Luồng dữ liệu

`XLSX/Workbook → nhận diện profile → wizard xác minh ngày và đơn vị → ánh xạ địa phương → chuẩn hóa thành bảng bản ghi + chứng cứ ô nguồn → kiểm tra chất lượng → đăng ký dataset phiên bản → phiên báo cáo tham chiếu dataset → engine phép tính tổng/tổng → lưới báo cáo → export/audit`.

Không đưa dữ liệu thô trực tiếp vào ô giao diện rồi tính từ chuỗi đã định dạng. Mọi thành phần hiển thị cùng dùng **một** calculation engine để tránh số trên màn hình khác số xuất Excel/PDF.

## 9. Schema dữ liệu tối thiểu

```ts
interface Dataset {
  id: string; sourceType: 'REV'|'DISB'|'GPMB'|'MANUAL';
  sourceFilename: string; sourceHash: string;
  sourceSheet: string; mappingVersion: string;
  unitCount: number; projectRowCount?: number;
  asOfDate: string; // YYYY-MM-DD, bắt buộc sau import
  periodLabel: string; periodStart?: string; periodEnd?: string;
  asOfStatus: 'DETECTED_CONFIRMED'|'MANUAL_CONFIRMED';
  importedAt: string;
  records: SourceRecord[]; issues: QualityIssue[];
}
interface SourceRecord {
  id: string; datasetId: string; localityId: string;
  projectRowId?: string; // chỉ GPMB
  metrics: Record<string, {raw: string|number|null;
     normalizedValue: string|null; unit: string;
     state: 'VALUE'|'ZERO'|'MISSING'|'FORMULA_ERROR'|'INVALID'|'NOT_APPLICABLE';
     provenance: {filename:string; sheet:string; cell:string;
       formula?:string; cachedValue?:string|number};
  }>;
}
interface Locality {
  id: string; canonicalName: string;
  type: 'XA'|'PHUONG'|'DAC_KHU'; aliases: string[];
  officialCode?: string; matchStatus: 'CONFIRMED'|'NEEDS_CONFIRMATION';
}
interface ReportSession {
  id: string; name: string; createdAt: string; updatedAt: string;
  selectedLocalityIds: string[];   // [] khi tạo mới
  indicatorIds: string[];          // chọn theo template, không ràng buộc xã
  dataBindings: {REV?:string; DISB?:string; GPMB?:string}; // cố định phiên bản dataset
  benchmarkBindings: Record<string, BenchmarkConfig>;
  settings: {decimals:number; areaUnit:'m2'|'ha'; moneyUnit:'million'|'billion';
     gpmbDefaultMethod:'AREA_WEIGHTED'; paperSize:'A4'|'A3'; orientation:'landscape'|'portrait'};
  overrides: ManualOverride[]; templateId?: string;
}
interface BenchmarkConfig {
  scope: 'LOCALITIES_FULL_114'|'LOCALITIES_AVAILABLE_N'|
    'PROJECT_PORTFOLIO_CITY'|'CITY_TOTAL_OFFICIAL'|
    'SELECTED_UNITS'|'MANUAL_CONFIRMED';
  numeratorField: string; denominatorField: string;
  coverageActual: number; coverageExpected?: number;
  datasetId: string; asOfDate: string; manuallyApprovedPartial?: boolean;
}
interface Workspace {
  formatVersion: number; name: string;
  localities: Locality[]; datasets: Dataset[];
  sessions: ReportSession[]; activeSessionId?: string;
  auditLog: AuditEntry[];
}
```

Định danh địa phương ưu tiên mã đơn vị hành chính nếu nguồn tin cậy có. Ba sheet hiện tại có thể không cùng chứa mã; khi đó dùng **(loại địa phương, tên chuẩn hóa, ngữ cảnh hành chính)**, tuyệt đối không ghép đơn vị chỉ vì tên gần giống. Cho phép alias do người dùng xác nhận và ghi nhật ký. Dùng địa phương đã ghi ở bảng giải ngân để xây dựng danh mục chọn 114 địa phương ban đầu, **không đánh dấu chọn** một đơn vị nào.

`sourceHash` dùng nhận diện file trùng phiên bản; không coi tên file là mã duy nhất. Khi thay tệp, tạo dataset phiên bản mới (immutable), không ghi đè dữ liệu phiên cũ nếu người dùng chưa chọn chuyển nguồn.

### 9.1 Bổ sung schema R01/R02/V2 (bắt buộc song song với interface trên)

- `Dataset` thêm `workbookSha256`, `sheetIndex`, `sheetVisibility`, `schemaFingerprint`, `reportPeriodLabel`, `asOfDateEvidence`, `asOfDateConfirmation`, `importSelectionMode` và `calculationPolicyVersion`.
- `SourceRecord.metrics[field].state` giữ MISSING/ZERO/ERROR riêng; thêm `cellType`, `sourceFormula`, `cachedValue`, `sourceRow`, `sourceColumn`, `extractionConfidence`, `normalizedDecimal`. Không tự thay công thức nguồn `#REF!` bằng số 0.
- `Locality`: `displayName`, `canonicalNameNFC`, `type`, `officialCode?`, `adminContext?`, `aliases[]`, `matchEvidence`, `matchConfidence`, `matchDecisionAudit`. Khóa auto-join = mã đã kiểm chứng hoặc `(loại, tên có dấu NFC/casefold, ngữ cảnh xác thực)`; **không** tự ghép theo chuỗi không dấu, `includes`, fuzzy, chuỗi chứa nhau. Bỏ khoảng trắng thừa và gộp khoảng trắng kép khi so khớp. Chuỗi bỏ dấu chỉ để **tìm kiếm UI**. `Xã Cẩm Giang` và `Xã Cẩm Giàng` là hai ID.
- `DisbursementRecord` thêm `inspectionMarker` từ P; `officialNote` từ Q; `adjustedScenarios[]` có `rawText`, `rateCandidate?`, `numerator?`, `denominator?`, `excludedItems[]`, `sourceCells[]`, `reviewStatus`. Ghi chú không tự cập nhật giá trị chính thức.
- `ReportSession`: thêm `sessionRevision`, `reportScope`, `customMetricDefinitions`, `calculationPolicyOverrides` (có audit), `qualityAcknowledgements`, `calculationTraceIndex`, `exportAuditOptions`. Phiên mới luôn `selectedLocalityIds=[]`.
- `QualityIssue`: `ruleId`, `severity`, `status`, `datasetId`, `rowId`, `localityId`, `fieldId`, `sourceCell`, `observed`, `expected`, `delta`, `threshold`, `explanation`, `acknowledgedAt?`; phân biệt **số lượt lỗi** với **số dòng khác nhau bị ảnh hưởng**.
- `CalculationTrace` và `SourceCellRef` theo §6A. Các field tính được phải dẫn đến trace; source raw phải dẫn đến provenance. Bộ quy tắc xuất report chỉ dùng engine thống nhất.

**Ràng buộc bất biến:** Dataset bất biến theo phiên bản, chỉ chỉnh bằng override có lý do; mỗi session ghim dataset ID/version. Cập nhật tệp mới tạo dataset mới, không đổi kết quả của báo cáo cũ khi chưa có chọn chủ động.


## 10. Quản lý nhiều phiên và lưu trữ không mất dữ liệu

**Phân biệt workspace và session:** một workspace là bộ hồ sơ số liệu gồm nhiều tệp nguồn/phiên bản; một session là cách chọn địa phương, chỉ tiêu, mốc và ngày chốt để lập một báo cáo cụ thể. Session A và B có thể dùng chung dataset nhưng có bảng/tùy chỉnh độc lập; đổi dataset ở A không tự đổi B.

Các chức năng: tạo, đặt tên, đổi tên, nhân bản, chọn đang mở, đóng (không xóa), xóa với xác nhận, sắp xếp và tìm kiếm session; lưu nhiều báo cáo chưa hoàn thành; hiển thị session có thay đổi chưa sao lưu. Mỗi lần chuyển session phải tự động ghi state hiện tại trong bộ nhớ, không mất chọn lọc/định dạng.

**Quan trọng về browser offline:** Với tài liệu `file://`, lưu trữ `localStorage`/IndexedDB có thể phụ thuộc trình duyệt, chính sách bảo mật và đường dẫn. Do đó:

1. Dùng IndexedDB nếu hỗ trợ để tự lưu tạm workspace khi chỉnh sửa, nhưng **không được quảng cáo đây là bản sao lưu bền vững duy nhất**.
2. Luôn có `Lưu toàn bộ bộ hồ sơ` → tải về một tệp `.kxh.json` (hoặc `.kxhpack`) chứa danh mục địa phương, giá trị nguồn chuẩn hóa, metadata/cell provenance, danh sách session, cấu hình, benchmark, audit và phiên bản schema. Không yêu cầu người dùng giữ lại nguyên tệp Excel sau khi đã đưa dữ liệu chuẩn hóa vào gói sao lưu (có thể chọn kèm workbook gốc vào gói nén, nhưng tùy nhu cầu dung lượng).
3. Có `Mở bộ hồ sơ`/`Nhập bản sao lưu` để khôi phục toàn bộ phiên cùng kết quả và cấu hình. Xác thực schema, kiểm tra hash/checksum, xem trước trước khi ghi đè; hỗ trợ nhập hợp nhất để không mất workspace đang có.
4. Có `Lưu riêng phiên` để đưa một session + tập dataset cần thiết ra tệp độc lập, nhập lại được.
5. Khi chưa xuất bản sao lưu mới, hiển thị trạng thái **'Chưa sao lưu ra tệp'**. Không thể âm thầm ghi file vào ổ đĩa bất kỳ nếu trình duyệt chưa được người dùng cấp quyền; tùy browser có thể dùng File System Access để ghi lại tệp đã chọn, nếu không thì tải về tệp mới.
6. Khi khởi động, tự kiểm tra khả năng lưu trữ cục bộ; nếu không hỗ trợ, ứng dụng vẫn chạy và yêu cầu lưu file sao lưu trước khi đóng. Không âm thầm xóa dữ liệu.
7. Nếu mở hai tab cùng một bản ứng dụng: cảnh báo nguy cơ ghi đè, sử dụng version lock/revision cho workspace nếu cơ chế lưu trình duyệt cho phép; giải pháp mặc định là không cho hai tab âm thầm ghi đè lên cùng một phiên.

### 10.1 Sao lưu cả công thức, quy tắc bỏ qua và lịch sử

Tệp sao lưu bắt buộc chứa dataset normalized, mapping, kỳ/ngày chốt, định danh địa phương, nhiều phiên, phiên bản công thức, cấu hình benchmark, cả chính sách xử lý null và các thủ tục xét ngoại lệ, nội dung ghi chú P/Q, danh sách chất lượng và metadata cần để dựng lại trace. Tệp backup phải tự kiểm checksum/trình tự phiên bản trước khi cho restore; hỗ trợ schema migration được kiểm thử. **Không** coi cache trong browser là bản lưu bền vững. Giao diện báo trạng thái chưa xuất sao lưu khi người dùng chuẩn bị đóng hoặc khi chuyển bộ hồ sơ.


## 11. Giao diện chi tiết và hành vi

**Trang A — Quản lý phiên:** sau khi mở app, không có phiên hoặc có danh sách phiên đã lưu. Nút `+ Phiên mới`. Form tạo gồm tên, mô tả tùy chọn, template chỉ tiêu; địa phương rỗng. Dưới mỗi phiên có tên, số địa phương, ngày cập nhật, các dataset đang dùng, trạng thái sao lưu. Có thể tạo `5 xã khu vực A` và `7 phường khu vực B`.

**Trang B — Nhập nguồn:** kéo thả nhiều `.xlsx`; tự nhận dạng loại bằng tiêu đề + cấu trúc; chọn profile nếu mơ hồ; chọn sheet; cho xem 10 dòng mẫu, số địa bàn, đơn vị nguồn theo cột; xác minh ngày chốt; kiểm tra tên địa phương trùng và lỗ hổng; xử lý cảnh báo; `Hoàn tất nhập` khi mọi metadata bắt buộc hợp lệ. Cho phép sửa mapping cột trong wizard nếu file mới thay layout; có bản ghi mapping cho lần sau.

**Trang C — Chọn địa phương:** ô tìm kiếm tiếng Việt có/không dấu; bộ lọc Xã/Phường/Đặc khu, theo trạng thái có dữ liệu; tick nhiều, chọn tất cả trong vùng, bỏ chọn; sắp xếp kéo thả; chỉ một địa phương xuất hiện một lần trong phiên. Hiển thị số địa phương được chọn và cảnh báo số chỉ tiêu thiếu nguồn.

**Trang D — Bảng báo cáo:** bố cục như mẫu gốc: cột trái STT/Chỉ tiêu, các địa phương chạy ngang, mỗi dòng là chỉ tiêu. Khi > số cột màn hình: cuộn ngang, ghim cột tên chỉ tiêu và tiêu đề. Có chỉnh độ rộng/cỡ chữ/đơn vị/ẩn nhóm, thêm dòng nhóm, nhân bản chỉ tiêu, đổi thứ tự, bật/tắt dòng mốc chung, dòng nhận xét. **GPMB chỉ hiển thị tỷ lệ `SUM(I)/SUM(D)` theo diện tích**, không có công tắc 'Bình quân dự án'. Có icon cảnh báo ở xã có dự án mà M nguồn lệch I/D; bấm xem danh sách dự án/ô nguồn và chênh lệch. Có danh sách tên xã/phường thiếu bản ghi REV/DISB/GPMB trong phần ghi chú theo từng nguồn, ngay trên UI và bản xuất.

**Trang E — Chi tiết ô và đối chiếu:** nhấn vào một ô → panel bên phải: giá trị hiển thị, số gốc chưa làm tròn, đơn vị, công thức, tử/mẫu, dataset nguồn, tên file/sheet/ô hoặc toàn bộ hàng dự án, ngày chốt, cảnh báo. Nút `Xem phép tính`, `Xem dữ liệu gốc`, `Nhập điều chỉnh có lý do` (không xóa giá trị nguồn). Bảng đối chiếu delta đơn vị và dữ liệu tham khảo.

**Trang F — Mốc so sánh và quy tắc:** lựa chọn mốc phù hợp từng nhóm chỉ tiêu; hiển thị dạng: `Giải ngân 114 địa phương: 67,10%, dữ liệu 15/10/2026 (10.434,92 / 15.550,92 tỷ)`; `Thu 113 địa phương: 111,30%, chưa đủ 114` và `GPMB 108 địa bàn có dự án: 72,13% (26/10/2026)`. Cấu hình ngưỡng `cao hơn`, `thấp hơn`, `rất thấp` bằng độ lệch điểm % hoặc ngưỡng tuyệt đối, trạng thái 'chưa có mốc' thì không sinh nhận xét.

**Trang G — Xuất/Lưu:** xuất XLSX với cell số numeric, định dạng %/tiền/diện tích; có sheet `Chỉ tiêu`, `Nguồn & thời điểm`, `Kiểm tra & cảnh báo` tùy chọn. In/PDF bằng trình duyệt, A4/A3 ngang/dọc, lặp header, cỡ chữ hợp lý, tự chia trang ngang. Sao lưu bộ hồ sơ toàn bộ và phục hồi. Không tự thêm nhận xét ngoài template khi xuất nếu người dùng không chọn.

### 11.1 Thao tác xem phép tính cho mọi ô

- Bấm chuột hoặc bàn phím vào bất kỳ ô báo cáo, số tổng, mốc, chênh lệch, tỷ lệ hay nhận xét để mở `Trace Inspector`.
- Tab `Công thức`: biểu thức dễ đọc bằng tiếng Việt; tab `Số hạng`: tử/mẫu, phép cộng từng bước; tab `Bản ghi được tính`: danh sách dự án/địa phương có ô nguồn; tab `Bỏ qua/không tính`: bản ghi, nguyên nhân, ảnh hưởng; tab `Nguồn & thời gian`: source file/sheet/cell/SHA/ngày; tab `Cảnh báo`: trạng thái và cách xử lý; tab `Lịch sử`: override, chốt/đổi chính sách.
- Mọi bảng lọc theo session: hiển thị cảnh báo của các địa phương đang chọn; bảng Import cung cấp thống kê toàn nguồn theo nhóm/số lần và số dòng. Cho phép bộ lọc INFO do làm tròn, WARNING vi phạm bản chất, ERROR/BLOCKER.
- Cột Q có ghi chú thì hiện biểu tượng chú thích cạnh tỷ lệ giải ngân, bấm xem nguyên văn và kịch bản loại trừ **không tự áp dụng**; cột P chỉ dùng làm metadata, không tự tạo phiên 11 xã.
- Có nút `Xem công thức mốc chung` trên từng dòng mốc; **tất cả mục bỏ qua phải ghi lý do**. Nếu một phép tính không thể tái hiện, UI hiển thị lỗi truy vết và không đánh dấu "đã xác minh".


## 12. Nhận diện và xử lý sai số/nguồn lỗi

Mức độ cảnh báo: `BLOCKER` (không thể nhập/xuất có trách nhiệm), `ERROR` (không tính chỉ tiêu liên quan), `WARNING` (vẫn tính nhưng có giải trình), `INFO` (thông tin minh bạch).

| Quy tắc | Phản ứng |
|---|---|
| Thiếu ngày chốt | `BLOCKER` tại bước nhập; yêu cầu người dùng xác nhận ngày |
| File không đúng profile | `BLOCKER` nếu không map được; chuyển wizard ánh xạ |
| Ô công thức Excel `#VALUE!`/`#REF!` | `ERROR` cho chỉ tiêu đó; cho phép tính lại **chỉ công thức nghiệp vụ chuẩn đã biết** khi có đủ thành phần |
| Thiếu một địa phương trong nguồn | `NO_LOCALITY_RECORD`, nêu **đúng tên địa phương** và nguồn, không thay 0; report coverage toàn nguồn và theo phiên |
| Có địa phương nhưng thiếu một trường/dự án | `FIELD_MISSING` hoặc `PARTIAL_AGGREGATE`, ghi địa phương, ô/dự án, số lượng và tác động, không gọi thiếu toàn địa phương |
| Trùng tên khác loại địa phương | Đối chiếu mã/loại, yêu cầu xác nhận liên kết |
| GPMB I>D hoặc K>E | `WARNING` với vị trí ô và số liệu nguồn |
| Tiền GPMB J>G | `WARNING` kiểm tra phạm vi phân bổ/chi |
| Tỷ lệ nguồn M dòng **dự án** lệch `100*I/D` >0,1 điểm % | `WARNING_M_RATIO_MISMATCH`; dùng I/D để tính theo diện tích địa bàn, ghi dòng D/I/M và delta, không so M dòng tổng địa bàn |
| Mốc nguồn 113/108 nhưng nhãn người dùng ghi 114 | `BLOCKER` đối với nhãn sai; đề nghị đổi đúng phạm vi |
| So sánh mốc khác thời điểm/phạm vi | `WARNING` + yêu cầu xác nhận rõ; trên bản xuất có chú thích |
| Tỷ lệ vượt 100% | `WARNING`, giữ nguyên giá trị, không cắt ngưỡng |
| Mẫu số 0 | hiển thị `Không có cơ sở`/`Phát sinh ngoài kế hoạch`, không chia 0 |
| Công thức custom có lỗi chu trình hoặc không hợp lệ | `ERROR` tại editor; không cập nhật chỉ tiêu |
| File Excel mới khác cấu trúc | tạm dừng nhập, hiển thị mapping cũ/mới và bản xem trước |

Không so sánh `GPMB_BUDGET` từ báo cáo dự án với `DISB_GPMB_PAID` từ giải ngân như hai vế của cùng tỷ lệ nếu chưa xác minh danh mục, phạm vi chủ đầu tư và thời điểm.

### 12.1 Bộ quy tắc cảnh báo đã được kiểm chứng

| Nhóm | Số liệu tham chiếu | Cách hiển thị |
|---|---|---|
| GPMB vượt số phải thực hiện | 13 `I>D`, 14 `K>E`, 24 `L>F`; 48 `J>G` | WARNING theo dự án, không tự kết luận sai nghiệp vụ |
| GPMB tỷ lệ M khác I/D >0,1 điểm % | 12 lượt | WARNING; lệch nhỏ (≤0,1) INFO nếu cần |
| GPMB nhóm 5 rule trên | 111 lượt cờ trên 90 dự án riêng biệt | Đếm riêng lượt và dự án; không gắn nhãn 113 dự án vi phạm |
| GPMB thiếu I | 3 dòng, D tổng 11.459 m² | WARNING và đánh cờ PARTIAL_AGGREGATE trên tổng liên quan |
| DISB G/J/M/N trống | 296 ô trên 104/114 dòng | Không cảnh báo giả từ `SUM` ngang; vẫn lưu missing và bộ kiểm chứng |
| DISB ghi chú Q/P | 25 ghi chú Q, 11 marker P | Hiển thị context/cảnh báo phương pháp; kịch bản điều chỉnh phải xác minh |
| Sheet hidden | DISB 7 hidden; REV 1 hidden, 2 veryHidden | Chỉ visible được auto chọn; hidden chỉ mở theo quyết định thủ công |

Trang Import hiển thị nhóm cảnh báo, số lượt, số dòng, filter theo rule; trang Báo cáo lọc theo các địa phương đã chọn. Thay đổi ngưỡng hiển thị không được tự sửa giá trị raw. Đưa vào trace từng cờ có liên quan và cách xử lý đã chọn.


## 13. Tùy chỉnh nâng cao

- **Danh mục chỉ tiêu:** tạo một indicator mới từ trường nguồn hoặc công thức có `id`, nguồn, đơn vị, nhãn, độ chính xác, phương pháp tổng hợp, nhãn tham chiếu. Áp dụng công thức khác nhau theo địa phương/nhóm với điều kiện hiển thị.
- **Danh mục bảng:** tạo template mới từ bảng hiện tại; thay thứ tự/nhóm và cột, lưu template chỉ tiêu riêng (không nhân bản dữ liệu nguồn). Lưu các mẫu `Báo cáo thu`, `Báo cáo giải ngân`, `GPMB`, `Báo cáo tổng hợp`.
- **Quy tắc so sánh:** mốc chọn theo chỉ tiêu, so sánh với 114 nếu đủ dữ liệu, toàn thành phố nếu có nguồn riêng, 113/108 tham khảo khi xác nhận; thể hiện phương pháp và ngày ở đầu nhóm.
- **Định dạng:** số chữ số, dấu phân tách, ẩn số 0, trống, NA, màu cảnh báo, font, căn lề, độ rộng cột, tiêu đề, logo tùy chọn (không yêu cầu logo).
- **Phiên làm việc:** nhân bản phiên giữ thiết lập nhưng không ghi đè, phiên thay đổi nguồn tạo revision, có lịch sử ai/cái gì/đã sửa vì sao (vì app không có tài khoản, 'người thực hiện' là nhãn do người dùng tự khai báo nếu cần).
- **Tìm kiếm:** không dấu/không phân biệt hoa thường, theo mã địa phương, loại, tên, có dữ liệu; tìm trong bảng theo nhãn chỉ tiêu hoặc số liệu.
- **Phạm vi:** có thể chọn số lượng địa phương bất kỳ. Nếu hơn số cột có thể in một trang, hỗ trợ phân trang thông minh, không co chữ xuống mức không đọc được.

### 13.1 Tùy chỉnh có kiểm soát và không xóa tính minh bạch

Người dùng được tạo nhóm chỉ tiêu mới, chọn kiểu tổng `SUM`, `RATIO_OF_SUMS` và công thức tùy chỉnh có kiểm tra đơn vị, điều kiện lọc và ngoại lệ, so sánh khác kỳ khi có phê duyệt. **Không cho phép tạo chỉ tiêu GPMB chính thức bằng bình quân tỷ lệ dự án hoặc nguồn M tổng địa bàn**. Mỗi công thức tùy chỉnh cần `name`, `description`, `formulaId/version`, AST, sourceFields, unit, expectedScope, nullPolicy, exclusionPolicy, roundingPolicy, ownerEditReason`; lưu lịch sử thay đổi. **Không cho phép một chỉ tiêu tùy chỉnh tắt trace, đổi MISSING thành 0 không lý do hoặc ghi nhãn 114 khi thực tế 113.**


## 14. HAI KẾ HOẠCH CON — triển khai tuần tự và nghiệm thu độc lập

**Tài liệu thực thi bắt buộc:** [Kế hoạch con 1 — sản phẩm theo bảng mẫu](../plans/PHASE_1_RESULT_TEMPLATE.md) và [Kế hoạch con 2 — mở rộng hệ thống](../plans/PHASE_2_EXTENSIBILITY.md). Hai kế hoạch là **một phần quy phạm của MASTER V2.2**, không phải ví dụ tùy chọn. Các pha P0–P7 cũ là lịch sử V2.1, **không dùng làm thứ tự bàn giao hiện hành**.

| Kế hoạch | Mục tiêu trọng tâm | Điều kiện nghiệm thu | Phụ thuộc |
|---|---|---|---|
| **PH1 — Bảng KTXH theo mẫu kết quả** | Tạo app offline **dùng được ngay** cho đúng 14 dòng của `RESULT_REFERENCE!Sheet1` (dòng 3–16): chọn địa phương bất kỳ, nhập đủ 3 nguồn, tính toán, coverage có tên, cảnh báo M/I/D, UI tùy chỉnh, multi-session, trace, in/XLSX/backup | Có build chạy thật `dist/index.html`, số liệu kiểm chứng, chọn 5 xã/7 phường, báo cáo và export cùng đúng số, QA offline và bằng chứng cổng PH1 | **BẮT ĐẦU TRƯỚC**; không yêu cầu có mapping tổng quát hoặc AST tự do |
| **PH2 — Mở rộng/tùy biến hệ thống** | Bộ đọc nguồn đổi cấu trúc/đổi kỳ, mapping wizard, chỉ tiêu công thức an toàn nhiều loại, nhiều template, kịch bản đặc biệt, export và QA nâng cao | Tất cả T01–T66 PASS trên SHA được test, không hồi quy PH1, mở file:// offline, versioning và backup có chứng cứ | **Chỉ bắt đầu sau khi có kết quả nghiệm thu PH1**; kế thừa engine/giao diện đã PASS |

### 14.1 Các hạng mục được bảo vệ khỏi bị trì hoãn sang PH2

PH1 **không chỉ là UI giả lập**: bắt buộc có bộ 3 adapter cho các file tham chiếu, đọc metadata, ngày chốt độc lập, chuẩn hóa đơn vị, calculation engine Decimal, benchmark tổng/tổng, phân biệt 0/null/error, toàn bộ trace, bảo toàn nhiều phiên, xuất Excel/PDF và backup/restore. PH1 phải xử lý bảng mẫu 14 dòng một cách linh hoạt với **0 địa phương mặc định**; các kết quả tính phải đến từ dữ liệu Excel, không hardcode 11 xã trong template. Không thể đánh dấu PH1 PASS chỉ vì tạo được file HTML.

PH1 **tùy chỉnh được**: tiêu đề/dòng/nhóm/nhãn; chọn, thêm, bỏ, sắp xếp xã/phường/đặc khu; bật/tắt chỉ tiêu/mốc/nhận xét; tỷ đồng/triệu, m²/ha, độ chính xác, font/cỡ chữ/chiều rộng, màu, ngưỡng/diễn giải; lưu lại theo từng session và xuất theo tùy chọn. Các biến đổi không được ghi đè định nghĩa chỉ tiêu chuẩn hoặc tự bịa benchmark.

Chỉ các tính năng **mở rộng ngoài dữ liệu/chỉ tiêu mẫu** mới đưa sang PH2: profile importer động/mapping với Excel bố cục mới, AST công thức tự do, nhiều kỳ và so sánh version, template không giới hạn, xuất hành chính phức tạp, phân tích nâng cao. Trong PH2 không được bỏ những kiểm tra đã PASS của PH1.

### 14.2 Gate và thứ tự kiểm thử

- **Gate PH1:** thực hiện PH1-01…PH1-06 tại kế hoạch con 1; kiểm thử tất cả quy tắc tính/chất lượng liên quan bộ mẫu (T01–T58), ghi `DEFERRED_BY_SCOPE` minh bạch cho test chỉ đòi mapping/AST/kịch bản đa kỳ nằm PH2; các ca **T59–T65** phải PASS bằng dữ liệu và runtime của PH1. Ở PH1, `T05`, `T35`, `T45` thay điều kiện cũ bằng yêu cầu **KHÔNG tính/hiển thị bình quân M**.
- **Gate PH2:** hoàn thành PH2-01…PH2-06; chạy lại toàn bộ **T01–T66** (gồm các test có phạm vi PH2), 100% test PASS có evidence trên commit SHA mới. Chỉ tuyên bố DONE dự án khi cả PH1 và PH2 nghiệm thu.
- **Checkpoint:** trước và sau mỗi gói, ghi dữ liệu nguồn SHA, branch và commit, logic/từ điển thay đổi, kết quả test thực, ảnh hưởng sang kế hoạch con còn lại, bug còn mở. Không thừa nhận PASS trên commit cũ nếu code mới có ảnh hưởng mà chưa regression.

## 15. Test cases bắt buộc (dữ liệu thật và tình huống)

### A. Tính toán và phạm vi

- `T01` – 114 địa phương giải ngân: `ΣF=15.550.923,159 triệu`, `ΣI=10.434.921,777 triệu`. `I/F=67,10%`; ứng dụng **không** hiện 76,46% làm tỷ lệ chuẩn 114.
- `T02` – Mức vốn giao bình quân 114 địa phương: `15.550.923,159/114=136.411,60666 triệu ≈136,41 tỷ/địa phương`.
- `T03` – Thu 113 địa phương: `ΣC=25.651.713 triệu`, `ΣI=28.550.929,455 triệu`; `I/C=111,30%`. Trace/kiểm toán benchmark ghi **113**, cảnh báo thiếu Đặc khu Bạch Long Vĩ; nhãn bảng chính ghi quy ước 114 theo mục 3.
- `T04` – GPMB 108 địa bàn: `ΣD=55.398.165 m²`, `ΣI=39.960.463,6 m²`; theo diện tích **72,13%**. Không lấy bình quân tỷ lệ các dòng địa bàn.
- `T05` – Xã Hồng Châu: `D=119.280 m²`, `I=35.897 m²`, theo diện tích **30,09%**. Bảng báo cáo/Excel/PDF **chỉ** hiển thị tỷ lệ 30,09%, không tạo/cho chọn bình quân tỷ lệ các dự án; nếu nguồn có chỉ số M tổng xã khác thì không dùng để tính/ghi đè tỷ lệ.
- `T06` – Với một nhóm 11 xã mẫu, tỷ lệ GPMB theo diện tích của **nhóm được chọn** ~**76,97%** (theo dữ liệu 26/10). Không coi đây là tỷ lệ chuẩn 114 hoặc 108.
- `T07` – Tổng thành phố giải ngân: `I7=31.833.882,636 triệu`, `F7=46.150.296,085 triệu` ⇒ nguồn hiển thị ~68,98%. Nếu loại khoản I145=251.163 triệu ngoài kế hoạch thì ~68,43%. Cả hai có mô tả phạm vi; không thay benchmark địa phương 67,10%.

### B. Đơn vị và giá trị

- `T08` – Thu xã Hồng Châu từ `REV C` = **32.845 triệu** ⇒ **32,845 tỷ đồng** nội bộ, hiển thị 32,85 nếu 2 chữ số. Không hiểu là 32.845 tỷ.
- `T09` – Giải ngân xã Hồng Châu `DISB F` = **35.680,778561 triệu** ⇒ **35,680778561 tỷ đồng**.
- `T10` – Kinh phí GPMB xã Hồng Châu `G` cộng = **56.141.672.000 đồng** ⇒ **56,141672 tỷ đồng**; diện tích 119.280 m² = 11,928 ha.
- `T11` – Tân An kinh phí GPMB 3,125385 tỷ ⇒ hiển thị 3,13 tỷ khi làm tròn 2 chữ số; Lạc Phượng vốn giải ngân 38,644618586 tỷ ⇒ 38,64 tỷ.
- `T12` – Nhập chuỗi `119.280 m2`, `32,8 tỷ`, `119.71`, `3.125385 tỷ`: số phải được đọc phù hợp ngữ cảnh cột/đơn vị; input mơ hồ phải hỏi, không tự chọn sai.
- `T13` – Mẫu số 0 và có thu >0: hiển thị `Phát sinh ngoài dự toán`, không `Infinity` hoặc 0%; ô trống, ô 0, ô lỗi là 3 trạng thái riêng.

### C. Thời gian, phiên và lưu trữ

- `T14` – Import giải ngân tự phát hiện 15/10/2026; GPMB 26/10/2026, yêu cầu xác nhận; nguồn thu không tự điền chốt 31/10 hay 19/10; wizard yêu cầu ngày chốt thực tế.
- `T15` – Có thể tạo session A gồm 5 xã và B gồm 7 phường; không chọn sẵn địa phương trong A/B. Sửa A rồi chuyển B rồi quay lại A: giữ thứ tự, chỉ tiêu, mốc và ngày nguồn của cả hai.
- `T16` – Nhân bản A thành C, thay danh sách ở C không làm thay đổi A. Xóa B cần xác nhận. Lưu toàn workspace → đóng browser → mở lại → nhập backup → giữ A/C và dữ liệu nguồn.
- `T17` – Người dùng nhập phiên bản REV mới: A tiếp tục dùng phiên bản cũ, B có thể chuyển sang bản mới nếu chọn; không tự thay lịch sử của A.
- `T18` – In bảng 5 địa phương và 20 địa phương; không mất cột, tiêu đề/đơn vị/ngày chốt được hiển thị; export XLSX vẫn là ô số thực.

### D. Chất lượng, lỗi và bảo mật

- `T19` – Khóa công thức lỗi `#VALUE!` tại C7 file giải ngân không làm app hỏng; hiện lỗi nguồn và không tự đặt 0. Một bản copy XLSX đổi vị trí cột B/C/F phải bật mapping wizard.
- `T20` – Không tạo dữ liệu thu cho Bạch Long Vĩ nếu nguồn không có; không thêm 0 vào benchmark 113. Không tính 'bình quân 114' từ 113 mẫu.
- `T21` – GPMB M nguồn >100% và `I>D`: giữ số thực, cảnh báo; dự án trùng tên khác địa bàn không bị gộp sai.
- `T22` – Ngắt hoàn toàn Internet + mở `dist/index.html` trên Chrome và Edge, nhập 3 tệp, tạo bảng, lưu backup, xuất Excel và in PDF thành công. DevTools Network không có request tới máy chủ ngoài.
- `T23` – Nội dung chuỗi trong XLSX như `<script>` chỉ được hiển thị text, không chạy mã; macro và liên kết ngoài không thực thi; công thức chỉ tiêu tùy chỉnh không cho `eval`.
- `T24` – File backup sai schema hoặc hỏng checksum phải bị từ chối nhập mà vẫn giữ workspace đang mở. Mọi action mất dữ liệu có bước xác nhận.

### E. Phản biện R01 đã tích hợp (T25–T32)

- `T25` — Import DISB ghi nhận đủ 25/114 Q có note và 11 marker P, không chọn sẵn 11 xã theo P.
- `T26` — `O18` ~58,35%, Q18 nêu 94% theo loại trừ; hiện cả hai nhãn đúng, không tự dùng 94% vào I/F hay benchmark khi thiếu tử/mẫu.
- `T27` — Q7 nhiều tỷ lệ 83%, 86%, 76% và mức 5% tiết kiệm; không tự bắt một con số bằng regex làm tỷ lệ chính thức.
- `T28` — `Xã Cẩm Giang` và `Xã Cẩm Giàng` có hai localityId; trim đúng tên `Xã Thanh Miện `; không nhầm Hưng Đạo/Trần Hưng Đạo hoặc Thanh Miện/Nam Thanh Miện.
- `T29` — GPMB rule count tại dung sai 0,1 điểm %: I>D 13, J>G 48, K>E 14, L>F 24, M dòng **dự án** khác I/D 12; 111 lượt cảnh báo/90 dòng dự án khác nhau (không gồm missing). Không so M dòng tổng xã; warning M không tự sửa ô nguồn.
- `T30` — Báo cáo chọn 5 xã chỉ hiện cờ tương ứng trong lưới; dashboard import vẫn có tổng toàn nguồn và tách INFO/WARNING.
- `T31` — Đổi tên tệp nhưng giữ cấu trúc vẫn nhận dạng; sai cấu trúc mở mapping; không lấy 22/10 ở P, 25/9 trong Q làm ngày chốt.
- `T32` — XLSX thực xuất mở bằng Microsoft Excel đúng font Times New Roman, border, căn lề, width, số thật, A4/A3, các sheet audit; build offline không request mạng.

### F. Phản biện R02 đã tích hợp (T33–T40)

- `T33` — Dòng GPMB 107, 173, 365: raw I/J/K/L/M vẫn MISSING, D > 0, có đúng cờ thiếu kết quả tương ứng.
- `T34` — GPMB 422 dự án, tổng D 55.398.165, recorded I 39.960.463,6, recorded rate 72,13% **PARTIAL_AGGREGATE**, 11.459 m² thuộc 3 dòng thiếu I.
- `T35` — Kinh Môn: recorded rate **84,51%**, có 4 dự án trong D, 3 dự án có I và dòng 107 thiếu I; status `PARTIAL_AGGREGATE`. Không tạo chỉ tiêu bình quân M từ dòng nhóm M105 hoặc từ 3/4 dự án.
- `T36` — 114 địa phương DISB có 67 trống G, 67 J, 60 M, 102 N = 296 ô trên 104 dòng khác nhau.
- `T37` — 114/114 dòng cân đối `F=G+H`, `I=J+K`, `I=L+M+N` theo chính sách add-missing có kiểm soát; trace các phép có ô null phải ghi `PASS_WITH_MISSING_COMPONENTS`.
- `T38` — Thành phần DISB null vẫn MISSING khi xem độc lập; ô lỗi/tổng thiếu/tất cả số hạng thiếu/tổng lệch không được PASS giả bằng quy tắc coalesce.
- `T39` — Workbook DISB auto chọn `Tổng hợp` index 5, không chọn `DA trọng đểm NQ 174` index 0 bị hidden.
- `T40` — Workbook REV có visible `10T-19.10`, hidden `Sheet1`, veryHidden `bc`, `TMS`; không auto pick sheet ẩn, manual review vẫn xem được kèm cảnh báo.

### G. Bổ sung nguyên tắc 11 — Giải trình mọi phép tính (T41–T52)

- `T41` — Mỗi ô SOURCE_VALUE có file/sheet/cell/SHA/ngày chốt/raw/đơn vị và chỉ rõ không phải phép tính ứng dụng. Với ô công thức nguồn, xuất cả source formula và cached status.
- `T42` — Mỗi ô CALCULATED (gồm tổng, tỷ lệ, bình quân, chuyển đổi, mốc, chênh lệch, nhận xét) có `traceId`, công thức dễ đọc, ID và phiên bản, đầu vào chưa làm tròn và các bước tính. Quét 100% ô tính trong một báo cáo test, không có ô nào thiếu trace.
- `T43` — Tỷ lệ giải ngân 114 địa phương trace có 114 included, tổng tử 10.434.921,777 triệu, mẫu 15.550.923,159 triệu, đúng 67,10%; ghi ngày 15/10 và không dùng AVERAGE 114 tỷ lệ.
- `T44` — Benchmark REV chỉ có 113/114, ghi 1 địa phương thiếu (Bạch Long Vĩ) trong coverage, loại theo `OUT_OF_SCOPE/SOURCE_NOT_PRESENT` chứ không bù 0; tỷ lệ vẫn 111,30% của **113**, không gọi 114.
- `T45` — GPMB Kinh Môn trace liệt kê 4 dự án D tham gia, 3 dự án có I và 1 thiếu I107, lý do thiếu và diện tích 5.050; recorded 84,51% `PARTIAL_AGGREGATE`. Nếu người dùng xem M105 trong nguồn, đây là nguồn thô không phù hợp với tỷ lệ theo diện tích; **không** sinh bình quân M.
- `T46` — Toàn danh mục GPMB trace có 422 dự án mẫu số, 419 dự án có I số, 3 dự án thiếu I, diện tích liên quan 11.459; UI/XLSX/PDF nhất quán về 72,13% và quality PARTIAL.
- `T47` — `F=G+H` với G null cân đối được nhưng trace lưu G là MISSING, status PASS_WITH_MISSING_COMPONENTS, giải thích chỉ sử dụng phần tử trung hòa để đối chiếu; xem G riêng không thành 0.
- `T48` — Đổi tiền `35.680,778561 triệu → 35,680778561 tỷ`: trace có phép chia 1000, cả đơn vị trước/sau, không làm tròn trước khi tính tỷ lệ; xuất 2 chữ số chỉ tại bước display.
- `T49` — Bật kịch bản loại trừ theo ghi chú Q chưa đủ tử/mẫu ⇒ `MANUAL_UNVERIFIED` và không dùng benchmark/nhận xét; khi có chứng cứ và xác nhận, trace lưu danh sách khoản loại, lý do, ảnh hưởng cả tử và mẫu.
- `T50` — Custom formula cố gắng bỏ ô invalid/khác ngày/khác phạm vi mà không có policy/approval ⇒ FAIL và hiển thị lý do; công thức có vòng lặp/`eval`/sai đơn vị phải bị chặn.
- `T51` — Backup → đóng app → restore: 2 phiên, source IDs, policy versions, exclusion reason và trace tái tạo khớp bitwise số Decimal; không ghi đè lịch sử cũ.
- `T52` — Xuất XLSX có các sheet `Báo cáo`, `Danh mục công thức`, `Nhật ký phép tính`, `Bản ghi không tính`; mọi ô tính có trace ID để truy lại. PDF có ghi phương pháp, phạm vi, ngày chốt và khả năng xuất phụ lục trace. Không có phần tử loại trừ vô lý do.

### H. Phản biện R04 — tỷ lệ có dòng ZERO và hoàn chỉnh từ điển thu đất (T53–T58)

- `T53` — REV dòng `D15,D26,D42,D57,D114 = 0`, `R>0`: ở cấp địa phương `REV_LAND_RATE_Y` hiển thị *Phát sinh ngoài dự toán* (`DENOMINATOR_ZERO`), không 0%, không `Infinity` và không tự đánh dấu dòng `EXCLUDED` khỏi benchmark.
- `T54` — Benchmark `REV_LAND_RATE_Y` trên đúng 113 dòng 11–123 phải có `SUM(R)=9.777.655,455 triệu`, `SUM(D)=7.182.893 triệu`, tỷ lệ **136,12%**; `includedRecordIds` giữ cả 5 dòng D=0 cùng `zeroDenominatorContributors` tổng 269.290 triệu. Kết quả khớp nguồn `Y10=R10/D10`.
- `T55` — Unit test chống hồi quy: bộ lọc sai `D_i>0` hoặc chỉ lấy những dòng có tỷ lệ Y hợp lệ sẽ cho khoảng **132,38%**; engine phải từ chối công thức benchmark đó hoặc gắn kết quả FAIL và truy vết **269.290 triệu** tử số bị bỏ sai, không nghiệm thu.
- `T56` — Benchmark `REV_LAND_RATE_P` cho 113 dòng phải bao gồm 6 dòng G=0, R>0 (15,26,28,42,57,114), tổng R nhóm này **304.790 triệu**; `SUM(R)/SUM(G) = 9.777.655,455/4.823.476 = 202,71%` khớp `AB10`. Bỏ sai 6 dòng cho khoảng **196,39%**, phải FAIL. Riêng dòng 28 ghi *Phát sinh ngoài kế hoạch*.
- `T57` — `DATA_DICTIONARY` và UI cấu hình phải có đủ 6 mã tỷ lệ REV, đối chiếu X:AC: `REV_RATE_Y=I/C`, `REV_LAND_RATE_Y=R/D`, `REV_NONLAND_RATE_Y=W/E`, `REV_RATE_P=I/F`, **`REV_LAND_RATE_P=R/G`**, `REV_NONLAND_RATE_P=W/H`. Cả sáu hoạt động trên tập đơn vị tùy chọn và nguồn có giá trị/0/blank.
- `T58` — Phân biệt trong trace `ZERO` hợp lệ với `MISSING/ERROR`: nếu chọn nhóm chỉ gồm dòng có `D=0`, tổng thực thu dương vẫn giữ nhưng `SUM(D)=0` → tỷ lệ nhóm `DENOMINATOR_ZERO`, không 0%; nếu thêm một địa phương `D>0`, tỷ lệ được tính từ tất cả tử/mẫu của tập và giải thích những dòng có D=0. Xuất XLSX và PDF thể hiện đồng nhất phương pháp, phạm vi, lượng thực thu ngoài dự toán và các lý do loại trừ thực tế.

### I. R06 — hai kế hoạch con, bỏ bình quân dự án, liệt kê địa phương thiếu (T59–T66)

- `T59` — Bảng chính của PH1 cho 5 xã hoặc 7 phường **chỉ có tỷ lệ GPMB theo `SUM(I)/SUM(D)`**; toàn UI/menu/template/XLSX/PDF không có chỉ tiêu hoặc tùy chọn bình quân tỷ lệ M. Hồng Châu = 30,09%; không hiển thị một tỷ lệ khác lấy từ AVG(M).
- `T60` — 422 dòng dự án GPMB: chỉ so M nguồn với `100*I/D` khi A là số dự án, D>0 và I/M numeric. Có đúng **12 warning** với `abs(delta)>0,1 điểm phần trăm` (bộ tệp gốc); mỗi warning chứa ô D/I/M, mã dự án, nguồn, I/D tính lại, M và mức chênh. Dòng tổng xã M không bị đưa vào rule; 3 dự án I trống có cờ thiếu riêng.
- `T61` — Theo danh mục DISB 114, REV có đúng 113 địa phương, thiếu **Đặc khu Bạch Long Vĩ** với trạng thái `NO_LOCALITY_RECORD`, không tự thêm 0; UI quản lý nguồn/session, sheet kiểm toán XLSX và phụ lục kiểm toán PDF nêu rõ tên và phạm vi thực tế; nhãn bảng chính ghi quy ước 114 theo mục 3.
- `T62` — Theo danh mục DISB 114, GPMB có đúng 108 địa bàn; danh sách `NO_LOCALITY_RECORD` đúng sáu tên **Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ**. Không tạo giá trị 0% hoặc kết luận 'không có dự án' từ danh sách vắng mặt.
- `T63` — Kinh Môn/ Tân Hưng/ Kiến Hưng vẫn có địa bàn trong GPMB nhưng thiếu I ở dòng 107/173/365; là `FIELD_MISSING` và `PARTIAL_AGGREGATE`, không phải `NO_LOCALITY_RECORD`. DISB có 296 ô thành phần trống nhưng không thiếu 114 dòng địa phương; `ZERO_VALID` phải khác `FIELD_MISSING`.
- `T64` — Hai phiên A (5 xã) và B (7 phường) có bộ báo thiếu theo nguồn/phiên riêng, ngày chốt và mốc 114/113/108 đúng; nhân bản/sao lưu/khôi phục không đổi các trạng thái thiếu hoặc tự thêm xã.
- `T65` — XLSX phải có sheet `Nguồn thiếu & lý do` và hồ sơ trace đúng nguồn/ô/kỳ, phạm vi, phương pháp GPMB và cờ M/I/D. PDF báo cáo sạch không có footer nguồn; phụ lục kiểm toán riêng hỗ trợ xuất khi cần. Không được bỏ hồ sơ giải trình khi bỏ footer.
- `T66` — **Gate PH1/PH2**: PH1 chỉ PASS khi lập báo cáo 14 dòng thật từ ba nguồn trong trình duyệt offline, tùy chỉnh, lưu nhiều phiên, QA số và cảnh báo; các bài test thuộc PH2 phải đánh dấu `DEFERRED_BY_SCOPE`, không ghi PASS giả. PH2 chỉ PASS khi nâng cấp từ commit PH1 và T01–T66 thực chạy PASS không hồi quy.

**Cổng test:** T01–T66 là bộ kiểm thử logic/báo cáo bắt buộc trên toàn bộ sản phẩm. PH1/PH2 có hai cổng nghiệm thu riêng, phân phạm vi theo §14 và hai kế hoạch con;  Với số kỳ vọng trong T01–T40 và T59–T65, kiểm thử trên 4 nguồn có SHA tại §2.1 và `docs/data_checks/REFERENCE_COVERAGE_20261109.json`. Các kết quả được so sánh trên Decimal gốc rồi mới áp dung sai hiển thị. Lập báo cáo T01–T66 PASS/FAIL/DEFERRED_BY_SCOPE có commit SHA (khi đã có repository), phiên bản file, phiên bản engine và bằng chứng. Không tự công bố PASS nếu chưa chạy thật.


## 16. Các điểm quyết định mặc định cho AI khi triển khai

Để tránh AI khác hỏi lại các quyết định đã chốt:

- Bản đầu **không có địa phương mặc định**; có thể hiển thị một template báo cáo, nhưng cột địa phương để trống cho đến khi chọn.
- Template đầu tiên là `Tổng hợp chỉ tiêu KTXH` dựa trên bảng 11 xã, sửa tên các chỉ tiêu đang gây hiểu lầm theo đúng phép tính.
- GPMB **chỉ** dùng tỷ lệ theo diện tích; **không có** lựa chọn, báo cáo hay dòng tham khảo bình quân tỷ lệ dự án. M nguồn chỉ dùng QC so với I/D cho từng dự án.
- Benchmark phần trăm là tổng/tổng; benchmark tiền vốn bình quân là tổng vốn/số đơn vị.
- Thiếu 114: chỉ trình bày mốc 113 hoặc 108 như **mốc tham khảo có cảnh báo**; nếu có tổng thành phố thực sự tương thích thì cho người dùng chọn mốc thành phố và hiển thị nguyên phạm vi; nếu không có nguồn, không tự bịa.
- Dữ liệu thu kỳ '10 tháng' cần xác nhận ngày cụ thể, không mặc định theo tên file.
- Người dùng có thể tùy chỉnh đến mức tạo template mới mà không sửa code; song những ràng buộc cứng về provenance, đơn vị, ngày và phạm vi không được tắt hoàn toàn.
- Không tự động ghi đè file trên ổ đĩa khi không có quyền; bản sao lưu `.kxh.json` là cơ chế khôi phục chính, lưu trình duyệt là tiện ích.
- **Bàn giao hai cổng:** PH1 phải có `index.html` offline hoạt động theo mẫu 14 dòng, source, 3 profile nhập cố định, template, coverage, QC M, trace, test và bằng chứng; PH2 mở rộng và cần T01–T66 toàn bộ PASS. Không cần backend, cloud, login, AI, OCR, các API.

### 16.1 Chọn kỹ thuật và tuân thủ bảo mật

- Trình duyệt mở `file://.../index.html` phải hoạt động khi tắt Internet. **Không phụ thuộc** PWA, Service Worker, CDN, Google Fonts hoặc backend. Dùng TypeScript, cấu trúc module kiểm thử được, build một file HTML có JS/CSS và thư viện bundle nội tuyến. Cần xác minh các dependency có phép dùng phù hợp và khóa phiên bản.
- Reader XLSX: profile adapter đọc cached values và source formula/metadata khi sẵn có; không chạy VBA/macro hoặc liên kết ngoài. UI escape toàn bộ chuỗi từ Excel; khi xuất ngăn formula injection từ chuỗi bắt đầu `=`, `+`, `-`, `@` theo ngữ cảnh.
- Writer XLSX: P0 thử **ExcelJS browser bundle** hoặc **xlsx-js-style** (hay giải pháp tương đương có bằng chứng). Không coi SheetJS Community Edition là đáp ứng hoàn toàn định dạng nâng cao; không phủ nhận khả năng width của nó. Chọn thư viện theo thử nghiệm font Times New Roman, border, merge, background, numeric `%`, print layout, file:// và size/performance.
- Decimal engine dùng Decimal chính xác; không dùng `Number` nhị phân làm giá trị cuối cho đồng/triệu/tỷ khi vượt sai số, không biến 0 và null thành cùng một giá trị.
- Không telemetry, không gửi dữ liệu ra dịch vụ ngoài khi ứng dụng chạy offline. Ngoại lệ GitHub được chủ dự án phê duyệt: bốn tệp tham chiếu và các mẫu nguồn gốc đúng phạm vi dự án được cung cấp, đăng ký theo mục 7 (Public được xác nhận 25/11/2026). App không tự commit raw XLSX hay backup cá nhân; không đưa dữ liệu ngoài phạm vi, bí mật hoặc thông tin cá nhân. Không gọi external network, không thực thi công thức tùy chỉnh bằng eval.
- Cơ chế lưu trong trình duyệt chỉ là cache hỗ trợ; lưu/nhập `.kxh.json` hoặc `.kxhpack` có checksum và version là chức năng chính để chống mất nhiều phiên.

### 16.2 Quy tắc làm việc trên GitHub cho AI/Codex

- Repository thực tế được kết nối: `cavoixanh638/KTXD-report`, public (**tên repo KTXD khác tên sản phẩm KTXH**, không tự đổi tên repo), có `README.md`, `AGENTS.md`, tài liệu chuẩn `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md`, hai kế hoạch `docs/plans/` và thư mục `src`, `tests`, `docs/status`, `docs/reviews`, `tools`. Không gộp code vào repository không liên quan khi chưa có yêu cầu.
- Trước mỗi pha: đọc tài liệu **MASTER V2.2 và PH1/PH2** rồi ghi checkpoint gồm tình trạng/branch/HEAD SHA/test đã chạy/dữ liệu SHA/issue còn mở. Ghi nhận từng commit và mã kiểm thử có chứng cứ; không đánh dấu DONE theo nhận xét của AI khác.
- V1, R01, R02, đề xuất trước đây là **hồ sơ lịch sử**. V2.1 là đặc tả quy phạm hợp nhất, không đòi lập trình viên ghép nhiều file. Nếu đề xuất sửa V2.2, mở `CHANGE_REQUEST` hoặc `REVIEW_R05+`, nêu đề mục bị thay, bằng chứng, kiểm thử cần sửa và quyết định duyệt; không sửa âm thầm logic nghiệp vụ.
- **Lưu ý quản trị repository:** `KTXH-Offline-Report` là tên đề xuất cũ nên truy vấn 404; tài khoản kết nối có repository `KTXD-report` được tạo 09/11/2026, có quyền push. Nơi lưu chính là `KTXD-report`; chỉ ghi commit/document URL sau khi thao tác ghi và đọc lại qua công cụ GitHub thành công. Trạng thái đồng bộ thực tế xem `docs/status/PROJECT_STATUS.md`.


## 17. Điều kiện hoàn thành cuối cùng

- **PH1 DONE**: một app `dist/index.html` mở offline Chrome/Edge, nhập 3 nguồn thực, không chọn sẵn địa phương, dựng chính xác 14 dòng `RESULT_REFERENCE`, tỷ lệ GPMB chỉ theo diện tích, cờ 12 dự án M lệch I/D, danh sách thiếu REV 1/GPMB 6 có tên và lý do, nhiều phiên độc lập, đơn vị/kỳ chuẩn, click mỗi ô xem trace, tùy chỉnh, backup/restore, XLSX/in-PDF và log kiểm thử **có chứng cứ**.
- **PH2 DONE**: bộ importer/mapping, formula AST, multi-period/template linh hoạt và xuất nâng cao theo kế hoạch con 2; regression PH1 PASS, toàn bộ **T01–T66 PASS thực tế** trên SHA đang xét, không chỉ dựa vào audit nguồn hoặc screenshot.
- **PROJECT DONE**: cả hai gate PH1 và PH2 đạt và được ghi nhận trong `docs/status/PROJECT_STATUS.md`. Không sử dụng `FINAL` của tài liệu để tự nhận đã hoàn thành phần mềm.

---

**Ghi chú:** Mọi tỷ lệ tính trên giá trị gốc chưa làm tròn; mốc chỉ có 113/108 phải ghi đúng phạm vi; dự án thiếu dữ liệu có cờ PARTIAL. V2.2 thay V2.1 là nguồn yêu cầu duy nhất kể từ R06; **không sửa hoặc xóa V2.1 lịch sử**.


## 18. Nhật ký hợp nhất và quy tắc cập nhật V2.1

| Nguồn thay đổi | Quyết định đã hợp nhất vào V2 | Vị trí |
|---|---|---|
| Yêu cầu ban đầu (lịch sử) | Offline browser, không mặc định xã, multi-session, nhiều cách hiểu GPMB ban đầu, tổng/tổng, đơn vị và ngày chốt độc lập | §1–§16; **R06 thay thế quy tắc GPMB cũ** |
| R01 #1 | DISB đọc P/Q; ghi chú và kịch bản điều chỉnh không tự sửa tỷ lệ I/F | §4.2, §11.1, T25–T27 |
| R01 #2 | Định danh địa phương NFC có dấu; bỏ dấu chỉ cho search | §9.1, T28 |
| R01 #3 | Cảnh báo nhóm và lọc theo phiên; phân biệt warning events/distinct rows | §11.1, §12.1, T29–T30 |
| R01 #4 | Không tin tên file; chọn theo fingerprint và kiểm thử tên thay đổi | §2, §4, T31 |
| R01 #5 | Xuất Excel có style, PoC offline có bằng chứng | §14.1, §16.1, T32 |
| R02 #1 | Missing GPMB và aggregate PARTIAL; Kinh Môn 84,51% khác M105 100% | §4.3, §6A, T33–T35 |
| R02 #2 | 296 ô DISB null, phép cân đối ngang có kiểm soát | §4.2, §6A, T36–T38 |
| R02 #3 | Hidden/veryHidden không tự chọn sheet đầu tiên | §4.3a, T39–T40 |
| Yêu cầu người dùng mới | MỌI phép tính có hồ sơ công thức, tử-mẫu, included/excluded/reason, nguồn và kỳ, kể cả trung gian và kết quả xuất | §1.11, §6A, §9–§16, T41–T52 |

| R04 — phản biện hai tỷ lệ thu đất | ZERO mẫu số cấp dòng được cộng vào benchmark tổng/tổng; bổ sung `REV_LAND_RATE_P` | §3.4, §4.1, §5, §6A.3a, T53–T58 |
| R05 — 4 workbook tham chiếu | Bốn file nguồn commit vào repo, SHA cố định | §2.1, `data/reference/` |
| **R06 — chỉ đạo tách giai đoạn** | **Bỏ AVG(M) dự án khỏi báo cáo; kiểm cờ M/I/D; liệt kê tên địa phương thiếu ở mỗi nguồn; tách thành PH1 sản phẩm theo mẫu và PH2 mở rộng** | §1, §2.2, §4.3, §11–§17; T59–T66; hai kế hoạch con |

**Quy trình phản biện tiếp:** AI phản biện mới phải chỉ ra (1) trích đúng điều khoản V2.2; (2) bằng chứng từ file/ô/kiểm thử/nguồn kỹ thuật; (3) bản chất sai nghiệp vụ hay lỗi triển khai; (4) thay đổi đề nghị, tác động các module, test hiện có và test mới; (5) ưu tiên P0/P1/... Không chấp nhận phán đoán không kiểm tra dữ liệu, không chỉnh lại dữ liệu gốc để làm test PASS.

**Mức độ hoàn tất tại lúc hợp nhất:** đặc tả đã hợp nhất; **chưa có webapp và chưa có bằng chứng test runtime**. Trạng thái lưu GitHub cập nhật tại `docs/status/PROJECT_STATUS.md`. Tài liệu này là kế hoạch triển khai, không phải biên bản nghiệm thu phần mềm.

**Nhật ký phiên bản:** V2.2 là nguồn yêu cầu hiện hành kể từ R06, **chia thành hai kế hoạch con PH1/PH2**. V2.1 (`docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_1_FINAL.md`) và V2.0 giữ nguyên làm lịch sử, không được trộn điều khoản của bản cũ khi xung đột.

## Cập nhật quy phạm PH1 ngày 24/11/2026 — nguồn tháng 11 và bảng báo cáo

**Hiệu lực:** Nội dung dưới đây là phần cập nhật của MASTER V2.2, ưu tiên áp dụng đối với các mô tả cũ về vị trí cột nguồn, phạm vi, ngày chốt, trình bày và xuất báo cáo; không hủy các kiểm thử/bằng chứng tham chiếu tháng 10, không mở rộng PH2. Các số 113/114, 108/114, tỷ lệ 111,30%, 67,10%, 72,13% trong phần bộ nguồn gốc là mốc kiểm thử lịch sử, không hardcode cho nguồn mới.

### 1. Nhập và tính đúng nguồn mới

- REV: Chỉ workbook tham chiếu gốc trùng SHA-256 `b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f` được dùng sơ đồ cố định C:H, I, R, W, X:AC. Mọi workbook khác dùng `REV_HEADER_SEMANTIC_V3`: nhận diện nhóm dự toán năm, kế hoạch kỳ, lũy kế thực hiện, thu tiền sử dụng đất, thu trừ tiền sử dụng đất theo tiêu đề/ngữ nghĩa và ranh giới nhóm; tìm cột thực thu đất nằm trong nhóm thực hiện (không nhầm thu thuê đất), cột thực thu không đất có tiêu đề lũy kế/thực hiện trừ đất. Không cố định vị trí cột hay tên sheet cho mẫu mới; nếu thiếu/trùng vai trò bắt buộc, chặn `BLOCKER_MAPPING_REQUIRED`, không suy đoán. Nhóm tỷ lệ nguồn chỉ đối chiếu, không làm tử/mẫu chính. Nguồn thu đến 23/11/2026 có cột I thực thu, S thu đất, X thu trừ tiền đất: I/C, S/D, X/E; tỷ lệ theo kỳ là I/F, S/G, X/H. Cột R và W ở file này không phải hai tử số tương ứng. Nếu chèn/di chuyển cột, tiếp tục dùng vai trò ngữ nghĩa, không hardcode S/X. Mọi phép tính lưu địa chỉ ô thật.
- DISB: nhận diện `DISB_TOTAL_LOCALITY_V2` (mapping `DISB_TOTAL_LOCALITY_HEADERS_V2`), mẫu tổng hợp ngày 22/11/2026: tiêu đề nhóm C/F/I và nhóm con Tổng số/Dự án khối TP/Phân cấp cấp xã; C kế hoạch đầu năm, F kế hoạch sau điều chỉnh, I tổng giải ngân, M tỷ lệ sau điều chỉnh dùng đối chiếu, N ghi chú; L là tỷ lệ theo giao đầu năm, không phải tiền giải ngân; không có cột P marker, Q ghi chú hoặc phân rã xây dựng/GPMB/khác. Đọc dòng địa phương theo STT và tên, điển hình 8–121 đủ 114, không dùng cửa sổ 13–126 của mẫu tháng 10 dẫn đến 109/114. Không tự tạo dòng tổng TP/địa phương nếu nguồn không có. Giữ tương thích DISB_V1 và hai profile DISB_PHAN_CAP_XA_V1/V2 đã có: profile V1 phân cấp dùng C/G và K/L (tỷ lệ/ghi chú), V2 dùng F/J và N/O; không gán phạm vi phân cấp cho mẫu tổng hợp V2.
- Công thức chuẩn theo trường dữ liệu: REV_RATE_Y = actual_total_revenue / annual_total_budget; REV_LAND_RATE_Y = actual_land_revenue / annual_land_budget; REV_NONLAND_RATE_Y = actual_nonland_revenue / annual_nonland_budget. Ba tỷ lệ kỳ dùng mẫu số period_total_plan, period_land_plan, period_nonland_plan tương ứng. DISB_RATE = disbursed_total / adjusted_total_plan; benchmark = SUM(tử)/SUM(mẫu) trên đúng phạm vi nguồn, giữ Decimal chính xác đến khi hiển thị. GPMB vẫn chỉ SUM(I ghi nhận)/SUM(D), không bình quân tỷ lệ dự án. Không coi thiếu nguồn là 0, không dùng tỷ lệ đã làm tròn để tính ngược tiền giải ngân. Số liệu cũ nhập với sai mapping phải nhập lại từ Excel gốc cho đúng phiên; không sửa đè dữ liệu gốc.
- REV nhận ngày chốt từ tiêu đề ngày cụ thể đã kiểm tra tính hợp lệ hoặc ngày do người dùng xác nhận; không suy ngày chốt từ tên sheet hoặc chỉ có tháng. DISB và GPMB giữ ngày chốt riêng của nguồn/phiên; không đồng nhất các kỳ khác nhau. Độ phủ và tên địa phương thiếu tính lại theo dataset thật.

### 2. Dòng tùy chọn, bố cục và xuất báo cáo

- `showRevRealizedRow` mặc định false: khi bật, chèn **Kết quả thu NSNN (đến ngày …)** ngay sau dự toán STT 1, là STT 2; lấy đúng trường actual_total_revenue (thường cột I, không cố định) chia 1.000 nếu nguồn triệu đồng và hiển thị tỷ đồng. Ngày chốt lấy REV của phiên, chưa xác nhận thì ghi rõ. Tắt khôi phục đánh số gốc. Dòng con không có STT; khi đồng thời bật `showRevBenchmarkRow`, tỷ lệ chung nhận STT 3, tỷ lệ từng địa phương là dòng con. Dòng 8/9 dự án dịch STT tương ứng, không sửa trực tiếp template lưu trong phiên.
- Khổ A4 ngang cho tối đa **11 địa phương/cụm cột** trong chế độ ngang, co cột tự động theo bề rộng giấy và số địa phương (A4 dọc 7; A3 ngang 12, A3 dọc 11). AUTO chọn ngang nếu nằm trong giới hạn, vượt thì chọn dọc; người dùng có thể chọn ngang thủ công để chia nhóm trang. Nội dung quá dài vẫn có thể tràn trang theo chiều cao, không cắt mất dự án. Xem trước và in ngang dùng chung hàm `horizontalPageCapacity` và `horizontalFit`; Excel dùng cùng ngưỡng số cột để tính bề rộng, cần nghiệm thu in thực tế riêng.
- `REV_BENCHMARK_RATE` (Tỷ lệ thu NSNN trung bình theo phạm vi nguồn), `DISB_BENCHMARK_RATE` (Tỷ lệ giải ngân trung bình theo phạm vi nguồn) và `GPMB_BENCHMARK_AREA_RATE` (Tỷ lệ GPMB trung bình theo phạm vi nguồn) là **giá trị chung theo phạm vi nguồn**; gộp toàn bộ ô giá trị địa phương trong một nhóm/trang, căn giữa, chỉ hiển thị một lần. Chế độ ngang colspan=N; chế độ dọc trên Studio rowspan=N; một địa phương chỉ dùng ô thường; trang nhiều nhóm hiển thị một lần mỗi nhóm để đọc độc lập. Excel sheet Báo cáo merge C tới cột địa phương cuối, chỉ anchor có giá trị, vẫn định dạng phần ô gộp. Không gộp ô STT/nhãn, không gộp chỉ tiêu từng địa phương, không đổi công thức/benchmark hoặc phạm vi thành nhóm được chọn. Bấm ô gộp vẫn xem CalculationTrace chung; sheet Nhật ký phép tính vẫn lưu vết. Các chỉ tiêu khác giữ nguyên.
- Bỏ đoạn ghi chú nguồn ở cuối bảng chính (Studio/grid, in/PDF sạch, sheet Báo cáo). Thông tin kỳ, phạm vi, file, cảnh báo thiếu, phương pháp và trace vẫn bắt buộc lưu ở khối Nguồn dữ liệu, trình soi vết, sheet Nguồn thiếu & lý do, Danh mục công thức, Nhật ký phép tính, Bản ghi không tính; có thể xuất phụ lục kiểm toán riêng theo tùy chọn. Các dòng tổng hợp phạm vi trên sheet Nguồn thiếu & lý do lấy số lượng/ngày chốt thật. Không chặn xuất chỉ vì cài đặt cũ showScopeFootnotes=false; không xóa các sheet kiểm toán. Bỏ footer không đồng nghĩa bỏ thông tin về kỳ hoặc lờ đi thiếu dữ liệu.
- Không commit workbook tháng 11 hay nội dung báo cáo Word; chỉ dùng tại máy người dùng, fixture giả lập và bộ nguồn tham chiếu được phép.

### 3. Chuẩn hóa bảy tên chỉ tiêu (chốt ngày 24/11/2026)

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

Áp dụng cho phiên mới, phiên cũ sau migration, Studio, PDF và sheet Báo cáo Excel. Gộp cả ba benchmark REV/DISB/GPMB theo yêu cầu mới nhất. `NOV_FIX_04` là ca hồi quy bắt buộc cho lần đổi tên.

Chỉ tăng cỡ chữ giá trị của ba tỷ lệ trung bình REV/DISB/GPMB: Studio/grid và bản in/PDF dùng `1.1em` (tăng 10% so với số liệu thông thường), Excel dùng 11 pt thay vì 10 pt, định dạng phần trăm và căn giữa giữ nguyên. Không tăng cỡ chữ nhãn chỉ tiêu hoặc giá trị của từng địa phương; gộp cả ba benchmark REV/DISB/GPMB. Nhãn mặc định cũ theo độ phủ được tự chuyển sang mẫu 114; giữ tên riêng của người dùng.

### 4. Gộp cả tỷ lệ giải ngân trung bình và phân phối HTML chạy sẵn

Ba chỉ tiêu tỷ lệ trung bình REV/DISB/GPMB đều gộp toàn bộ cột địa phương trong mỗi nhóm/trang ngang, gộp hàng trong Studio dọc và merge ô giá trị trong Excel. Mỗi nhóm/trang chỉ hiển thị một kết quả, căn giữa; giữ cỡ chữ lớn hơn 10% (Excel 11 pt), trace chung, công thức và phạm vi nguồn. Không gộp chỉ tiêu riêng từng địa phương.

Bản chạy duy nhất `dist/index.html` được theo dõi trực tiếp trong Git; người dùng clone hoặc Fetch/Pull origin nhánh phân phối rồi mở file bằng Chrome/Edge, không cần cài Node.js, npm, chạy build hoặc mở server. GitHub Actions hiện có trên nhánh `ai/november-source-report-fix-20261124` (và `main` sau khi được merge) chạy xác minh 4 nguồn tham chiếu, typecheck, build, test và chỉ sau khi đạt mới commit riêng file HTML đã build bằng GITHUB_TOKEN. Không force-push; bot push không kích hoạt lại CI. Các nhánh khác chỉ phân phối sau khi được hợp nhất hoặc build có chủ đích. Không commit `node_modules`, các tệp nguồn người dùng nhập hay đầu ra khác. HTML chỉ nhúng ba workbook tham chiếu đã được cho phép; không đưa dữ liệu phiên cá nhân vào repo. Nếu CI thất bại hoặc push bị từ chối, chưa công bố bản mới là sẵn sàng. Bản build thủ công chỉ dành cho phát triển.

### 5. Nạp 3 file mới nhất (25/11/2026)

- Thay nút "Nạp 3 file mẫu" ở Khối 1 và trạng thái thiếu nguồn bằng "Nạp 3 file mới nhất"; thêm lựa chọn tương ứng khi tạo phiên. Mặc định tạo phiên vẫn dùng bộ nguồn của phiên đang mở; phiên mới có 0 địa phương. Không tự thay nguồn đang gắn khi chỉ mở lại báo cáo.
- Xét nguồn đã nhập và lưu trong workspace (bao gồm backup đã phục hồi); không tự quét file chưa nhập trên máy. Chọn riêng DISB/REV/GPMB. Với DISB giữ phạm vi của phiên đích (tổng vốn: DISB_V1/DISB_TOTAL_LOCALITY_V2; phân cấp: DISB_PHAN_CAP_XA_V1/V2); mặc định tổng vốn khi chưa gắn DISB. Không chọn tự động nếu phạm vi hiện tại không xác định.
- Điều kiện: có bản ghi, mapping đúng, ngày chốt hợp lệ đã xác nhận; loại BLOCKER và ERROR nghiêm trọng tại nguồn/trường tính chính; thiếu vài địa phương chỉ là cảnh báo, không mặc định loại. Các file REV sai mapping cũ và DISB_V1 cũ chỉ nhận 109 địa phương chưa có layout xác minh không được tự chọn. DISB và REV xác định vị trí tiêu đề báo cáo theo ngữ nghĩa; GPMB đọc ngày cụ thể duy nhất trong tiêu đề A1; nếu không xác định được thì yêu cầu xác nhận. GPMB_FLAT không suy ngày từ deadline, tên file hoặc ngày nhập. Không dùng fallback tháng 10 cho file mới. Dữ liệu legacy không có bằng chứng ngày chốt đáng tin phải xác nhận thủ công tại Khối 1; kiểm tra ngày lịch hợp lệ, đồng bộ metadata/provenance. File mẫu đối chiếu bằng SHA-256 gốc, không theo tên.
- Xếp theo ngày chốt giảm dần trong từng loại và phạm vi. Chỉ dùng nguồn mẫu nếu chưa có nguồn thực tế tương thích; nếu có nguồn thực tế nhưng tất cả bị loại, yêu cầu chọn/nhập/xác nhận, không âm thầm lùi về mẫu. Không suy phiên bản điều chỉnh từ chữ "mới/sửa" trong tên file. Hiện chưa có metadata phiên bản chính thức đáng tin; khi cùng ngày và khác SHA, ưu tiên thời điểm nhập lần đầu gần nhất, cảnh báo có nhiều bản cùng ngày để người dùng kiểm tra. Nhập lại đúng SHA không tăng thứ hạng, cùng mapping giữ dữ liệu/ngày chốt đã xác nhận; cùng SHA có các ngày xác nhận khác nhau thì không tự chọn nội dung đó. 
- Preview tên file, ngày chốt, số địa phương, phạm vi giải ngân, nguồn mẫu và danh sách loại có lý do; chỉ cho nạp khi đủ 3 nguồn, kiểm tra lại bindings trước khi đổi. Cập nhật chỉ phiên đang mở, giữ nguyên lựa chọn địa phương, cấu hình và bindings phiên khác; không tự động chọn bản mới trong nền. Khi chọn nguồn cùng ngày khác với đề xuất, người dùng vẫn có thể chọn thủ công từ dropdown Khối 1. Ngày chốt của ba nguồn độc lập.
- NOV_FIX_05 kiểm thử thứ tự ngày/nhập, trùng SHA, cùng ngày, giữ xác nhận khi nhập lại, phạm vi, sai mapping, ngày không đáng tin, mẫu, xung đột ngày và cô lập phiên; build HTML theo gate CI hiện hành.

### 6. Xác minh cấu trúc và lịch sử nguồn (Source Schema Guard V1, 25/11/2026)

- Nâng gate PH1 về tính đúng dữ liệu, không triển khai Wizard tùy ý PH2. Không lấy số liệu theo địa chỉ cột cũ nếu chưa xác minh đúng vai trò. REV và GPMB phẳng/phân nhóm ánh xạ theo tiêu đề duy nhất; GPMB phân nhóm hỗ trợ cột và dòng tiêu đề dịch chuyển, lưu đúng địa chỉ ô mới; DISB giải quyết nhóm tiêu đề và vai trò con duy nhất trong 4 profile nghiệp vụ, remap cột thực khi chèn/dịch hoặc đảo thành phần rõ nghĩa; nếu không xác định nhóm/phạm vi hoặc thiếu/trùng vai trò thì chặn thay vì đoán. Thêm cột cuối không liên quan được phép nếu các kiểm tra khác đạt. Cột bắt buộc thiếu/trùng/không xác định, sheet sai, đơn vị xung đột → lỗi BLOCKER_MAPPING_REQUIRED/selection, giữ nguồn phiên cũ. Đơn vị chưa có bằng chứng rõ → cần đối chiếu (không tự giả định đã xác minh); chỉ hỗ trợ đơn vị nguồn đã quy định, chưa tự quy đổi mọi đơn vị lạ.
- Lưu `Dataset.sourceValidation` version SCHEMA_GUARD_V1 gồm SHA file, sheet, schemaSignature SHA-256 của tiêu đề/nhóm cột/ánh xạ/đơn vị đã chuẩn hóa, danh sách dòng tiêu đề, số cột có nội dung (không tính cột chỉ được định dạng trống), mapping chỉ tiêu/cột/tiêu đề/đơn vị, từng kết quả kiểm tra, trạng thái VERIFIED/NEEDS_REVIEW, metadata đối chiếu lịch sử và xác nhận thủ công. Số cột là thông tin bổ trợ, không phải điều kiện loại file.
- Kiểm tra kiểu số trường chính, REV tổng = tiền đất + trừ tiền đất cho dự toán/kế hoạch/thực hiện và 6 tỷ lệ ghi nguồn nếu có, DISB các đẳng thức thành phần và tỷ lệ sau điều chỉnh, GPMB tỷ lệ diện tích và tổng địa bàn theo dự án; đối chiếu tổng nguồn với chi tiết khi cùng phạm vi và đủ toán hạng. Sai lệch nghiệp vụ đơn lẻ lưu cảnh báo; sai lệch hàng loạt cần đối chiếu. Không thay giá trị nguồn bằng công thức kiểm tra; phương pháp SUM/SUM, thiếu dữ liệu và quy tắc R06 không đổi.
- Đối chiếu nguồn đã xác minh gần nhất trước kỳ mới, cùng năm và loại/phạm vi vốn, chỉ so đối tượng khớp định danh (GPMB dùng địa bàn + tên dự án, bỏ đối tượng trùng mơ hồ). Kiểm tra số lượng chỉ tiêu neo thay đổi, số lượng lũy kế giảm, tương quan thứ hạng Spearman khi đủ mẫu; không sử dụng ngưỡng % chênh lệch giá trị giữa hai kỳ hoặc chia biến động theo số ngày; không tự gán cột theo tương quan. Cảnh báo lịch sử chỉ bổ trợ, cần đối chiếu khi đồng thời có dấu hiệu mạnh. Khi xác nhận/đổi ngày chốt, tính lại lịch sử.
- Bình thường tự kiểm tra và gắn nguồn nếu VERIFIED. Cảnh báo cần xác minh mở hộp xác nhận có lý do, cột trước/sau và tiêu đề/đơn vị; người dùng chỉ phê duyệt sau đối chiếu Excel gốc. Hủy khi nhập giữ nguyên nguồn phiên. Nguồn cần xác minh sau đổi ngày có nút xác nhận ở Khối 1. Bảng chính, Excel/PDF và Nạp 3 file mới nhất không được sử dụng nguồn thiếu xác minh hoặc ngày chốt. Nguồn cũ chưa có guard phải nhập lại file gốc, ngoại trừ workbook tham chiếu khớp SHA/sheet/profile; bản nhập mới có ID phiên bản GUARD1 để không ghi đè nguồn phiên khác. Không bỏ giới hạn cột theo phạm vi in đã chốt. GPMB bỏ trần STT 422; kiểm tra nhóm, STT hợp lệ, tên dự án, trùng STT trong địa bàn.
- Kiểm thử biến thể từ workbook gốc: chèn cột có số, đảo cột, thiếu/trùng tiêu đề, thêm cột ngoài vùng, đổi đơn vị, chèn dòng tiêu đề GPMB, tăng số dự án, lịch sử cách xa kỳ và chọn latest. Nếu không xác minh chắc chắn phải từ chối. NOV_FIX_01/02/05/06/07 mở rộng và source-corpus regression là kiểm thử hiện hành; không coi các trường hợp chưa có file thật là đã nghiệm thu.

### 7. Kho file Excel nguồn để kiểm thử hồi quy

Giữ nguyên byte của 4 workbook tham chiếu (3 nguồn và 1 mẫu kết quả) đã lưu `data/reference/` và kiểm chứng SHA-256/Git blob SHA-1; không ghi đè, không thay bằng báo cáo xuất ra. `data/reference/SOURCE_CORPUS.json` đăng ký ba nguồn gốc kèm ánh xạ và số liệu kỳ vọng đối chiếu độc lập; `data/reference/corpus/` dành cho mọi phiên bản mẫu nguồn thực tế được chủ dự án cung cấp và cho phép lưu. Mỗi file mới đăng ký đường dẫn, loại nguồn, sheet, ngày chốt/bằng chứng, kích thước, SHA-256, Git blob SHA-1, số địa phương/dự án, cột đúng và golden values xác minh trực tiếp từ file; không lấy đầu ra importer làm kỳ vọng. CI kiểm tra mọi mục, cấm file ngoài danh mục và trùng nội dung. Chỉ ba nguồn tham chiếu cũ được nhúng vào HTML hiện tại; corpus mới chỉ dùng test. App offline không tự gửi file nguồn lên GitHub. **Ngày 25/11/2026, chủ dự án xác nhận giữ repository Public và cho phép lưu các mẫu nguồn của dự án để kiểm thử.** Chỉ thêm file gốc có byte truy cập được và thuộc phạm vi đã cho phép; không công bố dữ liệu ngoài dự án, thông tin cá nhân, bí mật, thông tin đăng nhập hoặc backup phiên. Không tự động upload từ app. Các file gốc chưa truy cập được phải xin chủ dự án gửi lại; không tuyên bố đã lưu khi chỉ có tên hoặc kết quả xuất. Không xóa bốn file gốc khi chưa có chỉ đạo.

### 8. Hoàn thiện nhận diện theo nhóm tiêu đề (25/11/2026)

- `resolveDisbLayout` xác minh vai trò STT, địa phương, kế hoạch, điều chỉnh, giải ngân, tỷ lệ, ghi chú; phân biệt tổng vốn/phân cấp bằng nhóm thành phần. Cho phép chèn cột ở trước/vào giữa bảng, đổi vị trí thành phần có tiêu đề rõ trong cùng nhóm. Không dùng giá trị số để đoán cột. Bố cục phá vỡ thứ tự/ý nghĩa nhóm, thiếu/trùng tiêu đề bắt buộc, phạm vi hoặc dòng tổng không xác minh được phải từ chối. Hỗ trợ cả 4 profile hiện có. `Dataset.disbLayout` lưu canonical role -> cột thực, dòng tiêu đề, danh sách dòng địa phương, dòng tổng/city/out-of-plan nếu xác minh được và ô tiêu đề; trace dùng địa chỉ/dòng thực. Compact lưu cả tỷ lệ vốn đầu năm để QA, không dùng thay công thức báo cáo.
- REV: định danh địa phương/STT, 9 trường bắt buộc và ô tiêu đề báo cáo theo nội dung; bỏ giới hạn 100 cột. Tỷ lệ nguồn chỉ gán khi nhóm tiêu đề dự toán/kế hoạch kỳ xác minh được; nếu thiếu nhóm, cảnh báo và vẫn tính tỷ lệ theo tiền gốc, không đoán thứ tự hai nhóm. GPMB phẳng nhận diện theo vai trò trên tất cả cột có nội dung, không chặn chỉ vì vị trí quá 40. Nếu một workbook có nhiều loại nguồn hợp lệ thì yêu cầu nhập vào ô nguồn cụ thể; từng importer vẫn cần sheet hợp lệ duy nhất.
- Đơn vị nhận cả ĐVT/Đơn vị tính; đơn vị xung đột trong cùng khai báo hoặc tiêu đề bắt buộc chặn. Lịch sử phát hiện dấu hiệu đổi đơn vị đồng loạt ở chỉ tiêu neo với hệ số 100/1.000/1.000.000 và nghịch đảo, đối chiếu gần như đúng hệ số (dung sai số học), không dùng ngưỡng % biến động giữa kỳ. Cảnh báo cần xác minh, không tự sửa số.
- Nguồn cũ đã qua guard giữ nguyên; phạm vi `disbLayout.fingerprint` và `schemaFingerprint` không khớp bị chặn. Bộ test dùng dữ liệu gốc, biến thể mô phỏng và corpus; chưa tuyên bố nghiệm thu các Excel thực tế tháng 11 khi byte gốc chưa truy xuất được.
- Kho mẫu: Public được chủ dự án xác nhận. `pendingOriginals` liệt kê 5 tệp gốc khác có metadata thư viện nhưng chưa lấy được raw bytes; không xem là đã archive hoặc test. Khi nhận file thực, kiểm tra SHA, dedup, xác minh cấu trúc và golden values trực tiếp trước khi đăng ký. File kết quả xuất không được thay thế nguồn gốc.
