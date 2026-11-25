import { unzipSync } from 'fflate';
import { Decimal, sha256Hex } from './decimal';
import { dateFromReportTitle, isValidSourceDate } from './latestSources';
import {
  AdjustedScenarioCandidate,
  CalculationTrace,
  Dataset,
  DisbSchemaFingerprint,
  getDisbSchemaProfile,
  IdentityCheckResult,
  Locality,
  MetricCellValue,
  QualityIssue,
  SourceCellRef,
  SourceRecord,
  ValueState,
} from './types';
import {
  canonicalizeLocalityName,
  createLocalityFromName,
  makeLocalityId,
} from './localities';

export interface RawSheetCell {
  address: string;
  row: number;
  col: string;
  cellType: 'n' | 's' | 'str' | 'e' | 'b' | 'empty';
  value: string | number | null;
  rawText: string | null;
  formula?: string;
}

export interface ParsedWorkbookSheet {
  index: number;
  name: string;
  state: 'visible' | 'hidden' | 'veryHidden';
  maxRow: number;
  cells: Map<string, RawSheetCell>;
}

export interface ParsedWorkbook {
  filename: string;
  sha256: string;
  sheets: ParsedWorkbookSheet[];
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseSharedStringsXml(xml: string): string[] {
  const result: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const inner = siMatch[1];
    const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    let combined = '';
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tMatch[1]);
    }
    result.push(combined);
  }
  return result;
}

function parseWorksheetXml(
  xml: string,
  sharedStrings: string[]
): { cells: Map<string, RawSheetCell>; maxRow: number } {
  const cells = new Map<string, RawSheetCell>();
  let maxRow = 0;

  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const inner = match[2] || '';

    const rMatch = attrs.match(/\br="([A-Z]+)(\d+)"/);
    if (!rMatch) continue;
    const col = rMatch[1];
    const row = parseInt(rMatch[2], 10);
    const address = `${col}${row}`;
    if (row > maxRow) maxRow = row;

    const tMatch = attrs.match(/\bt="([^"]+)"/);
    const tAttr = tMatch ? tMatch[1] : 'n';

    const fMatch = inner.match(/<f(?:\s+[^>]*)?>([\s\S]*?)<\/f>/);
    const formula = fMatch ? decodeXmlEntities(fMatch[1]) : undefined;

    const vMatch = inner.match(/<v(?:\s+[^>]*)?>([\s\S]*?)<\/v>/);
    const rawV = vMatch ? decodeXmlEntities(vMatch[1]) : null;

    if (tAttr === 'inlineStr') {
      const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      let strVal = '';
      while ((tMatch = tRegex.exec(inner)) !== null) {
        strVal += decodeXmlEntities(tMatch[1]);
      }
      cells.set(address, {
        address,
        row,
        col,
        cellType: 'str',
        value: strVal,
        rawText: strVal,
        formula,
      });
      continue;
    }

    if (rawV === null) {
      if (formula !== undefined) {
        cells.set(address, {
          address,
          row,
          col,
          cellType: 'empty',
          value: null,
          rawText: null,
          formula,
        });
      }
      continue;
    }

    if (tAttr === 'e' || rawV.startsWith('#')) {
      cells.set(address, {
        address,
        row,
        col,
        cellType: 'e',
        value: rawV,
        rawText: rawV,
        formula,
      });
    } else if (tAttr === 's') {
      const idx = parseInt(rawV, 10);
      const strVal = sharedStrings[idx] ?? '';
      cells.set(address, {
        address,
        row,
        col,
        cellType: 's',
        value: strVal,
        rawText: strVal,
        formula,
      });
    } else if (tAttr === 'str') {
      cells.set(address, {
        address,
        row,
        col,
        cellType: 'str',
        value: rawV,
        rawText: rawV,
        formula,
      });
    } else if (tAttr === 'b') {
      cells.set(address, {
        address,
        row,
        col,
        cellType: 'b',
        value: rawV === '1' ? 1 : 0,
        rawText: rawV,
        formula,
      });
    } else {
      const numVal = Number(rawV);
      if (Number.isFinite(numVal)) {
        cells.set(address, {
          address,
          row,
          col,
          cellType: 'n',
          value: numVal,
          rawText: numVal.toString(),
          formula,
        });
      } else {
        cells.set(address, {
          address,
          row,
          col,
          cellType: 'e',
          value: rawV,
          rawText: rawV,
          formula,
        });
      }
    }
  }

  return { cells, maxRow };
}

export function parseXlsxBytes(
  bytes: Uint8Array,
  filename: string
): ParsedWorkbook {
  const sha256 = sha256Hex(bytes);
  const unzipped = unzipSync(bytes);
  const decoder = new TextDecoder('utf-8');

  const workbookXmlBytes = unzipped['xl/workbook.xml'];
  if (!workbookXmlBytes) {
    throw new Error('Invalid XLSX archive: missing xl/workbook.xml');
  }
  const workbookXml = decoder.decode(workbookXmlBytes);

  const relsBytes = unzipped['xl/_rels/workbook.xml.rels'];
  const relsXml = relsBytes ? decoder.decode(relsBytes) : '';
  const relTargetById = new Map<string, string>();
  const relRegex = /<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*?\/?>/g;
  // Also handle reversed attribute order Target before Id
  const relTagRegex = /<Relationship\b([^>]*?)\/?>/g;
  let relTagMatch: RegExpExecArray | null;
  while ((relTagMatch = relTagRegex.exec(relsXml)) !== null) {
    const tagAttrs = relTagMatch[1];
    const idM = tagAttrs.match(/\bId="([^"]+)"/);
    const targetM = tagAttrs.match(/\bTarget="([^"]+)"/);
    if (idM && targetM) {
      let target = targetM[1];
      if (target.startsWith('/')) target = target.slice(1);
      else if (!target.startsWith('xl/')) target = `xl/${target}`;
      relTargetById.set(idM[1], target);
    }
  }
  void relRegex;

  const sharedStringsBytes = unzipped['xl/sharedStrings.xml'];
  const sharedStrings = sharedStringsBytes
    ? parseSharedStringsXml(decoder.decode(sharedStringsBytes))
    : [];

  const sheets: ParsedWorkbookSheet[] = [];
  const sheetTagRegex = /<sheet\b([^>]*?)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  let idx = 0;
  while ((sheetMatch = sheetTagRegex.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const nameM = attrs.match(/\bname="([^"]+)"/);
    const stateM = attrs.match(/\bstate="([^"]+)"/);
    const rIdM = attrs.match(/\br:id="([^"]+)"/);
    if (!nameM) continue;

    const name = decodeXmlEntities(nameM[1]);
    const stateRaw = stateM ? stateM[1] : 'visible';
    const state: 'visible' | 'hidden' | 'veryHidden' =
      stateRaw === 'hidden' || stateRaw === 'veryHidden' ? stateRaw : 'visible';

    const rId = rIdM ? rIdM[1] : '';
    const targetPath =
      relTargetById.get(rId) || `xl/worksheets/sheet${idx + 1}.xml`;
    const sheetBytes = unzipped[targetPath];
    const { cells, maxRow } = sheetBytes
      ? parseWorksheetXml(decoder.decode(sheetBytes), sharedStrings)
      : { cells: new Map<string, RawSheetCell>(), maxRow: 0 };

    sheets.push({
      index: idx,
      name,
      state,
      maxRow,
      cells,
    });
    idx++;
  }

  return {
    filename,
    sha256,
    sheets,
  };
}

export function colIndexToLetter(colIdx1Based: number): string {
  let n = colIdx1Based;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseCsvBytes(
  bytes: Uint8Array,
  filename: string
): ParsedWorkbook {
  const sha256 = sha256Hex(bytes);
  const decoder = new TextDecoder('utf-8');
  let text = decoder.decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Auto-detect delimiter
  let delimiter = ',';
  const firstLineEnd = text.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount) {
    delimiter = ';';
  }

  const records: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(currentVal);
        currentVal = '';
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        row.push(currentVal);
        records.push(row);
        row = [];
        currentVal = '';
      } else if (ch === '\n') {
        row.push(currentVal);
        records.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += ch;
      }
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    records.push(row);
  }

  const cells = new Map<string, RawSheetCell>();
  let maxRow = 0;

  for (let r = 0; r < records.length; r++) {
    const rowVals = records[r];
    if (rowVals.length === 1 && !rowVals[0].trim()) continue;
    maxRow = r + 1;
    for (let c = 0; c < rowVals.length; c++) {
      const valStr = rowVals[c].trim();
      const colLetter = colIndexToLetter(c + 1);
      const address = `${colLetter}${r + 1}`;
      if (!valStr) {
        cells.set(address, {
          address,
          row: r + 1,
          col: colLetter,
          cellType: 'empty',
          value: null,
          rawText: '',
        });
      } else {
        const isNum = /^[-+]?(\d+(\.\d+)?|\.\d+)$/.test(valStr);
        if (isNum) {
          const numVal = Number(valStr);
          cells.set(address, {
            address,
            row: r + 1,
            col: colLetter,
            cellType: 'n',
            value: numVal,
            rawText: valStr,
          });
        } else {
          cells.set(address, {
            address,
            row: r + 1,
            col: colLetter,
            cellType: 's',
            value: valStr,
            rawText: valStr,
          });
        }
      }
    }
  }

  const sheet: ParsedWorkbookSheet = {
    index: 0,
    name: 'Sheet1',
    state: 'visible',
    maxRow,
    cells,
  };

  return {
    filename,
    sha256,
    sheets: [sheet],
  };
}

export function parseWorkbookBytes(
  bytes: Uint8Array,
  filename: string
): ParsedWorkbook {
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip || filename.toLowerCase().endsWith('.csv')) {
    try {
      return parseCsvBytes(bytes, filename);
    } catch (csvErr) {
      if (isZip) {
        return parseXlsxBytes(bytes, filename);
      }
      throw csvErr;
    }
  }
  return parseXlsxBytes(bytes, filename);
}

export function getCellText(sheet: ParsedWorkbookSheet, addr: string): string {
  const c = sheet.cells.get(addr);
  if (!c || c.value === null || c.value === undefined) return '';
  return String(c.value);
}

export function getCellNumber(
  sheet: ParsedWorkbookSheet,
  addr: string
): number | null {
  const c = sheet.cells.get(addr);
  if (!c || c.cellType !== 'n' || typeof c.value !== 'number') return null;
  return c.value;
}

/** Normalize ONLY header labels, not locality identity. */
function headerKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}
function isLocalityName(value: string): boolean {
  return /^(xã|phường|đặc khu)\s+\S/iu.test(canonicalizeLocalityName(value));
}
function localityRows(sheet: ParsedWorkbookSheet): number[] {
  return [...sheet.cells.values()]
    .filter(c => c.col === 'B' && isLocalityName(String(c.value ?? '')))
    .map(c => c.row).sort((a,b) => a-b);
}
function explicitTitleDate(title: string): string | undefined {
  const match = title.match(/(?:đến(?:\s+hết)?\s+ngày|tính\s+đến\s+ngày)\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})/iu);
  if (!match) return undefined;
  const [,day,month,year] = match;
  const iso = year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0');
  const d = new Date(iso+'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===iso ? iso : undefined;
}
function isCompactTotalDisb(sheet: ParsedWorkbookSheet): boolean {
  if (!headerKey(getCellText(sheet,'A1')).includes('giai ngan')) return false;
  for (let r=2;r<=Math.min(12,sheet.maxRow-1);r++) {
    const h = (col:string,delta=0) => headerKey(getCellText(sheet,col+(r+delta)));
    if (h('C').includes('ke hoach von') && h('F').includes('ke hoach von') &&
        /dieu chinh/.test(h('F')) && h('I').includes('giai ngan') &&
        /ty le.*sau dieu chinh/.test(h('M')) && /ghi chu/.test(h('N')) &&
        ['C','F','I'].every(c=>h(c,1)==='tong so') &&
        /du an khoi tp/.test(h('D',1)) && /phan cap.*cap xa/.test(h('E',1))) return true;
  }
  return false;
}
interface RevenueHeaderMapping {
  colMap: Record<string,string>;
  row: number;
}
/** Header-based semantic mapping. Distinguish annual, period, actual and
 * ratio groups by their labels AND their positions relative to group anchors;
 * duplicate/ambiguous required headers are rejected, never guessed. */
export function resolveRevenueHeader(sheet: ParsedWorkbookSheet): RevenueHeaderMapping | null {
  const dataRows = localityRows(sheet);
  if (!dataRows.length) return null;
  for (let r=1;r<Math.min(dataRows[0],40);r++) {
    const headers = Array.from({length:100},(_,i)=>({col:colIndexToLetter(i+1), index:i+1, key:headerKey(getCellText(sheet,colIndexToLetter(i+1)+r))}));
    const pick = (pred:(x:typeof headers[number])=>boolean) => {
      const a=headers.filter(pred);return a.length===1?a[0]:undefined;
    };
    // The total actually realized must explicitly be a cumulative actual amount,
    // not a rate, budget, plan, or cumulative non-land subtotal.
    const actual = pick(x=>/^(luy ke (thuc hien|thu)|thuc hien luy ke)/.test(x.key) && !/tru|khong|ty le|%/.test(x.key));
    if (!actual) continue;
    const period = pick(x=>x.index<actual.index && /^(ke hoach thu|ke hoach tong thu)/.test(x.key) && !/tru|khong|tien.*dat/.test(x.key));
    if (!period) continue;
    const annual = pick(x=>x.index<period.index && /^tong thu nsnn/.test(x.key) && !/tru|khong/.test(x.key));
    const isLand = (key:string) => /^(thu )?tien su dung dat(?:\s|$)/.test(key) && !/tru|khong|ke hoach|thue|ty le/.test(key);
    const isNonland = (key:string) => /(?:tru|khong(?: gom| bao gom)?|loai tru)\s+(?:thu\s+)?tien (?:su dung )?dat/.test(key);
    const annualLand = pick(x=>x.index> (annual?.index??0) && x.index<period.index && isLand(x.key));
    const annualNonland = pick(x=>x.index>(annual?.index??0) && x.index<period.index && isNonland(x.key));
    const periodLand = pick(x=>x.index>period.index && x.index<actual.index && /tien su dung dat/.test(x.key) && !isNonland(x.key) && !/thue/.test(x.key));
    const periodNonland = pick(x=>x.index>period.index && x.index<actual.index && isNonland(x.key));
    const actualNonland = pick(x=>x.index>actual.index && /luy ke|thuc hien/.test(x.key) && isNonland(x.key));
    if (!annual || !annualLand || !annualNonland || !periodLand || !periodNonland || !actualNonland) continue;
    const actualLand = pick(x=>x.index>actual.index && x.index<actualNonland.index && isLand(x.key));
    if (!actualLand) continue;
    const result:Record<string,string> = {
      [annual.col]:'annual_total_budget', [annualLand.col]:'annual_land_budget', [annualNonland.col]:'annual_nonland_budget',
      [period.col]:'period_total_plan', [periodLand.col]:'period_land_plan', [periodNonland.col]:'period_nonland_plan',
      [actual.col]:'actual_total_revenue', [actualLand.col]:'actual_land_revenue', [actualNonland.col]:'actual_nonland_revenue',
    };
    const components:Record<string,RegExp> = {
      actual_nonstate_sector:/thu tu khu vuc kinh te ngoai quoc doanh/,
      tax_vat:/^thue gtgt$/, tax_excise:/^thue ttdb$/, tax_cit:/^thue tndn$/, tax_resource:/^thue tai nguyen$/,
    };
    for (const [field,rx] of Object.entries(components)) {
      const item=pick(x=>x.index>actual.index&&x.index<actualNonland.index&&rx.test(x.key));
      if (item) result[item.col]=field;
    }
    // Rate columns: only match the exact 3 header roles, twice in source order.
    // They are diagnostic values; calculation continues to use raw amounts.
    const tail=headers.filter(x=>x.index>actualNonland.index&&x.key);
    const rateTotal=tail.filter(x=>/^tong thu nsnn$/.test(x.key));
    const rateLand=tail.filter(x=>isLand(x.key));
    const rateNonland=tail.filter(x=>isNonland(x.key));
    if (rateTotal.length===2&&rateLand.length===2&&rateNonland.length===2&&
      rateTotal[0].index<rateLand[0].index&&rateLand[0].index<rateNonland[0].index&&
      rateNonland[0].index<rateTotal[1].index&&rateTotal[1].index<rateLand[1].index&&rateLand[1].index<rateNonland[1].index) {
      for (const [i,suffix] of ['y','p'].entries()) {
        result[rateTotal[i].col]='source_rate_total_'+suffix;
        result[rateLand[i].col]='source_rate_land_'+suffix;
        result[rateNonland[i].col]='source_rate_nonland_'+suffix;
      }
    }
    return {colMap:result,row:r};
  }
  return null;
}

export function detectSheetFingerprint(
  sheet: ParsedWorkbookSheet
):
  | DisbSchemaFingerprint
  | 'REV_V1'
  | 'GPMB_V1'
  | 'GPMB_FLAT'
  | 'RESULT_TEMPLATE_V1'
  | 'SCHEMA_MODIFIED_NEEDS_MAPPING'
  | 'UNKNOWN' {
  const a1 = getCellText(sheet, 'A1');
  const a3 = getCellText(sheet, 'A3');
  const b7 = getCellText(sheet, 'B7');
  const b10 = getCellText(sheet, 'B10');
  const b12 = getCellText(sheet, 'B12');
  const b13 = getCellText(sheet, 'B13');
  const b11 = getCellText(sheet, 'B11');

  // Check RESULT_TEMPLATE_V1
  if (
    a1.includes('TÌNH HÌNH THỰC HIỆN MỘT SỐ CHỈ TIÊU KINH TẾ - XÃ HỘI') &&
    sheet.maxRow <= 25
  ) {
    return 'RESULT_TEMPLATE_V1';
  }

  // Check GPMB_FLAT (flat table in CSV or XLSX)
  for (let r = 1; r <= Math.min(5, sheet.maxRow); r++) {
    const rowTexts: string[] = [];
    for (let c = 1; c <= 40; c++) {
      const col = colIndexToLetter(c);
      const txt = getCellText(sheet, `${col}${r}`).toLowerCase().trim();
      if (txt) rowTexts.push(txt);
    }
    const hasLocality = rowTexts.some((t) =>
      /phường\s*xã|xã\s*phường|địa\s*bàn|địa\s*phương|phường\/xã/.test(t)
    );
    const hasDeclaredArea = rowTexts.some((t) =>
      /tổng\s*dt\s*gpmb|tổng\s*diện\s*tích\s*phải\s*gpmb|dt\s*gpmb|diện\s*tích\s*phải\s*gpmb/.test(t)
    );
    const hasRecordedArea = rowTexts.some((t) =>
      /dt\s*đã\s*thu\s*hồi|diện\s*tích\s*đã\s*gpmb|dt\s*đã\s*gpmb|đã\s*thu\s*hồi/.test(t)
    );
    if (hasLocality && hasDeclaredArea && hasRecordedArea) {
      return 'GPMB_FLAT';
    }
  }

  if (isCompactTotalDisb(sheet)) return 'DISB_TOTAL_LOCALITY_V2';

  // Check commune-allocated disbursement layouts (DISB_PHAN_CAP_XA_V2: 15 cols A..O; DISB_PHAN_CAP_XA_V1: 12 cols A..L)
  const c3 = getCellText(sheet, 'C3').toLowerCase();
  const f3 = getCellText(sheet, 'F3').toLowerCase();
  const g3 = getCellText(sheet, 'G3').toLowerCase();
  const j3 = getCellText(sheet, 'J3').toLowerCase();
  const k3 = getCellText(sheet, 'K3').toLowerCase();
  const n3 = getCellText(sheet, 'N3').toLowerCase();
  const d5 = getCellText(sheet, 'D5').toLowerCase();
  const e5 = getCellText(sheet, 'E5').toLowerCase();
  const g5 = getCellText(sheet, 'G5').toLowerCase();
  const h5 = getCellText(sheet, 'H5').toLowerCase();

  const isPhanCapXaSheet =
    !b12.toLowerCase().includes('địa phương') &&
    (b7.toUpperCase().includes('TỔNG SỐ') || a1.toLowerCase().includes('giải ngân'));

  // 15-col layout MUST be checked before 12-col V1 because both share D5/E5 source headers
  const isPhanCapXaV2Header =
    isPhanCapXaSheet &&
    (f3.includes('sau điều chỉnh') ||
      (c3.includes('đầu năm') && f3.includes('kế hoạch vốn') && j3.includes('giải ngân')) ||
      (d5.includes('sử dụng đất') &&
        e5.includes('mục tiêu') &&
        (g5.includes('sử dụng đất') || h5.includes('mục tiêu') || j3.includes('giải ngân') || n3.includes('tỷ lệ'))));

  if (isPhanCapXaV2Header) {
    const b8 = getCellText(sheet, 'B8');
    const c8 = sheet.cells.get('C8');
    const f8 = sheet.cells.get('F8');
    const j8 = sheet.cells.get('J8');
    if (
      !b8 ||
      typeof sheet.cells.get('B8')?.value !== 'string' ||
      !c8 ||
      c8.cellType !== 'n' ||
      !f8 ||
      f8.cellType !== 'n' ||
      !j8 ||
      j8.cellType !== 'n'
    ) {
      return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    }
    return 'DISB_PHAN_CAP_XA_V2';
  }

  const isPhanCapXaV1Header =
    isPhanCapXaSheet &&
    !c3.includes('đầu năm') &&
    !f3.includes('sau điều chỉnh') &&
    ((c3.includes('kế hoạch vốn') && g3.includes('giải ngân') && k3.includes('tỷ lệ')) ||
      (d5.includes('sử dụng đất') &&
        e5.includes('mục tiêu') &&
        !g5.includes('sử dụng đất') &&
        !j3.includes('giải ngân')));

  if (isPhanCapXaV1Header) {
    const b8 = getCellText(sheet, 'B8');
    const c8 = sheet.cells.get('C8');
    const g8 = sheet.cells.get('G8');
    if (
      !b8 ||
      typeof sheet.cells.get('B8')?.value !== 'string' ||
      !c8 ||
      c8.cellType !== 'n' ||
      !g8 ||
      g8.cellType !== 'n'
    ) {
      return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    }
    return 'DISB_PHAN_CAP_XA_V1';
  }

  // Check DISB_V1
  if (
    a1.toLowerCase().includes('giải ngân') ||
    (b7.toUpperCase().includes('TỔNG SỐ') && b12.toLowerCase().includes('địa phương'))
  ) {
    // Never classify an unfamiliar 8-row layout as the legacy row-13 profile.
    if (isLocalityName(b12)) return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    // Verify column positions B (locality name), F (adjusted plan numeric), I (disbursed numeric)
    const f13 = sheet.cells.get('F13');
    const i13 = sheet.cells.get('I13');
    if (
      !b13 ||
      typeof sheet.cells.get('B13')?.value !== 'string' ||
      !f13 ||
      f13.cellType !== 'n' ||
      !i13 ||
      i13.cellType !== 'n'
    ) {
      return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    }
    return 'DISB_V1';
  }

  // Check header-based REV first; retain recognition of the hash-verified reference for compatibility.
  if (resolveRevenueHeader(sheet)) return 'REV_V1';
  // Check REV_V1
  if (
    a3.toUpperCase().includes('THU NSNN') ||
    a3.toUpperCase().includes('THU NGÂN SÁCH') ||
    (b10.toUpperCase().includes('TỔNG') && b11.length > 0 && !b12.toLowerCase().includes('địa phương'))
  ) {
    const c11 = sheet.cells.get('C11');
    const i11 = sheet.cells.get('I11');
    if (
      typeof sheet.cells.get('B11')?.value !== 'string' ||
      !c11 ||
      c11.cellType !== 'n' ||
      !i11 ||
      i11.cellType !== 'n'
    ) {
      return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    }
    return 'REV_V1';
  }

  // Check GPMB_V1
  if (
    a1.toUpperCase().includes('GIẢI PHÓNG MẶT BẰNG') ||
    getCellText(sheet, 'D2').toLowerCase().includes('diện tích')
  ) {
    const d4 = sheet.cells.get('D4');
    if (!d4 || d4.cellType !== 'n') {
      return 'SCHEMA_MODIFIED_NEEDS_MAPPING';
    }
    return 'GPMB_V1';
  }

  return 'UNKNOWN';
}

function buildMetricCell(
  sheet: ParsedWorkbookSheet,
  col: string,
  row: number,
  unit: string,
  wb: ParsedWorkbook,
  asOfDate: string,
  mappingVersion: string
): MetricCellValue {
  const address = `${col}${row}`;
  const rawCell = sheet.cells.get(address);

  const provenance = {
    filename: wb.filename,
    fileSha256: wb.sha256,
    sheet: sheet.name,
    sheetIndex: sheet.index,
    sheetVisibility: sheet.state,
    cell: address,
    formula: rawCell?.formula,
    cachedValue: rawCell?.value ?? null,
    asOfDate,
    mappingVersion,
  };

  if (!rawCell || rawCell.cellType === 'empty' || rawCell.value === null) {
    return {
      raw: null,
      normalizedValue: null,
      normalizedDecimal: null,
      unit,
      state: 'MISSING',
      cellType: 'empty',
      sourceRow: row,
      sourceColumn: col,
      extractionConfidence: 1.0,
      provenance,
    };
  }

  if (rawCell.cellType === 'e') {
    return {
      raw: rawCell.value,
      normalizedValue: null,
      normalizedDecimal: null,
      unit,
      state: 'FORMULA_ERROR',
      cellType: 'e',
      sourceRow: row,
      sourceColumn: col,
      extractionConfidence: 1.0,
      provenance,
    };
  }

  if (unit === 'date_or_text' || unit === 'text') {
    const strVal = rawCell.value !== null && rawCell.value !== undefined ? String(rawCell.value).trim() : '';
    if (!strVal) {
      return {
        raw: rawCell.value,
        normalizedValue: null,
        normalizedDecimal: null,
        unit,
        state: 'MISSING',
        cellType: rawCell.cellType,
        sourceRow: row,
        sourceColumn: col,
        extractionConfidence: 1.0,
        provenance,
      };
    }
    return {
      raw: rawCell.value,
      normalizedValue: strVal,
      normalizedDecimal: null,
      unit,
      state: 'VALUE',
      cellType: rawCell.cellType,
      sourceRow: row,
      sourceColumn: col,
      extractionConfidence: 1.0,
      provenance,
    };
  }

  if (rawCell.cellType === 'n' && typeof rawCell.value === 'number') {
    const decStr = new Decimal(rawCell.value.toString()).toString();
    const state: ValueState = new Decimal(decStr).isZero() ? 'ZERO' : 'VALUE';
    return {
      raw: rawCell.value,
      normalizedValue: decStr,
      normalizedDecimal: decStr,
      unit,
      state,
      cellType: 'n',
      sourceRow: row,
      sourceColumn: col,
      extractionConfidence: 1.0,
      provenance,
    };
  }

  // String cell in a numeric metric column
  const strVal = String(rawCell.value).trim();
  if (strVal === '') {
    return {
      raw: rawCell.value,
      normalizedValue: null,
      normalizedDecimal: null,
      unit,
      state: 'MISSING',
      cellType: rawCell.cellType,
      sourceRow: row,
      sourceColumn: col,
      extractionConfidence: 1.0,
      provenance,
    };
  }

  return {
    raw: rawCell.value,
    normalizedValue: null,
    normalizedDecimal: null,
    unit,
    state: 'INVALID',
    cellType: rawCell.cellType,
    sourceRow: row,
    sourceColumn: col,
    extractionConfidence: 0.5,
    provenance,
  };
}

function extractAdjustedScenariosFromNote(
  noteText: string,
  cellAddress: string
): AdjustedScenarioCandidate[] {
  const matches = noteText.match(/\d+(?:[,.]\d+)?\s*%/g);
  if (!matches || matches.length === 0) return [];
  return matches.map((token) => ({
    rawText: noteText,
    rateCandidate: token.replace(/\s+/g, ''),
    numerator: null,
    denominator: null,
    excludedItems: noteText.toLowerCase().includes('4004')
      ? ['Vốn bổ sung QĐ 4004 ngày 25/9/2026']
      : noteText.toLowerCase().includes('4581')
      ? ['Nguồn tăng thu bổ sung QĐ 4581/QĐ-UBND ngày 31/10/2026']
      : ['Khoản điều chỉnh theo ghi chú nguồn (chưa xác minh tử/mẫu)'],
    sourceCells: [cellAddress],
    reviewStatus: 'UNVERIFIED_NOTE',
  }));
}

export interface ImportOptions {
  confirmedAsOfDate?: string;
  asOfConfirmationReason?: string;
  manualSheetName?: string;
  manualSelectionReason?: string;
}

function isDisbFingerprint(fp: string): fp is DisbSchemaFingerprint {
  return fp === 'DISB_V1' || fp === 'DISB_TOTAL_LOCALITY_V2' || fp === 'DISB_PHAN_CAP_XA_V1' || fp === 'DISB_PHAN_CAP_XA_V2';
}

export function importDisbursementWorkbook(
  bytes: Uint8Array,
  filename: string,
  options: ImportOptions = {}
): { dataset: Dataset; localities: Locality[] } {
  const wb = parseWorkbookBytes(bytes, filename);
  const allSheetsMeta = wb.sheets.map((s) => ({
    index: s.index,
    name: s.name,
    state: s.state,
  }));

  let targetSheet: ParsedWorkbookSheet | undefined;
  let targetFp: DisbSchemaFingerprint = 'DISB_V1';
  let importSelectionMode: 'AUTO_VISIBLE_SINGLE' | 'MANUAL_CONFIRMED' =
    'AUTO_VISIBLE_SINGLE';

  if (options.manualSheetName) {
    targetSheet = wb.sheets.find((s) => s.name === options.manualSheetName);
    if (targetSheet) {
      const detected = detectSheetFingerprint(targetSheet);
      if (!isDisbFingerprint(detected)) throw new Error('BLOCKER_MAPPING_REQUIRED: Sheet giải ngân chọn tay không khớp cấu trúc đã xác minh.');
      targetFp = detected;
    }
    importSelectionMode = 'MANUAL_CONFIRMED';
  } else {
    const visibleCandidates = wb.sheets.filter(
      (s) => s.state === 'visible' && isDisbFingerprint(detectSheetFingerprint(s))
    );
    if (visibleCandidates.length === 1) {
      targetSheet = visibleCandidates[0];
      const detectedFp = detectSheetFingerprint(targetSheet);
      targetFp = isDisbFingerprint(detectedFp) ? detectedFp : 'DISB_V1';
    } else {
      const modified = wb.sheets.find(
        (s) =>
          s.state === 'visible' &&
          detectSheetFingerprint(s) === 'SCHEMA_MODIFIED_NEEDS_MAPPING'
      );
      if (modified) {
        throw new Error(
          'BLOCKER_MAPPING_REQUIRED: Cấu trúc cột file Giải ngân thay đổi, yêu cầu mở Mapping Wizard (PH2-01).'
        );
      }
      throw new Error(
        'BLOCKER_SHEET_SELECTION: Không tìm thấy sheet visible duy nhất khớp fingerprint DISB_V1, DISB_PHAN_CAP_XA_V1 hoặc DISB_PHAN_CAP_XA_V2.'
      );
    }
  }

  if (!targetSheet) {
    throw new Error('Sheet not found in DISB workbook.');
  }

  const profile = getDisbSchemaProfile(targetFp);
  const a1Text = getCellText(targetSheet, 'A1');
  const detectedDate = dateFromReportTitle(a1Text);
  const manualDate = options.confirmedAsOfDate?.trim();
  if (manualDate && !isValidSourceDate(manualDate)) throw new Error('Ngày chốt không hợp lệ.');
  const asOfDate = manualDate || detectedDate || '';
  const asOfStatus: Dataset['asOfStatus'] = manualDate ? 'MANUAL_CONFIRMED' : detectedDate ? 'DETECTED_CONFIRMED' : 'REQUIRES_USER_CONFIRMATION';
  const datasetId = `DISB_${wb.sha256.slice(0, 12)}`;
  const mappingVersion = profile.mappingVersion;

  const localities: Locality[] = [];
  const records: SourceRecord[] = [];
  const issues: QualityIssue[] = [];
  if (!asOfDate) issues.push({
    id: `${datasetId}_BLOCKER_AS_OF_DATE`, ruleId: 'MISSING_CONFIRMED_AS_OF_DATE',
    severity: 'BLOCKER', status: 'OPEN', datasetId, sourceType: 'DISB', rowId: 'HEADER_A1',
    sourceRow: 1, localityId: 'ALL', localityName: 'Toàn bộ nguồn', fieldId: 'asOfDate',
    sourceCell: 'A1', observed: null, explanation: 'Không xác định được ngày chốt từ tiêu đề báo cáo. Cần xác nhận ngày chốt thực tế; không dùng tên file hoặc ngày mặc định.',
  });
  const identityChecks: IdentityCheckResult[] = [];

  const parseDisbRow = (row: number, locId: string, locName: string): SourceRecord => {
    const metrics: Record<string, MetricCellValue> = {};
    for (const [col, fieldId] of Object.entries(profile.colMap)) {
      const unit = col === profile.rateCol ? 'ratio' : 'million_vnd';
      const mCell = buildMetricCell(
        targetSheet,
        col,
        row,
        unit,
        wb,
        asOfDate,
        mappingVersion
      );
      metrics[fieldId] = mCell;

      if (mCell.state === 'FORMULA_ERROR') {
        issues.push({
          id: `${datasetId}_ERR_${col}${row}`,
          ruleId: 'DISB_FORMULA_ERROR',
          severity: 'ERROR',
          status: 'OPEN',
          datasetId,
          sourceType: 'DISB',
          rowId: `DISB_ROW_${row}`,
          sourceRow: row,
          localityId: locId,
          localityName: locName,
          fieldId,
          sourceCell: `${col}${row}`,
          observed: mCell.raw,
          explanation: `Ô công thức nguồn ${col}${row} trả về lỗi ${mCell.raw}; giữ trạng thái FORMULA_ERROR, không chuyển thành 0.`,
        });
      }
    }

    const pVal = profile.markerCol
      ? getCellText(targetSheet, `${profile.markerCol}${row}`).trim()
      : '';
    const noteAddr = `${profile.noteCol}${row}`;
    const qRaw = targetSheet.cells.get(noteAddr)?.value;
    const qVal =
      qRaw !== null && qRaw !== undefined && String(qRaw).trim() !== ''
        ? String(qRaw)
        : null;

    const adjustedScenarios = qVal
      ? extractAdjustedScenariosFromNote(qVal, noteAddr)
      : undefined;

    return {
      id: `DISB_R${row}`,
      datasetId,
      localityId: locId,
      localityName: locName,
      sourceRow: row,
      inspectionMarker: pVal || null,
      officialNote: qVal,
      adjustedScenarios,
      metrics,
    };
  };

  const citySummaryRecord = profile.hasCitySummary
    ? parseDisbRow(7, 'CITY_TOTAL', 'TỔNG SỐ TOÀN THÀNH PHỐ')
    : undefined;
  const summaryRecord = profile.summaryRow > 0 ? parseDisbRow(
    profile.summaryRow,
    'LOCALITIES_BLOCK_114',
    profile.isPhanCapXa
      ? 'Khối 114 địa phương (vốn phân cấp cấp xã, dòng 7)'
      : 'Khối địa phương (dòng 12)'
  ) : undefined;
  const unplannedDisbursementRecord = profile.hasUnplannedRow
    ? parseDisbRow(145, 'UNPLANNED_ROW_145', 'Giải ngân ngoài kế hoạch (dòng 145)')
    : undefined;

  const eqDefs = profile.eqDefs;
  const rowStart = profile.rowStart;
  const rowEnd = profile.isPhanCapXa
    ? Math.max(profile.defaultRowEnd, targetSheet.maxRow)
    : profile.defaultRowEnd;
  const candidateRows = targetFp === 'DISB_TOTAL_LOCALITY_V2'
    ? localityRows(targetSheet)
    : Array.from({length:rowEnd-rowStart+1},(_,i)=>rowStart+i);
  const seenLocalities = new Set<string>();

  for (const row of candidateRows) {
    const rawName = getCellText(targetSheet, `B${row}`).trim();
    if (!rawName) continue;
    if (profile.isPhanCapXa) {
      const lowerName = rawName.toLowerCase();
      if (lowerName.startsWith('tổng') || lowerName.startsWith('ghi chú')) {
        continue;
      }
      const aCell = targetSheet.cells.get(`A${row}`);
      const planCell = targetSheet.cells.get(`${profile.planCol}${row}`);
      const disbCell = targetSheet.cells.get(`${profile.disbCol}${row}`);
      const looksLikeLocalityRow =
        aCell?.cellType === 'n' ||
        (planCell?.cellType === 'n' && disbCell?.cellType === 'n');
      if (!looksLikeLocalityRow) continue;
    }

    const loc = createLocalityFromName(rawName, `${wb.filename}!${targetSheet.name}!B${row}`);
    if (seenLocalities.has(loc.id)) throw new Error('BLOCKER_DUPLICATE_LOCALITY: '+loc.canonicalNameNFC+' tại dòng '+row);
    seenLocalities.add(loc.id);
    localities.push(loc);

    const rec = parseDisbRow(row, loc.id, loc.canonicalNameNFC);
    records.push(rec);

    for (const def of eqDefs) {
      const totalCell = rec.metrics[def.totalField];
      const compCells = def.compCols.map((c) => ({
        ...c,
        cell: rec.metrics[c.field],
      }));

      const missingFields = compCells
        .filter((c) => c.cell.state === 'MISSING')
        .map((c) => `${c.col}${row}`);
      const presentCells = compCells.filter(
        (c) => c.cell.state === 'VALUE' || c.cell.state === 'ZERO'
      );
      const hasInvalidOrError =
        (totalCell.state !== 'VALUE' && totalCell.state !== 'ZERO') ||
        compCells.some(
          (c) =>
            c.cell.state !== 'VALUE' &&
            c.cell.state !== 'ZERO' &&
            c.cell.state !== 'MISSING'
        );

      let status: IdentityCheckResult['status'] = 'FAIL';
      let sumDec: Decimal | null = null;
      if (!hasInvalidOrError && presentCells.length > 0 && totalCell.normalizedDecimal) {
        sumDec = presentCells.reduce(
          (acc, c) => acc.plus(new Decimal(c.cell.normalizedDecimal!)),
          new Decimal(0)
        );
        const totalDec = new Decimal(totalCell.normalizedDecimal);
        if (totalDec.minus(sumDec).abs().lte('0.00001')) {
          status =
            missingFields.length > 0
              ? 'PASS_WITH_MISSING_COMPONENTS'
              : 'PASS_COMPLETE';
        }
      }

      const makeRef = (mCell: MetricCellValue): SourceCellRef => ({
        datasetId,
        fileName: wb.filename,
        fileSha256: wb.sha256,
        sheetName: targetSheet.name,
        sheetIndex: targetSheet.index,
        sheetVisibility: targetSheet.state,
        address: mCell.provenance.cell,
        sourceFormula: mCell.provenance.formula,
        sourceFormulaVerification: mCell.provenance.formula ? 'VERIFIED' : 'NOT_APPLICABLE',
        cachedValue: mCell.provenance.cachedValue,
        asOfDate,
        mappingVersion,
      });

      const trace: CalculationTrace = {
        traceId: `TRACE_IDCHECK_${def.eq}_${loc.id}_R${row}`,
        indicatorId: `DISB_IDENTITY_${def.eq}`,
        localityId: loc.id,
        localityName: loc.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: sumDec ? sumDec.toString() : null,
          displayedText: status,
          canonicalUnit: 'million_vnd',
          displayUnit: 'million_vnd',
          state: status === 'FAIL' ? 'INVALID' : 'VALUE',
        },
        formula: {
          formulaId: `IDENTITY_${def.eq}`,
          formulaVersion: '2.2',
          readableExpression: `Kiểm tra cân đối ngang ${def.eq} tại dòng ${row} (${loc.canonicalNameNFC})`,
          expressionTree: { op: 'EQUALS', lhs: def.totalCol, rhs: def.compCols.map((c) => c.col) },
          method: 'DISB_IDENTITY_CHECK',
          roundingPolicy: 'EXACT_DECIMAL_TOLERANCE_1E_5',
          tolerancePolicy: '0.00001 million_vnd',
        },
        scope: {
          type: 'SINGLE_LOCALITY_IDENTITY',
          sourceDatasetIds: [datasetId],
          selectedLocalityIds: [loc.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [asOfDate],
        },
        operands: [
          {
            role: 'total',
            fieldId: def.totalField,
            exactValue: totalCell.normalizedDecimal,
            unit: 'million_vnd',
            state: totalCell.state,
            sources: [makeRef(totalCell)],
          },
          ...compCells.map((c) => ({
            role: 'component',
            fieldId: c.field,
            exactValue: c.cell.normalizedDecimal,
            unit: 'million_vnd',
            state: c.cell.state,
            sources: [makeRef(c.cell)],
          })),
        ],
        population: {
          eligibleCount: compCells.length,
          includedCount: presentCells.length,
          excludedCount: missingFields.length,
          missingCount: missingFields.length,
          includedRecordIds: presentCells.map((c) => `${c.col}${row}`),
          excludedRecordIds: missingFields,
        },
        coverageDetails: missingFields.map((cellAddr) => ({
          localityId: loc.id,
          localityName: loc.canonicalNameNFC,
          sourceDatasetId: datasetId,
          sourceType: 'DISB',
          fieldId: cellAddr,
          status: 'FIELD_MISSING',
          reason: `Ô thành phần ${cellAddr} trống trong nguồn; chỉ trung hòa phép cộng kiểm tra cân đối ${def.eq}, khi xem độc lập vẫn là MISSING.`,
          sourceSheet: targetSheet.name,
          sourceCell: cellAddr,
          asOfDate,
          impactOnComputation: 'Neutral in horizontal identity check only; remains MISSING for standalone indicator',
        })),
        exclusions: missingFields.map((cellAddr) => ({
          recordId: cellAddr,
          affectedOperand: def.eq,
          reasonCode: 'MISSING_INPUT',
          explanation: `Ô ${cellAddr} trống (MISSING); được trung hòa có kiểm soát chỉ trong kiểm tra cân đối ngang ${def.eq}.`,
          sourceCell: cellAddr,
          sourceValue: null,
        })),
        steps: [
          {
            operation: 'DISB_IDENTITY_CHECK',
            inputs: presentCells.map((c) => `${c.col}${row}=${c.cell.normalizedDecimal}`),
            output: sumDec ? sumDec.toString() : null,
            inputUnit: 'million_vnd',
            outputUnit: 'million_vnd',
            reason:
              missingFields.length > 0
                ? `Cộng các thành phần có số, bỏ qua có kiểm soát ${missingFields.join(', ')} (MISSING)`
                : 'Cộng đầy đủ tất cả thành phần',
          },
        ],
        quality: {
          status:
            status === 'PASS_WITH_MISSING_COMPONENTS'
              ? 'PASS_WITH_MISSING_COMPONENTS'
              : status === 'PASS_COMPLETE'
              ? 'COMPLETE'
              : 'INSUFFICIENT_COMPONENTS',
          warningIds: [],
        },
        sourceRefs: [makeRef(totalCell), ...compCells.map((c) => makeRef(c.cell))],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [wb.sha256],
      };

      identityChecks.push({
        equation: def.eq,
        row,
        localityId: loc.id,
        localityName: loc.canonicalNameNFC,
        status,
        totalExact: totalCell.normalizedDecimal,
        sumComponentsExact: sumDec ? sumDec.toString() : null,
        missingFields,
        trace,
      });
    }
  }

  const dataset: Dataset = {
    id: datasetId,
    sourceType: 'DISB',
    sourceFilename: filename,
    sourceHash: wb.sha256,
    workbookSha256: wb.sha256,
    sourceSheet: targetSheet.name,
    sheetIndex: targetSheet.index,
    sheetVisibility: targetSheet.state,
    schemaFingerprint: targetFp,
    importSelectionMode,
    manualSelectionReason: options.manualSelectionReason,
    mappingVersion,
    calculationPolicyVersion: 'V2.2_R06',
    unitCount: records.length,
    asOfDate,
    reportPeriodLabel: asOfDate ? `Đến hết ngày ${asOfDate.split('-').reverse().join('/')}` : 'Chưa xác nhận ngày chốt',
    periodLabel: asOfDate ? `Đến hết ngày ${asOfDate.split('-').reverse().join('/')}` : 'Chưa xác nhận ngày chốt',
    periodStart: asOfDate ? asOfDate.slice(0,4)+'-01-01' : undefined,
    periodEnd: asOfDate || undefined,
    asOfStatus,
    asOfDateEvidence: detectedDate ? `VERIFIED_TITLE_DATE:${detectedDate} Sheet ${targetSheet.name}!A1 ("${a1Text.trim()}")` : `Sheet ${targetSheet.name}!A1: chưa xác định ngày chốt`,
    asOfDateConfirmation: {
      confirmedByUser: !!manualDate,
      confirmedAt: manualDate ? new Date().toISOString() : null,
      reason: options.asOfConfirmationReason,
    },
    importedAt: new Date().toISOString(),
    records,
    summaryRecord,
    citySummaryRecord,
    unplannedDisbursementRecord,
    issues,
    identityChecks,
    allSheetsMeta,
  };

  return { dataset, localities };
}

export function importRevenueWorkbook(
  bytes: Uint8Array,
  filename: string,
  options: ImportOptions = {}
): { dataset: Dataset } {
  const wb = parseWorkbookBytes(bytes, filename);
  const allSheetsMeta = wb.sheets.map((s) => ({
    index: s.index,
    name: s.name,
    state: s.state,
  }));

  let targetSheet: ParsedWorkbookSheet | undefined;
  let importSelectionMode: 'AUTO_VISIBLE_SINGLE' | 'MANUAL_CONFIRMED' =
    'AUTO_VISIBLE_SINGLE';

  if (options.manualSheetName) {
    targetSheet = wb.sheets.find((s) => s.name === options.manualSheetName);
    importSelectionMode = 'MANUAL_CONFIRMED';
  } else {
    const visibleCandidates = wb.sheets.filter(
      (s) => s.state === 'visible' && detectSheetFingerprint(s) === 'REV_V1'
    );
    if (visibleCandidates.length === 1) {
      targetSheet = visibleCandidates[0];
    } else {
      const modified = wb.sheets.find(
        (s) =>
          s.state === 'visible' &&
          detectSheetFingerprint(s) === 'SCHEMA_MODIFIED_NEEDS_MAPPING'
      );
      if (modified) {
        throw new Error(
          'BLOCKER_MAPPING_REQUIRED: Cấu trúc cột file Thu NSNN thay đổi, yêu cầu mở Mapping Wizard (PH2-01).'
        );
      }
      throw new Error(
        'BLOCKER_SHEET_SELECTION: Không tìm thấy sheet visible duy nhất khớp fingerprint REV_V1.'
      );
    }
  }

  if (!targetSheet) {
    throw new Error('Sheet not found in REV workbook.');
  }

  // Per Master V2.2 §7 & T14: REV does NOT auto-fill 31/10 or 19/10 without user confirmation!
  const hasUserConfirmedDate = Boolean(
    options.confirmedAsOfDate && options.confirmedAsOfDate.trim().length > 0
  );
  const title = getCellText(targetSheet,'A3');
  const titleDate = explicitTitleDate(title);
  if (hasUserConfirmedDate && !isValidSourceDate(options.confirmedAsOfDate!.trim())) throw new Error('Ngày chốt không hợp lệ.');
  const asOfDate = hasUserConfirmedDate ? options.confirmedAsOfDate!.trim() : (titleDate || '');
  const asOfStatus: Dataset['asOfStatus'] = hasUserConfirmedDate
    ? 'MANUAL_CONFIRMED'
    : titleDate ? 'DETECTED_CONFIRMED' : 'REQUIRES_USER_CONFIRMATION';
  const datasetId = `REV_${wb.sha256.slice(0, 12)}`;
  const semanticMapping = resolveRevenueHeader(targetSheet);
  const isOriginalReference = wb.sha256 === 'b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f';
  // Only the authorized, byte-identical original workbook is allowed to use
  // the legacy fixed map. Any other workbook must pass semantic recognition.
  if (!semanticMapping && !isOriginalReference) {
    throw new Error('BLOCKER_MAPPING_REQUIRED: Không nhận diện duy nhất tiêu đề các cột dự toán/kế hoạch/thực hiện/thu tiền đất/thu trừ tiền đất; không được lấy theo cột R/W cố định.');
  }
  const mappingVersion = isOriginalReference ? 'REV_ADAPTER_V2.2' : 'REV_HEADER_SEMANTIC_V3';
  const legacyMap: Record<string, string> = {
    C: 'annual_total_budget',
    D: 'annual_land_budget',
    E: 'annual_nonland_budget',
    F: 'period_total_plan',
    G: 'period_land_plan',
    H: 'period_nonland_plan',
    I: 'actual_total_revenue',
    J: 'actual_nonstate_sector',
    K: 'tax_vat',
    L: 'tax_excise',
    M: 'tax_cit',
    N: 'tax_resource',
    R: 'actual_land_revenue',
    W: 'actual_nonland_revenue',
    X: 'source_rate_total_y',
    Y: 'source_rate_land_y',
    Z: 'source_rate_nonland_y',
    AA: 'source_rate_total_p',
    AB: 'source_rate_land_p',
    AC: 'source_rate_nonland_p',
  };

  const colMap = isOriginalReference ? legacyMap : semanticMapping!.colMap;
  const issues: QualityIssue[] = [];
  if (!asOfDate) {
    issues.push({
      id: `${datasetId}_BLOCKER_AS_OF_DATE`,
      ruleId: 'MISSING_CONFIRMED_AS_OF_DATE',
      severity: 'BLOCKER',
      status: 'OPEN',
      datasetId,
      sourceType: 'REV',
      rowId: 'HEADER_A3',
      sourceRow: 3,
      localityId: 'ALL',
      localityName: 'Toàn bộ nguồn Thu NSNN',
      fieldId: 'asOfDate',
      sourceCell: 'A3',
      observed: null,
      explanation:
        'Tiêu đề "10 tháng năm 2026" và tên sheet "10T-19.10" chưa chứng minh được ngày chốt cụ thể (không tự gán 19/10 hay 31/10). Yêu cầu người dùng nhập/xác nhận ngày chốt thực tế.',
    });
  }

  const parseRevRow = (row: number, locId: string, locName: string): SourceRecord => {
    const metrics: Record<string, MetricCellValue> = {};
    for (const [col, fieldId] of Object.entries(colMap)) {
      const isRatio = fieldId.startsWith('source_rate_');
      const unit = isRatio ? 'ratio' : 'million_vnd';
      metrics[fieldId] = buildMetricCell(
        targetSheet,
        col,
        row,
        unit,
        wb,
        asOfDate || 'UNCONFIRMED',
        mappingVersion
      );
    }
    return {
      id: `REV_R${row}`,
      datasetId,
      localityId: locId,
      localityName: locName,
      sourceRow: row,
      metrics,
    };
  };

  const dataRows = localityRows(targetSheet);
  const seen = new Set<string>();
  const records: SourceRecord[] = [];
  for (const row of dataRows) {
    const rawName = getCellText(targetSheet, `B${row}`);
    const canonical = canonicalizeLocalityName(rawName);
    const locId = makeLocalityId(canonical);
    if (seen.has(locId)) throw new Error('BLOCKER_DUPLICATE_LOCALITY: '+canonical+' tại dòng '+row);
    seen.add(locId);
    records.push(parseRevRow(row, locId, canonical));
  }
  if (!records.length) throw new Error('BLOCKER_MAPPING_REQUIRED: Không có dòng địa phương được nhận diện.');
  const totalRow = Array.from({length:Math.max(0,dataRows[0]-1)},(_,i)=>i+1)
    .find(row=>/^tong so|^tong cong$/.test(headerKey(getCellText(targetSheet,'B'+row))));
  const summaryRecord = totalRow ? parseRevRow(totalRow,'REV_AVAILABLE_113','Tổng các địa phương (dòng '+totalRow+')') : undefined;
  const monthMatch = title.match(/(\d{1,2})\s*tháng\s*(?:đầu\s*)?(?:năm\s*)?(\d{4})/iu);
  const periodLabel = titleDate ? 'Lũy kế đến ngày '+titleDate.split('-').reverse().join('/') :
    monthMatch ? monthMatch[1]+' tháng đầu năm '+monthMatch[2] : 'Kỳ theo tiêu đề nguồn';

  const dataset: Dataset = {
    id: datasetId,
    sourceType: 'REV',
    sourceFilename: filename,
    sourceHash: wb.sha256,
    workbookSha256: wb.sha256,
    sourceSheet: targetSheet.name,
    sheetIndex: targetSheet.index,
    sheetVisibility: targetSheet.state,
    schemaFingerprint: 'REV_V1',
    importSelectionMode,
    manualSelectionReason: options.manualSelectionReason,
    mappingVersion,
    calculationPolicyVersion: 'V2.2_R06',
    unitCount: records.length,
    asOfDate,
    reportPeriodLabel: isOriginalReference ? '10 tháng đầu năm 2026' : periodLabel,
    periodLabel: isOriginalReference ? '10 tháng đầu năm 2026' : periodLabel,
    periodStart: asOfDate ? asOfDate.slice(0,4)+'-01-01' : '2026-01-01',
    periodEnd: isOriginalReference ? '2026-10-31' : asOfDate || undefined,
    asOfStatus,
    asOfDateEvidence:
      titleDate ? `Sheet ${targetSheet.name}!A3: ${title.trim()}` :
      `Sheet ${targetSheet.name}!A3: ${title.trim()}; chưa có ngày chốt cụ thể, yêu cầu người dùng xác nhận.`,
    asOfDateConfirmation: {
      confirmedByUser: hasUserConfirmedDate,
      confirmedAt: hasUserConfirmedDate ? new Date().toISOString() : null,
      reason: options.asOfConfirmationReason,
    },
    importedAt: new Date().toISOString(),
    records,
    summaryRecord,
    issues,
    allSheetsMeta,
  };

  return { dataset };
}

export function importGpmbWorkbook(
  bytes: Uint8Array,
  filename: string,
  options: ImportOptions = {}
): { dataset: Dataset } {
  const wb = parseWorkbookBytes(bytes, filename);
  const allSheetsMeta = wb.sheets.map((s) => ({
    index: s.index,
    name: s.name,
    state: s.state,
  }));

  let targetSheet: ParsedWorkbookSheet | undefined;
  let importSelectionMode: 'AUTO_VISIBLE_SINGLE' | 'MANUAL_CONFIRMED' =
    'AUTO_VISIBLE_SINGLE';

  if (options.manualSheetName) {
    targetSheet = wb.sheets.find((s) => s.name === options.manualSheetName);
    importSelectionMode = 'MANUAL_CONFIRMED';
  } else {
    const visibleCandidates = wb.sheets.filter((s) => {
      if (s.state !== 'visible') return false;
      const fp = detectSheetFingerprint(s);
      return fp === 'GPMB_V1' || fp === 'GPMB_FLAT';
    });
    if (visibleCandidates.length === 1) {
      targetSheet = visibleCandidates[0];
    } else {
      throw new Error(
        'BLOCKER_SHEET_SELECTION: Không tìm thấy sheet visible duy nhất khớp fingerprint GPMB (GPMB_V1 hoặc GPMB_FLAT).'
      );
    }
  }

  if (!targetSheet) {
    throw new Error('Sheet not found in GPMB workbook.');
  }

  const sheetFp = detectSheetFingerprint(targetSheet);
  const isFlatTable = sheetFp === 'GPMB_FLAT';

  const a1Text = getCellText(targetSheet, 'A1');
  // Flat tables often contain only project deadlines, not a report cutoff.
  const detectedDate = isFlatTable ? undefined : dateFromReportTitle(a1Text);
  const manualDate = options.confirmedAsOfDate?.trim();
  if (manualDate && !isValidSourceDate(manualDate)) throw new Error('Ngày chốt không hợp lệ.');
  const asOfDate = manualDate || detectedDate || '';
  const asOfStatus: Dataset['asOfStatus'] = manualDate ? 'MANUAL_CONFIRMED' : detectedDate ? 'DETECTED_CONFIRMED' : 'REQUIRES_USER_CONFIRMATION';
  const datasetId = `GPMB_${wb.sha256.slice(0, 12)}`;
  const mappingVersion = isFlatTable ? 'GPMB_FLAT_ADAPTER_V2.2' : 'GPMB_ADAPTER_V2.2';

  const records: SourceRecord[] = [];
  const issues: QualityIssue[] = [];
  if (!asOfDate) issues.push({
    id: `${datasetId}_BLOCKER_AS_OF_DATE`, ruleId: 'MISSING_CONFIRMED_AS_OF_DATE',
    severity: 'BLOCKER', status: 'OPEN', datasetId, sourceType: 'GPMB', rowId: 'HEADER_A1',
    sourceRow: 1, localityId: 'ALL', localityName: 'Toàn bộ nguồn', fieldId: 'asOfDate',
    sourceCell: 'A1', observed: null, explanation: 'Không xác định được ngày chốt từ tiêu đề báo cáo. Cần xác nhận ngày chốt thực tế; không dùng tên file hoặc ngày mặc định.',
  });
  const localityGroupSummaries: Record<
    string,
    { row: number; rawM: string | number | null; formulaM?: string }
  > = {};

  if (isFlatTable) {
    let headerRow = 1;
    let colMapFlat: {
      sttCol?: string;
      projectCol?: string;
      localityCol?: string;
      capitalTypeCol?: string;
      declaredAreaCol?: string;
      recordedAreaCol?: string;
      allocatedBudgetCol?: string;
      paidAmountCol?: string;
      declaredOrgsCol?: string;
      declaredHouseholdsCol?: string;
      doneOrgsCol?: string;
      doneHouseholdsCol?: string;
      rateCol?: string;
      deadlineCol?: string;
    } = {};

    for (let r = 1; r <= Math.min(5, targetSheet.maxRow); r++) {
      const found: typeof colMapFlat = {};
      for (let c = 1; c <= 40; c++) {
        const col = colIndexToLetter(c);
        const txt = getCellText(targetSheet, `${col}${r}`).toLowerCase().trim();
        if (!txt) continue;
        if (/^stt$|^số\s*thứ\s*tự$/i.test(txt)) found.sttCol = col;
        else if (/^dự\s*án$|^tên\s*dự\s*án$/i.test(txt)) found.projectCol = col;
        else if (/^phường\s*xã$|^xã\s*phường$|^địa\s*bàn$|^địa\s*phương$/i.test(txt)) found.localityCol = col;
        else if (/^nguồn\s*vốn$|^nguồn\s*ngân\s*sách$/i.test(txt)) found.capitalTypeCol = col;
        else if (/tổng\s*dt\s*gpmb|tổng\s*diện\s*tích\s*phải\s*gpmb|dt\s*gpmb/i.test(txt)) found.declaredAreaCol = col;
        else if (/dt\s*đã\s*thu\s*hồi|diện\s*tích\s*đã\s*gpmb|dt\s*đã\s*gpmb|đã\s*thu\s*hồi/i.test(txt)) found.recordedAreaCol = col;
        else if (/tiền\s*phân\s*bổ|kinh\s*phí\s*phân\s*bổ/i.test(txt)) found.allocatedBudgetCol = col;
        else if (/đã\s*chi\s*gpmb|tiền\s*đã\s*chi/i.test(txt)) found.paidAmountCol = col;
        else if (/tổ\s*chức\s*bị\s*thu\s*hồi/i.test(txt)) found.declaredOrgsCol = col;
        else if (/hộ\s*dân\s*bị\s*thu\s*hồi/i.test(txt)) found.declaredHouseholdsCol = col;
        else if (/^số\s*tổ\s*chức$/i.test(txt)) found.doneOrgsCol = col;
        else if (/^số\s*hộ\s*dân$/i.test(txt)) found.doneHouseholdsCol = col;
        else if (/tỷ\s*lệ\s*gpmb/i.test(txt)) found.rateCol = col;
        else if (/hạn\s*hoàn\s*thành|thời\s*hạn|tiến\s*độ\s*hoàn\s*thành/i.test(txt)) found.deadlineCol = col;
      }
      if (found.localityCol && (found.declaredAreaCol || found.recordedAreaCol)) {
        headerRow = r;
        colMapFlat = found;
        break;
      }
    }

    for (let row = headerRow + 1; row <= targetSheet.maxRow; row++) {
      const locText = colMapFlat.localityCol ? getCellText(targetSheet, `${colMapFlat.localityCol}${row}`).trim() : '';
      const projText = colMapFlat.projectCol ? getCellText(targetSheet, `${colMapFlat.projectCol}${row}`).trim() : '';
      if (!locText && !projText) continue;

      const normLoc = canonicalizeLocalityName(locText);
      const locId = makeLocalityId(normLoc);
      const sttRaw = colMapFlat.sttCol ? getCellNumber(targetSheet, `${colMapFlat.sttCol}${row}`) : null;
      const stt = sttRaw ?? (row - headerRow);
      const capType = colMapFlat.capitalTypeCol ? getCellText(targetSheet, `${colMapFlat.capitalTypeCol}${row}`).trim() : '';

      const metrics: Record<string, MetricCellValue> = {};
      const fieldsDef = [
        { fieldId: 'gpmb_declared_area', col: colMapFlat.declaredAreaCol, unit: 'm2' },
        { fieldId: 'gpmb_recorded_area', col: colMapFlat.recordedAreaCol, unit: 'm2' },
        { fieldId: 'gpmb_allocated_budget', col: colMapFlat.allocatedBudgetCol, unit: 'vnd' },
        { fieldId: 'gpmb_paid_amount', col: colMapFlat.paidAmountCol, unit: 'vnd' },
        { fieldId: 'gpmb_source_reported_rate', col: colMapFlat.rateCol, unit: 'percent_100' },
        { fieldId: 'gpmb_declared_orgs', col: colMapFlat.declaredOrgsCol, unit: 'org_count' },
        { fieldId: 'gpmb_declared_households', col: colMapFlat.declaredHouseholdsCol, unit: 'household_count' },
        { fieldId: 'gpmb_done_orgs', col: colMapFlat.doneOrgsCol, unit: 'org_count' },
        { fieldId: 'gpmb_done_households', col: colMapFlat.doneHouseholdsCol, unit: 'household_count' },
        { fieldId: 'gpmb_deadline', col: colMapFlat.deadlineCol, unit: 'date_or_text' },
      ];

      for (const def of fieldsDef) {
        if (def.col) {
          metrics[def.fieldId] = buildMetricCell(
            targetSheet,
            def.col,
            row,
            def.unit,
            wb,
            asOfDate,
            mappingVersion
          );
        } else {
          metrics[def.fieldId] = {
            raw: null,
            normalizedValue: null,
            normalizedDecimal: null,
            unit: def.unit,
            state: 'NOT_APPLICABLE',
            cellType: 'empty',
            sourceRow: row,
            sourceColumn: '',
            extractionConfidence: 1.0,
            provenance: {
              filename,
              fileSha256: wb.sha256,
              sheet: targetSheet.name,
              sheetIndex: targetSheet.index,
              sheetVisibility: targetSheet.state,
              cell: `EMPTY_${def.fieldId}_R${row}`,
              asOfDate,
              mappingVersion,
            },
          };
        }
      }

      const projectRecordId = `${datasetId}_${targetSheet.name}_R${row}`;
      records.push({
        id: projectRecordId,
        datasetId,
        localityId: locId,
        localityName: normLoc,
        sourceRow: row,
        projectRowId: projectRecordId,
        projectStt: stt,
        projectName: projText,
        capitalType: capType,
        metrics,
      });

      // Quality checks per §4.3
      const dVal = colMapFlat.declaredAreaCol ? getCellNumber(targetSheet, `${colMapFlat.declaredAreaCol}${row}`) : null;
      const iVal = colMapFlat.recordedAreaCol ? getCellNumber(targetSheet, `${colMapFlat.recordedAreaCol}${row}`) : null;
      const mVal = colMapFlat.rateCol ? getCellNumber(targetSheet, `${colMapFlat.rateCol}${row}`) : null;
      const gVal = colMapFlat.allocatedBudgetCol ? getCellNumber(targetSheet, `${colMapFlat.allocatedBudgetCol}${row}`) : null;
      const jVal = colMapFlat.paidAmountCol ? getCellNumber(targetSheet, `${colMapFlat.paidAmountCol}${row}`) : null;

      if (iVal !== null && dVal !== null && dVal > 0 && mVal !== null) {
        const computedRatio = (100 * iVal) / dVal;
        const diff = Math.abs(mVal - computedRatio);
        if (diff > 0.1) {
          issues.push({
            id: `ISSUE_GPMB_M_DIFF_${row}`,
            datasetId,
            ruleId: 'GPMB_M_DIFF_RATIO',
            severity: 'WARNING',
            status: 'OPEN',
            sourceType: 'GPMB',
            rowId: projectRecordId,
            sourceRow: row,
            sourceCell: `${colMapFlat.rateCol}${row}`,
            fieldId: 'gpmb_source_reported_rate',
            observed: mVal,
            expected: computedRatio,
            delta: diff,
            localityId: locId,
            localityName: normLoc,
            explanation: `Cột M báo cáo ${mVal}%, khác tỷ lệ diện tích 100*I/D = ${computedRatio.toFixed(2)}% (lệch ${diff.toFixed(2)} điểm %). Giữ M gốc ở cấp dự án và tính benchmark theo diện tích.`,
          });
        }
      }

      if ((iVal === null || iVal === 0) && dVal !== null && dVal > 0) {
        const rawI = colMapFlat.recordedAreaCol ? targetSheet.cells.get(`${colMapFlat.recordedAreaCol}${row}`) : null;
        if (!rawI || rawI.value === null || rawI.value === '') {
          issues.push({
            id: `ISSUE_GPMB_MISSING_I_${row}`,
            datasetId,
            ruleId: 'GPMB_MISSING_I',
            severity: 'WARNING',
            status: 'OPEN',
            sourceType: 'GPMB',
            rowId: projectRecordId,
            sourceRow: row,
            sourceCell: `${colMapFlat.recordedAreaCol}${row}`,
            fieldId: 'gpmb_recorded_area',
            observed: null,
            expected: dVal,
            localityId: locId,
            localityName: normLoc,
            explanation: `Dự án có diện tích phải GPMB (${dVal} m2) nhưng ô diện tích đã GPMB trống.`,
          });
        }
      }

      if (iVal !== null && dVal !== null && iVal > dVal) {
        issues.push({
          id: `ISSUE_GPMB_I_GT_D_${row}`,
          datasetId,
          ruleId: 'GPMB_I_GT_D',
          severity: 'WARNING',
          status: 'OPEN',
          sourceType: 'GPMB',
          rowId: projectRecordId,
          sourceRow: row,
          sourceCell: `${colMapFlat.recordedAreaCol}${row}`,
          fieldId: 'gpmb_recorded_area',
          observed: iVal,
          expected: dVal,
          localityId: locId,
          localityName: normLoc,
          explanation: `Diện tích đã GPMB (${iVal} m2) lớn hơn diện tích phải GPMB (${dVal} m2).`,
        });
      }

      if (jVal !== null && gVal !== null && jVal > gVal) {
        issues.push({
          id: `ISSUE_GPMB_J_GT_G_${row}`,
          datasetId,
          ruleId: 'GPMB_J_GT_G',
          severity: 'WARNING',
          status: 'OPEN',
          sourceType: 'GPMB',
          rowId: projectRecordId,
          sourceRow: row,
          sourceCell: `${colMapFlat.paidAmountCol}${row}`,
          fieldId: 'gpmb_paid_amount',
          observed: jVal,
          expected: gVal,
          localityId: locId,
          localityName: normLoc,
          explanation: `Kinh phí đã chi GPMB (${jVal} đ) lớn hơn kinh phí phân bổ (${gVal} đ).`,
        });
      }
    }
  } else {
    const colMap: Record<string, { fieldId: string; unit: string }> = {
      D: { fieldId: 'gpmb_declared_area', unit: 'm2' },
      E: { fieldId: 'gpmb_declared_orgs', unit: 'org_count' },
      F: { fieldId: 'gpmb_declared_households', unit: 'household_count' },
      G: { fieldId: 'gpmb_allocated_budget', unit: 'vnd' },
      H: { fieldId: 'gpmb_deadline', unit: 'date_or_text' },
      I: { fieldId: 'gpmb_recorded_area', unit: 'm2' },
      J: { fieldId: 'gpmb_paid_amount', unit: 'vnd' },
      K: { fieldId: 'gpmb_done_orgs', unit: 'org_count' },
      L: { fieldId: 'gpmb_done_households', unit: 'household_count' },
      M: { fieldId: 'gpmb_source_reported_rate', unit: 'percent_100' },
    };

    let currentLocalityName = '';
    let currentLocalityId = '';

    for (let row = 3; row <= targetSheet.maxRow; row++) {
      const cellA = targetSheet.cells.get(`A${row}`);
      const textB = getCellText(targetSheet, `B${row}`);
      const normB = canonicalizeLocalityName(textB);

    const isGroupHeader =
      (!cellA || cellA.value === null || cellA.value === '') &&
      (normB.startsWith('Xã ') ||
        normB.startsWith('Phường ') ||
        normB.startsWith('Đặc khu '));

    if (isGroupHeader) {
      currentLocalityName = normB;
      currentLocalityId = makeLocalityId(normB);
      const cellM = targetSheet.cells.get(`M${row}`);
      localityGroupSummaries[currentLocalityId] = {
        row,
        rawM: cellM?.value ?? null,
        formulaM: cellM?.formula,
      };
      continue;
    }

    if (
      cellA &&
      cellA.cellType === 'n' &&
      typeof cellA.value === 'number' &&
      Number.isInteger(cellA.value) &&
      cellA.value >= 1 &&
      cellA.value <= 422
    ) {
      const stt = cellA.value;
      const metrics: Record<string, MetricCellValue> = {};
      for (const [col, def] of Object.entries(colMap)) {
        metrics[def.fieldId] = buildMetricCell(
          targetSheet,
          col,
          row,
          def.unit,
          wb,
          asOfDate,
          mappingVersion
        );
      }

      const projectRecordId = `${datasetId}_${targetSheet.name}_R${row}`;
      records.push({
        id: projectRecordId,
        datasetId,
        localityId: currentLocalityId,
        localityName: currentLocalityName,
        sourceRow: row,
        projectRowId: projectRecordId,
        projectStt: stt,
        projectName: normB,
        capitalType: getCellText(targetSheet, `C${row}`).trim(),
        metrics,
      });

      // Quality Checks per §4.3, §12.1, T29, T33, T60
      const dVal = getCellNumber(targetSheet, `D${row}`);
      const eVal = getCellNumber(targetSheet, `E${row}`);
      const fVal = getCellNumber(targetSheet, `F${row}`);
      const gVal = getCellNumber(targetSheet, `G${row}`);
      const iVal = getCellNumber(targetSheet, `I${row}`);
      const jVal = getCellNumber(targetSheet, `J${row}`);
      const kVal = getCellNumber(targetSheet, `K${row}`);
      const lVal = getCellNumber(targetSheet, `L${row}`);
      const mVal = getCellNumber(targetSheet, `M${row}`);

      const overChecks: Array<{
        ruleId: string;
        numCol: string;
        denCol: string;
        numV: number | null;
        denV: number | null;
        fieldId: string;
        desc: string;
      }> = [
        {
          ruleId: 'GPMB_I_GT_D',
          numCol: 'I',
          denCol: 'D',
          numV: iVal,
          denV: dVal,
          fieldId: 'gpmb_recorded_area',
          desc: 'Diện tích đã GPMB (I) lớn hơn diện tích phải GPMB (D)',
        },
        {
          ruleId: 'GPMB_J_GT_G',
          numCol: 'J',
          denCol: 'G',
          numV: jVal,
          denV: gVal,
          fieldId: 'gpmb_paid_amount',
          desc: 'Kinh phí đã chi GPMB (J) lớn hơn kinh phí phân bổ (G)',
        },
        {
          ruleId: 'GPMB_K_GT_E',
          numCol: 'K',
          denCol: 'E',
          numV: kVal,
          denV: eVal,
          fieldId: 'gpmb_done_orgs',
          desc: 'Số tổ chức đã GPMB (K) lớn hơn số tổ chức phải thu hồi (E)',
        },
        {
          ruleId: 'GPMB_L_GT_F',
          numCol: 'L',
          denCol: 'F',
          numV: lVal,
          denV: fVal,
          fieldId: 'gpmb_done_households',
          desc: 'Số hộ đã GPMB (L) lớn hơn số hộ phải thu hồi (F)',
        },
      ];

      for (const chk of overChecks) {
        if (chk.numV !== null && chk.denV !== null && chk.numV > chk.denV) {
          issues.push({
            id: `${datasetId}_${chk.ruleId}_R${row}`,
            ruleId: chk.ruleId,
            severity: 'WARNING',
            status: 'OPEN',
            datasetId,
            sourceType: 'GPMB',
            rowId: projectRecordId,
            sourceRow: row,
            projectStt: stt,
            localityId: currentLocalityId,
            localityName: currentLocalityName,
            fieldId: chk.fieldId,
            sourceCell: `${chk.numCol}${row}`,
            sourceCells: {
              numerator: `${chk.numCol}${row}`,
              denominator: `${chk.denCol}${row}`,
            },
            observed: chk.numV,
            expected: chk.denV,
            delta: chk.numV - chk.denV,
            explanation: `${chk.desc} tại dự án STT ${stt} (dòng ${row}, ${currentLocalityName}): ${chk.numCol}${row}=${chk.numV} > ${chk.denCol}${row}=${chk.denV}. Giữ nguyên giá trị nguồn để xác minh.`,
          });
        }
      }

      // Check missing D or I (3 rows: 107, 173, 365)
      if (dVal === null || iVal === null) {
        issues.push({
          id: `${datasetId}_MISSING_D_OR_I_R${row}`,
          ruleId: 'GPMB_MISSING_PROGRESS',
          severity: 'WARNING',
          status: 'OPEN',
          datasetId,
          sourceType: 'GPMB',
          rowId: projectRecordId,
          sourceRow: row,
          projectStt: stt,
          localityId: currentLocalityId,
          localityName: currentLocalityName,
          fieldId: 'gpmb_recorded_area',
          sourceCell: `I${row}`,
          sourceCells: { declared: `D${row}`, recorded: `I${row}`, reportedM: `M${row}` },
          observed: iVal,
          expected: dVal,
          explanation: `Dự án STT ${stt} (dòng ${row}, ${currentLocalityName}) có D${row}=${dVal} m² nhưng thiếu kết quả I${row}/M${row} (MISSING). Giữ D trong mẫu số và gắn cờ PARTIAL_AGGREGATE, không gán I=0.`,
        });
      }

      // Check M vs 100*I/D ONLY on project rows where D>0 and I, M are numeric (T29, T60)
      if (dVal !== null && dVal > 0 && iVal !== null && mVal !== null) {
        const recomputedPct = (100 * iVal) / dVal;
        const deltaPp = mVal - recomputedPct;
        if (Math.abs(deltaPp) > 0.1 + 1e-9) {
          issues.push({
            id: `${datasetId}_WARNING_M_RATIO_MISMATCH_R${row}`,
            ruleId: 'WARNING_M_RATIO_MISMATCH',
            severity: 'WARNING',
            status: 'OPEN',
            datasetId,
            sourceType: 'GPMB',
            rowId: projectRecordId,
            sourceRow: row,
            projectStt: stt,
            localityId: currentLocalityId,
            localityName: currentLocalityName,
            fieldId: 'gpmb_source_reported_rate',
            sourceCell: `M${row}`,
            sourceCells: {
              declared: `D${row}`,
              recorded: `I${row}`,
              reportedPercent: `M${row}`,
            },
            observed: mVal,
            expected: recomputedPct,
            delta: deltaPp,
            threshold: 0.1,
            explanation: `Cột M dòng dự án ${row} (STT ${stt}, ${currentLocalityName}) ghi ${mVal}%, lệch ${deltaPp.toFixed(2)} điểm % so với 100*I${row}/D${row} (${recomputedPct.toFixed(2)}%). Báo cáo chỉ tính theo SUM(I)/SUM(D), không dùng cột M để tính trung bình.`,
          });
        }
      }
    }
  }
}

  const uniqueLocCount = new Set(records.map((r) => r.localityId).filter(Boolean)).size;

  const dataset: Dataset = {
    id: datasetId,
    sourceType: 'GPMB',
    sourceFilename: filename,
    sourceHash: wb.sha256,
    workbookSha256: wb.sha256,
    sourceSheet: targetSheet.name,
    sheetIndex: targetSheet.index,
    sheetVisibility: targetSheet.state,
    schemaFingerprint: isFlatTable ? 'GPMB_FLAT' : 'GPMB_V1',
    importSelectionMode,
    manualSelectionReason: options.manualSelectionReason,
    mappingVersion: isFlatTable ? 'GPMB_FLAT_ADAPTER_V2.2' : mappingVersion,
    calculationPolicyVersion: 'V2.2_R06',
    unitCount: isFlatTable ? uniqueLocCount : Object.keys(localityGroupSummaries).length,
    projectRowCount: records.length,
    asOfDate,
    reportPeriodLabel: asOfDate ? `Đến ngày ${asOfDate.split('-').reverse().join('/')}` : 'Chưa xác nhận ngày chốt',
    periodLabel: asOfDate ? `Đến ngày ${asOfDate.split('-').reverse().join('/')}` : 'Chưa xác nhận ngày chốt',
    periodStart: asOfDate ? asOfDate.slice(0,4)+'-01-01' : undefined,
    periodEnd: asOfDate || undefined,
    asOfStatus,
    asOfDateEvidence: detectedDate ? `VERIFIED_TITLE_DATE:${detectedDate} Sheet ${targetSheet.name}!A1 ("${a1Text.trim()}")` : 'Chưa xác định ngày chốt từ tiêu đề; cần xác nhận thủ công',
    asOfDateConfirmation: {
      confirmedByUser: !!manualDate,
      confirmedAt: manualDate ? new Date().toISOString() : null,
      reason: options.asOfConfirmationReason,
    },
    importedAt: new Date().toISOString(),
    records,
    localityGroupSummaries,
    issues,
    allSheetsMeta,
  };

  return { dataset };
}
