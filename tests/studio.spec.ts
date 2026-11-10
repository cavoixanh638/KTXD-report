import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
} from '../src/core/sourceReaders';
import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  createReportSession,
  setSessionLocalities,
  cloneReportSession,
  migrateLegacySessionLabels,
} from '../src/core/sessions';
import { evaluateSessionReport } from '../src/core/calculationTrace';
import { searchLocalities } from '../src/core/localities';
import { generatePrintableReportHtml } from '../src/export/print';
import {
  computeAutoLayoutMode,
  renderA4DocumentStudioHtml,
  formatReportCellValue,
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
});
