# QUY TẮC TÍNH TOÁN VÀ TRUY VẾT DỮ LIỆU (CALCULATION RULES & TRACE)

> **Dự án:** KTXH Offline Report (`cavoixanh638/KTXD-report`)  
> **Tài liệu quy phạm chủ quản:** `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md` (§3, §3.4, §6, §6A, §6A.1..6A.4)  
> **Kế hoạch triển khai:** `docs/plans/PHASE_1_RESULT_TEMPLATE.md` (§2, §5, §6, §8)  
> **Các bài kiểm thử liên quan:** T01–T07, T41–T48, T53–T58, T59–T65  
> **Phiên bản:** V2.2 — Ban hành cho Cổng PH1 & PH2

---

## 1. Nguyên tắc cốt lõi: Tính Benchmark Tổng trên Tổng

### 1.1 Định nghĩa công thức chuẩn

Mọi tỷ lệ tổng gộp (Benchmark) trong toàn bộ hệ thống bắt buộc phải được tính toán theo phương pháp **Tổng tử số trên Tổng mẫu số** trong cùng phạm vi và kỳ báo cáo:

$$\text{Tỷ lệ Benchmark} = \frac{\sum_{i \in \text{Phạm vi}} \text{Tử số}_i}{\sum_{i \in \text{Phạm vi}} \text{Mẫu số}_i} \times 100$$

> **NGHIÊM CẤM:** Tuyệt đối không lấy trung bình cộng các tỷ lệ của từng địa phương:
> $$\text{Tỷ lệ Benchmark} \neq \frac{1}{N} \sum_{i=1}^{N} \text{Tỷ lệ}_i$$
> Việc lấy trung bình cộng tỷ lệ sẽ gây sai lệch nghiêm trọng về mặt thống kê và kinh tế do không tính đến quy mô vốn/ngân sách của từng đơn vị.

### 1.2 Các mốc so sánh chuẩn trong bộ dữ liệu tham chiếu

1. **Giải ngân đầu tư công (DISB):**
   - Mốc 114 địa phương: $\frac{\sum_{13}^{126} I}{\sum_{13}^{126} F} = \frac{10.434.921,777}{15.550.923,159} = \mathbf{67,10\%}$.
   - Mốc toàn thành phố: $I7 / F7 = \frac{31.833.882,636}{46.150.296,085} \approx 68,98\%$.
   - Mốc toàn thành phố loại trừ khoản ngoài kế hoạch (dòng 145): $\frac{31.833.882,636 - 251.163}{46.150.296,085} \approx 68,43\%$.
   - Mức vốn giao bình quân một địa phương: $\frac{\sum F_{114}}{114} = \frac{15.550.923,159}{114} \approx \mathbf{136,412\text{ tỷ đồng}}$.

2. **Thu ngân sách nhà nước (REV):**
   - Nguồn chỉ có dữ liệu của **113 địa phương** (thiếu Đặc khu Bạch Long Vĩ).
   - Tỷ lệ tổng thu so với dự toán năm: $\frac{\sum I}{\sum C} = \frac{28.550.929,455}{25.651.713} \approx \mathbf{111,30\%}$.
   - Tỷ lệ thu tiền đất so với dự toán năm: $\frac{\sum R}{\sum D} = \frac{9.777.655,455}{7.182.893} = \mathbf{136,12\%}$ (khớp ô $Y10$).
   - Tỷ lệ thu tiền đất so với kế hoạch kỳ 10 tháng: $\frac{\sum R}{\sum G} = \frac{9.777.655,455}{4.823.476} = \mathbf{202,71\%}$ (khớp ô $AB10$).
   - Tỷ lệ thu không gồm đất so với dự toán năm: $\frac{\sum W}{\sum E} = \frac{28.550.929,455 - 9.777.655,455}{25.651.713 - 7.182.893} = \frac{18.773.274}{18.468.820} \approx \mathbf{101,65\%}$ (khớp ô $Z10$).
   - Mốc REV trong hồ sơ giải trình phải ghi rõ phạm vi: *"113 địa phương có dữ liệu (thiếu Bạch Long Vĩ)"*. Nhãn bảng chính ghi 114 theo quy ước trình bày, không nâng phạm vi phép tính.

3. **Giải phóng mặt bằng (GPMB):**
   - Nguồn chỉ có dữ liệu của **108 địa bàn** (thiếu 6 địa bàn).
   - Tỷ lệ hoàn thành theo diện tích: $\frac{\sum I}{\sum D} = \frac{39.960.463,6}{55.398.165} \approx \mathbf{72,13\%}$.
   - Mốc GPMB phải gắn nhãn: *"108 địa bàn có dữ liệu, cờ PARTIAL_AGGREGATE do còn 3 dự án thiếu dữ liệu"*.

---

## 2. Quy tắc R04: Xử lý Mẫu số bằng 0 (Zero Denominator)

Quy tắc R04 phân định rạch ròi 3 bài toán độc lập:
1. Đọc và phân loại trạng thái dữ liệu nguồn (`ZERO` vs `MISSING` vs `FORMULA_ERROR`).
2. Đánh giá tỷ lệ của **một địa phương riêng lẻ**.
3. Tính tỷ lệ Benchmark cho **một tập hợp nhiều địa phương**.

### 2.1 Cấp địa phương riêng lẻ

Khi tính tỷ lệ $\frac{A_i}{B_i}$ tại dòng địa phương $i$:
- Nếu $B_i = 0$ (số 0 hợp lệ được ghi rõ trong nguồn) và $A_i > 0$:
  - Phép chia toán học không xác định.
  - Trạng thái trả về: `DENOMINATOR_ZERO`.
  - Hiển thị trên báo cáo:
    - Đối với so sánh năm: Chuỗi văn bản **"Phát sinh ngoài dự toán"**.
    - Đối với so sánh kỳ: Chuỗi văn bản **"Phát sinh ngoài kế hoạch"**.
  - **CẤM:** Không được gán là `0%`, không gán `Infinity%`, không báo lỗi `#DIV/0!`.
- Nếu $B_i = 0$ và $A_i = 0$: Hiển thị **"Không có cơ sở tính tỷ lệ"**.

### 2.2 Cấp tổng hợp Benchmark tập hợp

- **Điều kiện tham gia tổng gộp:** Dòng địa phương $i$ có cả tử số $A_i$ và mẫu số $B_i$ là số hợp lệ.
- **Dòng có $B_i = 0$ là HỢP LỆ:** Dòng có $B_i = 0$ và $A_i > 0$ **bắt buộc phải tham gia vào cả hai phép cộng tổng**:
  - Đóng góp vào tổng tử số: $+ A_i$ (toàn bộ số tiền thực tế phát sinh ngoài dự toán/kế hoạch).
  - Đóng góp vào tổng mẫu số: $+ 0$.
- Trạng thái `DENOMINATOR_ZERO` ở cấp dòng **tuyệt đối không phải lý do để đưa dòng đó vào danh sách loại trừ (`excludedRecordIds`)** của Benchmark.
- Phép kiểm tra mẫu số $= 0$ chỉ được thực hiện trên **tổng mẫu số sau khi gộp** $\sum B_i$:
  - Nếu $\sum B_i > 0$: Tính tỷ lệ bình thường $\frac{\sum A_i}{\sum B_i}$.
  - Nếu $\sum B_i = 0$: Trả về `DENOMINATOR_ZERO` cho cả nhóm (vẫn hiển thị tổng tiền thực thu $\sum A_i$).

### 2.3 Bằng chứng đối chứng dữ liệu thực tế (Test T53–T58)

Trong tệp `REV_10M_2026`, có các địa phương không được giao dự toán/kế hoạch thu đất nhưng thực tế vẫn phát sinh nguồn thu:

| Chỉ tiêu tỷ lệ | Công thức & Ô tổng nguồn | Danh sách dòng $B_i = 0, A_i > 0$ | Tổng thu $R$ nhóm $B_i=0$ | Tử số toàn nguồn $\sum R$ | Mẫu số toàn nguồn $\sum B$ | Tỷ lệ chuẩn xác | Tỷ lệ sai nếu loại dòng $B_i=0$ |
|---|:---:|---|---:|---:|---:|---:|---:|
| **Thu đất / Dự toán năm** (`REV_LAND_RATE_Y`) | $R / D$ (ô $Y10$) | D15, D26, D42, D57, D114 | **269.290 triệu** | 9.777.655,455 | 7.182.893 | **136,12%** | 132,38% (Sai do mất 269.290 triệu tử số) |
| **Thu đất / Kế hoạch 10 tháng** (`REV_LAND_RATE_P`) | $R / G$ (ô $AB10$) | G15, G26, G28, G42, G57, G114 | **304.790 triệu** | 9.777.655,455 | 4.823.476 | **202,71%** | 196,39% (Sai do mất 304.790 triệu tử số) |

> **Chi tiết các địa phương phát sinh ngoài dự toán/kế hoạch thu đất:**
> - Dòng 15: Huyện Tiên Lãng ($R = 218.436$ triệu đồng, $D = 0, G = 0$)
> - Dòng 26: Phường Việt Khê ($R = 10.932$ triệu đồng, $D = 0, G = 0$)
> - Dòng 28: Xã An Khánh ($R = 35.500$ triệu đồng, $D = 100.000, G = 0$ $\rightarrow$ phát sinh ngoài kế hoạch kỳ)
> - Dòng 42: Xã Vĩnh Thuận ($R = 18.704$ triệu đồng, $D = 0, G = 0$)
> - Dòng 57: Xã Hồng An ($R = 18.921$ triệu đồng, $D = 0, G = 0$)
> - Dòng 114: Xã Hùng Thắng ($R = 2.297$ triệu đồng, $D = 0, G = 0$)

Tất cả các dòng trên phải xuất hiện trong mảng `zeroDenominatorContributors` của `CalculationTrace`.

---

## 3. Quy tắc Cân đối ngang DISB (`PASS_WITH_MISSING_COMPONENTS`)

### 3.1 Ba đẳng thức cân đối

Nguồn giải ngân `DISB_20261015` có 3 mối quan hệ cân đối cấu trúc giữa cột tổng và các cột thành phần:
1. $F = G + H$ (Kế hoạch vốn sau điều chỉnh = Khối TP + Khối xã)
2. $I = J + K$ (Giải ngân tổng số = Khối TP + Khối xã)
3. $I = L + M + N$ (Giải ngân tổng số = Xây lắp/tư vấn/QLDA + Bồi thường GPMB + Khác)

### 3.2 Quy tắc xử lý 296 ô trống

- Bảng tính gốc có 296 ô để trống (null) tại các cột $G$ (67), $J$ (67), $M$ (60), $N$ (102) nằm rải rác trên 104 dòng địa phương.
- Trong bảng số liệu báo cáo: Giữ nguyên trạng thái `MISSING`, hiển thị *"Chưa có số liệu"*. Tuyệt đối không tự ý điền số 0.
- **Khi thực hiện kiểm tra cân đối nội bộ (Identity Check):**
  - Cho phép coi các ô `MISSING` như phần tử trung hòa phép cộng (giá trị 0) **có kiểm soát**.
  - **Điều kiện để được công nhận cân đối:**
    1. Ô tổng ($F$ hoặc $I$) là số hợp lệ.
    2. Có ít nhất một cột thành phần là số hợp lệ.
    3. Không có bất kỳ cột thành phần nào bị lỗi công thức (`FORMULA_ERROR`) hoặc không thể đọc số (`INVALID`).
    4. Tổng các thành phần số đã ghi nhận khớp với ô tổng trong dung sai sai số $|\Delta| \le 10^{-5}$ triệu đồng.
  - Khi thỏa mãn cả 4 điều kiện: Trả về trạng thái **`PASS_WITH_MISSING_COMPONENTS`** kèm danh sách địa chỉ các ô thiếu.
  - Nếu tất cả thành phần đều trống hoặc tổng không khớp: Gắn trạng thái `FAIL`.
  - Giá trị suy diễn này **chỉ dùng cho kiểm tra cân đối, không được dùng làm số liệu báo cáo hoặc tham gia phép chia**.

---

## 4. Quy tắc `PARTIAL_AGGREGATE` của GPMB

### 4.1 Phương pháp tỷ lệ duy nhất

- Tỷ lệ hoàn thành giải phóng mặt bằng của một địa bàn hoặc một nhóm dự án **chỉ được phép tính theo một phương pháp duy nhất**:
  $$\text{Tỷ lệ GPMB} = \frac{\sum I_{\text{dự án đã ghi nhận}}}{\sum D_{\text{dự án phải GPMB}}} \times 100$$
- **Tuyệt đối không sử dụng bình quân tỷ lệ dự án $M$**: Cột $M$ trên dòng tổng địa bàn trong file cũ (ví dụ ô M105 Kinh Môn = 100% trong khi diện tích thực chỉ đạt 84,51%) là minh chứng của phương pháp tính sai trong quá khứ, không được dùng làm số liệu báo cáo.

### 4.2 Xử lý 3 dự án thiếu dữ liệu kết quả $I$

- Ba dòng dự án:
  - Dòng 107 (Phường Kinh Môn): $D = 5.050\text{ m}²$
  - Dòng 173 (Phường Tân Hưng): $D = 1.190\text{ m}²$
  - Dòng 365 (Xã Kiến Hưng): $D = 5.219\text{ m}²$
  - Tổng diện tích phải GPMB: $11.459\text{ m}²$.
- **Nguyên tắc xử lý:**
  - Giữ nguyên diện tích phải GPMB $D$ trong mẫu số gộp.
  - Tại ô $I$ của dự án: Giữ trạng thái `MISSING`, không đóng góp vào tử số gộp, **không tự biến $I$ thành 0**.
  - Tỷ lệ gộp của địa bàn (hoặc benchmark toàn bộ) được gắn trạng thái chất lượng **`PARTIAL_AGGREGATE`**.
  - Nhãn hiển thị bắt buộc: *"Tỷ lệ theo diện tích đã ghi nhận, còn dự án thiếu dữ liệu"*.
  - Hệ thống không tự động đưa ra kết luận đánh giá hoàn thành đối với các địa phương mang cờ `PARTIAL_AGGREGATE`, trừ khi người dùng chủ động phê duyệt kèm lý do xác nhận.

---

## 5. Cấu trúc Hồ sơ phép tính (`CalculationTrace`)

Mọi con số hiển thị trên giao diện hoặc xuất ra tệp XLSX/PDF đều phải thuộc một trong hai loại:
1. **`SOURCE_VALUE` (Giá trị đọc trực tiếp từ nguồn):** Chứa thông tin xuất xứ tệp, sheet, ô, mã băm SHA-256, kiểu ô, công thức Excel gốc và ngày chốt.
2. **`CALCULATED` (Giá trị tính toán):** Bắt buộc phải có một hồ sơ `CalculationTrace` hoàn chỉnh theo giao diện TypeScript sau (`src/core/types.ts`):

```typescript
export interface CalculationTrace {
  traceId: string;              // Mã truy vết duy nhất: dataset + session + indicator + locality
  indicatorId: string;          // Mã chỉ tiêu (ví dụ: REV_LAND_RATE_Y)
  indicatorLabel?: string;      // Nhãn chỉ tiêu hiển thị
  localityId?: string;          // Mã địa phương (nếu tính theo địa phương)
  localityName?: string;        // Tên địa phương
  resultKind: 'SOURCE_VALUE' | 'CALCULATED';
  
  result: {
    exactDecimal: string | null;  // Giá trị số học chính xác dạng chuỗi Decimal
    displayedText: string;        // Chuỗi hiển thị trên bảng báo cáo (ví dụ: "136,12%")
    canonicalUnit: string;        // Đơn vị chuẩn nội bộ (ví dụ: "fraction", "billion_vnd")
    displayUnit: string;          // Đơn vị hiển thị (ví dụ: "%", "tỷ đồng")
    state: ValueState;            // VALUE | ZERO | MISSING | DENOMINATOR_ZERO...
  };
  
  formula: {
    formulaId: string;            // Mã công thức quy chuẩn (ví dụ: "SUM_I_DIV_SUM_D")
    formulaVersion: string;       // Phiên bản công thức (ví dụ: "2.2.0")
    readableExpression: string;   // Biểu thức dễ đọc (ví dụ: "SUM(I) / SUM(D) * 100")
    method: string;               // Tên phương pháp (ví dụ: "AREA_WEIGHTED_RATIO")
    roundingPolicy: string;       // Chính sách làm tròn (ví dụ: "ROUND_HALF_UP_2_DECIMALS")
    tolerancePolicy: string;      // Dung sai so sánh (ví dụ: "0.00001")
  };
  
  scope: {
    type: string;                 // LOCALITY | BENCHMARK_FULL | BENCHMARK_AVAILABLE
    sourceDatasetIds: string[];   // Danh sách ID nguồn tham chiếu
    selectedLocalityIds: string[];// Danh sách địa phương trong phạm vi tính
    expectedCount?: number;       // Số lượng địa phương kỳ vọng (114)
    asOfDates: string[];          // Danh sách ngày chốt dữ liệu
  };
  
  operands: Array<{
    role: string;                 // "NUMERATOR" | "DENOMINATOR" | "COMPONENT"
    fieldId: string;              // Mã trường (ví dụ: "actual_land_revenue")
    exactValue: string | null;    // Giá trị Decimal
    unit: string;                 // Đơn vị
    state: ValueState;            // Trạng thái
    sources: SourceCellRef[];     // Danh sách ô nguồn cấu thành
  }>;
  
  population: {
    eligibleCount: number;        // Số bản ghi đủ điều kiện
    includedCount: number;        // Số bản ghi thực tế được cộng
    excludedCount: number;        // Số bản ghi bị loại
    missingCount: number;         // Số bản ghi thiếu nguồn
    includedRecordIds: string[];  // Danh sách ID bản ghi được tính
    excludedRecordIds: string[];  // Danh sách ID bản ghi bị loại
  };
  
  coverageDetails: CoverageDetail[]; // Chi tiết trạng thái nguồn của từng địa phương
  
  exclusions: Array<{
    recordId: string;
    affectedOperand: string;
    reasonCode: ExclusionReason;  // Lý do loại trừ chuẩn hóa
    explanation: string;          // Diễn giải chi tiết lý do loại
    sourceCell?: string;
  }>;
  
  zeroDenominatorContributors?: Array<{
    recordId: string;
    localityName?: string;
    numeratorFieldId: string;
    denominatorFieldId: string;
    numeratorExactDecimal: string;
    denominatorExactDecimal: '0';
    numeratorSource: SourceCellRef;
    denominatorSource: SourceCellRef;
  }>;
  
  steps: Array<{
    operation: string;            // Tên bước (READ, SUM, DIV, CONVERT_UNIT, ROUND)
    inputs: string[];             // Đầu vào
    output: string | null;        // Đầu ra
    reason: string;               // Lý do thực hiện
  }>;
  
  quality: {
    status: CalculationQuality;   // COMPLETE | PARTIAL_AGGREGATE | DENOMINATOR_ZERO...
    warningIds: string[];         // Danh sách mã cảnh báo QA
    approvedByUser?: boolean;     // Người dùng đã phê duyệt thủ công hay chưa
  };
  
  sourceRefs: SourceCellRef[];    // Danh sách tham chiếu ô nguồn trực tiếp
  createdAt: string;              // Thời điểm tính toán ISO 8601
  engineVersion: string;          // Phiên bản engine tính toán
  datasetHashes: string[];        // Danh sách SHA-256 của các tệp nguồn
}
```

---

## 6. Trình kiểm tra Trace trực tiếp (Trace Inspector)

Khi người dùng nhấn vào bất kỳ ô nào trên Bảng báo cáo 14 dòng:
1. Panel **Trace Inspector** ở cạnh phải màn hình lập tức hiển thị toàn bộ hồ sơ `CalculationTrace` của ô đó.
2. Trình bày rõ ràng:
   - Biểu thức công thức và cách tính toán.
   - Tử số, Mẫu số và giá trị Decimal trước khi làm tròn.
   - Bảng kê các ô nguồn Excel (Tệp, Sheet, Địa chỉ ô, Giá trị gốc, Ngày chốt).
   - Danh sách các địa phương tham gia tính toán và danh sách địa phương bị loại trừ (nêu rõ từng nguyên nhân).
   - Danh sách các địa phương phát sinh thu ngoài kế hoạch/dự toán (`zeroDenominatorContributors`).
   - Nút sao chép nội dung Trace dưới định dạng JSON phục vụ kiểm toán và lưu trữ độc lập.

## 24/11/2026 — Công thức theo vai trò nguồn

Công thức tiền đất và không đất phải dùng trường `actual_land_revenue`, `actual_nonland_revenue` từ header mapping; tháng 10 lần lượt R/W, tháng 11 lần lượt S/X. Mẫu tháng 11: tỷ lệ năm I/C, S/D, X/E; tỷ lệ kỳ I/F, S/G, X/H. Các chỉ số trên là tỷ số (×100 khi hiển thị %). `REV_REALIZED` = actual_total_revenue / 1.000 (triệu sang tỷ). Giải ngân = disbursed_total / adjusted_total_plan (I/F ở tổng hợp tháng 11; J/F ở phân cấp V2). Benchmark REV/GPMB giữ tổng/tổng toàn phạm vi đủ điều kiện, không dùng AVERAGE, không suy ngược số tiền từ tỷ lệ hiển thị. GPMB = SUM(I ghi nhận)/SUM(D), không thay đổi. Ba benchmark REV/DISB/GPMB dùng một ô gộp và một trace chung; số liệu gốc, cảnh báo, included/excluded, mẫu số 0, thiếu I và kiểm toán vẫn như quy tắc MASTER. Các trị số ví dụ tháng 10 ở trên chỉ là fixture lịch sử.

### Tên chỉ tiêu cập nhật cuối ngày 24/11/2026

Theo bảng bảy nhãn chuẩn tại MASTER mục cập nhật PH1. Từ `trung bình` trong tiêu đề REV/DISB/GPMB chỉ là tên trình bày, không đổi công thức tổng/tổng; ngày chốt lấy đúng nguồn của phiên, nhãn bảng chính ghi 114 địa phương theo quy ước; phạm vi phép tính và độ phủ thực tiếp tục lấy từ dữ liệu. Ba benchmark REV/DISB/GPMB vẫn gộp ô; không đổi CalculationTrace hay số liệu.
