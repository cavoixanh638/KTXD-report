import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
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
  renderUncompletedProjectsTableHtml,
} from '../src/ui/reportStudio';
import {
  getUncompletedProjectsForSession,
  getNq11ProjectsForSession,
} from '../src/core/uncompletedProjects';
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
    expect(htmlAdjust).toContain('<span class="val-primary">2.101,33 tỷ</span>');
    expect(htmlAdjust).toContain('<span class="val-note">(tăng 38,25 tỷ)</span>');

    // 2. Comparison notes
    const htmlHigher = renderReportCellValueHtml('cao hơn (>25,99%)');
    expect(htmlHigher).toContain('<span class="val-primary">cao hơn</span>');
    expect(htmlHigher).toContain('<span class="val-note">(&gt;25,99%)</span>');

    const htmlLower = renderReportCellValueHtml('thấp hơn (<47,05%)');
    expect(htmlLower).toContain('<span class="val-primary">thấp hơn</span>');
    expect(htmlLower).toContain('<span class="val-note">(&lt;47,05%)</span>');

    // 3. Regular value without note
    const htmlRegular = renderReportCellValueHtml('Không có nhiệm vụ GPMB');
    expect(htmlRegular).toBe('<span class="val-primary">Không có nhiệm vụ GPMB</span>');

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

  it('13. Customizable small italic subtitle under main report title with show/hide toggle', () => {
    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);

    const session = createReportSession(ws, { name: 'Subtitle Test Session' });
    setSessionLocalities(ws, session.id, [baselineLocalities[0].id]);

    // 1. By default, showSubtitle is true and subtitle is set
    session.settings.showSubtitle = true;
    session.settings.subtitle = '(Số liệu ước tính đến tháng 10 năm 2026)';

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
    expect(studioHtml).toContain('doc-subtitle-text');
    expect(studioHtml).toContain('(Số liệu ước tính đến tháng 10 năm 2026)');

    const printHtml = generatePrintableReportHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtml).toContain('print-subtitle-block');
    expect(printHtml).toContain('(Số liệu ước tính đến tháng 10 năm 2026)');

    // 2. When showSubtitle is turned off (showSubtitle = false)
    session.settings.showSubtitle = false;
    const printHtmlHidden = generatePrintableReportHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtmlHidden).not.toContain('print-subtitle-block');
    expect(printHtmlHidden).not.toContain('(Số liệu ước tính đến tháng 10 năm 2026)');

    const studioHtmlHidden = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtmlHidden).not.toContain('doc-subtitle-text');
    expect(studioHtmlHidden).not.toContain('doc-subtitle-add-hint');
    expect(studioHtmlHidden).not.toContain('doc-subtitle-block');

    // 3. Customizable indicator column width (STT stays fixed 30px, remaining space evenly shared)
    session.settings.indicatorColumnWidthPx = 310;
    const studioHtmlCustomWidth = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtmlCustomWidth).toContain('style="width: 310px; max-width: 310px;"');

    const printHtmlCustomWidth = generatePrintableReportHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtmlCustomWidth).toContain('style="width: 310px; max-width: 310px;"');
  });

  it('14. Option 3: Uncompleted GPMB projects extraction, summary row, appendix table with 3 key fields, user editing and non-interference', () => {
    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);

    // Test with 5 sample communes
    const locNames = ['Xã Nam Sách', 'Xã Thái Tân', 'Xã Trần Phú', 'Xã Hợp Tiến', 'Xã An Phú'];
    const sampleLocs = locNames
      .map((name) => baselineLocalities.find((l) => l.displayName === name))
      .filter(Boolean) as Locality[];
    expect(sampleLocs).toHaveLength(5);

    const session = createReportSession(ws, { name: 'Option 3 Test Session' });
    setSessionLocalities(
      ws,
      session.id,
      sampleLocs.map((l) => l.id)
    );

    // 1. Verify getUncompletedProjectsForSession
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset,
      baselineLocalities,
    });

    const namSach = sampleLocs.find((l) => l.displayName === 'Xã Nam Sách')!;
    const thaiTan = sampleLocs.find((l) => l.displayName === 'Xã Thái Tân')!;
    const tranPhu = sampleLocs.find((l) => l.displayName === 'Xã Trần Phú')!;
    const hopTien = sampleLocs.find((l) => l.displayName === 'Xã Hợp Tiến')!;
    const anPhu = sampleLocs.find((l) => l.displayName === 'Xã An Phú')!;

    // Counts:
    // Nam Sách has 4 uncompleted projects out of 4 total
    expect(uncompletedRes.projectsByLocalityId[namSach.id]).toHaveLength(4);
    expect(uncompletedRes.summaryTextByLocalityId[namSach.id]).toBe('4/4 dự án');

    // Thái Tân is in GPMB_NO_RECORD_COMMUNES -> "Không có nhiệm vụ GPMB"
    expect(uncompletedRes.projectsByLocalityId[thaiTan.id]).toHaveLength(0);
    expect(uncompletedRes.summaryTextByLocalityId[thaiTan.id]).toBe('Không có nhiệm vụ GPMB');

    // Trần Phú has 2 uncompleted projects out of 4 total -> "2/4 dự án"
    expect(uncompletedRes.projectsByLocalityId[tranPhu.id]).toHaveLength(2);
    expect(uncompletedRes.summaryTextByLocalityId[tranPhu.id]).toBe('2/4 dự án');

    // Hợp Tiến has 1 uncompleted project out of 3 total -> "1/3 dự án"
    expect(uncompletedRes.projectsByLocalityId[hopTien.id]).toHaveLength(1);
    expect(uncompletedRes.summaryTextByLocalityId[hopTien.id]).toBe('1/3 dự án');

    // An Phú has 1 project that is 100% completed -> 0 uncompleted -> "Hoàn thành 1/1 dự án"
    expect(uncompletedRes.projectsByLocalityId[anPhu.id]).toHaveLength(0);
    expect(uncompletedRes.summaryTextByLocalityId[anPhu.id]).toBe('Hoàn thành 1/1 dự án');

    // Total uncompleted projects: 4 + 2 + 1 = 7 projects
    expect(uncompletedRes.projects).toHaveLength(7);
    // Deadlines are specific to month (format "Hạn tháng M/YYYY" or "Hạn tháng MM/YYYY")
    expect(uncompletedRes.projects[0].deadline).toMatch(/^Hạn tháng \d+\/\d{4}$/);
    expect(uncompletedRes.projects.some((p) => p.deadline === 'Hạn tháng 11/2026')).toBe(true);

    // 2. Verify Appendix Table strictly renders only 5 columns (STT, Địa phương, Tên dự án, Tỷ lệ hoàn thành, Hạn hoàn thành)
    const tableHtml = renderUncompletedProjectsTableHtml({
      session,
      gpmbDataset,
      baselineLocalities,
      isPrintMode: true,
    });
    expect(tableHtml).toContain('DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH');
    expect(tableHtml).toContain('Địa phương');
    expect(tableHtml).toContain('Tên dự án');
    expect(tableHtml).toContain('Tỷ lệ hoàn thành');
    expect(tableHtml).toContain('Hạn hoàn thành');
    // Ensure excluded columns (Area D, I, Kinh phí G, J) are NOT present in table headers
    expect(tableHtml).not.toContain('Diện tích');
    expect(tableHtml).not.toContain('Kinh phí');

    // 3. User Override Capability: Edit project name, rate, deadline, hide project
    const projToEdit = uncompletedRes.projects[0];
    session.settings.projectOverrides = {
      [projToEdit.id]: {
        projectName: 'Tên dự án đã chỉnh sửa bởi người dùng',
        completionRate: '95,00%',
        deadline: '15/12/2026',
      },
      [uncompletedRes.projects[1].id]: {
        isHidden: true,
      },
    };

    const resAfterOverride = getUncompletedProjectsForSession({
      session,
      gpmbDataset,
      baselineLocalities,
    });
    // 1 project was hidden, so 7 - 1 = 6
    expect(resAfterOverride.projects).toHaveLength(6);
    const editedProj = resAfterOverride.projects.find((p) => p.id === projToEdit.id)!;
    expect(editedProj.projectName).toBe('Tên dự án đã chỉnh sửa bởi người dùng');
    expect(editedProj.completionRate).toBe('95,00%');
    expect(editedProj.deadline).toBe('Hạn tháng 12/2026');

    // 4. Custom Projects Addition
    session.settings.customProjects = [
      {
        id: 'custom_proj_1',
        localityId: namSach.id,
        localityName: 'Xã Nam Sách',
        projectStt: 99,
        projectName: 'Dự án bổ sung thủ công',
        completionRate: '50,00%',
        deadline: '30/11/2026',
        isCustom: true,
      },
    ];

    const resWithCustom = getUncompletedProjectsForSession({
      session,
      gpmbDataset,
      baselineLocalities,
    });
    expect(resWithCustom.projects).toHaveLength(7);
    const customProj = resWithCustom.projects.find((p) => p.projectName === 'Dự án bổ sung thủ công')!;
    expect(customProj).toBeDefined();
    expect(customProj.deadline).toBe('Hạn tháng 11/2026');

    // 5. Studio Document & Print Document rendering integration
    const evalReport = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    // Master spec rule: 14 core rows remain untouched!
    expect(evalReport.rows).toHaveLength(14);

    const studioHtml = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    // Contains summary row STT 8 and sub-row
    expect(studioHtml).toContain('Số dự án chưa hoàn thành GPMB');
    expect(studioHtml).toContain('Tên dự án chưa hoàn thành GPMB');
    // Contains appendix table
    expect(studioHtml).toContain('DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH');

    const printHtml = generatePrintableReportHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtml).toContain('Số dự án chưa hoàn thành GPMB');
    expect(printHtml).toContain('Tên dự án chưa hoàn thành GPMB');
    expect(printHtml).toContain('DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH');

    // 6. Test hide/un-hide button when appendix table is hidden
    session.settings.showUncompletedProjectsTable = false;
    const studioHtmlHiddenTable = renderA4DocumentStudioHtml({
      evaluated: evalReport,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtmlHiddenTable).toContain('Hiện bảng chi tiết danh mục dự án GPMB');
    expect(studioHtmlHiddenTable).not.toContain('DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH');

    // 7. Test font size customization for project detail sub-row
    session.settings.uncompletedProjectsFontSizePt = 9.5;
    const evalWithFont = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const studioHtmlFont = renderA4DocumentStudioHtml({
      evaluated: evalWithFont,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtmlFont).toContain('9.5pt');

    const printHtmlFont = generatePrintableReportHtml({
      evaluated: evalWithFont,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtmlFont).toContain('font-size: 9.5pt');

    // 8. Test split row 8 to new page toggle
    session.settings.splitRow8ToNewPage = true;
    const evalWithSplit = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const studioHtmlSplit = renderA4DocumentStudioHtml({
      evaluated: evalWithSplit,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    // WebApp renders 2 A4 paper sheets
    expect((studioHtmlSplit.match(/class="a4-paper-sheet/g) || []).length).toBe(2);
    expect(studioHtmlSplit).toContain('(tiếp theo)');
    expect(studioHtmlSplit).toContain('Trang 1/2');
    expect(studioHtmlSplit).toContain('Trang 2/2');

    const printHtmlSplit = generatePrintableReportHtml({
      evaluated: evalWithSplit,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    // Print renders 2 page sections
    expect((printHtmlSplit.match(/class="print-page-chunk"/g) || []).length).toBe(2);
    expect(printHtmlSplit).toContain('(tiếp theo)');

    // 9. Test Row 9: Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc
    // Default presence of Row 9
    expect(studioHtmlSplit).toContain('doc-row-nq11');
    expect(studioHtmlSplit).toContain('Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc');
    expect(studioHtmlSplit).toContain('btn-add-nq11-global');
    expect(studioHtmlSplit).toContain('btn-action-add-nq11-loc');

    // Add user-inputted NQ 11 project to Nam Sách
    session.settings.nq11Projects = [
      {
        id: 'nq11-proj-1',
        localityId: namSach.id,
        localityName: namSach.displayName,
        projectName: 'Đường gom dân sinh ven kênh NQ11',
        issueContent: 'Vướng GPMB 5 hộ dân chưa nhận tiền đền bù',
        deadline: 'Hạn tháng 12/2026',
      },
    ];

    const evalWithNq11 = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const studioHtmlNq11 = renderA4DocumentStudioHtml({
      evaluated: evalWithNq11,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    // Verify NQ 11 project rendering in HTML with font size (9.5pt) applied and top alignment
    expect(studioHtmlNq11).toContain('Đường gom dân sinh ven kênh NQ11');
    expect(studioHtmlNq11).toContain('Vướng GPMB 5 hộ dân chưa nhận tiền đền bù');
    expect(studioHtmlNq11).toContain('Hạn tháng 12/2026');
    expect(studioHtmlNq11).toContain('font-size: 9.5pt');
    expect(studioHtmlNq11).toContain('data-nq11-id="nq11-proj-1"');
    expect(studioHtmlNq11).toContain('vertical-align: top;');
    // Ensure no duplicate style attribute on td elements for rows 8 & 9
    expect(studioHtmlNq11).not.toMatch(/style="[^"]*"\s+style="/);

    // Verify NQ 11 presence and top alignment in Print HTML
    const printHtmlNq11 = generatePrintableReportHtml({
      evaluated: evalWithNq11,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });
    expect(printHtmlNq11).toContain('Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc');
    expect(printHtmlNq11).toContain('Đường gom dân sinh ven kênh NQ11');
    expect(printHtmlNq11).toContain('Vướng GPMB 5 hộ dân chưa nhận tiền đền bù');
    expect(printHtmlNq11).toContain('doc-row-uncompleted-count');
    expect(printHtmlNq11).toContain('doc-row-uncompleted-names');
    expect(printHtmlNq11).toContain('vertical-align: top;');

    // Verify NQ 11 presence and top-alignment styles in XLSX export
    const xlsxBytes = exportSessionReportToXlsxBytes({
      evaluated: evalWithNq11,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(xlsxBytes.length).toBeGreaterThan(1000);
    const unzipped = unzipSync(xlsxBytes);
    const stylesXml = strFromU8(unzipped['xl/styles.xml']);
    const sheet1Xml = strFromU8(unzipped['xl/worksheets/sheet1.xml']);
    expect(stylesXml).toContain('vertical="top"');
    expect(sheet1Xml).toContain('Đường gom dân sinh ven kênh NQ11');

    // Verify hiding Row 9 when showNq11Row = false
    session.settings.showNq11Row = false;
    const evalWithoutNq11 = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const studioHtmlNoNq11 = renderA4DocumentStudioHtml({
      evaluated: evalWithoutNq11,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtmlNoNq11).not.toContain('doc-row-nq11');
    expect(studioHtmlNoNq11).not.toContain('Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc');
  });

  it('15. Recognizes DISB_PHAN_CAP_XA_V1 (12-col allocated capital workbook without pre-adjustment column) and omits plan adjustment comparison', () => {
    const buildMinimalPhanCapXaXlsx = (): Uint8Array => {
      const cellXml = (addr: string, val: string | number) => {
        if (typeof val === 'number') {
          return `<c r="${addr}" t="n"><v>${val}</v></c>`;
        }
        const escaped = String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<c r="${addr}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
      };
      const rows: string[] = [];
      const pushRow = (r: number, cols: Array<[string, string | number]>) => {
        rows.push(`<row r="${r}">${cols.map(([c, v]) => cellXml(`${c}${r}`, v)).join('')}</row>`);
      };
      pushRow(1, [['A', 'TÌNH HÌNH GIẢI NGÂN KẾ HOẠCH VỐN ĐẦU TƯ CÔNG NĂM 2026 ĐẾN HẾT NGÀY 08/11/2026']]);
      pushRow(2, [['A', 'Đơn vị: Triệu đồng']]);
      pushRow(3, [
        ['A', 'Stt'],
        ['B', 'Chủ đầu tư'],
        ['C', 'Kế hoạch vốn năm 2026'],
        ['G', 'Giải ngân đến hết ngày 08/11/2026 theo báo cáo của Kho bạc Nhà nước khu vực III'],
        ['K', 'Tỷ lệ'],
        ['L', 'Ghi chú'],
      ]);
      pushRow(4, [['C', 'Tổng số'], ['D', 'Chi tiết theo nguồn vốn'], ['G', 'Tổng số'], ['H', 'Chi tiết theo nguồn vốn']]);
      pushRow(5, [
        ['D', 'Nguồn thu tiền sử dụng đất'],
        ['E', 'Bổ sung có mục tiêu'],
        ['F', 'Nguồn tăng thu'],
        ['H', 'Nguồn thu tiền sử dụng đất'],
        ['I', 'Bổ sung có mục tiêu'],
        ['J', 'Nguồn tăng thu'],
      ]);
      pushRow(6, [['A', 1], ['B', 2], ['C', '3=4+5+6'], ['G', '7=8+9+10'], ['K', '11=7/3'], ['L', 12]]);
      // Row 7 summary = sum of 3 sample communes
      pushRow(7, [
        ['B', 'Tổng số'],
        ['C', 258787.89399932264],
        ['D', 22854],
        ['E', 135933.89399932264],
        ['F', 100000],
        ['G', 195050],
        ['H', 22363],
        ['I', 134549],
        ['J', 38138],
        ['K', 0.7537060405768989],
      ]);
      pushRow(8, [
        ['A', 1],
        ['B', 'Xã Nam Sách'],
        ['C', 88745.03866983537],
        ['D', 10172],
        ['E', 28573.03866983536],
        ['F', 50000],
        ['G', 76883],
        ['H', 10172],
        ['I', 28573],
        ['J', 38138],
        ['K', 0.8663357541150376],
      ]);
      pushRow(9, [
        ['A', 2],
        ['B', 'Xã Thái Tân'],
        ['C', 24169.16741313712],
        ['D', 3570],
        ['E', 20599.16741313712],
        ['F', 0],
        ['G', 23157],
        ['H', 3081],
        ['I', 20076],
        ['J', 0],
        ['K', 0.9581215440385027],
      ]);
      pushRow(10, [
        ['A', 3],
        ['B', 'Phường Phù Liễn'],
        ['C', 145873.68791631915],
        ['D', 9112],
        ['E', 86761.68791631915],
        ['F', 50000],
        ['G', 95010],
        ['H', 9110],
        ['I', 85900],
        ['J', 0],
        ['K', 0.6513169130633202],
        ['L', 'Loại trừ nguồn tăng thu bổ sung theo Quyết định số 4581/QĐ-UBND ngày 31/10/2026, tỷ lệ giải ngân đạt 99%'],
      ]);

      const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
      const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tổng hợp" sheetId="1" state="visible" r:id="rId1"/></sheets></workbook>`;
      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
      const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

      return zipSync({
        '[Content_Types].xml': strToU8(contentTypes),
        '_rels/.rels': strToU8(rootRels),
        'xl/workbook.xml': strToU8(workbookXml),
        'xl/_rels/workbook.xml.rels': strToU8(relsXml),
        'xl/worksheets/sheet1.xml': strToU8(sheetXml),
      });
    };

    const bytes = buildMinimalPhanCapXaXlsx();
    const parsedWb = parseWorkbookBytes(bytes, 'Von_phan_cap_xa_08.11.xlsx');
    expect(detectSheetFingerprint(parsedWb.sheets[0])).toBe('DISB_PHAN_CAP_XA_V1');

    const imported = importDisbursementWorkbook(bytes, 'Von_phan_cap_xa_08.11.xlsx');
    expect(imported.dataset.schemaFingerprint).toBe('DISB_PHAN_CAP_XA_V1');
    expect(imported.dataset.asOfDate).toBe('2026-11-08');
    expect(imported.dataset.unitCount).toBe(3);
    expect(imported.dataset.citySummaryRecord).toBeUndefined();
    expect(imported.dataset.unplannedDisbursementRecord).toBeUndefined();
    expect(imported.dataset.summaryRecord?.sourceRow).toBe(7);
    expect(imported.dataset.identityChecks?.length).toBe(6); // 3 rows x (C=D+E+F, G=H+I+J)
    expect(imported.dataset.identityChecks?.every((c) => c.status === 'PASS_COMPLETE')).toBe(true);

    const phuLienRec = imported.dataset.records.find((r) => r.localityName === 'Phường Phù Liễn')!;
    expect(phuLienRec.officialNote).toContain('4581/QĐ-UBND');
    expect(phuLienRec.adjustedScenarios?.[0].excludedItems[0]).toContain('4581');

    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, imported.dataset, imported.localities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);
    const session = createReportSession(ws, {
      name: 'Phân cấp xã 08.11',
      dataBindings: { DISB: imported.dataset.id, REV: revDataset.id, GPMB: gpmbDataset.id },
    });
    const namSachId = imported.localities.find((l) => l.displayName === 'Xã Nam Sách')!.id;
    const thaiTanId = imported.localities.find((l) => l.displayName === 'Xã Thái Tân')!.id;
    setSessionLocalities(ws, session.id, [namSachId, thaiTanId]);

    const evaluated = evaluateSessionReport({
      session,
      baselineLocalities: ws.localities,
      datasets: { DISB: imported.dataset, REV: revDataset, GPMB: gpmbDataset },
    });

    const row3 = evaluated.rows.find((r) => r.indicator.id === 'DISB_PLAN')!;
    const namSachPlan = row3.cellsByLocalityId[namSachId];
    expect(namSachPlan.adjustmentNote).toBeNull();
    expect(formatReportCellValue(namSachPlan, row3.indicator.displayUnit, 'billion')).toBe('88,75 tỷ');
    expect(evaluated.benchmarks?.disbRateBenchmark?.displayedText).toBe('75,37%');

    const studioHtml = renderA4DocumentStudioHtml({
      evaluated,
      baselineLocalities: ws.localities,
      datasets: { DISB: imported.dataset, REV: revDataset, GPMB: gpmbDataset },
    });
    expect(studioHtml).toContain('88,75 tỷ');
    expect(studioHtml).toContain('08/11/2026');
    expect(studioHtml).not.toContain('(tăng');
    expect(studioHtml).not.toContain('(giữ nguyên');

    const xlsxBytes = exportSessionReportToXlsxBytes({
      evaluated,
      baselineLocalities: ws.localities,
      datasets: { DISB: imported.dataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const sheet1Xml = strFromU8(unzipSync(xlsxBytes)['xl/worksheets/sheet1.xml']);
    expect(sheet1Xml).toContain('88.74503866983537');

    // Also test explicit toggle-off on DISB_V1 omits adjustmentNote cleanly
    const wsV1 = createEmptyWorkspace();
    registerDatasetInWorkspace(wsV1, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(wsV1, revDataset);
    registerDatasetInWorkspace(wsV1, gpmbDataset);
    const sV1 = createReportSession(wsV1, { name: 'V1 without adj comparison' });
    const kienThuyLoc = baselineLocalities.find((l) => l.displayName.includes('Kiến Thụy'))!;
    setSessionLocalities(wsV1, sV1.id, [kienThuyLoc.id]);
    sV1.settings.showDisbPlanAdjustmentComparison = false;
    const evalV1NoAdj = evaluateSessionReport({
      session: sV1,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const ktCell = evalV1NoAdj.rows.find((r) => r.indicator.id === 'DISB_PLAN')!.cellsByLocalityId[kienThuyLoc.id];
    expect(ktCell.adjustmentNote).toBeNull();
  });
});
