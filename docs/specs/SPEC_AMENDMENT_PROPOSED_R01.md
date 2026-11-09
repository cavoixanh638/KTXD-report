# Đề xuất bổ sung đặc tả V1.1 — sau phản biện R01

**Trạng thái:** `PROPOSED / NOT_APPROVED / NOT_IMPLEMENTED`  
**Nguồn:** `docs/reviews/REVIEW_R01_20261109.md`  
**Mục tiêu:** đưa ra thay đổi cụ thể để AI lập trình không phải tự đoán; chưa thay đổi đặc tả V1 đã được chốt.

## A. Bổ sung adapter DISB (`§4.2`)

- Map thêm `P` → `inspectionMarker`: giá trị nguồn x/X/rỗng; nhãn header lấy từ sheet `P5` (`Chủ tịch đi 22/10`); metadata không quyết định địa phương được chọn.
- Map thêm `Q` → `officialNote` dưới dạng chuỗi nguyên bản, giữ `provenance` cụ thể tới `Tổng hợp!Q{row}`.
- Cho phép `adjustedScenarios: Scenario[]`, mỗi phần tử có `rate`, `rateUnit='percent'`, `exclusionDescription`, `sourceCell`, `confidence`, `verificationStatus`, `numerator?`, `denominator?`. Một Q có 0..N kịch bản; có nhiều % không có nghĩa là nhiều tỷ lệ hợp lệ.
- Nếu ghi chú chỉ cung cấp %, trạng thái `SOURCE_NOTE_ONLY`, hiển thị để tham khảo/giải trình nhưng không thay `officialDisbursementRate=I/F` và không tự tham gia benchmark.
- Date parser lấy ngày chốt từ header `A1`; loại bỏ khỏi ứng viên các ngày trong `P5`, `Q*`, nội dung quyết định hoặc văn bản.

## B. Locality matcher (`§9`, `§11`)

```text
canonical_display_name = trim(collapse_whitespace(NFC(input)))
auto_match_key = (validated_official_code OR [locality_type, canonical_display_name, admin_context])
search_key = unaccent(casefold(canonical_display_name)) // CHỈ cho tìm kiếm
```

- Không dùng `search_key`, `includes`, fuzzy similarity hay tên thiếu loại địa phương để auto-join.
- Chỉ auto-join khi kết quả duy nhất và có cùng loại/đúng tên có dấu; nếu nhiều ứng viên, yêu cầu xác nhận alias, ghi audit.
- Metadata `Locality` có `displayName`, `canonicalName`, `localityType`, `officialCode?`, `aliases[]`, `matchEvidence` và `matchStatus`.

## C. QualityIssue/UI (`§12`, Trang B, Trang D)

- Cấu trúc chuẩn `QualityIssue` giữ `ruleId`, `datasetId`, `localityId`, `projectRowId?`, `sourceCell`, `observedValue`, `expectedValue`, `threshold`, `delta`, `severity`, `status`, `acknowledgedAt?`.
- Trang Import: dashboard tổng hợp toàn bộ dataset, `warningEventsCount` và `distinctAffectedProjectCount` riêng biệt, lọc theo loại và severity.
- Trang báo cáo: chỉ cờ thuộc danh sách `session.selectedLocalityIds`; nút vào toàn bộ cờ dataset. Không xóa cờ khi ẩn.
- Chênh lệch M với 100*I/D: < hoặc =0,1 điểm % → INFO nếu có lệch (thường làm tròn); >0,1 → WARNING, ngưỡng cấu hình hiển thị; phép tính dùng giá trị gốc. Khi kết quả cực đoan, không âm thầm chỉnh số.

## D. File input/test (`§2`, `§15`)

- Giữ đúng tên tệp tham chiếu của nguồn đã đính kèm; không thay theo máy AI khác.
- Mỗi test có fixture manifest với `sourceType`, `sheet`, `sha256`, `schemaFingerprint` và đường dẫn do người chạy cung cấp (`--disb`, `--gpmb`, `--rev`).
- Adapter nhận dạng cấu trúc+tiêu đề, không trông vào basename. Nếu file khác schema, bật mapping wizard và không ghi đè dữ liệu.

## E. Xuất XLSX có style (`§8.1`, Trang G, P0 và P6)

- Ở P0 làm PoC với **ExcelJS browser bundle** và **xlsx-js-style** (hoặc thư viện được chứng minh tương đương). Kiểm tra browser `file://`, bundle một file, tài nguyên offline, kích thước gói, giấy phép, bảo mật và dễ bảo trì. Ghi rõ lựa chọn cuối, phiên bản pin vào `package-lock.json`/metadata.
- Acceptance của file xuất: font Times New Roman, viền, màu cảnh báo, căn lề, wrap, ô gộp, độ rộng/độ cao, kiểu số thật, định dạng tiền/tỷ lệ, in A4/A3, lặp header, trang nhiều địa phương, nguồn ngày chốt và không cảnh báo sửa chữa file khi mở Excel.
- Không được cho tiêu chí PASS chỉ vì xuất được file `xlsx` chứa dữ liệu thô.

## F. Bổ sung test T25–T32 (ngoài T01–T24)

| Test | Kỳ vọng PASS |
|---|---|
| `T25` | DISB nhập đủ 25/114 ghi chú Q; 11 marker P; marker không tự tạo session 11 xã |
| `T26` | Q18/O18 hiển thị 58,35% chính thức và 94% ghi chú có điều kiện; benchmark chỉ dùng 58,35% từ I/F khi không có mẫu số điều chỉnh |
| `T27` | Q7 có 83%, 86%, 76% là các kịch bản khác nhau; 5% tiết kiệm chi không bị phân loại thành tỷ lệ giải ngân; không tự áp dụng một kịch bản |
| `T28` | Cẩm Giang/Cẩm Giàng là hai localityId khác nhau; khoảng trắng cuối được xử lý; không nối nhầm Hưng Đạo/Trần Hưng Đạo |
| `T29` | 422 dự án, theo dung sai 0,1 điểm %: 13 I>D, 48 J>G, 14 K>E, 24 L>F, 12 sai khác M; 111 lượt cờ, 90 dự án; 3 thiếu D/I là nhóm khác |
| `T30` | Phiên chọn 5 xã chỉ hiển thị cảnh báo của 5 xã; tổng dashboard vẫn thấy toàn bộ; INFO do làm tròn có thể thu gọn |
| `T31` | Đổi tên file Excel nhưng giữ cấu trúc → nhập được; sai cấu trúc → mở mapping, không lấy nhầm ngày 22/10 từ P hoặc 25/9 từ Q |
| `T32` | XLSX đã xuất đọc bằng Excel đúng font, viền, widths, number formats, sheet chú thích, giấy in; chạy trên `file://` offline và không tải library từ Internet |

**Cổng nghiệm thu:** Chỉ được nâng V1 thành V1.1 nếu người dùng duyệt kiến nghị; riêng lựa chọn thư viện Excel phải có PoC PASS.
