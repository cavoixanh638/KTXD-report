# ĐẶC TẢ TRIỂN KHAI WEBAPP TỔNG HỢP BÁO CÁO KTXH OFFLINE

**Mã tài liệu:** KTXH-OFFLINE-SPEC-1.0  
**Ngày lập:** 09/11/2026  
**Trạng thái:** Đặc tả để duyệt và bàn giao triển khai; **chưa phải ứng dụng đã xây dựng**.  
**Ngôn ngữ giao diện:** Tiếng Việt.  
**Nền tảng:** Chrome/Edge trên Windows, chạy offline, không cần đăng nhập, không có backend hoặc truyền dữ liệu ra Internet.

> **Lệnh bàn giao cho AI triển khai:** Đọc hết tài liệu, đọc trực tiếp bốn file `.xlsx` nêu ở mục 2. Không thay nội dung quy tắc nghiệp vụ bằng suy đoán. Viết ứng dụng, kiểm thử trên dữ liệu thật, bàn giao bản build offline `index.html` và mã nguồn; phải vượt hết các kiểm thử nghiệm thu trong mục 15. Nếu tệp khác cấu trúc đã định nghĩa, kích hoạt chế độ ánh xạ cột, không âm thầm lấy sai ô. Không mặc định lựa chọn xã/phường; không tính trung bình cộng tỷ lệ của các đơn vị để làm mốc chuẩn. Không chỉnh sửa tệp Excel gốc.

## 1. Mục tiêu, phạm vi và các nguyên tắc không được vi phạm

1. Người dùng mở ứng dụng bằng trình duyệt khi máy không có Internet. Trải nghiệm chính phải hoạt động từ gói tải về, không yêu cầu cài Python/Node, tài khoản, API key hay truy cập CDN.
2. Khi tạo một phiên báo cáo mới, danh sách địa phương **rỗng**. Người dùng tìm kiếm và chọn 1, 5, 7, 11, 114 hoặc số lượng bất kỳ; cho phép chọn xã, phường, đặc khu hoặc phối hợp. Bảng mẫu 11 xã chỉ là **template chỉ tiêu**, tuyệt đối không phải danh sách địa phương được chọn sẵn.
3. Một **workspace** chứa nhiều **phiên báo cáo** (session) có tên, danh sách địa phương, thứ tự, chỉ tiêu, cách so sánh và bản nguồn liên kết riêng. Có thể làm báo cáo 5 xã, chuyển sang báo cáo 7 phường, quay về báo cáo 5 xã mà không mất thiết lập và không trộn dữ liệu. Không hạn chế cứng số phiên ở 2, 3 hoặc 5.
4. Với GPMB phải có cả (a) tỷ lệ theo diện tích = tổng diện tích đã GPMB/tổng diện tích phải GPMB (mặc định và chuẩn để đánh giá), (b) bình quân tỷ lệ từng dự án như báo cáo gốc (chỉ hiển thị tham khảo; có giải thích về phương pháp). Cần đánh dấu nếu tỷ lệ ở cột M của nguồn sai khác phép I/D.
5. Mọi **tỷ lệ chuẩn chung/mốc so sánh** của thu, giải ngân và GPMB phải = **tổng tử số chia tổng mẫu số trong cùng phạm vi**, KHÔNG = `AVERAGE` tỷ lệ của từng địa phương. Nếu tính **mức vốn bình quân một đơn vị** (tỷ đồng/đơn vị) thì công thức đúng là tổng vốn chia số đơn vị hợp lệ; đây là mức bình quân tuyệt đối, không phải bình quân tỷ lệ.
6. Mỗi ô số liệu có giá trị gốc, đơn vị gốc, giá trị chuẩn hóa, công thức hoặc quy tắc tính, nguồn file/sheet/cell và thời điểm chốt riêng. Thiếu, chưa xác định, 0, và lỗi phải là bốn trạng thái khác nhau.
7. Mỗi tệp có ngày chốt độc lập; tự trích ngày khi rõ ràng, người dùng xác nhận; khi không rõ/không nhất quán phải yêu cầu nhập và ghi lại cách xác nhận, không tự đoán.
8. Báo cáo phải ghi rõ **mốc so sánh áp dụng cho 114, 113, 108 địa bàn hay toàn thành phố**. Không đổi tên hay nâng phạm vi số liệu chưa đủ thành '114 xã, phường'. Không coi số giải ngân toàn thành phố là mốc của 114 địa phương.
9. Không tự điền số 0 khi không có dữ liệu; không tự cộng khoản không cùng kỳ, cùng phạm vi hoặc cùng phương pháp; không lấy trung bình phần trăm đã làm tròn.
10. Người dùng thay đổi được phần lớn nội dung bảng thông qua cấu hình mà không cần sửa code: địa phương, chỉ tiêu, công thức an toàn, đơn vị, thứ tự, nhãn, điều kiện nhận xét, màu, hiển thị, khổ in và template.

## 2. Bốn tệp Excel nghiệp vụ đầu vào

Các tệp chính đã có trong cuộc trao đổi:

| Mã nguồn | Tên tệp | Sheet cần phân tích | Đơn vị | Phạm vi | Ngày chốt |
|---|---|---|---|---|---|
| `DISB_20261015` | `Báo cáo giải ngân 15.10 sửa(1).xlsx` | `Tổng hợp` | Triệu đồng | 114 địa phương + nhóm khác ở dòng tổng thành phố | 15/10/2026 (tiêu đề ô A1) |
| `REV_10M_2026` | `Bc thu 10 thang-19.10-BC (1)(1).xlsx` | `10T-19.10` | Triệu đồng | 113 địa phương | Kỳ '10 tháng đầu năm 2026', **chưa chứng minh được ngày chốt cụ thể** |
| `GPMB_20261026` | `PL01_Tổng hợp DA_26.12.26(1).xlsx` | `Tổng hợp theo địa bàn` | m², đồng, tổ chức, hộ | 108 địa bàn, 422 dòng dự án | 26/10/2026 (tiêu đề A1; tên tệp không phù hợp hoàn toàn) |
| `RESULT_REFERENCE` | `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx` | `Sheet1` | Tỷ đồng, m², tỷ lệ và văn bản | 11 xã | Trộn nhiều thời điểm | MẪU TRÌNH BÀY, KHÔNG LÀ NGUỒN SỰ THẬT CHO CÔNG THỨC |

Nguồn thu có 113/114 địa phương so với nguồn giải ngân, thiếu Đặc khu Bạch Long Vĩ. Nguồn GPMB có danh mục tại 108 địa bàn, không được suy luận sáu địa bàn còn lại là 0% hoặc 100%. Giải ngân tổng thành phố (`Tổng hợp!7`) gồm đơn vị ngoài khối địa phương; giải ngân khối địa phương nằm ở `Tổng hợp!12`.

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

## 4. Ánh xạ nguồn chi tiết (data adapters)

### 4.1 `REV` – Thu NSNN (sheet `10T-19.10`)

- Tiêu đề kỳ: `A3`; đơn vị: `AC5` = triệu đồng; tiêu đề cột dòng 8; dòng tổng `10`; địa phương dòng **11–123**.
- Khóa địa phương: cột `B` (tên). Với các file phiên bản mới, dùng kiểm tra tiêu đề thay vì tuyệt đối tin dòng 11.
- `annual_total_budget` = `C`; `annual_land_budget` = `D`; `annual_nonland_budget` = `E`.
- `period_total_plan` = `F`; `period_land_plan` = `G`; `period_nonland_plan` = `H`.
- `actual_total_revenue` = `I`; `actual_nonstate_sector` = `J`; thuế GTGT `K`; TTĐB `L`; TNDN `M`; tài nguyên `N`; các sắc thuế/khoản thu còn lại `O:V`; `actual_land_revenue` = `R`; `actual_nonland_revenue` = `W`.
- `X:AC` là tỷ lệ có sẵn để đối chiếu, **không làm nguồn tính chính**. Tái tính từ số tiền: `X=I/C`, `Y=R/D`, `Z=W/E`, `AA=I/F`, `AB=R/G`, `AC=W/H`. Chú giải ở `AC9` bị ghi nhầm; tin phép tính thực tế `W/H`.
- Mọi giá trị tiền ở nguồn là **triệu đồng**. Quy đổi tỷ đồng: chia 1.000.
- Quy tắc kiểm: `C=D+E`, `F=G+H`, `I=J+O+P+Q+R+S+T+U+V`, `W=I-R`, `J=K+L+M+N` (sai số theo ngưỡng). Không cộng `K:N` hai lần khi tính `I`.
- Không suy luận '10 tháng' = đã chốt 31/10 khi sheet/tên file có `19.10`; yêu cầu xác minh ngày tại wizard.

### 4.2 `DISB` – Giải ngân (sheet `Tổng hợp`)

- Ngày báo cáo: A1 = đến hết 15/10/2026; đơn vị A2 = triệu đồng; dòng tổng thành phố 7; dòng tổng **khối địa phương 12**; các địa phương dòng **13–126**; tên tại `B`.
- `initial_total_plan` = `C` (có lỗi `#VALUE!` ở một số ô tổng, không dùng khi lỗi); `initial_city_component`=`D`; `initial_local_component`=`E`.
- `adjusted_total_plan`=`F`; phần dự án khối TP `G`; phần phân cấp cấp xã `H`.
- `disbursed_total`=`I`; chi tiết theo nguồn `J` (khối TP), `K` (cấp xã); theo nội dung `L` (xây lắp/tư vấn/QLDA), `M` (bồi thường GPMB), `N` (khác).
- `O` là tỷ lệ từ nguồn để kiểm tra; **tái tính bằng I/F**, không bình quân O của các địa phương.
- Kiểm tra `F=G+H`, `I=J+K`, `I=L+M+N`. Cột C có nhiều ô cached `#VALUE!`; không cho giá trị lỗi trở thành 0.
- Toàn bộ tiền: **triệu đồng**; quy đổi tỷ đồng = ÷1.000.
- Sheet ẩn có nhiều `#REF!`; không tự lấy dữ liệu sheet ẩn để thay cho bảng chính. Khi user chọn sheet ẩn phải quét lỗi và hiển thị phạm vi không đáng tin cậy.

### 4.3 `GPMB` – Giải phóng mặt bằng (sheet `Tổng hợp theo địa bàn`)

- Dòng 1 chứa ngày 26/10/2026; tiêu đề cột dòng 2. Dòng dữ liệu từ 3 đến 532.
- Địa bàn được khai báo bằng **dòng nhóm**: cột `B` = tên xã/phường/đặc khu, cột `A` trống; tiếp theo là các dòng dự án có `A` là STT số 1 đến 422. Mỗi dự án gán với địa bàn gần nhất phía trên; dòng tổng địa bàn chỉ dùng đối chiếu tổng.
- Tên dự án = `B`; loại vốn = `C`; diện tích phải GPMB m² = `D`; số tổ chức phải thu hồi = `E`; số hộ phải thu hồi = `F`; kinh phí phân bổ VND = `G`; hạn hoàn thành `H`.
- Diện tích đã GPMB m² = `I`; kinh phí đã chi VND = `J`; tổ chức đã GPMB = `K`; hộ đã GPMB = `L`; tỷ lệ báo cáo = `M` (có thể là 100 thay vì 1); trạng thái = `N`; nghị quyết 11 = `O`; nhóm = `P`.
- `gpmb_area_rate` cho **một địa bàn** = `SUM(I_project_rows) / SUM(D_project_rows)` (mặc định). `gpmb_project_average_reference` = trung bình các tỷ lệ dự án trong `M`, giống cách báo cáo hiện có để tham khảo; hiển thị nhãn `Bình quân tỷ lệ dự án (không phản ánh tiến độ theo diện tích)`.
- Phải ghi riêng thêm `gpmb_project_average_recalculated` = trung bình các `I/D` theo từng dự án hợp lệ; không tự coi như `gpmb_project_average_reference` nếu nguồn `M` sai. Có thể giấu cột này theo mặc định, chỉ mở khi xem kiểm tra.
- `M` của các dòng nhóm dùng `AVERAGE` (dự án). **Tuyệt đối không dùng M dòng nhóm để tính tỷ lệ diện tích**; khi tính chung 108 địa bàn hoặc một tập hợp tùy chọn: lấy `SUM(I)`/`SUM(D)` trên tất cả dòng dự án nằm trong phạm vi.
- Diện tích là **m²**; khi xuất ha: ÷10.000. Tiền G/J là **đồng**, khi xuất tỷ đồng: ÷1.000.000.000; khi xuất triệu: ÷1.000.000. Hộ/tổ chức là số đếm không có đơn vị tiền.
- Nếu có nhiều dòng trùng tên dự án ở nhiều địa bàn: không tự xóa trùng bởi vì mỗi dòng có thể là phần diện tích phân bổ theo địa bàn. Mã dòng dự án = `sourceDatasetId + sheet + rowNumber`.
- Cảnh báo: `I>D`, `J>G`, `K>E`, `L>F`, `M` lệch `100*I/D`, thiếu D/I, hoàn thành N nhưng phần trăm chưa đạt, quá hạn nhưng chưa đạt. Đưa cảnh báo để xác minh, không tự động sửa số liệu.

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
| `GPMB_AVG_PROJECTS` | Bình quân tỷ lệ các dự án | `AVG(M_project)` | %; tham khảo |
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
6. Mỗi chỉ tiêu trong báo cáo hiển thị nhãn nguồn/kỳ khi cần; bản xuất có dòng chú thích `Thu NSNN: ...; Giải ngân: 15/10/2026; GPMB: 26/10/2026`. Nếu trộn kỳ và người dùng tắt nhãn chú thích, ứng dụng cảnh báo và không cho xuất không giải trình.
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

## 11. Giao diện chi tiết và hành vi

**Trang A — Quản lý phiên:** sau khi mở app, không có phiên hoặc có danh sách phiên đã lưu. Nút `+ Phiên mới`. Form tạo gồm tên, mô tả tùy chọn, template chỉ tiêu; địa phương rỗng. Dưới mỗi phiên có tên, số địa phương, ngày cập nhật, các dataset đang dùng, trạng thái sao lưu. Có thể tạo `5 xã khu vực A` và `7 phường khu vực B`.

**Trang B — Nhập nguồn:** kéo thả nhiều `.xlsx`; tự nhận dạng loại bằng tiêu đề + cấu trúc; chọn profile nếu mơ hồ; chọn sheet; cho xem 10 dòng mẫu, số địa bàn, đơn vị nguồn theo cột; xác minh ngày chốt; kiểm tra tên địa phương trùng và lỗ hổng; xử lý cảnh báo; `Hoàn tất nhập` khi mọi metadata bắt buộc hợp lệ. Cho phép sửa mapping cột trong wizard nếu file mới thay layout; có bản ghi mapping cho lần sau.

**Trang C — Chọn địa phương:** ô tìm kiếm tiếng Việt có/không dấu; bộ lọc Xã/Phường/Đặc khu, theo trạng thái có dữ liệu; tick nhiều, chọn tất cả trong vùng, bỏ chọn; sắp xếp kéo thả; chỉ một địa phương xuất hiện một lần trong phiên. Hiển thị số địa phương được chọn và cảnh báo số chỉ tiêu thiếu nguồn.

**Trang D — Bảng báo cáo:** bố cục như mẫu gốc: cột trái STT/Chỉ tiêu, các địa phương chạy ngang, mỗi dòng là chỉ tiêu. Khi > số cột màn hình: cuộn ngang, ghim cột tên chỉ tiêu và tiêu đề. Có chỉnh độ rộng/cỡ chữ/đơn vị/ẩn nhóm, thêm dòng nhóm, nhân bản chỉ tiêu, đổi thứ tự, bật/tắt dòng mốc chung, dòng nhận xét. Chỉ tiêu GPMB cho phép chuyển hiển thị `Theo diện tích` (mặc định) / `Bình quân dự án` (tham khảo); nhãn phương pháp hiển thị cả trên bản xuất.

**Trang E — Chi tiết ô và đối chiếu:** nhấn vào một ô → panel bên phải: giá trị hiển thị, số gốc chưa làm tròn, đơn vị, công thức, tử/mẫu, dataset nguồn, tên file/sheet/ô hoặc toàn bộ hàng dự án, ngày chốt, cảnh báo. Nút `Xem phép tính`, `Xem dữ liệu gốc`, `Nhập điều chỉnh có lý do` (không xóa giá trị nguồn). Bảng đối chiếu delta đơn vị và dữ liệu tham khảo.

**Trang F — Mốc so sánh và quy tắc:** lựa chọn mốc phù hợp từng nhóm chỉ tiêu; hiển thị dạng: `Giải ngân 114 địa phương: 67,10%, dữ liệu 15/10/2026 (10.434,92 / 15.550,92 tỷ)`; `Thu 113 địa phương: 111,30%, chưa đủ 114` và `GPMB 108 địa bàn có dự án: 72,13% (26/10/2026)`. Cấu hình ngưỡng `cao hơn`, `thấp hơn`, `rất thấp` bằng độ lệch điểm % hoặc ngưỡng tuyệt đối, trạng thái 'chưa có mốc' thì không sinh nhận xét.

**Trang G — Xuất/Lưu:** xuất XLSX với cell số numeric, định dạng %/tiền/diện tích; có sheet `Chỉ tiêu`, `Nguồn & thời điểm`, `Kiểm tra & cảnh báo` tùy chọn. In/PDF bằng trình duyệt, A4/A3 ngang/dọc, lặp header, cỡ chữ hợp lý, tự chia trang ngang. Sao lưu bộ hồ sơ toàn bộ và phục hồi. Không tự thêm nhận xét ngoài template khi xuất nếu người dùng không chọn.

## 12. Nhận diện và xử lý sai số/nguồn lỗi

Mức độ cảnh báo: `BLOCKER` (không thể nhập/xuất có trách nhiệm), `ERROR` (không tính chỉ tiêu liên quan), `WARNING` (vẫn tính nhưng có giải trình), `INFO` (thông tin minh bạch).

| Quy tắc | Phản ứng |
|---|---|
| Thiếu ngày chốt | `BLOCKER` tại bước nhập; yêu cầu người dùng xác nhận ngày |
| File không đúng profile | `BLOCKER` nếu không map được; chuyển wizard ánh xạ |
| Ô công thức Excel `#VALUE!`/`#REF!` | `ERROR` cho chỉ tiêu đó; cho phép tính lại **chỉ công thức nghiệp vụ chuẩn đã biết** khi có đủ thành phần |
| Thiếu một địa phương trong nguồn | `MISSING`, không thay số 0; báo coverage |
| Trùng tên khác loại địa phương | Đối chiếu mã/loại, yêu cầu xác nhận liên kết |
| GPMB I>D hoặc K>E | `WARNING` với vị trí ô và số liệu nguồn |
| Tiền GPMB J>G | `WARNING` kiểm tra phạm vi phân bổ/chi |
| Tỷ lệ nguồn M khác I/D | `WARNING`, ưu tiên tính lại theo diện tích khi hiển thị mặc định |
| Mốc nguồn 113/108 nhưng nhãn người dùng ghi 114 | `BLOCKER` đối với nhãn sai; đề nghị đổi đúng phạm vi |
| So sánh mốc khác thời điểm/phạm vi | `WARNING` + yêu cầu xác nhận rõ; trên bản xuất có chú thích |
| Tỷ lệ vượt 100% | `WARNING`, giữ nguyên giá trị, không cắt ngưỡng |
| Mẫu số 0 | hiển thị `Không có cơ sở`/`Phát sinh ngoài kế hoạch`, không chia 0 |
| Công thức custom có lỗi chu trình hoặc không hợp lệ | `ERROR` tại editor; không cập nhật chỉ tiêu |
| File Excel mới khác cấu trúc | tạm dừng nhập, hiển thị mapping cũ/mới và bản xem trước |

Không so sánh `GPMB_BUDGET` từ báo cáo dự án với `DISB_GPMB_PAID` từ giải ngân như hai vế của cùng tỷ lệ nếu chưa xác minh danh mục, phạm vi chủ đầu tư và thời điểm.

## 13. Tùy chỉnh nâng cao

- **Danh mục chỉ tiêu:** tạo một indicator mới từ trường nguồn hoặc công thức có `id`, nguồn, đơn vị, nhãn, độ chính xác, phương pháp tổng hợp, nhãn tham chiếu. Áp dụng công thức khác nhau theo địa phương/nhóm với điều kiện hiển thị.
- **Danh mục bảng:** tạo template mới từ bảng hiện tại; thay thứ tự/nhóm và cột, lưu template chỉ tiêu riêng (không nhân bản dữ liệu nguồn). Lưu các mẫu `Báo cáo thu`, `Báo cáo giải ngân`, `GPMB`, `Báo cáo tổng hợp`.
- **Quy tắc so sánh:** mốc chọn theo chỉ tiêu, so sánh với 114 nếu đủ dữ liệu, toàn thành phố nếu có nguồn riêng, 113/108 tham khảo khi xác nhận; thể hiện phương pháp và ngày ở đầu nhóm.
- **Định dạng:** số chữ số, dấu phân tách, ẩn số 0, trống, NA, màu cảnh báo, font, căn lề, độ rộng cột, tiêu đề, logo tùy chọn (không yêu cầu logo).
- **Phiên làm việc:** nhân bản phiên giữ thiết lập nhưng không ghi đè, phiên thay đổi nguồn tạo revision, có lịch sử ai/cái gì/đã sửa vì sao (vì app không có tài khoản, 'người thực hiện' là nhãn do người dùng tự khai báo nếu cần).
- **Tìm kiếm:** không dấu/không phân biệt hoa thường, theo mã địa phương, loại, tên, có dữ liệu; tìm trong bảng theo nhãn chỉ tiêu hoặc số liệu.
- **Phạm vi:** có thể chọn số lượng địa phương bất kỳ. Nếu hơn số cột có thể in một trang, hỗ trợ phân trang thông minh, không co chữ xuống mức không đọc được.

## 14. Kế hoạch triển khai theo cổng nghiệm thu

| Pha | Nhiệm vụ triển khai | Tiêu chí PASS để chuyển pha |
|---|---|---|
| `P0` | Sao lưu và chốt file mẫu; tạo repo; viết `DATA_DICTIONARY`, rule benchmark, và bộ kiểm thử dữ liệu thật | Có mapping của 3 nguồn, quy tắc rõ ràng về 114/113/108, đơn vị, kỳ; test kỳ vọng đóng băng |
| `P1` | Build offline `index.html`, UI shell, kiểm tra không request Internet; khởi tạo workspace | Mở trên Chrome/Edge `file://` khi tắt mạng; trang đầu không chọn địa phương |
| `P2` | Adapter nhập REV/DISB/GPMB, nhận diện sheet, ngày chốt, map địa bàn, import preview | Nạp đủ 113/114/108 và 422 project; metadata từng cột đúng, ngày thu được yêu cầu xác nhận |
| `P3` | Engine chuẩn hóa đơn vị, Decimal, tỷ lệ tổng/tổng, benchmark coverage, GPMB hai cách tính | Trả về các giá trị kiểm thử định lượng của mục 15; không lấy bình quân % địa phương |
| `P4` | Session manager: tạo/nhân bản/đổi tên/chọn địa phương, lưu workspace, khôi phục | Có đồng thời phiên 5 xã và 7 phường, chuyển qua lại không trộn và khôi phục từ file |
| `P5` | Bảng chỉ tiêu theo template, panel nguồn, cảnh báo, chỉnh template, công thức custom an toàn | Chỉ tiêu mẫu chính xác, không default xã, xem được ô nguồn/đơn vị/ngày, sửa cấu hình không cần code |
| `P6` | Xuất Excel, in PDF, backup/restore, logging, khác biệt nguồn và date | XLSX có numeric cells, PDF không cắt bảng, backup-restore nguyên vẹn cả session & datasets |
| `P7` | E2E Chrome/Edge offline, regression, thử đầu vào xấu và nhiều phiên/phiên bản | 100% test BLOCKER và test định lượng PASS; bàn giao README, source, dist, kết quả test |

Mỗi pha cần commit/checkpoint độc lập; không làm lại phần đã PASS khi không bị ảnh hưởng. Bàn giao mã nguồn có thể build lại, không chỉ file HTML đã minify. Không coi screenshot là bằng chứng đủ về logic; phải có unit/integration test.

## 15. Test cases bắt buộc (dữ liệu thật và tình huống)

### A. Tính toán và phạm vi

- `T01` – 114 địa phương giải ngân: `ΣF=15.550.923,159 triệu`, `ΣI=10.434.921,777 triệu`. `I/F=67,10%`; ứng dụng **không** hiện 76,46% làm tỷ lệ chuẩn 114.
- `T02` – Mức vốn giao bình quân 114 địa phương: `15.550.923,159/114=136.411,60666 triệu ≈136,41 tỷ/địa phương`.
- `T03` – Thu 113 địa phương: `ΣC=25.651.713 triệu`, `ΣI=28.550.929,455 triệu`; `I/C=111,30%`. Benchmark ghi **113**, cảnh báo thiếu Đặc khu Bạch Long Vĩ, không ghi là mốc 114.
- `T04` – GPMB 108 địa bàn: `ΣD=55.398.165 m²`, `ΣI=39.960.463,6 m²`; theo diện tích **72,13%**. Không lấy bình quân tỷ lệ các dòng địa bàn.
- `T05` – Xã Hồng Châu: `D=119.280 m²`, `I=35.897 m²`, theo diện tích **30,09%**, trong khi bình quân tỷ lệ dự án nguồn ≈**78,73%**. Hiển thị cả 2 và lý do khác biệt; mặc định 30,09%.
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

## 16. Các điểm quyết định mặc định cho AI khi triển khai

Để tránh AI khác hỏi lại các quyết định đã chốt:

- Bản đầu **không có địa phương mặc định**; có thể hiển thị một template báo cáo, nhưng cột địa phương để trống cho đến khi chọn.
- Template đầu tiên là `Tổng hợp chỉ tiêu KTXH` dựa trên bảng 11 xã, sửa tên các chỉ tiêu đang gây hiểu lầm theo đúng phép tính.
- GPMB dùng diện tích theo mặc định; bình quân theo dự án là lựa chọn tham khảo không được làm benchmark chuẩn.
- Benchmark phần trăm là tổng/tổng; benchmark tiền vốn bình quân là tổng vốn/số đơn vị.
- Thiếu 114: chỉ trình bày mốc 113 hoặc 108 như **mốc tham khảo có cảnh báo**; nếu có tổng thành phố thực sự tương thích thì cho người dùng chọn mốc thành phố và hiển thị nguyên phạm vi; nếu không có nguồn, không tự bịa.
- Dữ liệu thu kỳ '10 tháng' cần xác nhận ngày cụ thể, không mặc định theo tên file.
- Người dùng có thể tùy chỉnh đến mức tạo template mới mà không sửa code; song những ràng buộc cứng về provenance, đơn vị, ngày và phạm vi không được tắt hoàn toàn.
- Không tự động ghi đè file trên ổ đĩa khi không có quyền; bản sao lưu `.kxh.json` là cơ chế khôi phục chính, lưu trình duyệt là tiện ích.
- Bản bàn giao tối thiểu: `index.html` offline, mã nguồn, tài liệu hướng dẫn, 3 profile nhập, template, test suite, kết quả chạy test. Không cần backend, cloud, login, AI, OCR, các API.

## 17. Điều kiện hoàn thành cuối cùng

Chỉ đánh dấu `DONE` khi: (1) mọi yêu cầu mục 1 được thỏa; (2) các test T01–T24 PASS; (3) ứng dụng đọc thật 3 tệp Excel và tạo báo cáo mới không có xã/phường mặc định; (4) hai phiên A/B tồn tại và khôi phục đúng; (5) mọi bảng báo cáo/Excel/PDF hiển thị đúng phạm vi benchmark, đơn vị, phương pháp và ngày chốt; (6) offline thực tế với Chrome và Edge; (7) nguồn gốc từng số có thể truy vết về file/sheet/cell; (8) mã nguồn và bản build độc lập có thể bàn giao cho người khác bảo trì.

---

**Ghi chú:** Một vài tỉ lệ minh họa được làm tròn 2 chữ số thập phân; khi triển khai phải tính trên giá trị số gốc không làm tròn trước, và dùng tolerance khi kiểm thử. Đặc tả này ưu tiên tính đúng số liệu và truy vết nguồn hơn việc sao chép máy móc các tỷ lệ sai hoặc thiếu chú thích trong bảng mẫu.
