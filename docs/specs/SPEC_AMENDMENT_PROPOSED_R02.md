# Đề xuất bổ sung đặc tả R02 — Trạng thái trống, cân đối ngang và sheet visibility

**Trạng thái:** `PROPOSED / NOT_APPROVED / NOT_IMPLEMENTED`  
**Cơ sở kiểm chứng:** `docs/reviews/REVIEW_R02_20261109.md` + `ROUND02_AUDIT_RESULT.json`.  
**Không thay đổi** `KTXH_OFFLINE_SPEC_V1.md` hoặc đề xuất R01 khi chưa được duyệt.

## A. §4.3 GPMB — Hợp đồng tổng hợp có dòng thiếu I

- Trên mỗi dòng dự án lưu `D`, `I`, `J`, `K`, `L`, `M` theo `rawState` và `rawValue`. `null` không phải `0`.
- Khi `D > 0` mà `I.state == MISSING`, tạo `QualityIssue { ruleId:'GPMB_MISSING_DONE_AREA', sourceCell:'I{row}', ... }`.
- `SUM` để tái tạo bảng nguồn dùng `recordedDoneArea = Σ I numeric`, `declaredArea = Σ D numeric` cho tất cả project rows, bao gồm D của các dự án thiếu I.
- `rate = recordedDoneArea / declaredArea * 100`, nhưng `dataCompleteness='PARTIAL_AGGREGATE'` nếu còn dòng thiếu I. Lưu `missingRowsCount`, `missingDeclaredArea`, `missingDeclaredAreaShare`, `knownRowsCount`.
- Không dùng `AVERAGE(M)` dòng tổng địa bàn làm tỷ lệ hoàn thành theo diện tích. Nếu người dùng chọn tham khảo bình quân dự án, hiển thị `N có tỷ lệ / tổng N dự án`; không tự sửa trống thành `0%`.
- Không đưa ratio PARTIAL vào kết luận đạt/chưa đạt dưới nhãn kết quả đầy đủ; phải có chú thích hoặc xác nhận mục đích báo cáo.

**Kiểm thử số:** 422 project rows, missing row 107/173/365; D_missing=11.459 m²; tổng D=55.398.165; I_known=39.960.463,6; recorded ratio=72,13% có cờ PARTIAL. Kinh Môn: D=32.609, I_known=27.559, recorded ratio=84,51%, nguồn M105=100% với 3/4 dự án có M.

## B. §4.2 DISB — Phép cộng ngang và missing component

Áp dụng riêng trong `validateRowIdentity()` (không áp dụng mặc định trong `readRawNumeric()`):

```ts
function checkIdentity(totalCell, componentCells, tolerance) {
  if (!isNumeric(totalCell)) return {status:'SOURCE_MISSING_OR_INVALID'};
  const known = componentCells.filter(isNumeric);
  if (known.length === 0) return {status:'INSUFFICIENT_COMPONENTS'};
  if (componentCells.some(isFormulaErrorOrInvalid)) return {status:'COMPONENT_ERROR'};
  const sumKnown = known.reduce((s, c) => s + c.value, 0);
  const diff = totalCell.value - sumKnown;
  return {
    status: Math.abs(diff) <= tolerance ? 'PASS_WITH_NULL_AS_ADDITIVE_IDENTITY' : 'MISMATCH',
    diff, missingComponentCells: componentCells.filter(isMissing).map(c => c.address)
  };
}
```

- Raw value/state **không thay đổi**; các cột thành phần vẫn phân biệt `MISSING` với `ZERO`.
- Dung sai phải được ghi rõ theo đơn vị gốc, kiểm tra số thực (floating point), không xét chỉ theo chuỗi đã làm tròn.
- Nếu cần hiển thị thành phần trống như 0 suy ra từ phép cân đối, đánh nhãn `INFERRED_FOR_IDENTITY_ONLY` và cho phép người dùng tắt; tuyệt đối không thay thế nguyên bản nguồn.
- Hợp đồng số thực: 114 dòng, G trống 67, J trống 67, M trống 60, N trống 102; tổng 296 ô, thuộc **104 địa phương khác nhau**; 114/114 cân đối cả 3 đẳng thức dưới quy tắc trên.

## C. §4.2/§8 — Chọn sheet theo metadata và fingerprint

```ts
const candidates = workbook.sheetNames.map((name, i) => ({
  name,
  index: i,
  visibility: workbook.sheetVisibility(name),
  fingerprint: inspectSheetStructure(name),
}));
const autoCandidates = candidates.filter(s => s.visibility === 'visible');
const selected = chooseBestMatchingFingerprint(autoCandidates, expectedAdapter);
if (!selected || !selected.isUnambiguous) showManualSheetPicker(candidates);
```

Đoạn trên là **pseudocode**, không áp đặt API thư viện cụ thể.

- Không dùng mặc định `SheetNames[0]`, cũng không dùng tên file làm bộ nhận dạng duy nhất.
- `hidden`/`veryHidden` không auto-pick trong preset chuẩn; người dùng được vào chế độ nâng cao xem sheet đã ẩn nếu xác nhận hiểu rủi ro khác kỳ/công thức.
- Nếu sheet visible không khớp fingerprint thì không tự lấy sheet hidden; yêu cầu mapping thủ công.
- Provenance: `workbookSha256`, `sheetName`, `sheetIndex`, `visibility`, `schemaFingerprint`, `manualOverride`.
- Source profile: giải ngân auto chọn `Tổng hợp` index 5; thu auto chọn `10T-19.10` index 0; GPMB auto chọn `Tổng hợp theo địa bàn` index 0.

## D. Bộ kiểm thử mới T33–T40

| Test | Kỳ vọng PASS |
|---|---|
| T33 | GPMB dòng 107/173/365 raw I/J/K/L/M vẫn `MISSING`, không bị ép thành 0; tạo 3 cảnh báo `GPMB_MISSING_DONE_AREA` |
| T34 | GPMB benchmark T04: 55.398.165 và 39.960.463,6; tỷ lệ 72,13%; metadata `PARTIAL_AGGREGATE`, thiếu 11.459 m² |
| T35 | Phường Kinh Môn: M105 100% là bình quân 3/4 dự án; tỷ lệ số ghi nhận 84,51% có cờ thiếu dữ liệu; không gắn nhãn tỷ lệ thực tế đã được kiểm chứng |
| T36 | Giải ngân G=67, J=67, M=60, N=102 blank; 296 ô trống trên 104 dòng khác nhau; F/I đủ 114 |
| T37 | 114/114 dòng PASS cả 3 đẳng thức khi dùng `null` làm phần tử trung hòa cho phép cộng ngang; nguyên bản component null vẫn null |
| T38 | Kiểm tra thành phần G/J/M/N độc lập vẫn phân biệt missing với 0; tổng không khớp hoặc error thì không được giả vờ PASS bằng cách coalesce |
| T39 | File giải ngân auto chọn `Tổng hợp` ở index 5, không chọn `DA trọng đểm NQ 174` index 0 vì bị hidden |
| T40 | File thu có `10T-19.10` visible, `Sheet1` hidden, `bc`/`TMS` veryHidden; hidden không được auto-pick, nhưng manual review có cảnh báo và provenance |

**P7 Gate:** Cộng T33–T40 vào T01–T32; tiêu chí không hoàn thành nếu thiếu chứng cứ chạy test với file Excel nguồn đúng SHA, hoặc chỉ demo giao diện. Bản bổ sung vẫn trong trạng thái PROPOSED cho đến khi được phê duyệt.
