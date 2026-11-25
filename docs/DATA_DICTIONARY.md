# TỪ ĐIỂN DỮ LIỆU CHỈ TIÊU KINH TẾ - XÃ HỘI (DATA DICTIONARY)

> **Dự án:** KTXH Offline Report (`cavoixanh638/KTXD-report`)  
> **Tài liệu quy phạm chủ quản:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md` (§5, §6, §6A)  
> **Kế hoạch triển khai:** `docs/plans/PHASE_1_RESULT_TEMPLATE.md` (§2)  
> **Phiên bản:** V2.2 — Cập nhật phục vụ Cổng nghiệm thu PH1 & PH2  
> **Môi trường hoạt động:** 100% Offline trên Chrome & Edge (`file://.../dist/index.html`)

---

## 1. Trạng thái dữ liệu chuẩn (`ValueState`)

Trong toàn bộ hệ thống, mọi giá trị ô trích xuất từ nguồn hoặc qua tính toán nội bộ đều phải mang một trong các trạng thái quy chuẩn sau. Tuyệt đối không quy đồng giá trị `MISSING` hoặc `ERROR` thành số `0`.

| Mã trạng thái (`ValueState`) | Tên hiển thị tiếng Việt | Ý nghĩa nghiệp vụ | Nguyên tắc xử lý trong tính toán |
|---|---|---|---|
| `VALUE` | Có giá trị | Giá trị số hợp lệ được trích xuất trực tiếp từ ô nguồn hoặc tính toán thành công. | Tham gia đầy đủ vào các phép tính `SUM`, `DIV`, tỷ lệ benchmark. |
| `ZERO` | Số 0 hợp lệ | Giá trị số `0` được ghi rõ ràng trong nguồn dữ liệu gốc (không phải ô trống). | Đóng góp vào `SUM` tử số nếu là tử; nếu là mẫu số cấp dòng thì kích hoạt trạng thái `DENOMINATOR_ZERO`, nhưng vẫn đóng góp `0` vào mẫu số benchmark tổng và tử số tương ứng vào tử số benchmark (Quy tắc R04). |
| `MISSING` | Chưa có số liệu | Ô trống trong bảng tính Excel nguồn, hoặc địa phương không có bản ghi trong nguồn. | Không tự động chuyển thành `0`. Hiển thị nhãn *"Chưa có số liệu"*. Trong kiểm tra cân đối nội bộ DISB, được coi là phần tử trung hòa cộng có kiểm soát (`PASS_WITH_MISSING_COMPONENTS`), nhưng không đóng góp số vào báo cáo chính. |
| `FORMULA_ERROR` | Lỗi công thức nguồn | Ô nguồn chứa lỗi tính toán của Excel (`#REF!`, `#VALUE!`, `#DIV/0!`, `#N/A`, `#NAME?`). | Giữ nguyên trạng thái lỗi, cảnh báo người dùng. Tuyệt đối không lấy giá trị cached lỗi làm số liệu báo cáo. |
| `INVALID` | Dữ liệu không hợp lệ | Ô nguồn chứa chuỗi ký tự không thể chuyển đổi thành số hợp lệ, hoặc không đúng định dạng schema kỳ vọng. | Loại khỏi phép tính và ghi rõ lý do trong hồ sơ `CalculationTrace`. |
| `NOT_APPLICABLE` | Không áp dụng | Chỉ tiêu hoặc phép tính không áp dụng đối với đối tượng này (ví dụ: chỉ tiêu dự án áp dụng cho địa bàn không có dự án). | Không tính toán, hiển thị dấu gạch ngang `-` hoặc nhãn giải trình. |
| `OUT_OF_SCOPE` | Ngoài phạm vi | Bản ghi hoặc ô dữ liệu nằm ngoài phạm vi được người dùng lựa chọn cho phiên báo cáo hiện tại. | Không tham gia vào tập tính toán của phiên. |

---

## 2. Quy định quy đổi đơn vị và làm tròn

### 2.1 Bảng quy đổi đơn vị chuẩn (`Unit Conversion`)

Nội bộ hệ thống luôn lưu trữ và tính toán bằng số học chính xác (`Decimal`), không lưu chuỗi chứa chữ hoặc làm tròn giữa chừng. Chuyển đổi đơn vị tuân theo các hệ số bất biến:

| Đơn vị gốc trong nguồn | Đơn vị chuẩn hóa / hiển thị | Hệ số quy đổi | Công thức áp dụng | Ghi chú nguồn dữ liệu |
|---|---|---:|---|---|
| `triệu đồng` | `tỷ đồng` | $\div 1.000$ | `gia_tri_ty = gia_tri_trieu / 1000` | Nguồn `DISB` (cột C..N) và `REV` (cột C..W). |
| `đồng` (VND) | `tỷ đồng` | $\div 1.000.000.000$ | `gia_tri_ty = gia_tri_dong / 1e9` | Nguồn `GPMB` (cột G kinh phí phân bổ, cột J kinh phí đã chi). |
| `đồng` (VND) | `triệu đồng` | $\div 1.000.000$ | `gia_tri_trieu = gia_tri_dong / 1e6` | Sử dụng khi người dùng cấu hình đơn vị hiển thị tiền là triệu đồng. |
| `m²` | `ha` | $\div 10.000$ | `gia_tri_ha = gia_tri_m2 / 10000` | Nguồn `GPMB` (cột D diện tích phải GPMB, cột I diện tích đã GPMB). |
| `tỷ lệ fraction` | `%` (phần trăm) | $\times 100$ | `hien_thi_pct = fraction * 100` | Lưu nội bộ dạng số thập phân thập phân (ví dụ `0.6710`), khi hiển thị nhân 100 thành `67,10%`. |
| `chênh lệch tỷ lệ` | `điểm phần trăm` (pp) | Trừ đại số | `delta_pp = rate_a_pct - rate_b_pct` | Khi so sánh hai tỷ lệ, chênh lệch luôn gọi là **điểm phần trăm** (điểm %), tuyệt đối không gọi là tăng/giảm phần trăm tương đối. |

> **Lưu ý đặc thù cột M nguồn GPMB:** Trong tệp Excel GPMB gốc, cột M thường được người lập biểu nhập sẵn dưới dạng số phần trăm nhân 100 (ví dụ `100` hoặc `67.1`). Khi đối chiếu với tỷ lệ tính lại `100 * I / D`, hệ thống so sánh trực tiếp trên thang điểm 100.

### 2.2 Quy định làm tròn thập phân

1. Mọi phép cộng, trừ, nhân, chia tích lũy được thực hiện trên đối tượng `Decimal` chính xác nguyên bản, **không làm tròn trung gian**.
2. Phép làm tròn chỉ được thực hiện ở **bước trình bày cuối cùng** trước khi render UI hoặc xuất XLSX/PDF.
3. Phương pháp làm tròn mặc định: `ROUND_HALF_UP` (làm tròn số học nửa lên).
4. Số chữ số thập phân mặc định:
   - Số tiền (`tỷ đồng`): 2 chữ số thập phân (ví dụ: `35,68 tỷ đồng`).
   - Tỷ lệ phần trăm (`%`): 2 chữ số thập phân (ví dụ: `67,10%`).
   - Diện tích `m²`: 0 chữ số thập phân (số nguyên, ví dụ: `119.280 m²`); nếu đổi sang `ha`: 2 chữ số thập phân.
   - Số lượng tổ chức, hộ gia đình: 0 chữ số thập phân (số nguyên).
5. Mọi thao tác làm tròn đều được ghi nhận là một bước (`ROUND`) trong `CalculationTrace`, nêu rõ giá trị trước và sau làm tròn.

---

## 3. Danh mục chỉ tiêu mặc định hệ thống (§5 MASTER V2.2)

Hệ thống định nghĩa danh mục các chỉ tiêu mặc định, liên kết trực tiếp với các trường dữ liệu từ 3 nguồn: Thu ngân sách (`REV`), Giải ngân đầu tư công (`DISB`) và Giải phóng mặt bằng (`GPMB`).

### 3.1 Bảng danh mục chỉ tiêu chi tiết

| Mã chỉ tiêu (`id`) | Tên chỉ tiêu | Nguồn | Trường / Công thức nguồn | Đơn vị gốc | Đơn vị chuẩn | Định dạng hiển thị | Phương pháp tính tổng gộp / Benchmark |
|---|---|:---:|---|:---:|:---:|:---:|---|
| `REV_BUDGET_Y` | Dự toán thu NSNN năm | REV | Cột `C` theo địa phương | triệu đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(C) / 1000` |
| `REV_REALIZED` | Tổng thu NSNN lũy kế | REV | Cột `I` theo địa phương | triệu đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(I) / 1000` |
| **`REV_RATE_Y`** | Tỷ lệ tổng thu so với dự toán năm | REV | Cột `I / C` | fraction | % | Phần trăm (2 chữ số) | **Benchmark:** `SUM(I) / SUM(C)` |
| **`REV_RATE_P`** | Tỷ lệ tổng thu so với kế hoạch kỳ (10 tháng) | REV | Cột `I / F` | fraction | % | Phần trăm (2 chữ số) | **Benchmark:** `SUM(I) / SUM(F)` |
| **`REV_LAND_RATE_Y`** | Tỷ lệ thu tiền sử dụng đất so với dự toán năm | REV | Cột `R / D` | fraction | % | Phần trăm (2 chữ số); `D=0, R>0`: *Phát sinh ngoài dự toán* | **Benchmark:** `SUM(R) / SUM(D)` (gồm cả dòng D=0, R>0 theo Quy tắc R04) |
| **`REV_LAND_RATE_P`** | Tỷ lệ thu tiền sử dụng đất so với kế hoạch kỳ | REV | Cột `R / G` | fraction | % | Phần trăm (2 chữ số); `G=0, R>0`: *Phát sinh ngoài kế hoạch* | **Benchmark:** `SUM(R) / SUM(G)` (gồm cả dòng G=0, R>0 theo Quy tắc R04) |
| **`REV_NONLAND_RATE_Y`** | Tỷ lệ thu không gồm tiền đất so với dự toán năm | REV | Cột `W / E` | fraction | % | Phần trăm (2 chữ số) | **Benchmark:** `SUM(W) / SUM(E)` |
| **`REV_NONLAND_RATE_P`** | Tỷ lệ thu không gồm tiền đất so với kế hoạch kỳ | REV | Cột `W / H` | fraction | % | Phần trăm (2 chữ số) | **Benchmark:** `SUM(W) / SUM(H)` |
| `DISB_PLAN` | Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung | DISB | Cột `F` theo địa phương | triệu đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(F) / 1000` |
| `DISB_PAID` | Đã giải ngân đầu tư công | DISB | Cột `I` theo địa phương | triệu đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(I) / 1000` |
| `DISB_RATE` | Tỷ lệ giải ngân đầu tư công | DISB | Cột `I / F` | fraction | % | Phần trăm (2 chữ số) | **Benchmark:** `SUM(I) / SUM(F)` trên 114 địa phương (hoặc tập hợp có dữ liệu) |
| `DISB_GPMB_PAID` | Giải ngân bồi thường GPMB (trong vốn ĐTC) | DISB | Cột `M` theo địa phương | triệu đồng | tỷ đồng | Số thập phân (2 chữ số); ô trống ghi *Chưa có số liệu* | `SUM(M) / 1000` trên các dòng có giá trị |
| `DISB_PLAN_PER_UNIT` | Vốn giao bình quân một địa phương | DISB | Mốc chuẩn: `SUM(F) / N` | triệu đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(F của 114 địa phương) / 114` |
| `GPMB_BUDGET` | Kinh phí được phân bổ GPMB | GPMB | Tổng cột `G` các dự án thuộc địa bàn | đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(G) / 1e9` |
| `GPMB_PAID` | Kinh phí đã chi GPMB | GPMB | Tổng cột `J` các dự án thuộc địa bàn | đồng | tỷ đồng | Số thập phân (2 chữ số) | `SUM(J) / 1e9` |
| `GPMB_AREA_PLAN` | Diện tích phải GPMB của từng địa phương | GPMB | Tổng cột `D` các dự án thuộc địa bàn | m² | m² hoặc ha | Số nguyên (m²) hoặc 2 chữ số (ha) | `SUM(D)` |
| `GPMB_AREA_DONE` | Diện tích đã GPMB | GPMB | Tổng cột `I` các dự án thuộc địa bàn | m² | m² hoặc ha | Số nguyên (m²) hoặc 2 chữ số (ha) | `SUM(I)` trên các dự án đã ghi nhận |
| **`GPMB_AREA_RATE`** | **Tỷ lệ hoàn thành GPMB theo diện tích** | GPMB | `SUM(I dự án) / SUM(D dự án)` | fraction | % | Phần trăm (2 chữ số); có cờ `PARTIAL_AGGREGATE` nếu thiếu I | **Phương pháp DUY NHẤT:** `SUM(I) / SUM(D)`. Tuyệt đối không tính bình quân tỷ lệ dự án M. |
| `GPMB_M_SOURCE_MISMATCH` | Cờ sai khác tỷ lệ M nguồn ở dòng dự án | GPMB | `M - (100 * I / D)` | điểm % | điểm % | Cảnh báo chất lượng QA (`WARNING` nếu \|$\Delta$\| > 0,1 điểm %) | **Chỉ áp dụng cấp dòng dự án** (STT 1..422, D>0, I/M là số), KHÔNG phải chỉ tiêu báo cáo. |
| `GPMB_BUDGET_RATE` | Tỷ lệ chi kinh phí GPMB so với phân bổ | GPMB | `SUM(J dự án) / SUM(G dự án)` | fraction | % | Phần trăm (2 chữ số) | `SUM(J) / SUM(G)` |
| `COMPARISON_LABEL` | Nhận xét so với mốc chuẩn | Tổng hợp | So sánh tỷ lệ với Benchmark theo ngưỡng | text | text | Chuỗi ký tự (*Cao hơn*, *Thấp hơn*, *Tương đương*, *Chưa đủ cơ sở*) | Đánh giá dựa trên chênh lệch điểm phần trăm và độ đầy đủ dữ liệu. |

---

## 4. Bắt buộc 6 mã tỷ lệ Thu ngân sách (REV Rates — Test T57)

Nhằm đảm bảo tính nhất quán giữa hệ thống chỉ tiêu, màn hình giao diện và bộ kiểm thử tự động (đặc biệt là bài kiểm tra quy chuẩn `T57`), hệ thống chuẩn hóa đầy đủ 6 mã tỷ lệ thu ngân sách đối chiếu trực tiếp với các cột `X:AC` của sheet `10T-19.10`:

| STT | Mã tỷ lệ quy chuẩn | Cột nguồn tương ứng | Công thức toán học | Tử số nghiệp vụ | Mẫu số nghiệp vụ | Quy tắc xử lý khi mẫu số = 0 |
|:---:|---|:---:|:---:|---|---|---|
| 1 | `REV_RATE_Y` | Cột `X` | $I / C$ | Thực thu NSNN tổng số (`I`) | Dự toán thu năm tổng số (`C`) | Nếu $C=0, I>0$: Phát sinh ngoài dự toán; Nếu $C=0, I=0$: Không có cơ sở tính. |
| 2 | `REV_LAND_RATE_Y` | Cột `Y` | $R / D$ | Thực thu tiền sử dụng đất (`R`) | Dự toán thu tiền sử dụng đất năm (`D`) | Nếu $D=0, R>0$: *Phát sinh ngoài dự toán* (vẫn cộng $R$ vào benchmark theo R04). |
| 3 | `REV_NONLAND_RATE_Y` | Cột `Z` | $W / E$ | Thực thu không gồm tiền đất ($W = I - R$) | Dự toán thu không gồm tiền đất năm ($E = C - D$) | Nếu $E=0, W>0$: Phát sinh ngoài dự toán. |
| 4 | `REV_RATE_P` | Cột `AA` | $I / F$ | Thực thu NSNN tổng số (`I`) | Kế hoạch thu kỳ 10 tháng tổng số (`F`) | Nếu $F=0, I>0$: Phát sinh ngoài kế hoạch. |
| 5 | **`REV_LAND_RATE_P`** | Cột `AB` | $R / G$ | Thực thu tiền sử dụng đất (`R`) | Kế hoạch thu tiền đất kỳ 10 tháng (`G`) | Nếu $G=0, R>0$: *Phát sinh ngoài kế hoạch* (vẫn cộng $R$ vào benchmark theo R04). |
| 6 | `REV_NONLAND_RATE_P` | Cột `AC` | $W / H$ | Thực thu không gồm tiền đất ($W = I - R$) | Kế hoạch thu không gồm đất kỳ 10 tháng ($H = F - G$) | Nếu $H=0, W>0$: Phát sinh ngoài kế hoạch. |

> **Khuyến cáo kiểm tra công thức nguồn:** Chú giải tại ô `AC9` của bảng tính gốc ghi nhầm tên công thức, nhưng công thức tính toán thực tế trong các ô dữ liệu là `W / H`. Ứng dụng luôn tái tính từ số tiền gốc nguyên bản, không phụ thuộc vào ô tỷ lệ nguồn.

---

## 5. Danh mục 14 dòng báo cáo mẫu (§2 Kế hoạch con PH1)

Dưới đây là cấu hình chi tiết cho 14 dòng báo cáo chuẩn kế thừa từ dòng 3 đến 16 của `Sheet1` tệp mẫu `Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx`.

| Dòng mẫu | Mã chỉ tiêu ánh xạ | Nhãn chỉ tiêu mặc định (Người dùng có thể đổi) | Cách tạo từ nguồn dữ liệu | Quy tắc tính toán & hiển thị |
|:---:|---|---|---|---|
| **3** | `REV_BUDGET_Y` | Dự toán thu NSNN năm | `REV` cột `C` theo địa phương | Chia 1.000 đổi sang tỷ đồng. Hiển thị số thập phân (2 chữ số). Đơn vị hiển thị nằm ở tiêu đề cột/bảng. |
| **4** | `REV_RATE_Y` | Tỷ lệ thu NSNN của từng địa phương so với dự toán | `REV` cột $I / C \times 100$ | Hiển thị dạng `%` (2 chữ số). Nếu $C=0$: không chia, hiển thị giải trình trạng thái `DENOMINATOR_ZERO`. |
| **5** | `REV_LAND_RATE_Y` | Trong đó: tỷ lệ thu tiền sử dụng đất | `REV` cột $R / D \times 100$ | Hiển thị dạng `%` (2 chữ số). Nếu $D=0, R>0$: hiển thị *"Phát sinh ngoài dự toán"*, không gán 0% hoặc lỗi. |
| **6** | `REV_NONLAND_RATE_Y` | Tỷ lệ thu không gồm tiền đất | `REV` cột $W / E \times 100$ ($W = I - R, E = C - D$) | Hiển thị dạng `%` (2 chữ số). Không tính trùng các sắc thuế thành phần chi tiết. |
| **7** | `DISB_PLAN` | Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung | `DISB` cột `F` theo địa phương | Chia 1.000 đổi sang tỷ đồng. Hiển thị số thập phân (2 chữ số). |
| **8** | `DISB_PLAN_PER_UNIT` | So với mức vốn giao bình quân một địa phương | So sánh $F$ của địa phương với mốc $\sum(F_{114})/114$ | Mốc tiền vốn tuyệt đối (triệu/tỷ đồng), không lấy trung bình tỷ lệ. Nêu rõ chênh lệch tiền và tỷ lệ so với mức bình quân. |
| **9** | `DISB_RATE` (Benchmark) | Tỷ lệ giải ngân trung bình của 114 địa phương (nhãn quy ước; phạm vi tính động) | `DISB` $\frac{\sum_{13}^{126} I}{\sum_{13}^{126} F} \times 100$ | **Giá trị chuẩn xác từ nguồn mẫu là 67,10%** ($\frac{10.434.921,777}{15.550.923,159}$). Tuyệt đối không lấy con số 76% từ tệp mẫu cũ. |
| **10** | `DISB_RATE` | Tỷ lệ giải ngân của địa phương | `DISB` cột $I / F \times 100$ | Hiển thị dạng `%` (2 chữ số). Kèm chú thích dấu thanh tra (cột P) và ghi chú văn bản (cột Q) nếu có. |
| **11** | `COMPARISON_LABEL` (Giải ngân) | Nhận xét tỷ lệ giải ngân | So sánh dòng 10 với mốc dòng 9 | Đánh giá theo ngưỡng cấu hình (*Cao hơn*, *Thấp hơn*, *Tương đương*). Nếu khác kỳ/ngày chốt thì cảnh báo chưa đủ cơ sở đánh giá tương đương. |
| **12** | `GPMB_BUDGET` | Kinh phí phân bổ GPMB cho từng địa phương | `GPMB` $\sum G$ các dự án thuộc địa phương | Chia $10^9$ đổi từ đồng sang tỷ đồng. Giữ nguyên tổng đồng nội bộ để tính tỷ lệ. |
| **13** | `GPMB_AREA_PLAN` | Diện tích phải GPMB của từng địa phương | `GPMB` $\sum D$ các dự án thuộc địa phương | Đơn vị m² (số nguyên có dấu chấm phân cách ngàn) hoặc ha (2 chữ số thập phân). |
| **14** | `GPMB_AREA_RATE` (Benchmark) | Tỷ lệ GPMB trung bình của 114 địa phương (nhãn quy ước) | `GPMB` $\frac{\sum I_{\text{dự án}}}{\sum D_{\text{dự án}}}$ trên 108 địa bàn | **Tái hiện từ nguồn mẫu là 72,13%** ($\frac{39.960.463,6}{55.398.165}$), gắn cờ `PARTIAL_AGGREGATE`. Tuyệt đối không gán 70,8% của 114 địa phương. |
| **15** | `GPMB_AREA_RATE` | Tỷ lệ GPMB địa phương theo diện tích | `GPMB` $\frac{\sum I_{\text{dự án ghi nhận}}}{\sum D_{\text{dự án}}}$ | **Phương pháp duy nhất được hiển thị.** Nếu có dự án thiếu $I$, gắn cờ `PARTIAL_AGGREGATE`. Tuyệt đối không hiển thị bình quân tỷ lệ cột M. |
| **16** | `COMPARISON_LABEL` (GPMB) | Đánh giá GPMB | So sánh dòng 15 với mốc hợp lệ dòng 14 | So sánh điểm phần trăm. Nếu địa phương có dự án thiếu $I$ (`PARTIAL_AGGREGATE`) hoặc khác ngày chốt: ghi chú *"Chưa đủ cơ sở đánh giá hoàn thành"*. |

---

## 6. Ranh giới kiến trúc và nghiệp vụ nghiêm ngặt

1. **Tuyệt đối không có chỉ tiêu bình quân tỷ lệ dự án M:** Toàn bộ hệ thống UI, menu cấu hình, template, file xuất Excel và in PDF không chứa bất kỳ chỉ tiêu hoặc lựa chọn nào liên quan đến bình quân tỷ lệ dự án ($M$). Cột $M$ chỉ được dùng để phát hiện sai lệch chất lượng dữ liệu nguồn (`GPMB_M_SOURCE_MISMATCH`) ở cấp dòng dự án.
2. **Không tự động suy đoán nguồn:** Danh sách địa phương thiếu nguồn (REV thiếu Bạch Long Vĩ; GPMB thiếu 6 địa bàn) phải được giữ nguyên trạng thái `NO_LOCALITY_RECORD`, không tự ý bổ sung dòng hay gán số 0.
3. **Tính minh bạch:** Mỗi ô trên bảng báo cáo đều liên kết với một `CalculationTrace` duy nhất, cho phép người dùng truy xuất nguồn gốc từng ô Excel, công thức và lý do loại trừ (nếu có).

## Mở rộng 24/11/2026

- `REV_HEADER_SEMANTIC_V3`: ánh xạ fieldId theo tiêu đề, không khóa địa chỉ. actual_total_revenue (I mẫu 23/11), actual_land_revenue (S), actual_nonland_revenue (X); dùng provenance.cell của bản nhập.
- `DISB_TOTAL_LOCALITY_V2` / `DISB_TOTAL_LOCALITY_HEADERS_V2`: tổng điều chỉnh F, tổng đã giải ngân I, tỷ lệ M, officialNote N; phạm vi tổng hợp địa phương, khác profile vốn phân cấp.
- `showRevRealizedRow`: boolean, mặc định false; `revRealizedRowCustomLabel`: nhãn tùy chỉnh có hậu tố ngày REV. `showRevBenchmarkRow` là tùy chọn độc lập; STT được dẫn xuất khi render, không sửa template.
- `REV_BENCHMARK_RATE`, `DISB_BENCHMARK_RATE`, `GPMB_BENCHMARK_AREA_RATE`: giá trị cấp phạm vi, hiển thị ô gộp, giữ traceId chung; không ghi nhiều giá trị trong Sheet Báo cáo. `showScopeFootnotes` là cấu hình legacy, không dùng để bắt buộc footer hay chặn xuất; kiểm toán vẫn luôn được lưu.
- Các giá trị độ phủ, ngày chốt, schema và mappingVersion ở dataset/trace phải lấy từ nguồn tương ứng, không dùng hằng số mẫu cũ.

### Nhãn chỉ tiêu cập nhật 24/11/2026

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

Chỉ tăng cỡ chữ giá trị của ba tỷ lệ trung bình REV/DISB/GPMB: Studio/grid và bản in/PDF dùng `1.1em` (tăng 10% so với số liệu thông thường), Excel dùng 11 pt thay vì 10 pt, định dạng phần trăm và căn giữa giữ nguyên. Không tăng cỡ chữ nhãn chỉ tiêu hoặc giá trị của từng địa phương; gộp cả ba benchmark REV/DISB/GPMB. Nhãn mặc định cũ theo độ phủ được tự chuyển sang mẫu 114; giữ tên riêng của người dùng.

### Metadata bộ chọn nguồn mới nhất

`Dataset.asOfDate`, `asOfStatus`, `asOfDateEvidence`, `workbookSha256`, `importedAt`, `schemaFingerprint`, `mappingVersion`, `issues`, `unitCount` là đầu vào chọn latest. `importedAt` giữ lần đầu của cùng ID/SHA khi nhập lại; `VERIFIED_TITLE_DATE:YYYY-MM-DD` là bằng chứng mới từ tiêu đề DISB/GPMB, không phải tên file. `LatestSourcePlan`/`LatestSourceChoice` là preview tạm thời gồm bindings, complete, skipped/reason, sameDateVersions, referenceFallback; không lưu đè bộ nguồn trước khi xác nhận.

### SourceValidation (SCHEMA_GUARD_V1)

Metadata kiểm tra của Dataset: workbookSha256, sheet, schemaSignature, headerRows, columnCount/headerColumnCount, columns[field,column,header,unit], status VERIFIED/NEEDS_REVIEW, checks[code,label,checked,failed,severity,detail,examples], checkedAt/reviewedAt/reviewReason, historicalDatasetId/historicalDate/previousColumnCount/changedColumns. Được lưu cùng dataset và backup. Signature khác SHA file: kiểm tra cấu trúc đã chuẩn hóa, không coi thay đổi nội dung là sai. ID bản nhập mới có hậu tố GUARD1. GPMB localityGroupSummaries.columnM lưu cột tỷ lệ nguồn thực tế (legacy mặc định M). Không lưu raw Excel mới trong browser hay gửi repo.

`Dataset.disbLayout?: DisbResolvedLayout`: fingerprint, columns (vai trò canonical A/B/C... -> cột Excel thực), headerRows, dataRows, summaryRow, citySummaryRow?, unplannedRow?, titleCell. `getDisbDatasetProfile` remap colMap, tỷ lệ, ghi chú, component/identity columns; `formatDisbDatasetRange` dùng các dòng thực. `source_disbursed_rate_initial` là tỷ lệ nguồn so vốn đầu năm của compact (ratio, chỉ QA).
