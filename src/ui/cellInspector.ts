import Decimal from 'decimal.js';
import { CalculationTrace } from '../core/types';

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
  extraMeta?: {
    officialNote?: string | null;
    inspectionMarker?: string | null;
  }
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

  const noteHtml = extraMeta?.officialNote
    ? `<div class="trace-section trace-official-note">
        <h4>Ghi chú nguyên văn cột Q (UNVERIFIED_NOTE — không tự thay tỷ lệ I/F)</h4>
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

    <div class="trace-section">
      <h4>4. Chứng cứ Ô nguồn &amp; SHA-256 (${trace.sourceRefs.length} tham chiếu)</h4>
      <ul class="trace-sources-list">${sourceRefsHtml}</ul>
    </div>
  </div>`;
}

export function renderCellTracePopoverHtml(
  trace: CalculationTrace,
  extraMeta?: { officialNote?: string | null; inspectionMarker?: string | null }
): string {
  const primarySource = trace.sourceRefs[0];
  const sourceText = primarySource
    ? `${primarySource.sheetName}!${primarySource.address}`
    : 'Tổng hợp nhiều ô';
  const asOf = trace.scope.asOfDates.join(', ') || primarySource?.asOfDate || 'Chưa rõ';

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

  return `<div class="cell-trace-popover" role="dialog" aria-label="Chi tiết phép tính ô">
    <div class="popover-header">
      <div class="popover-title-row">
        <h4 class="popover-title">${escapeHtmlUi(trace.localityName || trace.scope.type)}</h4>
        <button type="button" class="popover-btn-close" id="btn-close-popover" title="Đóng">&times;</button>
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
      ${
        extraMeta?.officialNote
          ? `<div class="popover-note-snippet">
              <span class="note-pill">Ghi chú cột Q</span>
              <div class="note-text">${escapeHtmlUi(extraMeta.officialNote)}</div>
            </div>`
          : ''
      }
    </div>
    <div class="popover-footer">
      <button type="button" class="btn btn-sm btn-primary" id="btn-open-full-trace" data-trace-id="${escapeHtmlUi(
        trace.traceId
      )}">
        Xem toàn bộ phép tính &rarr;
      </button>
    </div>
  </div>`;
}

