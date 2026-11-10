import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
  detectSheetFingerprint,
  parseWorkbookBytes,
} from '../src/core/sourceReaders';
import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  createReportSession,
  setSessionLocalities,
  cloneReportSession,
  migrateLegacySessionLabels,
  syncReportLabelsWithDatasetDates,
  formatVnDate,
  formatIsoDate,
} from '../src/core/sessions';
import { evaluateSessionReport } from '../src/core/calculationTrace';
import { searchLocalities } from '../src/core/localities';
import { generatePrintableReportHtml } from '../src/export/print';
import { exportSessionReportToXlsxBytes } from '../src/export/xlsx';
import {
  computeAutoLayoutMode,
  renderA4DocumentStudioHtml,
  formatReportCellValue,
  renderReportCellValueHtml,
} from '../src/ui/reportStudio';
import {
  renderCellTracePopoverHtml,
  formatMax4Decimals,
} from '../src/ui/cellInspector';
import { Dataset, Locality } from '../src/core/types';

const rootDir = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data/reference/MANIFEST.json'), 'utf-8')
);
const filePaths: Record<string, string> = {};
for (const f of manifest.files) {
  filePaths[f.id] = path.join(rootDir, f.path);
}

describe('KTXH Offline – A4 Report Studio & WYSIWYG Architecture Suite', () => {
  let disbDataset: Dataset;
  let revDataset: Dataset;
  let gpmbDataset: Dataset;
  let baselineLocalities: Locality[];

  beforeAll(() => {
    const disbBytes = new Uint8Array(fs.readFileSync(filePaths['DISB_20261015']));
    const revBytes = new Uint8Array(fs.readFileSync(filePaths['REV_10M_2026']));
    const gpmbBytes = new Uint8Array(fs.readFileSync(filePaths['GPMB_20261026']));

    const disbImported = importDisbursementWorkbook(
      disbBytes,
      'Báo cáo giải ngân 15.10 sửa(1).xlsx'
    );
    disbDataset = disbImported.dataset;
    baselineLocalities = disbImported.localities;

    const revImported = importRevenueWorkbook(
      revBytes,
      'Bc thu 10 thang-19.10-BC (1)(1).xlsx',
      {
        confirmedAsOfDate: '2026-10-19',
        asOfConfirmationReason: 'Xác nhận ngày chốt sơ bộ kỳ 10 tháng năm 2026',
      }
    );
    revDataset = revImported.dataset;

    const gpmbImported = importGpmbWorkbook(
      gpmbBytes,
      'PL01_Tổng hợp DA_26.12.26(1).xlsx'
    );
    gpmbDataset = gpmbImported.dataset;
  });

  it('1. Auto Layout Algorithm on A4 Landscape: picks Horizontal for <= 7 localities and Vertical for > 7 localities', () => {
    const ws = createEmptyWorkspace();
    const session = createReportSession(ws, { name: 'Phiên kiểm tra bố cục' });

    // Mode AUTO with 5 localities -> Horizontal
    const decision5 = computeAutoLayoutMode({
      session,
      selectedCount: 5,
      indicatorCount: 14,
    });
    expect(decision5.mode).toBe('HORIZONTAL');
    expect(decision5.isAuto).toBe(true);
    expect(decision5.pageCount).toBe(1);
    expect(decision5.reason).toContain('bố cục Địa phương theo chiều ngang');

    // Mode AUTO with 7 localities -> Horizontal
    const decision7 = computeAutoLayoutMode({
      session,
      selectedCount: 7,
      indicatorCount: 14,
    });
    expect(decision7.mode).toBe('HORIZONTAL');
    expect(decision7.pageCount).toBe(1);

    // Mode AUTO with 15 localities -> Vertical (avoids horizontal splitting on A4 landscape)
    const decision15 = computeAutoLayoutMode({
      session,
      selectedCount: 15,
      indicatorCount: 14,
    });
    expect(decision15.mode).toBe('VERTICAL');
    expect(decision15.isAuto).toBe(true);
    expect(decision15.pageCount).toBe(1);
    expect(decision15.reason).toContain('bố cục Địa phương theo chiều dọc');

    // Mode AUTO with 25 localities -> Vertical with 2 pages
    const decision25 = computeAutoLayoutMode({
      session,
      selectedCount: 25,
      indicatorCount: 14,
    });
    expect(decision25.mode).toBe('VERTICAL');
    expect(decision25.pageCount).toBe(2);

    // Manual Override to Horizontal
    session.settings.tableLayoutMode = 'HORIZONTAL';
    const manualH = computeAutoLayoutMode({
      session,
      selectedCount: 20,
      indicatorCount: 14,
    });
    expect(manualH.mode).toBe('HORIZONTAL');
    expect(manualH.isAuto).toBe(false);

    // Manual Override to Vertical
    session.settings.tableLayoutMode = 'VERTICAL';
    const manualV = computeAutoLayoutMode({
      session,
      selectedCount: 3,
      indicatorCount: 14,
    });
    expect(manualV.mode).toBe('VERTICAL');
    expect(manualV.isAuto).toBe(false);
  });

  it('2. A4 Document Studio Sheet Rendering (Horizontal & Vertical Modes, Administrative Headers & Signatures)', () => {
    const ws = createEmptyWorkspace();
    const session5 = createReportSession(ws, { name: 'Báo cáo A4 5 xã' });
    const fiveIds = baselineLocalities.slice(0, 5).map((l) => l.id);
    setSessionLocalities(ws, session5.id, fiveIds);

    // Render in Horizontal mode
    session5.settings.tableLayoutMode = 'HORIZONTAL';
    const eval5 = evaluateSessionReport({
      session: session5,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const html5 = renderA4DocumentStudioHtml({
      evaluated: eval5,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    // Check Studio Document Header & Centered Title per user refinements
    expect(html5).toContain('a4-paper-sheet a4-landscape');
    expect(html5).toContain('doc-title-block text-center');
    expect(html5).toContain('TÌNH HÌNH THỰC HIỆN MỘT SỐ CHỈ TIÊU KINH TẾ - XÃ HỘI CỦA CÁC ĐỊA PHƯƠNG');
    expect(html5).not.toContain('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
    expect(html5).not.toContain('SỞ KẾ HOẠCH VÀ ĐẦU TƯ');
    expect(html5).not.toContain('doc-asof-meta');
    expect(html5).not.toContain('doc-period-badge');
    expect(html5).toContain('doc-table-horizontal');
    expect(html5).toContain('Tỷ lệ GPMB của từng địa phương');
    expect(html5).not.toContain('Ghi chú phương pháp tính & Dữ liệu nguồn');
    expect(html5).not.toContain('NGƯỜI LẬP BIỂU');
    expect(html5).not.toContain('THỦ TRƯỞNG ĐƠN VỊ');
    expect(html5).not.toContain('Trang 1 / 1');

    // Render in Vertical mode (Transposed table)
    session5.settings.tableLayoutMode = 'VERTICAL';
    const htmlVert = renderA4DocumentStudioHtml({
      evaluated: eval5,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    expect(htmlVert).toContain('doc-table-vertical');
    expect(htmlVert).toContain('doc-td-loc-name');
    expect(htmlVert).toContain(fiveIds[0]); // Locality data attribute
  });

  it('3. Unified 114 Locality List Search, Filtering, and Missing Data Badges', () => {
    // Search without diacritics
    const resultsNoAccent = searchLocalities(baselineLocalities, 'cam giang');
    expect(resultsNoAccent.length).toBeGreaterThanOrEqual(1);
    expect(resultsNoAccent.some((l) => l.displayName === 'Xã Cẩm Giang')).toBe(true);

    // Search with diacritics
    const resultsAccent = searchLocalities(baselineLocalities, 'Cẩm Giang');
    expect(resultsAccent.some((l) => l.displayName === 'Xã Cẩm Giang')).toBe(true);

    // Distinguish Cẩm Giang and Cẩm Giàng
    const camGiang = baselineLocalities.find((l) => l.displayName === 'Xã Cẩm Giang');
    const camGiang2 = baselineLocalities.find((l) => l.displayName === 'Xã Cẩm Giàng');
    expect(camGiang).toBeDefined();
    expect(camGiang2).toBeDefined();
    expect(camGiang!.id).not.toBe(camGiang2!.id);

    // Missing records verification per MASTER V2.2
    // REV missing: Đặc khu Bạch Long Vĩ
    const bachLongVi = baselineLocalities.find((l) => l.displayName === 'Đặc khu Bạch Long Vĩ');
    expect(bachLongVi).toBeDefined();

    // GPMB missing 6: Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ
    const gpmbMissingExpected = [
      'Phường Lưu Kiếm',
      'Phường Ái Quốc',
      'Xã Hùng Thắng',
      'Xã Thái Tân',
      'Xã Tân Minh',
      'Đặc khu Bạch Long Vĩ',
    ];
    for (const name of gpmbMissingExpected) {
      expect(baselineLocalities.some((l) => l.displayName === name)).toBe(true);
    }
  });

  it('4. Real 11-Commune Sample Evaluation (Reconciled from Kết quả Tổng hợp chỉ tiêu KTXH 11 xã.xlsx)', () => {
    const ws = createEmptyWorkspace();
    const session11 = createReportSession(ws, { name: 'Mẫu 11 xã đối chiếu' });

    const sample11Names = [
      'Hồng Châu',
      'Khúc Thừa Dụ',
      'Vĩnh Lại',
      'Chí Minh',
      'Đại Sơn',
      'Lạc Phượng',
      'Tân An',
      'Tứ Kỳ',
      'Ninh Giang',
      'Tân Kỳ',
      'Nguyên Giáp',
    ];

    const localityIds11: string[] = [];
    for (const name of sample11Names) {
      const loc = baselineLocalities.find((l) => l.displayName.includes(name) || l.shortName === name);
      if (loc) localityIds11.push(loc.id);
    }
    expect(localityIds11.length).toBe(11);

    setSessionLocalities(ws, session11.id, localityIds11);
    const eval11 = evaluateSessionReport({
      session: session11,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    expect(eval11.rows).toHaveLength(14);
    expect(eval11.selectedLocalities).toHaveLength(11);

    // 100% of cells have valid CalculationTrace
    for (const r of eval11.rows) {
      for (const locId of localityIds11) {
        const cell = r.cellsByLocalityId[locId];
        expect(cell).toBeDefined();
        expect(cell.traceId).toBeTruthy();
        expect(eval11.tracesById.has(cell.traceId)).toBe(true);
      }
    }

    // Verify GPMB row 15 is strictly area-weighted ratio (SUM(I)/SUM(D))
    const row15 = eval11.rows.find((r) => r.rowConfig.rowNumber === 15);
    expect(row15).toBeDefined();
    expect(row15!.rowConfig.customLabel).toBe('Tỷ lệ GPMB của từng địa phương');
  });

  it('5. Cell Trace Popover Rendering & Fraction Operands Breakdown', () => {
    const ws = createEmptyWorkspace();
    const session = createReportSession(ws, { name: 'Test Popover' });
    const firstLocId = baselineLocalities[0].id;
    setSessionLocalities(ws, session.id, [firstLocId]);

    const evalRes = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const cell = evalRes.rows[0].cellsByLocalityId[firstLocId];
    const trace = evalRes.tracesById.get(cell.traceId)!;
    expect(trace).toBeDefined();

    const popoverHtml = renderCellTracePopoverHtml(trace, {
      officialNote: 'Ghi chú Q thử nghiệm',
      inspectionMarker: 'Chủ tịch đi 22/10',
    });

    expect(popoverHtml).toContain('cell-trace-popover');
    expect(popoverHtml).toContain('Số gốc chưa làm tròn:');
    expect(popoverHtml).toContain('Công thức:');
    expect(popoverHtml).toContain('Ô nguồn:');
    expect(popoverHtml).toContain('Xem toàn bộ phép tính &rarr;');
    expect(popoverHtml).toContain('Ghi chú Q thử nghiệm');
  });

  it('6. Customizing Indicator Display Labels without Altering Calculation Engine', () => {
    const ws = createEmptyWorkspace();
    const session = createReportSession(ws, { name: 'Test Đổi nhãn' });
    const firstLocId = baselineLocalities[0].id;
    setSessionLocalities(ws, session.id, [firstLocId]);

    // Customize Row 10 (Disbursement rate)
    const row10 = session.templateRows.find((r) => r.rowNumber === 10)!;
    const originalLabel = row10.customLabel;
    row10.customLabel = 'Tỷ lệ thực hiện kế hoạch giải ngân (%)';

    const evalCustom = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const evaluatedRow10 = evalCustom.rows.find((r) => r.rowConfig.rowNumber === 10)!;
    expect(evaluatedRow10.rowConfig.customLabel).toBe('Tỷ lệ thực hiện kế hoạch giải ngân (%)');
    expect(evaluatedRow10.indicator.id).toBe('DISB_RATE'); // ID unchanged!

    const cell = evaluatedRow10.cellsByLocalityId[firstLocId];
    expect(cell.trace.formula.formulaId).toBe('DISB_RATE_LOCALITY'); // Math unchanged!
  });

  it('7. User Formatting Refinements: clean row 7, max 4 unrounded decimals, and "tỷ" suffix for billion VND', () => {
    // 1. Max 4 decimals helper verification
    expect(formatMax4Decimals('136.41228070175438596')).toBe('136.4123');
    expect(formatMax4Decimals('72.128795123')).toBe('72.1288');
    expect(formatMax4Decimals('32.85')).toBe('32.85');
    expect(formatMax4Decimals('100')).toBe('100');
    expect(formatMax4Decimals(null)).toBe('null');

    // 2. Evaluate report and check STT 7 (rowNumber 14) clean displayed text
    const ws = createEmptyWorkspace();
    const session = createReportSession(ws, { name: 'Test Refinements' });
    const firstLocId = baselineLocalities[0].id;
    setSessionLocalities(ws, session.id, [firstLocId]);

    const evalReport = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const row14 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 14)!;
    expect(row14.rowConfig.sttLabel).toBe('7');
    const cellRow14 = row14.cellsByLocalityId[firstLocId];
    expect(cellRow14.displayedText).toBe('72,13%');
    expect(cellRow14.displayedText).not.toContain('108/114');
    expect(cellRow14.displayedText).not.toContain('còn 3 DA thiếu I');

    // 3. Check "tỷ" suffix in formatReportCellValue for billion_vnd
    const row3 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 3)!; // REV_BUDGET_Y
    const cellRow3 = row3.cellsByLocalityId[firstLocId];
    const formattedRow3 = formatReportCellValue(cellRow3, row3.indicator.displayUnit, 'billion');
    expect(formattedRow3).toMatch(/tỷ$/);

    // 4. Check renamed indicators & as-of date bolding
    const row4 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 4)!;
    expect(row4.rowConfig.customLabel).toContain('Tỷ lệ thu NSNN so với dự toán (đến ngày');
    const row9 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 9)!;
    expect(row9.rowConfig.customLabel).toContain('Tỷ lệ giải ngân chung của các địa phương (đến ngày');
    const row11 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 11)!;
    expect(row11.rowConfig.customLabel).toBe('Kết quả giải ngân so với tỷ lệ trung bình');
    const row14Renamed = evalReport.rows.find((r) => r.rowConfig.rowNumber === 14)!;
    expect(row14Renamed.rowConfig.customLabel).toContain('Tỷ lệ GPMB trung bình của các địa phương (đến ngày');
    const row15 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 15)!;
    expect(row15.rowConfig.customLabel).toBe('Tỷ lệ GPMB của từng địa phương');
    const row16 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 16)!;
    expect(row16.rowConfig.customLabel).toBe('Kết quả GPMB so với tỷ lệ trung bình');

    // 5. Check DISB_PLAN adjustment note (tăng/giảm/giữ nguyên)
    const kienThuyLoc = baselineLocalities.find((l) => l.displayName.includes('Kiến Thụy'));
    if (kienThuyLoc) {
      setSessionLocalities(ws, session.id, [kienThuyLoc.id]);
      const evalKt = evaluateSessionReport({
        session,
        baselineLocalities,
        datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      });
      const ktRow7 = evalKt.rows.find((r) => r.rowConfig.rowNumber === 7)!;
      const ktCell7 = ktRow7.cellsByLocalityId[kienThuyLoc.id];
      expect(ktCell7.adjustmentNote).toBe('tăng 38,25 tỷ');
      const formattedKt = formatReportCellValue(ktCell7, ktRow7.indicator.displayUnit, 'billion');
      expect(formattedKt).toContain('(tăng 38,25 tỷ)');
    }

    // 6. Render Studio HTML and check absence of hidden rows, absence of footer notes/signatures, and presence of bold date
    const studioHtml = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtml).not.toContain('So với mức vốn giao bình quân một địa phương');
    expect(studioHtml).not.toContain('indicator-unit-sub');
    expect(studioHtml).not.toContain('ind-vert-stt');
    expect(studioHtml).not.toContain('Ghi chú phương pháp tính & Dữ liệu nguồn');
    expect(studioHtml).not.toContain('NGƯỜI LẬP BIỂU');
    expect(studioHtml).not.toContain('THỦ TRƯỞNG ĐƠN VỊ');
    expect(studioHtml).toContain('<strong>(đến ngày');
    expect(studioHtml).toContain('tỷ');

    // 7. Check updated row 7 name
    const row7 = evalReport.rows.find((r) => r.rowConfig.rowNumber === 7)!;
    expect(row7.rowConfig.customLabel).toBe('Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND');

    // 8. Check GPMB comparison format (>X,XX%) or (<X,XX%)
    const row16Comp = evalReport.rows.find((r) => r.rowConfig.rowNumber === 16)!;
    const cellRow16 = row16Comp.cellsByLocalityId[firstLocId];
    expect(cellRow16.displayedText).toMatch(/(cao hơn \(\>[0-9,]+%\)|thấp hơn \(\<[0-9,]+%\)|tương đương \(0,00%\))/i);
    expect(cellRow16.displayedText).not.toContain('Chưa đủ cơ sở đánh giá');

    // 9. Verify Locality classification removed from header and sub-row styling applied
    expect(studioHtml).not.toContain('<span class="doc-loc-type">');
    expect(studioHtml).toContain('doc-row doc-row-sub');

    // 10. Verify Vertical mode has no "Loại" column
    const vertSession = createReportSession(ws, { name: 'Test Vertical' });
    vertSession.settings.tableLayoutMode = 'VERTICAL';
    setSessionLocalities(ws, vertSession.id, [firstLocId]);
    const evalVert = evaluateSessionReport({
      session: vertSession,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const vertStudioHtml = renderA4DocumentStudioHtml({
      evaluated: evalVert,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(vertStudioHtml).not.toContain('<th class="doc-th doc-th-loc-type">Loại</th>');
  });

  it('8. Session label migration, reordering selected localities, and clean 1-page print export', () => {
    const ws = createEmptyWorkspace();
    const session = createReportSession(ws, { name: 'Legacy Test Session' });
    // Simulate legacy saved labels from previous session in localStorage
    const legacyRow = session.templateRows.find((r) => r.indicatorId === 'DISB_PLAN')!;
    legacyRow.customLabel = 'Kế hoạch vốn đầu tư công sau điều chỉnh';

    migrateLegacySessionLabels(ws);
    expect(legacyRow.customLabel).toBe('Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND');

    // Reorder test: select 3 localities [loc0, loc1, loc2]
    const loc0 = baselineLocalities[0].id;
    const loc1 = baselineLocalities[1].id;
    const loc2 = baselineLocalities[2].id;
    setSessionLocalities(ws, session.id, [loc0, loc1, loc2]);
    expect(session.selectedLocalityIds).toEqual([loc0, loc1, loc2]);

    // Reorder to [loc2, loc0, loc1]
    setSessionLocalities(ws, session.id, [loc2, loc0, loc1]);
    expect(session.selectedLocalityIds).toEqual([loc2, loc0, loc1]);

    const evalReorder = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(evalReorder.selectedLocalities.map((l) => l.id)).toEqual([loc2, loc0, loc1]);

    // Print export with includeAppendix: false should be clean, no appendix, no meta junk
    const cleanPrintHtml = generatePrintableReportHtml({
      evaluated: evalReorder,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(cleanPrintHtml).not.toContain('print-appendix');
    expect(cleanPrintHtml).not.toContain('Phiên:');
    expect(cleanPrintHtml).not.toContain('Ngày chốt độc lập');
    expect(cleanPrintHtml).not.toContain('Trang 1 / 1');
    expect(cleanPrintHtml).toContain('Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND');
  });

  it('9. Automatic recognition of flat-table GPMB data (.csv) and correct locality grouping', () => {
    // Exact sample from user prompt
    const csvContent = `STT,Dự án,Nhóm,Phường xã,Đánh giá tiến độ,Hạn hoàn thành,Số QĐ,Nguồn vốn,Đấu giá đất,Tổng DT thu hồi,Tổng DT GPMB,Đất NN,Đất ở,Đất phi NN,Đất địa phương,Tổ chức bị thu hồi,Hộ dân bị thu hồi,Tiền phân bổ (đồng),DT đã thu hồi,Tỷ lệ GPMB,Đã chi GPMB,DT tổ chức đã GPMB,DT hộ dân đã GPMB,Số tổ chức,Số hộ dân,Trạng thái xác nhận,Kịch bản tăng trưởng,DT bàn giao CĐT,Tỷ lệ bàn giao
1,Dự án đường sắt đoạn qua đặc khu,DA đường sắt,Đặc khu Cát Hải,Đang trong tiến độ,31/12/2026,2890/QĐ-UBND,trong_ngan_sach,Không,422118,600066,5183,0,416935,0,2,13,11736212000,244103,57.83,4807251000,238920,5183,1,13,Đang thực hiện,Không,,
2,Dự án KCN cảng cửa ngõ,Dự án hạ tầng KCN,Đặc khu Cát Hải,Đang trong tiến độ,31/12/2026,7620078327,ngoai_ngan_sach,Không,305896,1280100,0,18454,287442,0,3,70,207259210000,304755,99.63,203752036000,286931,17824,2,66,Đang thực hiện,Không,,
3,Dự án Vinfast,Các dự án khác,Đặc khu Cát Hải,Đang trong tiến độ,31/12/2026,1555/QĐ-BQL,ngoai_ngan_sach,Không,103442,103442,0,53437,50005,0,4,201,364193847000,97613,94.36,333723526000,47094,50519,1,192,Đang thực hiện,Không,,
6,Dự án vườn hoa đường vòng Cầu Niệm,Các dự án khác,Phường An Biên,Vượt tiến độ,31/12/2026,1532/QĐ-UBND,trong_ngan_sach,Không,20165,20165,0,0,20124,0,1,0,61698000000,20165,100,24089678712,20165,0,1,0,Hoàn thành GPMB,Không,20165,100
7,Dự án trạm biến áp Cầu Rào,,Phường An Biên,Hoàn thành tiến độ,12/6/2026,1532/QĐ-UBND,ngoai_ngan_sach,Không,8400,8400,8067,333,0,0,0,27,10807508565,8400,100,10807508565,0,8400,0,27,Hoàn thành GPMB,Không,,
8,Dự án nhà ở xã hội Cầu Rào 2,DA khu đô thị,Phường An Biên,Hoàn thành tiến độ,30/6/2026,1660/QĐ-UBND,ngoai_ngan_sach,Không,73064,73064,14410,0,58654,0,0,32,12162468805,73064,100,12162468805,0,12766,0,32,Đang thực hiện,Không,,`;

    const bytes = new TextEncoder().encode(csvContent);
    const parsedWb = parseWorkbookBytes(bytes, 'gpmb_du_lieu_phang.csv');
    expect(parsedWb.sheets.length).toBe(1);
    expect(detectSheetFingerprint(parsedWb.sheets[0])).toBe('GPMB_FLAT');

    const { dataset: flatGpmb } = importGpmbWorkbook(bytes, 'gpmb_du_lieu_phang.csv');
    expect(flatGpmb.sourceType).toBe('GPMB');
    expect(flatGpmb.schemaFingerprint).toBe('GPMB_FLAT');
    expect(flatGpmb.projectRowCount).toBe(6);
    expect(flatGpmb.unitCount).toBe(2); // Đặc khu Cát Hải & Phường An Biên

    // Verify projects are grouped by locality correctly
    const catHaiRecords = flatGpmb.records.filter((r) => r.localityName === 'Đặc khu Cát Hải');
    expect(catHaiRecords.length).toBe(3);
    const anBienRecords = flatGpmb.records.filter((r) => r.localityName === 'Phường An Biên');
    expect(anBienRecords.length).toBe(3);

    // Verify evaluation of GPMB_AREA_RATE with SUM(I)/SUM(D) for Cat Hai
    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, flatGpmb);
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);

    const session = createReportSession(ws, {
      name: 'Flat GPMB Session',
      dataBindings: { GPMB: flatGpmb.id, DISB: disbDataset.id, REV: revDataset.id },
    });

    const catHaiLoc = baselineLocalities.find((l) => l.displayName.includes('Cát Hải'));
    expect(catHaiLoc).toBeDefined();
    if (catHaiLoc) {
      setSessionLocalities(ws, session.id, [catHaiLoc.id]);
      const evaluated = evaluateSessionReport({
        session,
        baselineLocalities,
        datasets: { DISB: disbDataset, REV: revDataset, GPMB: flatGpmb },
      });
      const areaRateRow = evaluated.rows.find((r) => r.indicator.id === 'GPMB_AREA_RATE');
      expect(areaRateRow).toBeDefined();
      const catHaiCell = areaRateRow?.cellsByLocalityId[catHaiLoc.id];
      expect(catHaiCell).toBeDefined();
      // SUM(I) = 244103 + 304755 + 97613 = 646471
      // SUM(D) = 600066 + 1280100 + 103442 = 1983608
      // Rate = 646471 / 1983608 * 100 = 32.59%
      expect(catHaiCell?.displayedText).toBe('32,59%');
    }
  });

  it('10. As-of date adjustments in source management dynamically update report table indicator labels', () => {
    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);

    const session = createReportSession(ws, { name: 'Date Adjustment Test' });
    expect(ws.sessions.length).toBe(1);

    // Initially standard dates
    const rowDisb = session.templateRows.find((r) => r.indicatorId === 'DISB_BENCHMARK_RATE')!;
    const rowRev = session.templateRows.find((r) => r.indicatorId === 'REV_RATE_Y')!;
    const rowGpmb = session.templateRows.find((r) => r.indicatorId === 'GPMB_BENCHMARK_AREA_RATE')!;

    expect(rowDisb.customLabel).toContain('15/10/2026');
    expect(rowRev.customLabel).toContain('19/10/2026');
    expect(rowGpmb.customLabel).toContain('26/10/2026');

    // Simulate user adjusting as-of dates in Source Data Management
    disbDataset.asOfDate = '2026-10-25';
    revDataset.asOfDate = '2026-10-31';
    gpmbDataset.asOfDate = '2026-11-05';

    // Synchronize labels
    syncReportLabelsWithDatasetDates(ws);

    expect(rowDisb.customLabel).toBe('Tỷ lệ giải ngân chung của các địa phương (đến ngày 25/10/2026)');
    expect(rowRev.customLabel).toBe('Tỷ lệ thu NSNN so với dự toán (đến ngày 31/10/2026)');
    expect(rowGpmb.customLabel).toBe('Tỷ lệ GPMB trung bình của các địa phương (đến ngày 05/11/2026)');

    // Verify rendered HTML on Document Studio bolds the new date
    setSessionLocalities(ws, session.id, [baselineLocalities[0].id]);
    const evalReport = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const studioHtml = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    expect(studioHtml).toContain('<strong>(đến ngày 25/10/2026)</strong>');
    expect(studioHtml).toContain('<strong>(đến ngày 31/10/2026)</strong>');
    expect(studioHtml).toContain('<strong>(đến ngày 05/11/2026)</strong>');
  });

  it('11. The 6 localities without GPMB records default to "Không có nhiệm vụ GPMB" on report cells', () => {
    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);

    const session = createReportSession(ws, { name: 'GPMB No Task Check' });
    const luuKiem = baselineLocalities.find((l) => l.displayName === 'Phường Lưu Kiếm')!;
    const bachLongVi = baselineLocalities.find((l) => l.displayName === 'Đặc khu Bạch Long Vĩ')!;
    const hungThang = baselineLocalities.find((l) => l.displayName === 'Xã Hùng Thắng')!;

    expect(luuKiem).toBeDefined();
    expect(bachLongVi).toBeDefined();
    expect(hungThang).toBeDefined();

    setSessionLocalities(ws, session.id, [luuKiem.id, bachLongVi.id, hungThang.id]);

    const evalReport = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const budgetRow = evalReport.rows.find((r) => r.indicator.id === 'GPMB_BUDGET')!;
    const areaPlanRow = evalReport.rows.find((r) => r.indicator.id === 'GPMB_AREA_PLAN')!;
    const areaRateRow = evalReport.rows.find((r) => r.indicator.id === 'GPMB_AREA_RATE')!;
    const compRow = evalReport.rows.find((r) => r.indicator.id === 'GPMB_COMPARISON_LABEL')!;

    for (const loc of [luuKiem, bachLongVi, hungThang]) {
      expect(budgetRow.cellsByLocalityId[loc.id]?.displayedText).toBe('Không có nhiệm vụ GPMB');
      expect(areaPlanRow.cellsByLocalityId[loc.id]?.displayedText).toBe('Không có nhiệm vụ GPMB');
      expect(areaRateRow.cellsByLocalityId[loc.id]?.displayedText).toBe('Không có nhiệm vụ GPMB');
      expect(compRow.cellsByLocalityId[loc.id]?.displayedText).toBe('Không có nhiệm vụ GPMB');
      expect(budgetRow.cellsByLocalityId[loc.id]?.hasWarning).toBe(false);
      expect(areaRateRow.cellsByLocalityId[loc.id]?.hasWarning).toBe(false);
    }

    // Verify Print/PDF HTML contains 'Không có nhiệm vụ GPMB'
    const printHtml = generatePrintableReportHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtml).toContain('Không có nhiệm vụ GPMB');

    // Verify XLSX Export produces valid bytes and includes Sheet 1
    const xlsxBytes = exportSessionReportToXlsxBytes({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(xlsxBytes.length).toBeGreaterThan(1000);
  });

  it('12. Renders parenthesized notes (tăng/giảm/so sánh) as separate inline-block spans for clean wrapping', () => {
    // 1. Adjustment note
    const htmlAdjust = renderReportCellValueHtml('2.101,33 tỷ (tăng 38,25 tỷ)');
    expect(htmlAdjust).toContain('<span class="cell-main-val">2.101,33 tỷ</span>');
    expect(htmlAdjust).toContain('<span class="cell-sub-note">(tăng 38,25 tỷ)</span>');

    // 2. Comparison notes
    const htmlHigher = renderReportCellValueHtml('cao hơn (>25,99%)');
    expect(htmlHigher).toContain('<span class="cell-main-val">cao hơn</span>');
    expect(htmlHigher).toContain('<span class="cell-sub-note">(&gt;25,99%)</span>');

    const htmlLower = renderReportCellValueHtml('thấp hơn (<47,05%)');
    expect(htmlLower).toContain('<span class="cell-main-val">thấp hơn</span>');
    expect(htmlLower).toContain('<span class="cell-sub-note">(&lt;47,05%)</span>');

    // 3. Regular value without note
    const htmlRegular = renderReportCellValueHtml('Không có nhiệm vụ GPMB');
    expect(htmlRegular).toBe('<span class="cell-main-val">Không có nhiệm vụ GPMB</span>');

    // 4. Area value with m2 unit appended
    const mockAreaCell = {
      traceId: 'T1',
      indicatorId: 'GPMB_AREA_PLAN',
      localityId: 'L1',
      localityName: 'Xã A',
      exactDecimal: '550000',
      numericValueForExcel: 550000,
      excelFormatType: 'AREA' as const,
      displayedText: '550.000',
      unitLabel: 'm²',
      state: 'VALUE' as const,
      qualityStatus: 'COMPLETE' as const,
      hasWarning: false,
      warningCount: 0,
      trace: {} as any,
    };
    const areaFormatted = formatReportCellValue(mockAreaCell, 'm2', 'billion', 'm2');
    expect(areaFormatted).toBe('550.000 m2');
  });
});
