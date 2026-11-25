# TÀI LIỆU ÁNH XẠ NGUỒN DỮ LIỆU (SOURCE MAPPINGS)

> **Dự án:** KTXH Offline Report (`cavoixanh638/KTXD-report`)  
> **Tài liệu quy phạm chủ quản:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md` (§4, §4.1, §4.2, §4.3, §4.3a)  
> **Kế hoạch triển khai:** `docs/plans/PHASE_1_RESULT_TEMPLATE.md` (§5, §6, §8)  
> **Dữ liệu kiểm chứng:** `data/reference/MANIFEST.json`, `docs/data_checks/REFERENCE_COVERAGE_20261109.json`  
> **Phiên bản:** V2.2 — Ánh xạ chi tiết 3 profile nguồn cố định cho Cổng PH1

---

## 1. Tổng quan các nguồn tham chiếu (Baseline Workbooks)

Hệ thống xử lý trực tiếp ba bảng tính Excel nguồn gốc, được lưu trữ cố định tại thư mục `data/reference/`. Mọi lần nạp tệp đều phải được xác minh mã băm SHA-256 để bảo đảm tính toàn vẹn dữ liệu:

| Nguồn dữ liệu | Tên tệp gốc | SHA-256 Checksum | Sheet sử dụng | Trạng thái hiển thị sheet | Phạm vi địa phương / bản ghi |
|---|---|---|---|:---:|---|
| **DISB_20261015** | `Báo cáo giải ngân 15.10 sửa(1).xlsx` | `3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c` | `Tổng hợp` | `visible` (index 5) | 114 địa phương (dòng 13..126) |
| **REV_10M_2026** | `Bc thu 10 thang-19.10-BC (1)(1).xlsx` | `b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f` | `10T-19.10` | `visible` (index 0) | 113 địa phương (dòng 11..123) |
| **GPMB_20261026** | `PL01_Tổng hợp DA_26.12.26(1).xlsx` | `d393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f` | `Tổng hợp theo địa bàn` | `visible` (index 0) | 108 địa bàn, 422 dự án (dòng 3..532) |
| *RESULT_REFERENCE* | `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx` | `bd19d2d910619d36dab5e3332ad9c8a491e3652b631e65b81e62bb23e6a4ec51` | `Sheet1` | `visible` (index 0) | Mẫu 14 dòng chỉ tiêu (dòng 3..16) |

---

## 2. Nguồn Giải ngân đầu tư công (`DISB_20261015`)

### 2.1 Cấu trúc Sheet và nguyên tắc chọn Sheet

Tệp có **8 sheet**, trong đó có tới **7 sheet ở trạng thái `hidden`** và chỉ duy nhất **1 sheet ở trạng thái `visible`** nằm tại **index 5**:
1. Index 0: `DA trọng đểm NQ 174` (`hidden`)
2. Index 1: `Vốn NSĐP_DA đường sắt` (`hidden`)
3. Index 2: `Vốn NSTW_DA đường sắt` (`hidden`)
4. Index 3: `Kịch bản update 30,6` (`hidden`)
5. Index 4: `PL01_Các DA TP` (`hidden`)
6. **Index 5: `Tổng hợp` (`visible`)** $\rightarrow$ **Sheet dữ liệu chính thức cần đọc**
7. Index 6: `THBC NSTW` (`hidden`)
8. Index 7: `GTGC tiền đất` (`hidden`)

> **Cảnh báo triển khai:** Tuyệt đối không dùng `workbook.SheetNames[0]` vì sẽ đọc nhầm sheet ẩn `DA trọng đểm NQ 174`. Bộ nạp phải duyệt tìm sheet có `visibility === 'visible'` và khớp cấu trúc schema (`schemaFingerprint`).

### 2.2 Các dòng đặc biệt trong sheet `Tổng hợp`

- **Dòng 1:** Tiêu đề báo cáo và ngày chốt: *"BÁO CÁO GIẢI NGÂN... ĐẾN HẾT NGÀY 15/10/2026"*. Ngày chốt: `2026-10-15`.
- **Dòng 2:** Đơn vị tính: ô `A2` ghi *"Đơn vị: Triệu đồng"*.
- **Dòng 7:** Dòng **Tổng cộng toàn thành phố** (`citySummaryRecord`):
  - Kế hoạch vốn sau điều chỉnh: `F7 = 46.150.296,085 triệu đồng`.
  - Đã giải ngân: `I7 = 31.833.882,636 triệu đồng`.
  - Tỷ lệ giải ngân hiển thị nguồn: $I7 / F7 \approx 68,98\%$.
- **Dòng 12:** Dòng **Tổng khối địa phương (quận/huyện/thị xã/thành phố)**:
  - Kế hoạch vốn sau điều chỉnh: `F12 = 15.550.923,159 triệu đồng`.
  - Đã giải ngân: `I12 = 10.434.921,777 triệu đồng`.
  - Tỷ lệ giải ngân benchmark khối địa phương: $I12 / F12 = 67,10\%$.
- **Dòng 13 đến 126:** Dữ liệu chi tiết của **114 địa phương** (xã, phường, đặc khu). Đây là danh mục địa phương tham chiếu chuẩn (Baseline Population $N=114$).
- **Dòng 145:** Khoản giải ngân ngoài kế hoạch (`unplannedDisbursementRecord`):
  - Số tiền giải ngân: `I145 = 251.163 triệu đồng` ngoài kế hoạch vốn thành phố giao ($F145 = 0$).
  - Khoản này được cộng gộp trong số tổng thành phố `I7`, nhưng **không nằm trong tổng khối địa phương `I12`**.
  - Nếu tính tỷ lệ toàn thành phố loại trừ dòng 145: $(I7 - I145) / F7 = (31.833.882,636 - 251.163) / 46.150.296,085 \approx 68,43\%$.

### 2.3 Ánh xạ chi tiết các cột dữ liệu

| Cột | Tên trường nội bộ | Ý nghĩa nghiệp vụ | Kiểu dữ liệu | Đơn vị | Quy tắc xử lý |
|:---:|---|---|:---:|:---:|---|
| **A** | `stt` | Số thứ tự địa phương | Integer | - | Bắt đầu từ 1 tại dòng 13 đến 114 tại dòng 126. |
| **B** | `localityName` | Tên đơn vị hành chính | String | - | Khóa ghép nối địa phương (chuẩn hóa NFC có dấu). |
| **C** | `initial_total_plan` | Kế hoạch vốn giao ban đầu tổng số | Number / Error | triệu đồng | Một số ô tổng chứa `#VALUE!`. Tuyệt đối không dùng khi bị lỗi, không ép lỗi về 0. |
| **D** | `initial_city_component` | Kế hoạch ban đầu - phần TP quản lý | Number | triệu đồng | Thành phần phân rã ban đầu. |
| **E** | `initial_local_component` | Kế hoạch ban đầu - phần phân cấp xã | Number | triệu đồng | Thành phần phân rã ban đầu. |
| **F** | `adjusted_total_plan` | Kế hoạch vốn sau điều chỉnh tổng số | Decimal | triệu đồng | Mẫu số của tỷ lệ giải ngân (`DISB_PLAN`). Quy đổi tỷ: $\div 1.000$. |
| **G** | `adjusted_city_component` | Vốn sau điều chỉnh - khối TP | Decimal / Null | triệu đồng | Có 67 ô null trong 114 địa phương. |
| **H** | `adjusted_local_component` | Vốn sau điều chỉnh - phân cấp xã | Decimal | triệu đồng | Cân đối: $F = G + H$. |
| **I** | `disbursed_total` | Đã giải ngân tổng số | Decimal | triệu đồng | Tử số của tỷ lệ giải ngân (`DISB_PAID`). Quy đổi tỷ: $\div 1.000$. |
| **J** | `disbursed_city_component` | Giải ngân - khối TP | Decimal / Null | triệu đồng | Có 67 ô null trong 114 địa phương. |
| **K** | `disbursed_local_component` | Giải ngân - cấp xã | Decimal | triệu đồng | Cân đối: $I = J + K$. |
| **L** | `disbursed_construction` | Chi xây lắp, thiết bị, QLDA, tư vấn | Decimal | triệu đồng | Thành phần cơ cấu chi giải ngân. |
| **M** | `disbursed_gpmb` | Chi bồi thường GPMB trong ĐTC | Decimal / Null | triệu đồng | Có 60 ô null trong 114 địa phương (`DISB_GPMB_PAID`). |
| **N** | `disbursed_other` | Chi khác | Decimal / Null | triệu đồng | Có 102 ô null trong 114 địa phương. Cân đối: $I = L + M + N$. |
| **O** | `reported_rate` | Tỷ lệ giải ngân từ nguồn gốc | Number | % | Chỉ dùng để đối chiếu, ứng dụng tự tính lại từ $I / F$. |
| **P** | `inspectionMarker` | Đánh dấu thanh tra / đoàn công tác | String / Null | - | Ghi chú dạng *"Chủ tịch đi 22/10"*. Có **11 địa phương** có dấu. Đây là nhãn kiểm tra hành chính, **không phải ngày chốt dữ liệu** và không dùng để chọn trước địa phương. |
| **Q** | `officialNote` | Ghi chú văn bản chính thức nguyên văn | String / Null | - | Có **25 địa phương** có ghi chú (chứa thông tin loại trừ vốn QĐ 4004 ngày 25/9, đường sắt...). Ban đầu gán nhãn `UNVERIFIED_NOTE`. Không tự động bóc tách % để thay thế $I/F$. |

### 2.4 Xử lý 296 ô trống và kiểm tra cân đối ngang (Quy tắc R02)

- Trong 114 dòng địa phương có tổng cộng **296 ô trống** tập trung tại 4 cột:
  - Cột $G$: 67 ô trống
  - Cột $J$: 67 ô trống
  - Cột $M$: 60 ô trống
  - Cột $N$: 102 ô trống
  - Xuất hiện trên **104 dòng địa phương** khác nhau.
- **Quy tắc:** Giữ nguyên trạng thái `MISSING` tại các ô này. Không tự động chuyển thành `ZERO`.
- **Kiểm tra cân đối ngang:**
  1. $F = G + H$
  2. $I = J + K$
  3. $I = L + M + N$
  - Khi kiểm tra, các ô `MISSING` được coi là phần tử trung hòa phép cộng (giá trị 0) **có kiểm soát**.
  - Nếu tổng khớp (sai số $\le 10^{-5}$): Gắn trạng thái `PASS_WITH_MISSING_COMPONENTS` kèm danh sách ô thiếu.
  - Tuyệt đối không áp dụng giá trị suy diễn này vào phép chia hoặc bảng số liệu báo cáo.

---

## 3. Nguồn Thu ngân sách nhà nước (`REV_10M_2026`)

### 3.1 Cấu trúc Sheet và kiểm soát hiển thị

Tệp gồm **4 sheet**:
1. **Index 0: `10T-19.10` (`visible`)** $\rightarrow$ **Sheet nguồn dữ liệu chính thức**
2. Index 1: `Sheet1` (`hidden`)
3. Index 2: `bc` (`veryHidden`)
4. Index 3: `TMS` (`veryHidden`)

### 3.2 Các dòng đặc biệt và xác nhận ngày chốt

- **Dòng 3:** Tiêu đề kỳ báo cáo: *"BÁO CÁO THU NSNN 10 THÁNG NĂM 2026"*.
- **Dòng 5:** Đơn vị tính ghi tại ô `AC5`: *"Đơn vị: triệu đồng"*.
- **Dòng 8:** Tiêu đề các cột dữ liệu.
- **Dòng 10:** Dòng **Tổng số toàn nguồn** (`summaryRecord`):
  - Dự toán năm tổng số: `C10 = 25.651.713 triệu đồng`.
  - Dự toán thu tiền đất năm: `D10 = 7.182.893 triệu đồng`.
  - Kế hoạch 10 tháng tiền đất: `G10 = 4.823.476 triệu đồng`.
  - Thực hiện tổng thu: `I10 = 28.550.929,455 triệu đồng`.
  - Thực hiện thu tiền đất: `R10 = 9.777.655,455 triệu đồng`.
  - Tỷ lệ thu tiền đất so với dự toán năm: $Y10 = R10 / D10 = 136,12\%$.
  - Tỷ lệ thu tiền đất so với kế hoạch kỳ: $AB10 = R10 / G10 = 202,71\%$.
- **Dòng 11 đến 123:** Dữ liệu chi tiết của **113 địa phương**.
- **Yêu cầu xác nhận ngày chốt (Cutoff Date):** Tiêu đề ghi "10 tháng" nhưng tên tệp và tên sheet ghi "19.10". Hệ thống yêu cầu người dùng xác nhận ngày chốt tại giao diện Nhập nguồn (ô ngày để trống nếu chưa xác nhận, không tự gợi ý ngày mặc định), không tự động suy diễn là ngày `2026-10-31`.

### 3.3 Nguồn thiếu: Đặc khu Bạch Long Vĩ

- So sánh với Baseline 114 địa phương của DISB, nguồn REV **thiếu đúng 1 địa phương**:
  - Tên: **Đặc khu Bạch Long Vĩ**
  - Trạng thái: `NO_LOCALITY_RECORD`
  - Lý do: Không có dòng địa phương trong bảng tính thu ngân sách.
- **Nguyên tắc xử lý:** Không gán tổng của 113 địa phương thành tổng của 114 địa phương. Không tự ý thêm dòng Bạch Long Vĩ với giá trị 0. Benchmark thu ngân sách phải ghi rõ nhãn phạm vi: *"113 địa phương có dữ liệu"*.

### 3.4 Ánh xạ chi tiết các cột dữ liệu

| Cột | Tên trường nội bộ | Ý nghĩa nghiệp vụ | Đơn vị | Quy tắc xử lý & ghi chú |
|:---:|---|---|:---:|---|
| **A** | `stt` | Số thứ tự | - | STT từ 1 đến 113. |
| **B** | `localityName` | Tên địa phương | - | Khóa ghép nối địa phương. |
| **C** | `annual_total_budget` | Dự toán thu năm tổng số | triệu đồng | Trường nguồn cho `REV_BUDGET_Y`. Quy đổi tỷ: $\div 1.000$. |
| **D** | `annual_land_budget` | Dự toán thu năm - tiền sử dụng đất | triệu đồng | Có **5 dòng có $D=0, R>0$** (dòng 15, 26, 42, 57, 114). Mẫu số cho `REV_LAND_RATE_Y`. |
| **E** | `annual_nonland_budget` | Dự toán thu năm - thuế, phí (không đất) | triệu đồng | $E = C - D$. Mẫu số cho `REV_NONLAND_RATE_Y`. |
| **F** | `period_total_plan` | Kế hoạch 10 tháng tổng số | triệu đồng | Mẫu số cho `REV_RATE_P`. |
| **G** | `period_land_plan` | Kế hoạch 10 tháng - tiền sử dụng đất | triệu đồng | Có **6 dòng có $G=0, R>0$** (dòng 15, 26, 28, 42, 57, 114). Mẫu số cho `REV_LAND_RATE_P`. |
| **H** | `period_nonland_plan` | Kế hoạch 10 tháng - thuế, phí (không đất) | triệu đồng | $H = F - G$. Mẫu số cho `REV_NONLAND_RATE_P`. |
| **I** | `actual_total_revenue` | Thực hiện tổng thu lũy kế | triệu đồng | Trường nguồn cho `REV_REALIZED`. Quy đổi tỷ: $\div 1.000$. |
| **J** | `actual_nonstate_sector` | Thu khu vực kinh tế ngoài quốc doanh | triệu đồng | $J = K + L + M + N$. |
| **K..N**| `actual_tax_components` | Chi tiết thuế GTGT, TTĐB, TNDN, tài nguyên | triệu đồng | Là thành phần chi tiết của $J$, **không cộng lặp lại vào tổng $I$**. |
| **O..Q**| `actual_other_components`| Thuế TNCN, tiền thuê đất, lệ phí trước bạ... | triệu đồng | Thành phần cấu thành tổng thu $I$. |
| **R** | `actual_land_revenue` | Thu tiền sử dụng đất thực tế | triệu đồng | Tử số cho cả hai tỷ lệ thu tiền đất `REV_LAND_RATE_Y` và `REV_LAND_RATE_P`. |
| **S..V**| `actual_fees_components` | Thuế sử dụng đất PNN, phí, lệ phí... | triệu đồng | Thành phần cấu thành tổng thu $I$. |
| **W** | `actual_nonland_revenue` | Thu không gồm tiền sử dụng đất | triệu đồng | Tính bằng $W = I - R$. Tử số cho `REV_NONLAND_RATE_Y` và `REV_NONLAND_RATE_P`. |
| **X** | `rate_y_source` | Tỷ lệ tổng thu / dự toán năm ($I/C$) | % | Đối chiếu tỷ lệ `REV_RATE_Y`. Tái tính từ số tiền. |
| **Y** | `land_rate_y_source` | Tỷ lệ thu đất / dự toán năm ($R/D$) | % | Đối chiếu tỷ lệ `REV_LAND_RATE_Y`. Tái tính từ số tiền. |
| **Z** | `nonland_rate_y_source`| Tỷ lệ thu không đất / dự toán năm ($W/E$) | % | Đối chiếu tỷ lệ `REV_NONLAND_RATE_Y`. Tái tính từ số tiền. |
| **AA**| `rate_p_source` | Tỷ lệ tổng thu / kế hoạch kỳ ($I/F$) | % | Đối chiếu tỷ lệ `REV_RATE_P`. Tái tính từ số tiền. |
| **AB**| `land_rate_p_source` | Tỷ lệ thu đất / kế hoạch kỳ ($R/G$) | % | Đối chiếu tỷ lệ `REV_LAND_RATE_P`. Tái tính từ số tiền. |
| **AC**| `nonland_rate_p_source`| Tỷ lệ thu không đất / kế hoạch kỳ ($W/H$) | % | Đối chiếu tỷ lệ `REV_NONLAND_RATE_P`. Ô `AC9` chú giải nhầm, công thức thực tế là $W/H$. |

### 3.5 Các dòng mẫu số bằng 0 có thực thu dương (Quy tắc R04)

- **5 dòng có $D=0$ nhưng $R>0$ (Dự toán năm tiền đất = 0):**
  1. Dòng 15: Huyện Tiên Lãng ($R = 218.436$ triệu đồng)
  2. Dòng 26: Phường Việt Khê ($R = 10.932$ triệu đồng)
  3. Dòng 42: Xã Vĩnh Thuận ($R = 18.704$ triệu đồng)
  4. Dòng 57: Xã Hồng An ($R = 18.921$ triệu đồng)
  5. Dòng 114: Xã Hùng Thắng ($R = 2.297$ triệu đồng)
  - Tổng thực thu tiền đất của nhóm này: **269.290 triệu đồng**.
- **6 dòng có $G=0$ nhưng $R>0$ (Kế hoạch kỳ tiền đất = 0):**
  - Gồm 5 địa phương trên cộng thêm Dòng 28: Xã An Khánh ($R = 35.500$ triệu đồng).
  - Tổng thực thu tiền đất của nhóm này: **304.790 triệu đồng**.

---

## 4. Nguồn Giải phóng mặt bằng (`GPMB_20261026`)

### 4.1 Cấu trúc Sheet và nguyên tắc nhận dạng dữ liệu hỗn hợp

Tệp gồm **1 sheet duy nhất**: `Tổng hợp theo địa bàn` (`visible`).
- **Dòng 1:** Ngày chốt báo cáo: `26/10/2026`.
- **Dòng 2:** Tiêu đề các cột dữ liệu.
- **Dòng 3 đến 532:** Bảng dữ liệu hỗn hợp gồm hai loại dòng đan xen:
  1. **Dòng nhóm địa bàn (Locality Group Row):** Cột $A$ trống; Cột $B$ là tên xã/phường/đặc khu. Toàn bộ sheet có **108 địa bàn**.
  2. **Dòng dự án (Project Row):** Cột $A$ chứa số nguyên STT từ `1` đến `422`. Mỗi dự án thuộc về địa bàn gần nhất nằm phía trên nó. Toàn bộ sheet có đúng **422 dòng dự án**.

### 4.2 Sáu địa bàn thiếu nguồn hoàn toàn (`NO_LOCALITY_RECORD`)

So với Baseline 114 địa phương của DISB, nguồn GPMB **thiếu đúng 6 địa bàn**:
1. **Phường Lưu Kiếm**
2. **Phường Ái Quốc**
3. **Xã Hùng Thắng**
4. **Xã Thái Tân**
5. **Xã Tân Minh**
6. **Đặc khu Bạch Long Vĩ**

> **Nguyên tắc nghiệp vụ:** Hệ thống ghi nhận trạng thái `NO_LOCALITY_RECORD`. Tuyệt đối không suy diễn lý do kinh tế/hành chính (như "không có dự án GPMB"), không tự điền số 0%, và không gọi mốc chuẩn GPMB 108 địa bàn là mốc của 114 địa phương.

### 4.3 Ba dòng dự án thiếu diện tích hoàn thành $I$ (`PARTIAL_AGGREGATE`)

Trong 422 dự án, có đúng **3 dự án có diện tích phải thu hồi $D > 0$ nhưng cột $I$ (và $J, K, L, M$) bị bỏ trống**:
1. **Dòng 107** (STT 85, Phường Kinh Môn): $D = 5.050\text{ m}²$; $I, M$ để trống.
2. **Dòng 173** (STT 137, Phường Tân Hưng): $D = 1.190\text{ m}²$; $I, M$ để trống.
3. **Dòng 365** (STT 292, Xã Kiến Hưng): $D = 5.219\text{ m}²$; $I, M$ để trống.
- **Tổng diện tích phải GPMB bị thiếu:** $5.050 + 1.190 + 5.219 = \mathbf{11.459\text{ m}²}$.
- **Nguyên tắc tính toán:**
  - Tổng diện tích phải GPMB toàn bộ 108 địa bàn: $\sum D = \mathbf{55.398.165\text{ m}²}$.
  - Tổng diện tích đã GPMB đã ghi nhận: $\sum I = \mathbf{39.960.463,6\text{ m}²}$.
  - Tỷ lệ theo diện tích đã ghi nhận: $\frac{39.960.463,6}{55.398.165} \approx \mathbf{72,13\%}$.
  - Trạng thái trả về: `PARTIAL_AGGREGATE` kèm cảnh báo còn 3 dự án thiếu dữ liệu. Tuyệt đối không tự điền $I=0$.

### 4.4 Mười hai dòng dự án có tỷ lệ $M$ nguồn lệch quá 0,1 điểm %

Quy tắc kiểm tra: Chỉ áp dụng trên **dòng dự án** ($A$ là STT 1..422), có $D > 0$ và cả $I, M$ đều là số hợp lệ.  
Công thức: $\Delta = M - \left(100 \times \frac{I}{D}\right)$. Phát cảnh báo `WARNING_M_RATIO_MISMATCH` khi $|\Delta| > 0,1\text{ điểm \%}$.

| STT DA | Dòng | Địa phương | Ô D | Ô I | Ô M nguồn | Tỷ lệ tính lại $100 \times I / D$ | Chênh lệch $\Delta$ (điểm %) |
|:---:|:---:|---|:---:|:---:|---:|---:|---:|
| 75 | 95 | Phường Hưng Đạo | D95 | I95 | 101,89% | 116,79% | -14,90 |
| 192 | 239 | Xã An Khánh | D239 | I239 | 100,00% | 112,05% | -12,05 |
| 202 | 252 | Xã An Quang | D252 | I252 | 52,10% | 51,60% | +0,50 |
| 243 | 303 | Xã Đường An | D303 | I303 | 100,00% | 176,80% | -76,80 |
| 263 | 327 | Xã Hà Đông | D327 | I327 | 98,62% | 103,99% | -5,37 |
| 310 | 386 | Xã Kim Thành | D386 | I386 | 90,30% | 98,82% | -8,52 |
| 353 | 440 | Xã Ninh Giang | D440 | I440 | 99,96% | 87,72% | +12,24 |
| 354 | 441 | Xã Ninh Giang | D441 | I441 | 99,83% | 96,80% | +3,03 |
| 380 | 474 | Xã Thượng Hồng | D474 | I474 | 97,37% | 83,46% | +13,91 |
| 389 | 487 | Xã Trường Tân | D487 | I487 | 100,00% | 1133,86% | -1033,86 |
| 418 | 528 | Đặc khu Cát Hải | D528 | I528 | 53,20% | 37,42% | +15,78 |
| 421 | 531 | Đặc khu Cát Hải | D531 | I531 | 99,63% | 23,81% | +75,82 |

> **Quy định bắt buộc:** 12 cảnh báo trên được hiển thị trong bảng kiểm tra chất lượng dữ liệu nguồn (QC) để người dùng nắm bắt và giải trình. Hệ thống tuyệt đối không tự ý sửa số liệu ô $M$, ô $I$ hoặc ô $D$ của nguồn gốc.

### 4.5 Ánh xạ chi tiết các cột dữ liệu GPMB

| Cột | Tên trường nội bộ | Ý nghĩa nghiệp vụ | Đơn vị nguồn | Đơn vị chuẩn / hiển thị | Quy tắc chuyển đổi & tính toán |
|:---:|---|---|:---:|:---:|---|
| **A** | `sttOrEmpty` | STT dự án (hoặc trống) | Integer / Empty | - | Trống = Dòng nhóm địa bàn; Số nguyên 1..422 = Dòng dự án. |
| **B** | `nameOrProject` | Tên địa bàn hoặc tên dự án | String | - | Ở dòng nhóm là tên địa phương; ở dòng dự án là tên công trình/dự án. |
| **C** | `capitalType` | Loại nguồn vốn | String | - | Vốn ngân sách tỉnh/huyện/trung ương... |
| **D** | `declaredArea_m2` | Diện tích phải thu hồi / GPMB | m² | m² hoặc ha | Mẫu số của tỷ lệ GPMB (`GPMB_AREA_PLAN`). Đổi sang ha: $\div 10.000$. |
| **E** | `organizations_plan` | Số tổ chức phải thu hồi | Số lượng | tổ chức | Số nguyên đếm. |
| **F** | `households_plan` | Số hộ gia đình phải thu hồi | Số lượng | hộ | Số nguyên đếm. |
| **G** | `budget_allocated_vnd` | Kinh phí phân bổ GPMB | đồng (VND) | tỷ đồng | Trường nguồn cho `GPMB_BUDGET`. Đổi sang tỷ đồng: $\div 10^9$. |
| **H** | `deadline` | Thời hạn hoàn thành | Date / Text | YYYY-MM-DD | Dùng để cảnh báo dự án quá hạn. |
| **I** | `recordedArea_m2` | Diện tích đã thu hồi / GPMB | m² | m² hoặc ha | Tử số của tỷ lệ GPMB (`GPMB_AREA_DONE`). Đổi sang ha: $\div 10.000$. |
| **J** | `budget_spent_vnd` | Kinh phí đã chi trả bồi thường | đồng (VND) | tỷ đồng | Trường nguồn cho `GPMB_PAID`. Đổi sang tỷ đồng: $\div 10^9$. |
| **K** | `organizations_done` | Số tổ chức đã GPMB | Số lượng | tổ chức | Số nguyên đếm. |
| **L** | `households_done` | Số hộ gia đình đã GPMB | Số lượng | hộ | Số nguyên đếm. |
| **M** | `reportedRatio_pct` | Tỷ lệ báo cáo từ nguồn | % (hoặc số 100) | - | Chỉ dùng để đối chiếu chất lượng QA ở dòng dự án. **Không dùng làm tỷ lệ báo cáo.** |
| **N** | `statusText` | Trạng thái dự án | String | - | Hoàn thành, đang thực hiện, vướng mắc... |
| **O** | `resolution11` | Phân loại Nghị quyết 11 | String / Null | - | Tiêu chí phân nhóm nghị quyết HĐND. |
| **P** | `projectGroup` | Nhóm dự án | String / Null | - | Dự án trọng điểm, nhóm A, B, C... |

## Bổ sung nguồn tháng 11/2026

Các bảng ánh xạ phía trên là **file tham chiếu gốc tháng 10**, không áp dụng vị trí tuyệt đối cho mọi workbook.

| Vai trò | REV tháng 10 (gốc SHA đã xác minh) | REV đến 23/11/2026 |
|---|---|---|
| Dự toán năm tổng/đất/không đất | C/D/E | C/D/E |
| Kế hoạch kỳ tổng/đất/không đất | F/G/H | F/G/H |
| Lũy kế tổng/đất/không đất | I/R/W | I/S/X |
| Tỷ lệ nguồn (chỉ đối chiếu) | X:AC | Nhận diện nhóm tiêu đề sau lũy kế trừ đất |

`REV_HEADER_SEMANTIC_V3` nhận vai trò qua tiêu đề, nhóm kế hoạch/thực hiện và thứ tự tương đối; nếu chèn cột, tiếp tục tìm cột đúng. Chỉ file gốc byte-identical dùng `REV_ADAPTER_V2.2`. Trùng/thiếu vai trò bắt buộc → BLOCKER_MAPPING_REQUIRED. Ngày chốt cụ thể trong tiêu đề hoặc người dùng xác nhận; không dựa tên sheet.

| Profile DISB | Kế hoạch sau điều chỉnh | Giải ngân | Tỷ lệ đối chiếu | Ghi chú | Dòng địa phương |
|---|---|---|---|---|---|
| DISB_V1 (gốc) | F | I | O | Q | 13–126 |
| DISB_TOTAL_LOCALITY_V2 | F | I | M | N | thường 8–121 |
| DISB_PHAN_CAP_XA_V1 | C | G | K | L | thường 8–121 |
| DISB_PHAN_CAP_XA_V2 | F | J | N | O | thường 8–121 |

DISB_TOTAL_LOCALITY_V2 chỉ có tổng C/F/I và hai thành phần tương ứng D+E/G+H/J+K; không áp dụng quy tắc I=L+M+N của mẫu gốc. Không đọc 109 địa phương do bỏ 5 dòng đầu; không lấy dòng tổng giả, không dùng L/M/N làm tiền xây dựng/GPMB/khác. Truy vết địa chỉ thực, tính phạm vi thực, không ghi cứng 114 nếu nguồn thiếu.

### Ngày chốt và chọn nguồn mới nhất

DISB/GPMB chỉ nhận ngày hợp lệ duy nhất trong tiêu đề A1 hoặc ngày người dùng xác nhận; CSV/bảng phẳng GPMB không dùng deadline hay tên file. Không tự gán ngày mẫu cho nguồn thiếu ngày. REV dùng tiêu đề A3 theo quy tắc cũ. Legacy DISB/GPMB thiếu chứng cứ A1 đáng tin cần xác nhận lại. Scope DISB TOTAL và ALLOCATED không thay thế nhau tự động. Xem MASTER mục 5.
