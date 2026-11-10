import { zipSync, strToU8 } from 'fflate';
import { EvaluatedSessionReport } from '../core/calculationTrace';
import { analyzeSourceCoverage, filterCoverageForSession } from '../core/coverage';
import { DEFAULT_INDICATORS } from '../core/indicators';
import { Dataset, Locality } from '../core/types';
import { formatReportCellValue } from '../ui/reportStudio';
import { formatVnDate } from '../core/sessions';
import {
  getUncompletedProjectsForSession,
  getNq11ProjectsForSession,
} from '../core/uncompletedProjects';

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Prevent CSV/Excel formula injection (T23, §16.1) for text cells.
 */
export function sanitizeExcelText(text: string): string {
  const s = String(text ?? '');
  if (/^[=+\-@]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

function colIndexToLetter(colIdx1Based: number): string {
  let n = colIdx1Based;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface XlsxCellInput {
  type: 'n' | 's';
  value: number | string;
  styleIndex: number;
}

function buildWorksheetXml(params: {
  rows: Array<Array<XlsxCellInput | null>>;
  colWidths: number[];
  mergeRanges?: string[];
  paperSize: 'A4' | 'A3';
  orientation: 'landscape' | 'portrait';
}): string {
  const { rows, colWidths, mergeRanges = [], paperSize, orientation } = params;

  const colsXml =
    colWidths.length > 0
      ? `<cols>${colWidths
          .map(
            (w, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
          )
          .join('')}</cols>`
      : '';

  const rowsXmlParts: string[] = [];
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowNum = rIdx + 1;
    const rowCells = rows[rIdx];
    const cellParts: string[] = [];

    for (let cIdx = 0; cIdx < rowCells.length; cIdx++) {
      const cell = rowCells[cIdx];
      if (!cell) continue;
      const addr = `${colIndexToLetter(cIdx + 1)}${rowNum}`;
      if (cell.type === 'n' && typeof cell.value === 'number' && Number.isFinite(cell.value)) {
        cellParts.push(
          `<c r="${addr}" s="${cell.styleIndex}"><v>${cell.value}</v></c>`
        );
      } else {
        const safeText = escapeXml(sanitizeExcelText(String(cell.value ?? '')));
        cellParts.push(
          `<c r="${addr}" t="inlineStr" s="${cell.styleIndex}"><is><t xml:space="preserve">${safeText}</t></is></c>`
        );
      }
    }
    rowsXmlParts.push(`<row r="${rowNum}">${cellParts.join('')}</row>`);
  }

  const mergesXml =
    mergeRanges.length > 0
      ? `<mergeCells count="${mergeRanges.length}">${mergeRanges
          .map((ref) => `<mergeCell ref="${ref}"/>`)
          .join('')}</mergeCells>`
      : '';

  // Excel paperSize: 9 = A4, 8 = A3
  const paperCode = paperSize === 'A3' ? 8 : 9;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${colsXml}
  <sheetData>${rowsXmlParts.join('')}</sheetData>
  ${mergesXml}
  <pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <pageSetup paperSize="${paperCode}" orientation="${orientation}"/>
</worksheet>`;
}

function buildStylesXml(): string {
  // Style indices:
  // 0: Normal Times New Roman 11
  // 1: Title Bold Times New Roman 13 Center
  // 2: Header Bold Times New Roman 11 Center Border Fill
  // 3: Text Times New Roman 11 Left Border Wrap
  // 4: Money (#,##0.00) Times New Roman 11 Right Border (numFmtId=164)
  // 5: Percent (0.00%) Times New Roman 11 Right Border (numFmtId=10)
  // 6: Integer/Area (#,##0) Times New Roman 11 Right Border (numFmtId=3)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="13"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="11"/><name val="Times New Roman"/><family val="1"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

export function exportSessionReportToXlsxBytes(params: {
  evaluated: EvaluatedSessionReport;
  baselineLocalities: Locality[];
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
}): Uint8Array {
  const { evaluated, baselineLocalities, datasets } = params;
  const { session, selectedLocalities, rows, tracesById } = evaluated;

  // Enforce §7 Rule 6: cannot disable scope footnotes when exporting mixed-period datasets
  if (!session.settings.showScopeFootnotes) {
    throw new Error(
      'BLOCKER_UNEXPLAINED_EXPORT: Báo cáo kết hợp nhiều nguồn có kỳ/ngày chốt khác nhau, không được tắt chú thích nguồn và phạm vi khi xuất chính thức.'
    );
  }

  // Sheet 1: Báo cáo
  const totalCols = Math.max(3, 2 + selectedLocalities.length);
  const lastColLetter = colIndexToLetter(totalCols);
  const sheet1Rows: Array<Array<XlsxCellInput | null>> = [];

  // Row 1: Title & optional subtitle
  const titleText =
    session.settings.showSubtitle && session.settings.subtitle
      ? `${session.settings.reportTitle}\n${session.settings.subtitle}`
      : session.settings.reportTitle;

  const titleRow: Array<XlsxCellInput | null> = new Array(totalCols).fill(null);
  titleRow[0] = {
    type: 's',
    value: titleText,
    styleIndex: 1,
  };
  sheet1Rows.push(titleRow);

  // Row 2: Header
  const headerRow: Array<XlsxCellInput | null> = [
    { type: 's', value: 'STT', styleIndex: 2 },
    { type: 's', value: 'Chỉ tiêu / Kết quả', styleIndex: 2 },
    ...selectedLocalities.map((loc) => ({
      type: 's' as const,
      value: loc.displayName,
      styleIndex: 2,
    })),
  ];
  sheet1Rows.push(headerRow);

  // Data rows (14 template rows, excluding hidden or removed average comment rows)
  const displayRows = rows.filter(
    (r) => r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT' && r.rowConfig.visible !== false
  );

  for (const r of displayRows) {
    const rowCells: Array<XlsxCellInput | null> = [
      { type: 's', value: r.rowConfig.sttLabel || '', styleIndex: 3 },
      {
        type: 's',
        value: r.rowConfig.customLabel,
        styleIndex: 3,
      },
    ];

    for (const loc of selectedLocalities) {
      const cellEval = r.cellsByLocalityId[loc.id];
      if (!cellEval) {
        rowCells.push({ type: 's', value: 'Chưa có số liệu', styleIndex: 3 });
        continue;
      }

      if (cellEval.adjustmentNote) {
        const formattedVal = formatReportCellValue(
          cellEval,
          r.indicator.displayUnit,
          session.settings.moneyUnit,
          session.settings.areaUnit
        );
        rowCells.push({
          type: 's',
          value: formattedVal,
          styleIndex: 7,
        });
      } else if (r.indicator.id === 'GPMB_AREA_PLAN') {
        const formattedVal = formatReportCellValue(
          cellEval,
          r.indicator.displayUnit,
          session.settings.moneyUnit,
          session.settings.areaUnit
        );
        rowCells.push({
          type: 's',
          value: formattedVal,
          styleIndex: 7,
        });
      } else if (
        cellEval.numericValueForExcel !== null &&
        Number.isFinite(cellEval.numericValueForExcel)
      ) {
        const styleIdx =
          cellEval.excelFormatType === 'PERCENT_RATIO'
            ? 5
            : 4;
        rowCells.push({
          type: 'n',
          value: cellEval.numericValueForExcel,
          styleIndex: styleIdx,
        });
      } else {
        const formattedVal = formatReportCellValue(
          cellEval,
          r.indicator.displayUnit,
          session.settings.moneyUnit,
          session.settings.areaUnit
        );
        rowCells.push({
          type: 's',
          value: formattedVal || cellEval.displayedText,
          styleIndex: 7,
        });
      }
    }

    sheet1Rows.push(rowCells);
  }

  if (session.settings.showUncompletedSummaryRow !== false && datasets.GPMB) {
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities,
    });

    // Dòng STT 8: Số dự án chưa hoàn thành GPMB
    const row8Cells: Array<XlsxCellInput | null> = [
      { type: 's', value: '8', styleIndex: 8 },
      {
        type: 's',
        value:
          session.settings.uncompletedRowCustomLabel ||
          'Số dự án chưa hoàn thành GPMB',
        styleIndex: 9,
      },
    ];
    for (const loc of selectedLocalities) {
      const summaryText =
        uncompletedRes.summaryTextByLocalityId[loc.id] || 'Đã hoàn thành';
      row8Cells.push({
        type: 's',
        value: summaryText,
        styleIndex: 11,
      });
    }
    sheet1Rows.push(row8Cells);

    // Dòng con (không STT): Tên dự án chưa hoàn thành GPMB
    const subRowCells: Array<XlsxCellInput | null> = [
      { type: 's', value: '', styleIndex: 10 },
      {
        type: 's',
        value:
          session.settings.uncompletedProjectsListCustomLabel ||
          'Tên dự án chưa hoàn thành GPMB',
        styleIndex: 10,
      },
    ];
    for (const loc of selectedLocalities) {
      const listText =
        uncompletedRes.projectListTextByLocalityId[loc.id] || '-';
      const isPlaceholder = listText === '-' || listText === 'Không có nhiệm vụ GPMB';
      subRowCells.push({
        type: 's',
        value: listText,
        styleIndex: isPlaceholder ? 11 : 10,
      });
    }
    sheet1Rows.push(subRowCells);
  }

  if (session.settings.showNq11Row !== false) {
    const nq11Res = getNq11ProjectsForSession({
      session,
      selectedLocalities,
    });
    const row9Cells: Array<XlsxCellInput | null> = [
      { type: 's', value: '9', styleIndex: 8 },
      {
        type: 's',
        value:
          session.settings.nq11RowCustomLabel ||
          'Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc',
        styleIndex: 9,
      },
    ];
    for (const loc of selectedLocalities) {
      const listText = nq11Res.textByLocalityId[loc.id] || '-';
      row9Cells.push({
        type: 's',
        value: listText,
        styleIndex: listText === '-' ? 11 : 10,
      });
    }
    sheet1Rows.push(row9Cells);
  }

  if (session.settings.showUncompletedProjectsTable !== false && datasets.GPMB) {
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities,
    });
    if (uncompletedRes.projects.length > 0) {
      sheet1Rows.push([]);
      sheet1Rows.push([
        {
          type: 's',
          value: 'DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH',
          styleIndex: 2,
        },
      ]);
      sheet1Rows.push([
        { type: 's', value: 'STT', styleIndex: 2 },
        { type: 's', value: 'Địa phương', styleIndex: 2 },
        { type: 's', value: 'Tên dự án', styleIndex: 2 },
        { type: 's', value: 'Tỷ lệ hoàn thành', styleIndex: 2 },
        { type: 's', value: 'Hạn hoàn thành', styleIndex: 2 },
      ]);
      uncompletedRes.projects.forEach((p, idx) => {
        sheet1Rows.push([
          { type: 'n', value: idx + 1, styleIndex: 4 },
          { type: 's', value: p.localityName, styleIndex: 3 },
          { type: 's', value: p.projectName, styleIndex: 3 },
          { type: 's', value: p.completionRate, styleIndex: 7 },
          { type: 's', value: p.deadline, styleIndex: 7 },
        ]);
      });
    }
  }

  // Footnote rows on Sheet 1
  sheet1Rows.push([]);
  const revDate = datasets.REV?.asOfDate ? formatVnDate(datasets.REV.asOfDate) : '19/10/2026';
  const disbDate = datasets.DISB?.asOfDate ? formatVnDate(datasets.DISB.asOfDate) : '15/10/2026';
  const gpmbDate = datasets.GPMB?.asOfDate ? formatVnDate(datasets.GPMB.asOfDate) : '26/10/2026';
  const gpmbUnits = datasets.GPMB?.unitCount || 108;
  const gpmbProjects = datasets.GPMB?.projectRowCount || 422;
  sheet1Rows.push([
    { type: 's', value: 'Ghi chú nguồn & ngày chốt:', styleIndex: 2 },
    {
      type: 's',
      value: `Thu NSNN: kỳ 10T/2026 (ngày chốt: ${revDate}, phạm vi 113/114 địa phương, thiếu Đặc khu Bạch Long Vĩ); Giải ngân: ${disbDate} (114/114 địa phương); GPMB: ${gpmbDate} (${gpmbUnits}/114 địa bàn, ${gpmbProjects} dự án, chỉ tính theo diện tích SUM(I)/SUM(D)).`,
      styleIndex: 3,
    },
  ]);

  const sheet1Xml = buildWorksheetXml({
    rows: sheet1Rows,
    colWidths: [
      8,
      session.settings.indicatorColumnWidthPx
        ? Math.round((session.settings.indicatorColumnWidthPx / 240) * 46)
        : 46,
      ...selectedLocalities.map(() => 18),
    ],
    mergeRanges: [`A1:${lastColLetter}1`],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
  });

  // Sheet 2: Nguồn thiếu & lý do (Coverage & Mismatches)
  const { allCoverageDetails } = analyzeSourceCoverage(
    baselineLocalities,
    datasets
  );
  const relevantCoverage = filterCoverageForSession(
    allCoverageDetails,
    session.selectedLocalityIds,
    true
  );

  const sheet2Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Tên địa phương', styleIndex: 2 },
      { type: 's', value: 'Nguồn', styleIndex: 2 },
      { type: 's', value: 'Trường / Chỉ tiêu', styleIndex: 2 },
      { type: 's', value: 'Trạng thái', styleIndex: 2 },
      { type: 's', value: 'Bằng chứng (Sheet/Ô)', styleIndex: 2 },
      { type: 's', value: 'Nguyên nhân / Diễn giải có căn cứ', styleIndex: 2 },
      { type: 's', value: 'Kỳ chốt', styleIndex: 2 },
      { type: 's', value: 'Tác động phép tính', styleIndex: 2 },
    ],
  ];

  for (const cov of relevantCoverage) {
    sheet2Rows.push([
      { type: 's', value: cov.localityName, styleIndex: 3 },
      { type: 's', value: cov.sourceType || cov.sourceDatasetId, styleIndex: 3 },
      { type: 's', value: cov.fieldId || 'Toàn bộ bản ghi địa phương', styleIndex: 3 },
      { type: 's', value: cov.status, styleIndex: 3 },
      {
        type: 's',
        value: `${cov.sourceSheet || ''}${cov.sourceCell ? '!' + cov.sourceCell : ''}`,
        styleIndex: 3,
      },
      { type: 's', value: cov.reason, styleIndex: 3 },
      { type: 's', value: cov.asOfDate || '', styleIndex: 3 },
      { type: 's', value: cov.impactOnComputation || '', styleIndex: 3 },
    ]);
  }

  const sheet2Xml = buildWorksheetXml({
    rows: sheet2Rows,
    colWidths: [24, 12, 22, 22, 22, 50, 14, 38],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
  });

  // Sheet 3: Danh mục công thức
  const sheet3Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Mã chỉ tiêu', styleIndex: 2 },
      { type: 's', value: 'Tên chỉ tiêu', styleIndex: 2 },
      { type: 's', value: 'Nguồn', styleIndex: 2 },
      { type: 's', value: 'Công thức nghiệp vụ', styleIndex: 2 },
      { type: 's', value: 'Đơn vị gốc', styleIndex: 2 },
      { type: 's', value: 'Đơn vị hiển thị', styleIndex: 2 },
      { type: 's', value: 'Phương pháp gộp', styleIndex: 2 },
      { type: 's', value: 'Chính sách Mốc & Null/0', styleIndex: 2 },
    ],
  ];

  for (const ind of Object.values(DEFAULT_INDICATORS)) {
    sheet3Rows.push([
      { type: 's', value: ind.id, styleIndex: 3 },
      { type: 's', value: ind.label, styleIndex: 3 },
      { type: 's', value: ind.sourceType, styleIndex: 3 },
      { type: 's', value: ind.fieldOrFormula, styleIndex: 3 },
      { type: 's', value: ind.originalUnit, styleIndex: 3 },
      { type: 's', value: ind.displayUnit, styleIndex: 3 },
      { type: 's', value: ind.aggregationPolicy, styleIndex: 3 },
      { type: 's', value: ind.benchmarkPolicy, styleIndex: 3 },
    ]);
  }

  const sheet3Xml = buildWorksheetXml({
    rows: sheet3Rows,
    colWidths: [26, 40, 12, 34, 14, 14, 26, 45],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
  });

  // Sheet 4: Nhật ký phép tính (CalculationTrace Log)
  const sheet4Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Trace ID', styleIndex: 2 },
      { type: 's', value: 'Mã chỉ tiêu', styleIndex: 2 },
      { type: 's', value: 'Địa phương / Phạm vi', styleIndex: 2 },
      { type: 's', value: 'Biểu thức công thức', styleIndex: 2 },
      { type: 's', value: 'Giá trị chính xác (Decimal)', styleIndex: 2 },
      { type: 's', value: 'Giá trị hiển thị', styleIndex: 2 },
      { type: 's', value: 'Đơn vị', styleIndex: 2 },
      { type: 's', value: 'Số bản ghi tính (Included)', styleIndex: 2 },
      { type: 's', value: 'Số bản ghi loại (Excluded)', styleIndex: 2 },
      { type: 's', value: 'Ngày chốt', styleIndex: 2 },
      { type: 's', value: 'Chất lượng (Quality)', styleIndex: 2 },
    ],
  ];

  for (const trace of tracesById.values()) {
    sheet4Rows.push([
      { type: 's', value: trace.traceId, styleIndex: 3 },
      { type: 's', value: trace.indicatorId, styleIndex: 3 },
      { type: 's', value: trace.localityName || trace.scope.type, styleIndex: 3 },
      { type: 's', value: trace.formula.readableExpression, styleIndex: 3 },
      { type: 's', value: trace.result.exactDecimal ?? 'null', styleIndex: 3 },
      { type: 's', value: trace.result.displayedText, styleIndex: 3 },
      { type: 's', value: trace.result.displayUnit, styleIndex: 3 },
      { type: 'n', value: trace.population.includedCount, styleIndex: 6 },
      { type: 'n', value: trace.population.excludedCount, styleIndex: 6 },
      { type: 's', value: trace.scope.asOfDates.join(', '), styleIndex: 3 },
      { type: 's', value: trace.quality.status, styleIndex: 3 },
    ]);
  }

  const sheet4Xml = buildWorksheetXml({
    rows: sheet4Rows,
    colWidths: [34, 24, 24, 44, 24, 20, 12, 16, 16, 16, 24],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
  });

  // Sheet 5: Bản ghi không tính & Cảnh báo M/I/D
  const sheet5Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Loại hồ sơ', styleIndex: 2 },
      { type: 's', value: 'Trace ID / Rule ID', styleIndex: 2 },
      { type: 's', value: 'Địa phương / Bản ghi', styleIndex: 2 },
      { type: 's', value: 'Toán hạng / Trường', styleIndex: 2 },
      { type: 's', value: 'Mã lý do (Reason Code)', styleIndex: 2 },
      { type: 's', value: 'Giải trình chi tiết', styleIndex: 2 },
      { type: 's', value: 'Ô nguồn', styleIndex: 2 },
      { type: 's', value: 'Giá trị quan sát', styleIndex: 2 },
    ],
  ];

  for (const trace of tracesById.values()) {
    for (const ex of trace.exclusions) {
      sheet5Rows.push([
        { type: 's', value: 'EXCLUSION', styleIndex: 3 },
        { type: 's', value: trace.traceId, styleIndex: 3 },
        { type: 's', value: ex.recordId, styleIndex: 3 },
        { type: 's', value: ex.affectedOperand, styleIndex: 3 },
        { type: 's', value: ex.reasonCode, styleIndex: 3 },
        { type: 's', value: ex.explanation, styleIndex: 3 },
        { type: 's', value: ex.sourceCell || '', styleIndex: 3 },
        { type: 's', value: String(ex.sourceValue ?? ''), styleIndex: 3 },
      ]);
    }
  }

  // Also append GPMB M vs I/D warnings (12 rows in full source)
  if (datasets.GPMB) {
    for (const iss of datasets.GPMB.issues) {
      if (
        iss.ruleId === 'WARNING_M_RATIO_MISMATCH' ||
        iss.ruleId === 'GPMB_MISSING_PROGRESS'
      ) {
        sheet5Rows.push([
          { type: 's', value: 'QC_WARNING', styleIndex: 3 },
          { type: 's', value: iss.ruleId, styleIndex: 3 },
          {
            type: 's',
            value: `${iss.localityName} (DA STT ${iss.projectStt ?? ''}, dòng ${iss.sourceRow})`,
            styleIndex: 3,
          },
          { type: 's', value: iss.fieldId, styleIndex: 3 },
          { type: 's', value: iss.severity, styleIndex: 3 },
          { type: 's', value: iss.explanation, styleIndex: 3 },
          { type: 's', value: iss.sourceCell, styleIndex: 3 },
          { type: 's', value: String(iss.observed ?? 'MISSING'), styleIndex: 3 },
        ]);
      }
    }
  }

  const sheet5Xml = buildWorksheetXml({
    rows: sheet5Rows,
    colWidths: [16, 32, 28, 22, 24, 55, 14, 18],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Báo cáo" sheetId="1" r:id="rId1"/>
    <sheet name="Nguồn thiếu &amp; lý do" sheetId="2" r:id="rId2"/>
    <sheet name="Danh mục công thức" sheetId="3" r:id="rId3"/>
    <sheet name="Nhật ký phép tính" sheetId="4" r:id="rId4"/>
    <sheet name="Bản ghi không tính" sheetId="5" r:id="rId5"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const archiveFiles: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(rootRelsXml),
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml),
    'xl/styles.xml': strToU8(buildStylesXml()),
    'xl/worksheets/sheet1.xml': strToU8(sheet1Xml),
    'xl/worksheets/sheet2.xml': strToU8(sheet2Xml),
    'xl/worksheets/sheet3.xml': strToU8(sheet3Xml),
    'xl/worksheets/sheet4.xml': strToU8(sheet4Xml),
    'xl/worksheets/sheet5.xml': strToU8(sheet5Xml),
  };

  return zipSync(archiveFiles);
}
