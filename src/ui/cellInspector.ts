import Decimal from 'decimal.js';
import {
  CalculationTrace,
  Dataset,
  getDisbSchemaProfile,
  SourceCellRef,
} from '../core/types';

export interface TraceInspectorExtraMeta {
  officialNote?: string | null;
  inspectionMarker?: string | null;
  datasets?: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
}

interface LookupStep {
  label: string;
  detail: string;
}

interface SourceLookupDescription {
  summaryBadge: string;
  steps: LookupStep[];
}

function uniqueOrdered<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function parseCellAddress(addr: string): { col: string; row: number } | null {
  const m = String(addr || '').trim().match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

function summarizeSourceRefs(refs: SourceCellRef[]): {
  cols: string[];
  rows: number[];
  addrsPreview: string;
} {
  const cols: string[] = [];
  const rows: number[] = [];
  const addrs: string[] = [];
  for (const r of refs) {
    if (r.address) addrs.push(r.address);
    const parsed = parseCellAddress(r.address);
    if (parsed) {
      cols.push(parsed.col);
      rows.push(parsed.row);
    }
  }
  const uCols = uniqueOrdered(cols);
  const uRows = uniqueOrdered(rows);
  const uAddrs = uniqueOrdered(addrs);
  const preview =
    uAddrs.length <= 6
      ? uAddrs.join(', ')
      : `${uAddrs.slice(0, 5).join(', ')}... (+${uAddrs.length - 5} ô)`;
  return { cols: uCols, rows: uRows, addrsPreview: preview };
}

function describeSourceLookupMethod(
  trace: CalculationTrace,
  extraMeta?: TraceInspectorExtraMeta
): SourceLookupDescription {
  const indId = trace.indicatorId;
  const primaryRef = trace.sourceRefs[0];
  const mappingVer = primaryRef?.mappingVersion || '';

  let sourceKind: 'DISB' | 'REV' | 'GPMB' | 'UNKNOWN' = 'UNKNOWN';
  if (indId.startsWith('DISB_')) sourceKind = 'DISB';
  else if (indId.startsWith('REV_')) sourceKind = 'REV';
  else if (indId.startsWith('GPMB_')) sourceKind = 'GPMB';
  else if (mappingVer.includes('DISB')) sourceKind = 'DISB';
  else if (mappingVer.includes('REV')) sourceKind = 'REV';
  else if (mappingVer.includes('GPMB')) sourceKind = 'GPMB';

  const ds =
    sourceKind !== 'UNKNOWN' ? extraMeta?.datasets?.[sourceKind] : undefined;
  const schemaFp = ds?.schemaFingerprint || mappingVer || 'N/A';
  const sheetName =
    ds?.sourceSheet || primaryRef?.sheetName || '(chưa gắn sheet nguồn)';
  const sheetVis = ds?.sheetVisibility || primaryRef?.sheetVisibility || 'visible';
  const allRefsSummary = summarizeSourceRefs(trace.sourceRefs);

  const numOp = trace.operands.find(
    (o) =>
      o.role === 'NUMERATOR' ||
      o.role === 'SUM_NUMERATOR' ||
      o.role === 'LOCALITY_DISB' ||
      o.role === 'LOCALITY_AREA_RATE'
  );
  const denOp = trace.operands.find(
    (o) =>
      o.role === 'DENOMINATOR' ||
      o.role === 'SUM_DENOMINATOR' ||
      o.role === 'BENCHMARK_RATE'
  );
  const numCols = numOp
    ? summarizeSourceRefs(numOp.sources).cols.join(', ')
    : '';
  const denCols = denOp
    ? summarizeSourceRefs(denOp.sources).cols.join(', ')
    : '';

  if (sourceKind === 'DISB') {
    const profile = getDisbSchemaProfile(schemaFp);
    const schemaDesc =
      profile.fingerprint === 'DISB_PHAN_CAP_XA_V2'
        ? '15 cột A–O (có KHV đầu năm C–E & sau ĐC F–I)'
        : profile.fingerprint === 'DISB_PHAN_CAP_XA_V1'
        ? '12 cột A–L (vốn phân cấp không có cột đầu năm)'
        : 'bảng chuẩn 31 cột A–AE';
    const isBench =
      indId === 'DISB_BENCHMARK_RATE' || indId === 'DISB_AVG_PLAN';
    const rowNum =
      allRefsSummary.rows[0] ??
      ds?.records.find((r) => r.localityId === trace.localityId)?.sourceRow;

    const step1: LookupStep = {
      label: '1. Tự động chọn sheet & nhận diện mẫu',
      detail: `Quét sheet ${sheetVis} "${sheetName}", khớp dấu vân tay ${profile.fingerprint} (${schemaDesc}; dữ liệu từ hàng ${profile.rowStart}).`,
    };

    const step2: LookupStep = isBench
      ? {
          label: '2. Khoanh vùng khối địa phương',
          detail: `Duyệt cột B từ hàng ${profile.rowStart}, chuẩn hóa Unicode NFC tên địa phương (bỏ qua dòng tổng toàn TP) → gom đủ ${trace.population.includedCount} địa phương.`,
        }
      : {
          label: '2. Dò đúng dòng địa phương',
          detail: `Chuẩn hóa Unicode NFC tên trong cột B (từ hàng ${profile.rowStart}) → khớp "${
            trace.localityName || ''
          }" tại dòng ${rowNum ?? '?'} (${sheetName}!B${rowNum ?? '?'}).`,
        };

    let colStepDetail = `Ánh xạ ô nguồn: ${allRefsSummary.addrsPreview || 'chưa có'}.`;
    if (indId === 'DISB_PLAN') {
      const rStr = rowNum ?? '';
      colStepDetail = profile.hasInitialPlan
        ? `Lấy KHV sau ĐC tại cột ${profile.planCol} (${profile.planCol}${rStr}) và KHV đầu năm tại cột C (C${rStr}) để tự tính chênh lệch; kiểm tra cân đối tổng & đổi triệu → tỷ đồng.`
        : `Lấy KHV sau ĐC tại cột ${profile.planCol} (${profile.planCol}${rStr}) (mẫu 12 cột không có KHV đầu năm); đổi triệu → tỷ đồng.`;
    } else if (indId === 'DISB_RATE') {
      const rStr = rowNum ?? '';
      colStepDetail = `Lấy Giải ngân cột ${profile.disbCol} (${profile.disbCol}${rStr}) ÷ KHV sau ĐC cột ${profile.planCol} (${profile.planCol}${rStr}) × 100% bằng Decimal (tự tính lại thay vì chép cột ${profile.rateCol}).`;
    } else if (indId === 'DISB_BENCHMARK_RATE') {
      colStepDetail = `Cộng SUM(${profile.disbCol}) ÷ SUM(${profile.planCol}) trên ${trace.population.includedCount} địa phương (không tính bình quân cộng tỷ lệ).`;
    } else if (indId === 'DISB_COMPARISON_LABEL') {
      const rStr = rowNum ?? '';
      colStepDetail = `Lấy tỷ lệ xã (${profile.disbCol}${rStr}/${profile.planCol}${rStr}) trừ mốc chung SUM(${profile.disbCol})/SUM(${profile.planCol}) để phân loại cao/thấp hơn.`;
    }

    return {
      summaryBadge: `${profile.fingerprint} · Sheet ${sheetName}`,
      steps: [
        step1,
        step2,
        { label: '3. Ánh xạ cột & quy đổi đơn vị', detail: colStepDetail },
      ],
    };
  }

  if (sourceKind === 'REV') {
    const isBench = indId === 'REV_BENCHMARK_RATE';
    const rowNum =
      allRefsSummary.rows[0] ??
      ds?.records.find((r) => r.localityId === trace.localityId)?.sourceRow;

    const step1: LookupStep = {
      label: '1. Tự động chọn sheet & nhận diện mẫu',
      detail: `Quét sheet ${sheetVis} "${sheetName}", khớp dấu vân tay ${schemaFp} (dòng tổng tại B10, vùng địa phương B11:B123).`,
    };

    let step2: LookupStep;
    if (isBench) {
      step2 = {
        label: '2. Khoanh vùng 114 địa phương',
        detail: `Duyệt cột B (hàng 11–123) chuẩn hóa Unicode NFC → khớp ${trace.population.includedCount} địa phương có bản ghi (địa phương thiếu không tự điền 0).`,
      };
    } else if (trace.sourceRefs.length === 0) {
      step2 = {
        label: '2. Dò dòng địa phương theo NFC',
        detail: `Quét B11:B123 tìm "${
          trace.localityName || ''
        }" → 0 dòng khớp trong file nguồn (NO_LOCALITY_RECORD).`,
      };
    } else {
      step2 = {
        label: '2. Dò đúng dòng địa phương',
        detail: `Chuẩn hóa Unicode NFC cột B (B11:B123) → khớp "${
          trace.localityName || ''
        }" tại dòng ${rowNum ?? '?'} (${sheetName}!B${rowNum ?? '?'}).`,
      };
    }

    const rStr = rowNum ?? '';
    let step3Detail = `Đọc trực tiếp ô ${allRefsSummary.addrsPreview || 'nguồn'}.`;
    if (indId === 'REV_BUDGET_Y') {
      step3Detail = `Lấy Dự toán thu năm tại cột C (C${rStr}), chia 1.000 quy đổi triệu đồng → tỷ đồng.`;
    } else if (indId === 'REV_RATE_Y') {
      step3Detail = `Lấy Thực thu cột I (I${rStr}) ÷ Dự toán cột C (C${rStr}) × 100% bằng Decimal (không dùng cột tỷ lệ X).`;
    } else if (indId === 'REV_LAND_RATE_Y') {
      step3Detail = `Lấy Thu tiền sử dụng đất cột R (R${rStr}) ÷ Dự toán tiền SDĐ cột D (D${rStr}) × 100%.`;
    } else if (indId === 'REV_NONLAND_RATE_Y') {
      step3Detail = `Lấy Thu không gồm tiền đất cột W (W${rStr}) ÷ Dự toán cột E (E${rStr}) × 100%.`;
    } else if (isBench) {
      step3Detail = `Cộng tổng thực thu cột I (${trace.population.includedCount} ô) ÷ tổng dự toán cột C (${trace.population.includedCount} ô) × 100%.`;
    }

    return {
      summaryBadge: `${schemaFp} · Sheet ${sheetName}`,
      steps: [
        step1,
        step2,
        { label: '3. Ánh xạ cột & phép tính', detail: step3Detail },
      ],
    };
  }

  if (sourceKind === 'GPMB') {
    const isFlat = schemaFp === 'GPMB_FLAT';
    const isBench = indId === 'GPMB_BENCHMARK_AREA_RATE';
    const totalProjects = ds?.projectRowCount || trace.population.eligibleCount;
    const rowPreview =
      allRefsSummary.rows.length <= 5
        ? allRefsSummary.rows.join(', ')
        : `${allRefsSummary.rows.slice(0, 4).join(', ')}... (+${
            allRefsSummary.rows.length - 4
          } dòng)`;
    const locProjCount =
      ds && trace.localityId
        ? ds.records.filter((r) => r.localityId === trace.localityId).length
        : allRefsSummary.rows.length;

    const step1: LookupStep = {
      label: '1. Tự động nhận diện sheet & cấu trúc',
      detail: isFlat
        ? `Quét tiêu đề hàng 1–5 trên sheet "${sheetName}" (${sheetVis}) khớp mẫu bảng phẳng GPMB_FLAT (tự định vị cột Địa phương, Tổng DT GPMB, DT đã thu hồi, Tiền phân bổ).`
        : `Chọn sheet ${sheetVis} "${sheetName}", khớp mẫu GPMB_V1 (cột A trống & B là tiêu đề nhóm xã/phường từ hàng 3; các dòng dưới có A là STT dự án, D = DT phải GPMB, G = kinh phí, I = DT đã GPMB).`,
    };

    let step2: LookupStep;
    if (isBench) {
      step2 = {
        label: '2. Gom nhóm toàn bộ dự án theo địa bàn',
        detail: `Duyệt toàn bộ ${totalProjects || trace.population.includedCount} dòng dự án hợp lệ, gom theo tiêu đề nhóm địa bàn chuẩn Unicode NFC → phạm vi ${
          ds?.unitCount || 108
        } địa bàn có dữ liệu.`,
      };
    } else if (trace.sourceRefs.length === 0) {
      step2 = {
        label: '2. Quét danh mục dự án theo tên xã',
        detail: `Duyệt toàn bộ ${
          totalProjects || ''
        } dòng dự án theo chuẩn Unicode NFC tìm nhóm "${
          trace.localityName || ''
        }" → 0 dòng khớp → xác định "Không có nhiệm vụ GPMB".`,
      };
    } else {
      step2 = {
        label: '2. Gom nhóm các dự án của địa phương',
        detail: `Lọc ${
          isFlat ? 'cột Phường/Xã' : 'dòng nhóm địa bàn ở cột B'
        } theo tên chuẩn Unicode NFC "${
          trace.localityName || ''
        }" → gom ${locProjCount} dòng dự án (hàng ${rowPreview || '?'}).`,
      };
    }

    const colDisplay = allRefsSummary.cols.join(', ') || 'D, I';
    const effectiveNumCols = numCols || (isFlat ? colDisplay : 'I');
    const effectiveDenCols = denCols || (isFlat ? colDisplay : 'D');
    let step3Detail = `Tổng hợp trực tiếp từ các ô ${
      allRefsSummary.addrsPreview || colDisplay
    }.`;
    if (trace.sourceRefs.length === 0 && !isBench) {
      step3Detail =
        'Áp dụng quy tắc minh bạch: không phát sinh dòng dự án nên giữ nguyên "Không có nhiệm vụ GPMB", không điền 0% giả.';
    } else if (indId === 'GPMB_BUDGET') {
      step3Detail = `Cộng tiền phân bổ từ cột ${allRefsSummary.cols.join(', ') || 'G'} trên các dự án đã gom; quy đổi đồng → tỷ đồng (÷ 10⁹).`;
    } else if (indId === 'GPMB_AREA_PLAN') {
      step3Detail = `Cộng diện tích phải GPMB từ cột ${allRefsSummary.cols.join(', ') || 'D'} trên các dự án đã gom (m2${
        trace.result.displayUnit === 'ha' ? ' ÷ 10.000 → ha' : ''
      }).`;
    } else if (indId === 'GPMB_AREA_RATE') {
      step3Detail = `Tính chuẩn theo diện tích: SUM(cột ${effectiveNumCols}) ÷ SUM(cột ${effectiveDenCols}) × 100% (loại dự án thiếu I nếu có, không bình quân cột M).`;
    } else if (isBench) {
      step3Detail = `Cộng SUM(cột ${effectiveNumCols}) ÷ SUM(cột ${effectiveDenCols}) × 100% trên toàn bộ dự án hợp lệ có đủ tử và mẫu.`;
    } else if (indId === 'GPMB_COMPARISON_LABEL') {
      step3Detail = `Tính tỷ lệ xã SUM(${effectiveNumCols})/SUM(${effectiveDenCols}) trừ mốc trung bình toàn nguồn GPMB để phân loại cao/thấp hơn.`;
    }

    return {
      summaryBadge: `${schemaFp} · Sheet ${sheetName}`,
      steps: [
        step1,
        step2,
        { label: '3. Ánh xạ cột & công thức GPMB', detail: step3Detail },
      ],
    };
  }

  return {
    summaryBadge: `${schemaFp} · Sheet ${sheetName}`,
    steps: [
      {
        label: '1. Tự động ánh xạ nguồn',
        detail: `Đọc từ sheet "${sheetName}" (${sheetVis}), ô ${
          allRefsSummary.addrsPreview || 'tổng hợp'
        }.`,
      },
    ],
  };
}

export function escapeHtmlUi(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMax4Decimals(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'null';
  const str = String(val).trim();
  if (str === 'null' || str === 'undefined') return 'null';
  try {
    const normalized = str.replace(',', '.');
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(normalized)) {
      return str;
    }
    const d = new Decimal(normalized);
    if (d.isNaN()) return str;
    return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString();
  } catch {
    return str;
  }
}

export function renderTraceInspectorHtml(
  trace: CalculationTrace | null,
  extraMeta?: TraceInspectorExtraMeta
): string {
  if (!trace) {
    return `<div class="trace-inspector-empty">
      <h3>Hồ sơ Giải trình Phép tính (Trace Inspector)</h3>
      <p>Nhấn chuột hoặc phím Enter vào bất kỳ ô số liệu, dòng mốc chuẩn hoặc nhận xét trên bảng báo cáo để xem đầy đủ công thức, tử/mẫu, số gốc chưa làm tròn, danh sách bản ghi được tính/bỏ qua và chứng cứ ô nguồn.</p>
    </div>`;
  }

  const operandsHtml = trace.operands
    .map(
      (op) => `<tr>
        <td><strong>${escapeHtmlUi(op.role)}</strong></td>
        <td><code>${escapeHtmlUi(op.fieldId)}</code></td>
        <td><code>${escapeHtmlUi(formatMax4Decimals(op.exactValue))}</code></td>
        <td>${escapeHtmlUi(op.unit)}</td>
        <td><span class="badge badge-${escapeHtmlUi(op.state)}">${escapeHtmlUi(op.state)}</span></td>
        <td>${op.sources
          .slice(0, 6)
          .map((s) => `${escapeHtmlUi(s.sheetName)}!${escapeHtmlUi(s.address)}`)
          .join(', ')}${op.sources.length > 6 ? ` (+${op.sources.length - 6} ô)` : ''}</td>
      </tr>`
    )
    .join('');

  const stepsHtml = trace.steps
    .map(
      (st, idx) => `<li>
        <strong>Bước ${idx + 1} [${escapeHtmlUi(st.operation)}]:</strong>
        Đầu vào (${escapeHtmlUi(st.inputs.join(', '))}) &rarr; Đầu ra: <code>${escapeHtmlUi(
        st.output ?? 'null'
      )}</code> (${escapeHtmlUi(st.outputUnit || '')}) — <em>${escapeHtmlUi(st.reason)}</em>
      </li>`
    )
    .join('');

  const zeroContribHtml =
    trace.zeroDenominatorContributors &&
    trace.zeroDenominatorContributors.length > 0
      ? `<div class="trace-section trace-zero-contributors">
          <h4>Phát sinh ngoài dự toán/kế hoạch nhưng vẫn tính vào tổng (Quy tắc P0 / R04)</h4>
          <p>Các dòng có mẫu số = 0 hợp lệ (ZERO_VALID) vẫn tham gia vào tổng tử số của mốc chung:</p>
          <table class="trace-subtable">
            <thead>
              <tr>
                <th>Bản ghi</th>
                <th>Địa phương</th>
                <th>Ô tử số</th>
                <th>Giá trị đóng góp</th>
                <th>Ô mẫu số (=0)</th>
              </tr>
            </thead>
            <tbody>
              ${trace.zeroDenominatorContributors
                .map(
                  (z) => `<tr>
                    <td><code>${escapeHtmlUi(z.recordId)}</code></td>
                    <td>${escapeHtmlUi(z.localityName || z.localityId)}</td>
                    <td>${escapeHtmlUi(z.numeratorSource.address)}</td>
                    <td><strong>${escapeHtmlUi(formatMax4Decimals(z.numeratorExactDecimal))}</strong></td>
                    <td>${escapeHtmlUi(z.denominatorSource.address)} = 0</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  const exclusionsHtml =
    trace.exclusions.length > 0
      ? `<table class="trace-subtable">
          <thead>
            <tr>
              <th>Bản ghi</th>
              <th>Toán hạng</th>
              <th>Mã lý do</th>
              <th>Giải trình</th>
              <th>Ô nguồn</th>
            </tr>
          </thead>
          <tbody>
            ${trace.exclusions
              .map(
                (ex) => `<tr>
                  <td><code>${escapeHtmlUi(ex.recordId)}</code></td>
                  <td>${escapeHtmlUi(ex.affectedOperand)}</td>
                  <td><span class="badge badge-WARNING">${escapeHtmlUi(ex.reasonCode)}</span></td>
                  <td>${escapeHtmlUi(ex.explanation)}</td>
                  <td>${escapeHtmlUi(ex.sourceCell || '')}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : `<p class="muted">Không có bản ghi nào bị loại trừ trong phép tính này.</p>`;

  const coverageHtml =
    trace.coverageDetails.length > 0
      ? `<table class="trace-subtable">
          <thead>
            <tr>
              <th>Địa phương</th>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th>Bằng chứng</th>
              <th>Lý do có căn cứ</th>
            </tr>
          </thead>
          <tbody>
            ${trace.coverageDetails
              .map(
                (c) => `<tr>
                  <td><strong>${escapeHtmlUi(c.localityName)}</strong></td>
                  <td>${escapeHtmlUi(c.sourceType || c.sourceDatasetId)}</td>
                  <td><span class="badge badge-${escapeHtmlUi(c.status)}">${escapeHtmlUi(
                  c.status
                )}</span></td>
                  <td>${escapeHtmlUi(c.sourceSheet || '')}${
                  c.sourceCell ? '!' + escapeHtmlUi(c.sourceCell) : ''
                }</td>
                  <td>${escapeHtmlUi(c.reason)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : '';

  const sourceRefsHtml = trace.sourceRefs
    .slice(0, 25)
    .map(
      (s) => `<li>
        <code>${escapeHtmlUi(s.fileName)}</code> (SHA: <code>${escapeHtmlUi(
        s.fileSha256.slice(0, 12)
      )}...</code>) &rarr; Sheet <strong>${escapeHtmlUi(
        s.sheetName
      )}</strong> (index ${s.sheetIndex}, ${escapeHtmlUi(
        s.sheetVisibility
      )})!<strong>${escapeHtmlUi(s.address)}</strong> | Ngày chốt: <strong>${escapeHtmlUi(
        s.asOfDate
      )}</strong>${
        s.sourceFormula
          ? ` | Công thức nguồn Excel: <code>=${escapeHtmlUi(s.sourceFormula)}</code> (${escapeHtmlUi(
              s.sourceFormulaVerification
            )})`
          : ''
      }
      </li>`
    )
    .join('');

  const traceDisbProfile = getDisbSchemaProfile(trace.sourceRefs[0]?.mappingVersion);
  const noteCol = traceDisbProfile.noteCol;
  const ratioSymbol = `${traceDisbProfile.disbCol}/${traceDisbProfile.planCol}`;

  const noteHtml = extraMeta?.officialNote
    ? `<div class="trace-section trace-official-note">
        <h4>Ghi chú nguyên văn cột ${escapeHtmlUi(noteCol)} (UNVERIFIED_NOTE — không tự thay tỷ lệ ${escapeHtmlUi(ratioSymbol)})</h4>
        <pre class="official-note-box">${escapeHtmlUi(extraMeta.officialNote)}</pre>
        ${
          extraMeta.inspectionMarker
            ? `<p><strong>Nhãn kiểm tra hành chính cột P:</strong> ${escapeHtmlUi(
                extraMeta.inspectionMarker
              )} (chỉ là metadata, không phải ngày chốt và không tự chọn xã)</p>`
            : ''
        }
      </div>`
    : '';

  const lookupInfo = describeSourceLookupMethod(trace, extraMeta);
  const lookupSectionHtml = `<div class="trace-section trace-lookup-box">
      <h4>4. Phương pháp hệ thống tự động tìm đúng ô giá trị trong file Excel nguồn</h4>
      <div style="margin-bottom: 6px;"><span class="badge badge-primary">${escapeHtmlUi(
        lookupInfo.summaryBadge
      )}</span></div>
      <ol class="lookup-steps-list">
        ${lookupInfo.steps
          .map(
            (st) =>
              `<li><strong>${escapeHtmlUi(st.label)}:</strong> ${escapeHtmlUi(
                st.detail
              )}</li>`
          )
          .join('')}
      </ol>
    </div>`;

  return `<div class="trace-inspector-card" data-trace-id="${escapeHtmlUi(trace.traceId)}">
    <div class="trace-header">
      <div>
        <span class="badge badge-primary">${escapeHtmlUi(trace.resultKind)}</span>
        <span class="badge badge-${escapeHtmlUi(trace.quality.status)}">${escapeHtmlUi(
    trace.quality.status
  )}</span>
        <code class="trace-id-code">${escapeHtmlUi(trace.traceId)}</code>
      </div>
      <h3>${escapeHtmlUi(trace.indicatorId)} — ${escapeHtmlUi(
    trace.localityName || trace.scope.type
  )}</h3>
    </div>

    <div class="trace-summary-grid">
      <div class="trace-stat">
        <span class="stat-label">Kết quả hiển thị:</span>
        <strong class="stat-value">${escapeHtmlUi(trace.result.displayedText)}</strong>
      </div>
      <div class="trace-stat">
        <span class="stat-label">Số gốc chính xác (Decimal chưa làm tròn, tối đa 4 số thập phân):</span>
        <code>${escapeHtmlUi(formatMax4Decimals(trace.result.exactDecimal))}</code>
      </div>
      <div class="trace-stat">
        <span class="stat-label">Đơn vị chuẩn / hiển thị:</span>
        <span>${escapeHtmlUi(trace.result.canonicalUnit)} &rarr; ${escapeHtmlUi(
    trace.result.displayUnit
  )}</span>
      </div>
      <div class="trace-stat">
        <span class="stat-label">Phạm vi &amp; Ngày chốt:</span>
        <span>${escapeHtmlUi(trace.scope.type)} | Ngày chốt: <strong>${escapeHtmlUi(
    trace.scope.asOfDates.join(', ')
  )}</strong></span>
      </div>
    </div>

    <div class="trace-section">
      <h4>1. Công thức &amp; Quy tắc làm tròn</h4>
      <p><strong>Biểu thức:</strong> <code>${escapeHtmlUi(
        trace.formula.readableExpression
      )}</code></p>
      <p><strong>Mã công thức:</strong> <code>${escapeHtmlUi(
        trace.formula.formulaId
      )}</code> (v${escapeHtmlUi(
    trace.formula.formulaVersion
  )}) | <strong>Phương pháp:</strong> ${escapeHtmlUi(
    trace.formula.method
  )} | <strong>Làm tròn:</strong> ${escapeHtmlUi(trace.formula.roundingPolicy)}</p>
    </div>

    <div class="trace-section">
      <h4>2. Toán hạng (Operands) &amp; Các bước tính</h4>
      <table class="trace-subtable">
        <thead>
          <tr>
            <th>Vai trò</th>
            <th>Trường</th>
            <th>Giá trị Decimal gốc</th>
            <th>Đơn vị gốc</th>
            <th>Trạng thái</th>
            <th>Ô nguồn</th>
          </tr>
        </thead>
        <tbody>${operandsHtml}</tbody>
      </table>
      <ol class="trace-steps-list">${stepsHtml}</ol>
    </div>

    ${zeroContribHtml}

    <div class="trace-section">
      <h4>3. Tập bản ghi được tính (${trace.population.includedCount}/${
    trace.population.eligibleCount
  }) &amp; Bỏ qua (${trace.population.excludedCount})</h4>
      <p><strong>Included IDs:</strong> <code>${escapeHtmlUi(
        trace.population.includedRecordIds.slice(0, 30).join(', ')
      )}${
    trace.population.includedRecordIds.length > 30
      ? ` ... (+${trace.population.includedRecordIds.length - 30} bản ghi)`
      : ''
  }</code></p>
      ${exclusionsHtml}
      ${coverageHtml}
    </div>

    ${noteHtml}

    ${lookupSectionHtml}

    <div class="trace-section">
      <h4>5. Chứng cứ Ô nguồn &amp; SHA-256 (${trace.sourceRefs.length} tham chiếu)</h4>
      <ul class="trace-sources-list">${sourceRefsHtml}</ul>
    </div>
  </div>`;
}

export function renderCellTracePopoverHtml(
  trace: CalculationTrace,
  extraMeta?: TraceInspectorExtraMeta
): string {
  const primarySource = trace.sourceRefs[0];
  const sourceText = primarySource
    ? `${primarySource.sheetName}!${primarySource.address}`
    : trace.indicatorId.startsWith('GPMB_')
    ? 'Không có dòng dự án khớp trong nguồn GPMB'
    : 'Tổng hợp nhiều ô';
  const asOf = trace.scope.asOfDates.join(', ') || primarySource?.asOfDate || 'Chưa rõ';
  const lookupInfo = describeSourceLookupMethod(trace, extraMeta);

  const numOp = trace.operands.find((o) => o.role === 'NUMERATOR' || o.role === 'SUM_NUMERATOR');
  const denOp = trace.operands.find((o) => o.role === 'DENOMINATOR' || o.role === 'SUM_DENOMINATOR');

  const operandsSummary =
    numOp && denOp
      ? `<div class="popover-fraction">
          <div class="fraction-line">
            <span class="fraction-label">Tử số:</span>
            <code>${escapeHtmlUi(formatMax4Decimals(numOp.exactValue))}</code> ${escapeHtmlUi(numOp.unit)}
          </div>
          <div class="fraction-line">
            <span class="fraction-label">Mẫu số:</span>
            <code>${escapeHtmlUi(formatMax4Decimals(denOp.exactValue))}</code> ${escapeHtmlUi(denOp.unit)}
          </div>
        </div>`
      : '';

  const lookupStepsHtml = lookupInfo.steps
    .map(
      (st) =>
        `<li><strong>${escapeHtmlUi(st.label)}:</strong> ${escapeHtmlUi(st.detail)}</li>`
    )
    .join('');

  return `<div class="cell-trace-popover" role="dialog" aria-label="Chi tiết phép tính ô">
    <div class="popover-header">
      <div class="popover-title-row">
        <h4 class="popover-title">${escapeHtmlUi(trace.localityName || trace.scope.type)}</h4>
        <button type="button" class="popover-btn-close" id="btn-close-popover" title="Đóng (Esc)">&times;</button>
      </div>
      <div class="popover-subtitle">${escapeHtmlUi(trace.indicatorLabel || trace.indicatorId)}</div>
    </div>
    <div class="popover-body">
      <div class="popover-value-row">
        <span class="popover-display-val">${escapeHtmlUi(trace.result.displayedText)}</span>
        <span class="badge badge-${escapeHtmlUi(trace.quality.status)}">${escapeHtmlUi(trace.quality.status)}</span>
      </div>
      <div class="popover-meta-row">
        <span class="popover-meta-label">Số gốc chưa làm tròn:</span>
        <code class="popover-exact-val">${escapeHtmlUi(formatMax4Decimals(trace.result.exactDecimal))}</code>
      </div>
      <div class="popover-meta-row">
        <span class="popover-meta-label">Công thức:</span>
        <code class="popover-formula">${escapeHtmlUi(trace.formula.readableExpression)}</code>
      </div>
      ${operandsSummary}
      <div class="popover-meta-row">
        <span class="popover-meta-label">Ô nguồn:</span>
        <span><strong>${escapeHtmlUi(sourceText)}</strong> (chốt: ${escapeHtmlUi(asOf)})</span>
      </div>
      <div class="popover-lookup-box">
        <div class="popover-lookup-title">
          <span>Phương pháp tự tìm ô Excel nguồn</span>
          <code class="lookup-schema-pill" title="${escapeHtmlUi(lookupInfo.summaryBadge)}">${escapeHtmlUi(lookupInfo.summaryBadge)}</code>
        </div>
        <ul class="popover-lookup-steps">${lookupStepsHtml}</ul>
      </div>
      ${
        extraMeta?.officialNote
          ? `<div class="popover-note-snippet">
              <span class="note-pill">Ghi chú cột ${escapeHtmlUi(
                getDisbSchemaProfile(primarySource?.mappingVersion).noteCol
              )}</span>
              <div class="note-text">${escapeHtmlUi(extraMeta.officialNote)}</div>
            </div>`
          : ''
      }
    </div>
    <div class="popover-footer">
      <span class="popover-shortcut-hint">Nhấn <kbd>Esc</kbd> để bỏ chọn ô</span>
      <button type="button" class="btn btn-sm btn-primary" id="btn-open-full-trace" data-trace-id="${escapeHtmlUi(
        trace.traceId
      )}">
        Xem toàn bộ phép tính &rarr;
      </button>
    </div>
  </div>`;
}

