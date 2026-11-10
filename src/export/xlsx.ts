import { zipSync, strToU8 } from 'fflate';
import { EvaluatedSessionReport } from '../core/calculationTrace';
import { analyzeSourceCoverage, filterCoverageForSession } from '../core/coverage';
import { DEFAULT_INDICATORS } from '../core/indicators';
import { Dataset, Locality, ReportSession } from '../core/types';
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
  if (s.trim() === '-') {
    return s;
  }
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

function colLetterToIndex0Based(letters: string): number {
  let result = 0;
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64);
  }
  return result - 1;
}

interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  sizePt?: number;
  colorHex?: string;
}

interface XlsxCellInput {
  type: 'n' | 's';
  value: number | string;
  styleIndex: number;
  richRuns?: RichTextRun[];
}

interface XlsxRowOptions {
  minHeightPt?: number;
  fontSizePt?: number;
  lineHeightPt?: number;
  padPt?: number;
}

// Named cellXfs indices emitted by buildStylesXml (preserving S4 money & S5 percent compatibility)
const ST = {
  NORMAL: 0,
  TITLE: 1,
  HEADER_CENTER: 2,
  TEXT_LEFT_MID: 3,
  PRIMARY_MONEY_NUM: 4,
  PRIMARY_PERCENT_NUM: 5,
  INT_CENTER: 6,
  PRIMARY_TEXT_CENTER: 7,
  ROW8_STT_BOLD_TOP: 8,
  ROW8_LABEL_BOLD_TOP: 9,
  PROJ_ITALIC_LEFT_TOP: 10,
  ROW8_VALUE_BOLD_TOP: 11,
  HEADER_LEFT: 12,
  PRIMARY_STT_BOLD_MID: 13,
  PRIMARY_LABEL_BOLD_MID: 14,
  SUB_STT_ITALIC_MID: 15,
  SUB_LABEL_ITALIC_MID: 16,
  SUB_MONEY_ITALIC: 17,
  SUB_PERCENT_ITALIC: 18,
  SUB_TEXT_ITALIC_CENTER: 19,
  SUB_TOP_ITALIC_LEFT: 20,
  SUB_TOP_ITALIC_CENTER: 21,
  ROW9_STT_BOLD_TOP: 22,
  ROW9_LABEL_BOLD_TOP: 23,
  ROW9_PROJ_LEFT_TOP: 24,
  ROW9_EMPTY_CENTER_TOP: 25,
  APPENDIX_SECTION_TITLE: 26,
  FOOTNOTE_LABEL: 27,
  FOOTNOTE_TEXT: 28,
  PRIMARY_AREA_NUM: 29,
  SUB_AREA_ITALIC_NUM: 30,
  APPENDIX_LABEL_BOLD: 31,
  APPENDIX_TEXT_CENTER: 32,
  HEADER_SUBTABLE: 33,
} as const;

function sanitizeFontName(fontFamily?: string): string {
  const clean = String(fontFamily || 'Times New Roman')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim();
  return clean || 'Times New Roman';
}

function buildInlineRichRunsXml(runs: RichTextRun[], defaultFont: string): string {
  // Apply formula-injection guard across full concatenated text
  const fullRaw = runs.map((r) => r.text).join('');
  const needsPrefix = /^[=+\-@]/.test(fullRaw);
  return runs
    .map((run, idx) => {
      const text = idx === 0 && needsPrefix ? `'${run.text}` : run.text;
      // Strict ECMA-376 CT_RPrElt child order: rFont?, b?, i?, color?, sz?
      const rPrParts: string[] = [`<rFont val="${escapeXml(defaultFont)}"/>`];
      if (run.bold) rPrParts.push('<b/>');
      if (run.italic) rPrParts.push('<i/>');
      if (run.colorHex) rPrParts.push(`<color rgb="${run.colorHex}"/>`);
      if (run.sizePt) rPrParts.push(`<sz val="${run.sizePt}"/>`);
      return `<r><rPr>${rPrParts.join('')}</rPr><t xml:space="preserve">${escapeXml(
        text
      )}</t></r>`;
    })
    .join('');
}

function estimateWrappedLines(
  text: string,
  colWidthChars: number,
  fontSizePt: number,
  isBold = false
): number {
  const raw = String(text ?? '');
  if (!raw.trim()) return 1;
  // Times New Roman fits slightly more proportional characters than standard Calibri digit width,
  // minus ~1.5 chars for cell padding and bold expansion.
  const boldFactor = isBold ? 0.94 : 1;
  const maxChars = Math.max(
    4,
    Math.floor((colWidthChars - 1) * (11.5 / fontSizePt) * boldFactor)
  );
  let totalLines = 0;
  for (const para of raw.split(/\r?\n/)) {
    const trimmed = para.trim();
    if (!trimmed) {
      totalLines += 1;
      continue;
    }
    let currentLen = 0;
    let paraLines = 1;
    for (const word of trimmed.split(/\s+/)) {
      if (currentLen === 0) {
        if (word.length > maxChars) {
          paraLines += Math.ceil(word.length / maxChars) - 1;
          currentLen = word.length % maxChars || maxChars;
        } else {
          currentLen = word.length;
        }
      } else if (currentLen + 1 + word.length <= maxChars) {
        currentLen += 1 + word.length;
      } else {
        paraLines += 1;
        if (word.length > maxChars) {
          paraLines += Math.ceil(word.length / maxChars) - 1;
          currentLen = word.length % maxChars || maxChars;
        } else {
          currentLen = word.length;
        }
      }
    }
    totalLines += paraLines;
  }
  return Math.max(1, totalLines);
}

function parseMergeWidthMap(
  mergeRanges: string[],
  colWidths: number[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ref of mergeRanges) {
    const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) continue;
    const c1 = colLetterToIndex0Based(m[1]);
    const r1 = parseInt(m[2], 10);
    const c2 = colLetterToIndex0Based(m[3]);
    let widthSum = 0;
    for (let c = c1; c <= c2; c++) {
      widthSum += colWidths[c] ?? 18;
    }
    map.set(`${r1}:${c1}`, widthSum);
  }
  return map;
}

function buildWorksheetXml(params: {
  rows: Array<Array<XlsxCellInput | null>>;
  rowOptions?: Array<XlsxRowOptions | undefined>;
  colWidths: number[];
  mergeRanges?: string[];
  paperSize: 'A4' | 'A3';
  orientation: 'landscape' | 'portrait';
  fontFamily: string;
  defaultTableFontPt: number;
  fitToWidth?: boolean;
  freezeTopRow?: boolean;
}): string {
  const {
    rows,
    rowOptions = [],
    colWidths,
    mergeRanges = [],
    paperSize,
    orientation,
    fontFamily,
    defaultTableFontPt,
    fitToWidth = false,
    freezeTopRow = false,
  } = params;

  const mergedWidthMap = parseMergeWidthMap(mergeRanges, colWidths);

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
    const opt = rowOptions[rIdx];
    const cellFontPt = opt?.fontSizePt ?? defaultTableFontPt;
    const lineHeightPt = opt?.lineHeightPt ?? cellFontPt * 1.32;
    const padPt = opt?.padPt ?? 6;
    let maxLines = 1;

    const cellParts: string[] = [];

    for (let cIdx = 0; cIdx < rowCells.length; cIdx++) {
      const cell = rowCells[cIdx];
      if (!cell) continue;
      const addr = `${colIndexToLetter(cIdx + 1)}${rowNum}`;
      const colWidth =
        mergedWidthMap.get(`${rowNum}:${cIdx}`) ?? colWidths[cIdx] ?? 18;

      if (
        cell.type === 'n' &&
        typeof cell.value === 'number' &&
        Number.isFinite(cell.value)
      ) {
        cellParts.push(
          `<c r="${addr}" s="${cell.styleIndex}"><v>${cell.value}</v></c>`
        );
      } else {
        const plainVal = String(cell.value ?? '');
        const isBoldCell =
          cell.styleIndex === ST.TITLE ||
          cell.styleIndex === ST.HEADER_CENTER ||
          cell.styleIndex === ST.HEADER_LEFT ||
          cell.styleIndex === ST.PRIMARY_STT_BOLD_MID ||
          cell.styleIndex === ST.PRIMARY_LABEL_BOLD_MID ||
          cell.styleIndex === ST.ROW8_STT_BOLD_TOP ||
          cell.styleIndex === ST.ROW8_LABEL_BOLD_TOP ||
          cell.styleIndex === ST.ROW8_VALUE_BOLD_TOP ||
          cell.styleIndex === ST.ROW9_STT_BOLD_TOP ||
          cell.styleIndex === ST.ROW9_LABEL_BOLD_TOP;

        const lines = estimateWrappedLines(
          plainVal,
          colWidth,
          cellFontPt,
          isBoldCell
        );
        if (lines > maxLines) maxLines = lines;

        if (cell.richRuns && cell.richRuns.length > 0) {
          cellParts.push(
            `<c r="${addr}" t="inlineStr" s="${cell.styleIndex}"><is>${buildInlineRichRunsXml(
              cell.richRuns,
              fontFamily
            )}</is></c>`
          );
        } else {
          const safeText = escapeXml(sanitizeExcelText(plainVal));
          cellParts.push(
            `<c r="${addr}" t="inlineStr" s="${cell.styleIndex}"><is><t xml:space="preserve">${safeText}</t></is></c>`
          );
        }
      }
    }

    let computedHeight =
      rowCells.length === 0
        ? opt?.minHeightPt ?? 10
        : Math.max(opt?.minHeightPt ?? 20, Math.ceil(maxLines * lineHeightPt + padPt));
    computedHeight = Math.min(409, computedHeight); // Excel max single row height is 409pt

    rowsXmlParts.push(
      `<row r="${rowNum}" ht="${computedHeight}" customHeight="1">${cellParts.join('')}</row>`
    );
  }

  const mergesXml =
    mergeRanges.length > 0
      ? `<mergeCells count="${mergeRanges.length}">${mergeRanges
          .map((ref) => `<mergeCell ref="${ref}"/>`)
          .join('')}</mergeCells>`
      : '';

  const sheetPrXml = fitToWidth
    ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    : '';

  const sheetViewsXml = freezeTopRow
    ? '<sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>';

  // Excel paperSize: 9 = A4, 8 = A3
  const paperCode = paperSize === 'A3' ? 8 : 9;
  const pageSetupAttrs = fitToWidth
    ? `paperSize="${paperCode}" orientation="${orientation}" fitToWidth="1" fitToHeight="0"`
    : `paperSize="${paperCode}" orientation="${orientation}"`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${sheetPrXml}
  ${sheetViewsXml}
  ${colsXml}
  <sheetData>${rowsXmlParts.join('')}</sheetData>
  ${mergesXml}
  <pageMargins left="0.3" right="0.3" top="0.35" bottom="0.35" header="0.2" footer="0.2"/>
  <pageSetup ${pageSetupAttrs}/>
</worksheet>`;
}

function buildDecimalPattern(decimals: number): string {
  const d = Math.max(0, Math.min(4, Math.round(decimals)));
  return d === 0 ? '#,##0' : `#,##0.${'0'.repeat(d)}`;
}

function buildPercentPattern(decimals: number): string {
  const d = Math.max(0, Math.min(4, Math.round(decimals)));
  return d === 0 ? '0%' : `0.${'0'.repeat(d)}%`;
}

function buildStylesXml(settings: ReportSession['settings']): string {
  const fontName = escapeXml(sanitizeFontName(settings.fontFamily));
  const titleFontPt = Math.max(
    12,
    Math.min(18, Math.round((settings.titleFontSizePx || 16) * 0.85))
  );
  const tableFontPt = 10;
  const projFontPt = Math.max(
    7.5,
    Math.min(13, settings.uncompletedProjectsFontSizePt || 8.5)
  );

  const moneyUnitText = settings.moneyUnit === 'million' ? 'triệu' : 'tỷ';
  const decMoney = settings.decimalsMoney ?? settings.decimals ?? 2;
  const decPct = settings.decimalsPercent ?? settings.decimals ?? 2;
  const decArea = settings.areaUnit === 'ha' ? 2 : settings.decimalsArea ?? 0;
  const areaUnitText = settings.areaUnit === 'ha' ? 'ha' : 'm2';

  const moneyFmt = `${buildDecimalPattern(decMoney)} &quot;${moneyUnitText}&quot;`;
  const pctFmt = buildPercentPattern(decPct);
  const areaFmt = `${buildDecimalPattern(decArea)} &quot;${areaUnitText}&quot;`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="${moneyFmt}"/>
    <numFmt numFmtId="165" formatCode="${areaFmt}"/>
    <numFmt numFmtId="166" formatCode="${pctFmt}"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="${tableFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><b/><sz val="${titleFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><b/><sz val="${tableFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><i/><sz val="${tableFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><i/><sz val="${projFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><sz val="${projFontPt}"/><color rgb="FF000000"/><name val="${fontName}"/><family val="1"/></font>
    <font><i/><sz val="9"/><color rgb="FF334155"/><name val="${fontName}"/><family val="1"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="medium"><color rgb="FF64748B"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="34">
    <!-- 0: NORMAL -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: TITLE -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: HEADER_CENTER -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 3: TEXT_LEFT_MID -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 4: PRIMARY_MONEY_NUM -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 5: PRIMARY_PERCENT_NUM (kept at index 5 for TEST compatibility) -->
    <xf numFmtId="${decPct === 2 ? 10 : 166}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 6: INT_CENTER -->
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 7: PRIMARY_TEXT_CENTER -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 8: ROW8_STT_BOLD_TOP (white bg, matching webapp) -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <!-- 9: ROW8_LABEL_BOLD_TOP (white bg, matching webapp) -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 10: PROJ_ITALIC_LEFT_TOP -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 11: ROW8_VALUE_BOLD_TOP -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <!-- 12: HEADER_LEFT -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 13: PRIMARY_STT_BOLD_MID -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 14: PRIMARY_LABEL_BOLD_MID -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 15: SUB_STT_ITALIC_MID -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 16: SUB_LABEL_ITALIC_MID -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 17: SUB_MONEY_ITALIC -->
    <xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 18: SUB_PERCENT_ITALIC -->
    <xf numFmtId="${decPct === 2 ? 10 : 166}" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 19: SUB_TEXT_ITALIC_CENTER -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 20: SUB_TOP_ITALIC_LEFT -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 21: SUB_TOP_ITALIC_CENTER -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <!-- 22: ROW9_STT_BOLD_TOP -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <!-- 23: ROW9_LABEL_BOLD_TOP -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 24: ROW9_PROJ_LEFT_TOP -->
    <xf numFmtId="0" fontId="5" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 25: ROW9_EMPTY_CENTER_TOP -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <!-- 26: APPENDIX_SECTION_TITLE -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 27: FOOTNOTE_LABEL -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 28: FOOTNOTE_TEXT -->
    <xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <!-- 29: PRIMARY_AREA_NUM -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 30: SUB_AREA_ITALIC_NUM -->
    <xf numFmtId="165" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 31: APPENDIX_LABEL_BOLD -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 32: APPENDIX_TEXT_CENTER -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 33: HEADER_SUBTABLE -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function buildIndicatorRichRuns(
  label: string,
  hasStt: boolean,
  tableFontPt: number
): RichTextRun[] | undefined {
  // Highlight "(đến ngày ...)" in bold (keeping italic on sub-rows) just like Studio
  const re = /(\(?đến ngày[^)]*\)?)/gi;
  if (!re.test(label)) return undefined;
  re.lastIndex = 0;
  const runs: RichTextRun[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(label)) !== null) {
    if (m.index > lastIdx) {
      runs.push({
        text: label.slice(lastIdx, m.index),
        bold: hasStt,
        italic: !hasStt,
        sizePt: tableFontPt,
        colorHex: 'FF000000',
      });
    }
    runs.push({
      text: m[0],
      bold: true,
      italic: !hasStt,
      sizePt: tableFontPt,
      colorHex: 'FF000000',
    });
    lastIdx = re.lastIndex;
  }
  if (lastIdx < label.length) {
    runs.push({
      text: label.slice(lastIdx),
      bold: hasStt,
      italic: !hasStt,
      sizePt: tableFontPt,
      colorHex: 'FF000000',
    });
  }
  return runs.length > 0 ? runs : undefined;
}

function buildCellValueRichRuns(
  formattedVal: string,
  italic: boolean,
  tableFontPt: number
): RichTextRun[] | undefined {
  const m = formattedVal.match(/^([\s\S]+?)\s*(\([^)]+\))$/);
  if (!m) return undefined;
  const mainVal = m[1].trim();
  const subNote = m[2].trim();
  const noteSizePt = Math.max(7.5, tableFontPt - 1.5);
  return [
    {
      text: `${mainVal} `,
      italic,
      sizePt: tableFontPt,
      colorHex: 'FF000000',
    },
    {
      text: subNote,
      italic,
      sizePt: noteSizePt,
      colorHex: 'FF334155',
    },
  ];
}

function buildUncompletedProjectRichRuns(
  listText: string,
  projFontPt: number
): RichTextRun[] | undefined {
  if (!listText || listText === '-' || listText === 'Không có nhiệm vụ GPMB') {
    return undefined;
  }
  const lines = listText.split('\n');
  const runs: RichTextRun[] = [];
  lines.forEach((line, lineIdx) => {
    const suffixNewline = lineIdx < lines.length - 1 ? '\n' : '';
    const m = line.match(
      /^(\d+\.\s+)?([\s\S]+?)(\s-\s)(\d+[,.]\d+%)(\s-\s[\s\S]+)$/
    );
    if (m) {
      if (m[1]) {
        runs.push({
          text: m[1],
          bold: true,
          italic: true,
          sizePt: projFontPt,
          colorHex: 'FF000000',
        });
      }
      runs.push({
        text: `${m[2]}${m[3]}`,
        italic: true,
        sizePt: projFontPt,
        colorHex: 'FF000000',
      });
      runs.push({
        text: m[4],
        bold: true,
        italic: true,
        sizePt: projFontPt,
        colorHex: 'FF000000',
      });
      runs.push({
        text: `${m[5]}${suffixNewline}`,
        italic: true,
        sizePt: projFontPt,
        colorHex: 'FF000000',
      });
    } else {
      runs.push({
        text: `${line}${suffixNewline}`,
        italic: true,
        sizePt: projFontPt,
        colorHex: 'FF000000',
      });
    }
  });
  return runs.length > 0 ? runs : undefined;
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

  const fontFamily = sanitizeFontName(session.settings.fontFamily);
  const titleFontPt = Math.max(
    12,
    Math.min(18, Math.round((session.settings.titleFontSizePx || 16) * 0.85))
  );
  const tableFontPt = 10;
  const projFontPt = Math.max(
    7.5,
    Math.min(13, session.settings.uncompletedProjectsFontSizePt || 8.5)
  );

  // Sheet 1: Báo cáo
  const totalCols = Math.max(3, 2 + selectedLocalities.length);
  const lastColLetter = colIndexToLetter(totalCols);
  const sheet1Rows: Array<Array<XlsxCellInput | null>> = [];
  const sheet1RowOpts: Array<XlsxRowOptions | undefined> = [];
  const sheet1Merges: string[] = [`A1:${lastColLetter}1`];

  // Row 1: Title & optional italic subtitle (kept in Row 1 via rich-text runs so data starts at C3!)
  const hasSubtitle = Boolean(
    session.settings.showSubtitle && session.settings.subtitle
  );
  const titleText = hasSubtitle
    ? `${session.settings.reportTitle}\n${session.settings.subtitle}`
    : session.settings.reportTitle;

  const titleRichRuns: RichTextRun[] = [
    {
      text: session.settings.reportTitle,
      bold: true,
      italic: false,
      sizePt: titleFontPt,
      colorHex: 'FF000000',
    },
  ];
  if (hasSubtitle && session.settings.subtitle) {
    titleRichRuns.push({
      text: `\n${session.settings.subtitle}`,
      bold: false,
      italic: true,
      sizePt: Math.max(9, Math.round((titleFontPt - 3.5) * 2) / 2),
      colorHex: 'FF000000',
    });
  }

  const titleRow: Array<XlsxCellInput | null> = new Array(totalCols).fill(null);
  titleRow[0] = {
    type: 's',
    value: titleText,
    styleIndex: ST.TITLE,
    richRuns: titleRichRuns,
  };
  sheet1Rows.push(titleRow);
  sheet1RowOpts.push({
    minHeightPt: hasSubtitle ? 44 : 28,
    fontSizePt: titleFontPt,
    lineHeightPt: hasSubtitle ? 16 : titleFontPt * 1.35,
    padPt: 10,
  });

  // Row 2: Header matching Studio ("STT", "Chỉ tiêu / Kết quả thực hiện", Locality names)
  const headerRow: Array<XlsxCellInput | null> = [
    { type: 's', value: 'STT', styleIndex: ST.HEADER_CENTER },
    {
      type: 's',
      value: 'Chỉ tiêu / Kết quả thực hiện',
      styleIndex: ST.HEADER_LEFT,
    },
    ...selectedLocalities.map((loc) => ({
      type: 's' as const,
      value: loc.displayName,
      styleIndex: ST.HEADER_CENTER,
    })),
  ];
  sheet1Rows.push(headerRow);
  sheet1RowOpts.push({ minHeightPt: 26, fontSizePt: tableFontPt, padPt: 8 });

  // Data rows (including STT primary vs italic sub-rows)
  const displayRows = rows.filter(
    (r) =>
      r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT' &&
      r.rowConfig.visible !== false
  );

  for (const r of displayRows) {
    const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
    const sttStyle = hasStt ? ST.PRIMARY_STT_BOLD_MID : ST.SUB_STT_ITALIC_MID;
    const labelStyle = hasStt
      ? ST.PRIMARY_LABEL_BOLD_MID
      : ST.SUB_LABEL_ITALIC_MID;

    const rowCells: Array<XlsxCellInput | null> = [
      { type: 's', value: r.rowConfig.sttLabel || '', styleIndex: sttStyle },
      {
        type: 's',
        value: r.rowConfig.customLabel,
        styleIndex: labelStyle,
        richRuns: buildIndicatorRichRuns(
          r.rowConfig.customLabel,
          hasStt,
          tableFontPt
        ),
      },
    ];

    for (const loc of selectedLocalities) {
      const cellEval = r.cellsByLocalityId[loc.id];
      if (!cellEval) {
        rowCells.push({
          type: 's',
          value: 'Chưa có số liệu',
          styleIndex: hasStt ? ST.PRIMARY_TEXT_CENTER : ST.SUB_TEXT_ITALIC_CENTER,
        });
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
          styleIndex: hasStt ? ST.PRIMARY_TEXT_CENTER : ST.SUB_TEXT_ITALIC_CENTER,
          richRuns: buildCellValueRichRuns(formattedVal, !hasStt, tableFontPt),
        });
      } else if (
        cellEval.numericValueForExcel !== null &&
        Number.isFinite(cellEval.numericValueForExcel)
      ) {
        let styleIdx: number;
        if (cellEval.excelFormatType === 'PERCENT_RATIO') {
          styleIdx = hasStt ? ST.PRIMARY_PERCENT_NUM : ST.SUB_PERCENT_ITALIC;
        } else if (cellEval.excelFormatType === 'AREA') {
          styleIdx = hasStt ? ST.PRIMARY_AREA_NUM : ST.SUB_AREA_ITALIC_NUM;
        } else {
          styleIdx = hasStt ? ST.PRIMARY_MONEY_NUM : ST.SUB_MONEY_ITALIC;
        }
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
        const textVal = formattedVal || cellEval.displayedText;
        rowCells.push({
          type: 's',
          value: textVal,
          styleIndex: hasStt ? ST.PRIMARY_TEXT_CENTER : ST.SUB_TEXT_ITALIC_CENTER,
          richRuns: buildCellValueRichRuns(textVal, !hasStt, tableFontPt),
        });
      }
    }

    sheet1Rows.push(rowCells);
    sheet1RowOpts.push({ minHeightPt: 21, fontSizePt: tableFontPt, padPt: 6 });
  }

  if (session.settings.showUncompletedSummaryRow !== false && datasets.GPMB) {
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities,
    });

    // Dòng STT 8: Số dự án chưa hoàn thành GPMB (bold, top-aligned, white fill)
    const row8Cells: Array<XlsxCellInput | null> = [
      { type: 's', value: '8', styleIndex: ST.ROW8_STT_BOLD_TOP },
      {
        type: 's',
        value:
          session.settings.uncompletedRowCustomLabel ||
          'Số dự án chưa hoàn thành GPMB',
        styleIndex: ST.ROW8_LABEL_BOLD_TOP,
      },
    ];
    for (const loc of selectedLocalities) {
      const summaryText =
        uncompletedRes.summaryTextByLocalityId[loc.id] || 'Đã hoàn thành';
      row8Cells.push({
        type: 's',
        value: summaryText,
        styleIndex: ST.ROW8_VALUE_BOLD_TOP,
      });
    }
    sheet1Rows.push(row8Cells);
    sheet1RowOpts.push({ minHeightPt: 22, fontSizePt: tableFontPt, padPt: 7 });

    // Dòng con (không STT): Tên dự án chưa hoàn thành GPMB (italic, top-aligned)
    const subRowCells: Array<XlsxCellInput | null> = [
      { type: 's', value: '', styleIndex: ST.SUB_TOP_ITALIC_LEFT },
      {
        type: 's',
        value:
          session.settings.uncompletedProjectsListCustomLabel ||
          'Tên dự án chưa hoàn thành GPMB',
        styleIndex: ST.SUB_TOP_ITALIC_LEFT,
      },
    ];
    for (const loc of selectedLocalities) {
      const listText =
        uncompletedRes.projectListTextByLocalityId[loc.id] || '-';
      const isPlaceholder =
        listText === '-' || listText === 'Không có nhiệm vụ GPMB';
      subRowCells.push({
        type: 's',
        value: listText,
        styleIndex: isPlaceholder
          ? ST.SUB_TOP_ITALIC_CENTER
          : ST.PROJ_ITALIC_LEFT_TOP,
        richRuns: isPlaceholder
          ? undefined
          : buildUncompletedProjectRichRuns(listText, projFontPt),
      });
    }
    sheet1Rows.push(subRowCells);
    sheet1RowOpts.push({
      minHeightPt: 24,
      fontSizePt: projFontPt,
      lineHeightPt: projFontPt * 1.32,
      padPt: 8,
    });
  }

  if (session.settings.showNq11Row !== false) {
    const nq11Res = getNq11ProjectsForSession({
      session,
      selectedLocalities,
    });
    const row9Cells: Array<XlsxCellInput | null> = [
      { type: 's', value: '9', styleIndex: ST.ROW9_STT_BOLD_TOP },
      {
        type: 's',
        value:
          session.settings.nq11RowCustomLabel ||
          'Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc',
        styleIndex: ST.ROW9_LABEL_BOLD_TOP,
      },
    ];
    for (const loc of selectedLocalities) {
      const listText = nq11Res.textByLocalityId[loc.id] || '-';
      row9Cells.push({
        type: 's',
        value: listText,
        styleIndex:
          listText === '-' ? ST.ROW9_EMPTY_CENTER_TOP : ST.ROW9_PROJ_LEFT_TOP,
      });
    }
    sheet1Rows.push(row9Cells);
    sheet1RowOpts.push({
      minHeightPt: 24,
      fontSizePt: projFontPt,
      lineHeightPt: projFontPt * 1.32,
      padPt: 8,
    });
  }

  let hasAppendixProjectsTable = false;
  if (session.settings.showUncompletedProjectsTable !== false && datasets.GPMB) {
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities,
    });
    if (uncompletedRes.projects.length > 0) {
      hasAppendixProjectsTable = true;
      sheet1Rows.push([]);
      sheet1RowOpts.push({ minHeightPt: 12 });

      const appTitleRowNum = sheet1Rows.length + 1;
      const appLastCol = colIndexToLetter(Math.max(5, totalCols));
      sheet1Merges.push(`A${appTitleRowNum}:${appLastCol}${appTitleRowNum}`);
      sheet1Rows.push([
        {
          type: 's',
          value: 'DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH',
          styleIndex: ST.APPENDIX_SECTION_TITLE,
        },
      ]);
      sheet1RowOpts.push({ minHeightPt: 24, fontSizePt: tableFontPt, padPt: 6 });

      sheet1Rows.push([
        { type: 's', value: 'STT', styleIndex: ST.HEADER_SUBTABLE },
        { type: 's', value: 'Địa phương', styleIndex: ST.HEADER_SUBTABLE },
        { type: 's', value: 'Tên dự án', styleIndex: ST.HEADER_LEFT },
        { type: 's', value: 'Tỷ lệ hoàn thành', styleIndex: ST.HEADER_SUBTABLE },
        { type: 's', value: 'Hạn hoàn thành', styleIndex: ST.HEADER_SUBTABLE },
      ]);
      sheet1RowOpts.push({ minHeightPt: 24, fontSizePt: tableFontPt, padPt: 6 });

      uncompletedRes.projects.forEach((p, idx) => {
        sheet1Rows.push([
          { type: 'n', value: idx + 1, styleIndex: ST.INT_CENTER },
          { type: 's', value: p.localityName, styleIndex: ST.APPENDIX_LABEL_BOLD },
          { type: 's', value: p.projectName, styleIndex: ST.TEXT_LEFT_MID },
          {
            type: 's',
            value: p.completionRate,
            styleIndex: ST.APPENDIX_LABEL_BOLD,
          },
          { type: 's', value: p.deadline, styleIndex: ST.APPENDIX_TEXT_CENTER },
        ]);
        sheet1RowOpts.push({ minHeightPt: 20, fontSizePt: tableFontPt, padPt: 6 });
      });
    }
  }

  // Footnote row on Sheet 1 (merged cleanly across full table width)
  sheet1Rows.push([]);
  sheet1RowOpts.push({ minHeightPt: 10 });
  const footnoteRowNum = sheet1Rows.length + 1;
  sheet1Merges.push(`A${footnoteRowNum}:${lastColLetter}${footnoteRowNum}`);
  const revDate = datasets.REV?.asOfDate
    ? formatVnDate(datasets.REV.asOfDate)
    : '19/10/2026';
  const disbDate = datasets.DISB?.asOfDate
    ? formatVnDate(datasets.DISB.asOfDate)
    : '15/10/2026';
  const gpmbDate = datasets.GPMB?.asOfDate
    ? formatVnDate(datasets.GPMB.asOfDate)
    : '26/10/2026';
  const gpmbUnits = datasets.GPMB?.unitCount || 108;
  const gpmbProjects = datasets.GPMB?.projectRowCount || 422;
  const footnoteBody = `Thu NSNN: kỳ 10T/2026 (ngày chốt: ${revDate}, phạm vi 113/114 địa phương, thiếu Đặc khu Bạch Long Vĩ); Giải ngân: ${disbDate} (114/114 địa phương); GPMB: ${gpmbDate} (${gpmbUnits}/114 địa bàn, ${gpmbProjects} dự án, chỉ tính theo diện tích SUM(I)/SUM(D)).`;
  sheet1Rows.push([
    {
      type: 's',
      value: `Ghi chú nguồn: ${footnoteBody}`,
      styleIndex: ST.FOOTNOTE_TEXT,
      richRuns: [
        {
          text: 'Ghi chú nguồn: ',
          bold: true,
          italic: false,
          sizePt: 9,
          colorHex: 'FF1E293B',
        },
        {
          text: footnoteBody,
          bold: false,
          italic: true,
          sizePt: 9,
          colorHex: 'FF334155',
        },
      ],
    },
  ]);
  sheet1RowOpts.push({ minHeightPt: 22, fontSizePt: 9, lineHeightPt: 12.5, padPt: 6 });

  // Column widths mirroring Webapp proportions (preserving col B = 46 at default 240px for PH1 test gate)
  const sttColWidth = 6;
  const indColWidth = session.settings.indicatorColumnWidthPx
    ? Math.max(24, Math.round((session.settings.indicatorColumnWidthPx / 240) * 46))
    : 46;

  const isCustomLocWidth =
    Boolean(session.settings.columnWidthPx) &&
    session.settings.columnWidthPx !== 130;
  let locColWidth: number;
  if (isCustomLocWidth) {
    locColWidth = Math.max(
      14,
      Math.round((session.settings.columnWidthPx / 240) * 46)
    );
  } else {
    const pageBudget =
      session.settings.orientation === 'portrait'
        ? 125
        : session.settings.paperSize === 'A3'
        ? 275
        : 190;
    const maxPerPage = session.settings.paperSize === 'A3' ? 12 : 7;
    const colsOnPage = Math.max(1, Math.min(selectedLocalities.length, maxPerPage));
    const availablePerCol = Math.floor(
      (pageBudget - sttColWidth - indColWidth) / colsOnPage
    );
    locColWidth = Math.max(20, Math.min(32, availablePerCol));
  }

  const sheet1ColWidths: number[] = [
    sttColWidth,
    indColWidth,
    ...selectedLocalities.map(() => locColWidth),
  ];
  if (hasAppendixProjectsTable) {
    while (sheet1ColWidths.length < 5) {
      sheet1ColWidths.push(24);
    }
  }

  const sheet1Xml = buildWorksheetXml({
    rows: sheet1Rows,
    rowOptions: sheet1RowOpts,
    colWidths: sheet1ColWidths,
    mergeRanges: sheet1Merges,
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
    fontFamily,
    defaultTableFontPt: tableFontPt,
    fitToWidth: true,
    freezeTopRow: false,
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
      { type: 's', value: 'Tên địa phương', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Nguồn', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Trường / Chỉ tiêu', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Trạng thái', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Bằng chứng (Sheet/Ô)', styleIndex: ST.HEADER_CENTER },
      {
        type: 's',
        value: 'Nguyên nhân / Diễn giải có căn cứ',
        styleIndex: ST.HEADER_CENTER,
      },
      { type: 's', value: 'Kỳ chốt', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Tác động phép tính', styleIndex: ST.HEADER_CENTER },
    ],
  ];

  for (const cov of relevantCoverage) {
    sheet2Rows.push([
      { type: 's', value: cov.localityName, styleIndex: ST.TEXT_LEFT_MID },
      {
        type: 's',
        value: cov.sourceType || cov.sourceDatasetId,
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
      {
        type: 's',
        value: cov.fieldId || 'Toàn bộ bản ghi địa phương',
        styleIndex: ST.TEXT_LEFT_MID,
      },
      { type: 's', value: cov.status, styleIndex: ST.PRIMARY_TEXT_CENTER },
      {
        type: 's',
        value: `${cov.sourceSheet || ''}${cov.sourceCell ? '!' + cov.sourceCell : ''}`,
        styleIndex: ST.TEXT_LEFT_MID,
      },
      { type: 's', value: cov.reason, styleIndex: ST.TEXT_LEFT_MID },
      {
        type: 's',
        value: cov.asOfDate || '',
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
      {
        type: 's',
        value: cov.impactOnComputation || '',
        styleIndex: ST.TEXT_LEFT_MID,
      },
    ]);
  }

  const sheet2Xml = buildWorksheetXml({
    rows: sheet2Rows,
    colWidths: [24, 12, 22, 22, 22, 50, 14, 38],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
    fontFamily,
    defaultTableFontPt: tableFontPt,
    freezeTopRow: true,
  });

  // Sheet 3: Danh mục công thức
  const sheet3Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Mã chỉ tiêu', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Tên chỉ tiêu', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Nguồn', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Công thức nghiệp vụ', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Đơn vị gốc', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Đơn vị hiển thị', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Phương pháp gộp', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Chính sách Mốc & Null/0', styleIndex: ST.HEADER_CENTER },
    ],
  ];

  for (const ind of Object.values(DEFAULT_INDICATORS)) {
    sheet3Rows.push([
      { type: 's', value: ind.id, styleIndex: ST.TEXT_LEFT_MID },
      { type: 's', value: ind.label, styleIndex: ST.TEXT_LEFT_MID },
      { type: 's', value: ind.sourceType, styleIndex: ST.PRIMARY_TEXT_CENTER },
      { type: 's', value: ind.fieldOrFormula, styleIndex: ST.TEXT_LEFT_MID },
      { type: 's', value: ind.originalUnit, styleIndex: ST.PRIMARY_TEXT_CENTER },
      { type: 's', value: ind.displayUnit, styleIndex: ST.PRIMARY_TEXT_CENTER },
      { type: 's', value: ind.aggregationPolicy, styleIndex: ST.TEXT_LEFT_MID },
      { type: 's', value: ind.benchmarkPolicy, styleIndex: ST.TEXT_LEFT_MID },
    ]);
  }

  const sheet3Xml = buildWorksheetXml({
    rows: sheet3Rows,
    colWidths: [26, 40, 12, 34, 14, 14, 26, 45],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
    fontFamily,
    defaultTableFontPt: tableFontPt,
    freezeTopRow: true,
  });

  // Sheet 4: Nhật ký phép tính (CalculationTrace Log)
  const sheet4Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Trace ID', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Mã chỉ tiêu', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Địa phương / Phạm vi', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Biểu thức công thức', styleIndex: ST.HEADER_CENTER },
      {
        type: 's',
        value: 'Giá trị chính xác (Decimal)',
        styleIndex: ST.HEADER_CENTER,
      },
      { type: 's', value: 'Giá trị hiển thị', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Đơn vị', styleIndex: ST.HEADER_CENTER },
      {
        type: 's',
        value: 'Số bản ghi tính (Included)',
        styleIndex: ST.HEADER_CENTER,
      },
      {
        type: 's',
        value: 'Số bản ghi loại (Excluded)',
        styleIndex: ST.HEADER_CENTER,
      },
      { type: 's', value: 'Ngày chốt', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Chất lượng (Quality)', styleIndex: ST.HEADER_CENTER },
    ],
  ];

  for (const trace of tracesById.values()) {
    sheet4Rows.push([
      { type: 's', value: trace.traceId, styleIndex: ST.TEXT_LEFT_MID },
      { type: 's', value: trace.indicatorId, styleIndex: ST.TEXT_LEFT_MID },
      {
        type: 's',
        value: trace.localityName || trace.scope.type,
        styleIndex: ST.TEXT_LEFT_MID,
      },
      {
        type: 's',
        value: trace.formula.readableExpression,
        styleIndex: ST.TEXT_LEFT_MID,
      },
      {
        type: 's',
        value: trace.result.exactDecimal ?? 'null',
        styleIndex: ST.TEXT_LEFT_MID,
      },
      {
        type: 's',
        value: trace.result.displayedText,
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
      {
        type: 's',
        value: trace.result.displayUnit,
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
      {
        type: 'n',
        value: trace.population.includedCount,
        styleIndex: ST.INT_CENTER,
      },
      {
        type: 'n',
        value: trace.population.excludedCount,
        styleIndex: ST.INT_CENTER,
      },
      {
        type: 's',
        value: trace.scope.asOfDates.join(', '),
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
      {
        type: 's',
        value: trace.quality.status,
        styleIndex: ST.PRIMARY_TEXT_CENTER,
      },
    ]);
  }

  const sheet4Xml = buildWorksheetXml({
    rows: sheet4Rows,
    colWidths: [34, 24, 24, 44, 24, 20, 12, 16, 16, 16, 24],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
    fontFamily,
    defaultTableFontPt: tableFontPt,
    freezeTopRow: true,
  });

  // Sheet 5: Bản ghi không tính & Cảnh báo M/I/D
  const sheet5Rows: Array<Array<XlsxCellInput | null>> = [
    [
      { type: 's', value: 'Loại hồ sơ', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Trace ID / Rule ID', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Địa phương / Bản ghi', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Toán hạng / Trường', styleIndex: ST.HEADER_CENTER },
      {
        type: 's',
        value: 'Mã lý do (Reason Code)',
        styleIndex: ST.HEADER_CENTER,
      },
      { type: 's', value: 'Giải trình chi tiết', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Ô nguồn', styleIndex: ST.HEADER_CENTER },
      { type: 's', value: 'Giá trị quan sát', styleIndex: ST.HEADER_CENTER },
    ],
  ];

  for (const trace of tracesById.values()) {
    for (const ex of trace.exclusions) {
      sheet5Rows.push([
        { type: 's', value: 'EXCLUSION', styleIndex: ST.PRIMARY_TEXT_CENTER },
        { type: 's', value: trace.traceId, styleIndex: ST.TEXT_LEFT_MID },
        { type: 's', value: ex.recordId, styleIndex: ST.TEXT_LEFT_MID },
        { type: 's', value: ex.affectedOperand, styleIndex: ST.TEXT_LEFT_MID },
        { type: 's', value: ex.reasonCode, styleIndex: ST.PRIMARY_TEXT_CENTER },
        { type: 's', value: ex.explanation, styleIndex: ST.TEXT_LEFT_MID },
        {
          type: 's',
          value: ex.sourceCell || '',
          styleIndex: ST.PRIMARY_TEXT_CENTER,
        },
        {
          type: 's',
          value: String(ex.sourceValue ?? ''),
          styleIndex: ST.PRIMARY_TEXT_CENTER,
        },
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
          { type: 's', value: 'QC_WARNING', styleIndex: ST.PRIMARY_TEXT_CENTER },
          { type: 's', value: iss.ruleId, styleIndex: ST.TEXT_LEFT_MID },
          {
            type: 's',
            value: `${iss.localityName} (DA STT ${iss.projectStt ?? ''}, dòng ${iss.sourceRow})`,
            styleIndex: ST.TEXT_LEFT_MID,
          },
          { type: 's', value: iss.fieldId, styleIndex: ST.TEXT_LEFT_MID },
          { type: 's', value: iss.severity, styleIndex: ST.PRIMARY_TEXT_CENTER },
          { type: 's', value: iss.explanation, styleIndex: ST.TEXT_LEFT_MID },
          {
            type: 's',
            value: iss.sourceCell,
            styleIndex: ST.PRIMARY_TEXT_CENTER,
          },
          {
            type: 's',
            value: String(iss.observed ?? 'MISSING'),
            styleIndex: ST.PRIMARY_TEXT_CENTER,
          },
        ]);
      }
    }
  }

  const sheet5Xml = buildWorksheetXml({
    rows: sheet5Rows,
    colWidths: [16, 32, 28, 22, 24, 55, 14, 18],
    paperSize: session.settings.paperSize,
    orientation: session.settings.orientation,
    fontFamily,
    defaultTableFontPt: tableFontPt,
    freezeTopRow: true,
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
    'xl/styles.xml': strToU8(buildStylesXml(session.settings)),
    'xl/worksheets/sheet1.xml': strToU8(sheet1Xml),
    'xl/worksheets/sheet2.xml': strToU8(sheet2Xml),
    'xl/worksheets/sheet3.xml': strToU8(sheet3Xml),
    'xl/worksheets/sheet4.xml': strToU8(sheet4Xml),
    'xl/worksheets/sheet5.xml': strToU8(sheet5Xml),
  };

  return zipSync(archiveFiles);
}
