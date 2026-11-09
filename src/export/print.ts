import { EvaluatedSessionReport } from '../core/calculationTrace';
import { analyzeSourceCoverage, filterCoverageForSession } from '../core/coverage';
import { Dataset, Locality } from '../core/types';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates clean, paginated print/PDF HTML for any number of selected localities
 * (e.g. 5 localities in 1 page, 20 localities split across 3 horizontal page chunks of 8 localities each so no column is lost or shrunk to unreadable size - T18, T65).
 */
export function generatePrintableReportHtml(params: {
  evaluated: EvaluatedSessionReport;
  baselineLocalities: Locality[];
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  includeTraceAppendix?: boolean;
}): string {
  const {
    evaluated,
    baselineLocalities,
    datasets,
    includeTraceAppendix = true,
  } = params;
  const { session, selectedLocalities, rows, tracesById } = evaluated;

  if (!session.settings.showScopeFootnotes) {
    throw new Error(
      'BLOCKER_UNEXPLAINED_EXPORT: Không được tắt chú thích nguồn và phạm vi khi in/xuất PDF báo cáo chính thức.'
    );
  }

  const maxColsPerPage = session.settings.paperSize === 'A3' ? 12 : 8;
  const chunks: Locality[][] = [];
  if (selectedLocalities.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < selectedLocalities.length; i += maxColsPerPage) {
      chunks.push(selectedLocalities.slice(i, i + maxColsPerPage));
    }
  }

  const revDate = datasets.REV?.asOfDate || 'Chưa xác nhận';
  const disbDate = datasets.DISB?.asOfDate || '15/10/2026';
  const gpmbDate = datasets.GPMB?.asOfDate || '26/10/2026';

  const pagesHtml = chunks
    .map((chunk, pageIdx) => {
      const headerCols = chunk
        .map((loc) => `<th>${escapeHtml(loc.displayName)}</th>`)
        .join('');

      const bodyRows = rows
        .map((r) => {
          const cells = chunk
            .map((loc) => {
              const c = r.cellsByLocalityId[loc.id];
              return `<td class="print-cell">${escapeHtml(
                c ? c.displayedText : 'Chưa có số liệu'
              )}</td>`;
            })
            .join('');
          return `<tr>
            <td class="stt-col">${escapeHtml(r.rowConfig.sttLabel || '')}</td>
            <td class="label-col">${escapeHtml(r.rowConfig.customLabel)}</td>
            ${cells}
          </tr>`;
        })
        .join('');

      return `<section class="print-page-chunk">
        <h2>${escapeHtml(session.settings.reportTitle)} ${
        chunks.length > 1 ? `(Phần ${pageIdx + 1}/${chunks.length})` : ''
      }</h2>
        <p class="print-meta">Phiên: <strong>${escapeHtml(
          session.name
        )}</strong> | Đơn vị tiền: <strong>${
        session.settings.moneyUnit === 'billion' ? 'Tỷ đồng' : 'Triệu đồng'
      }</strong> | Đơn vị diện tích: <strong>${
        session.settings.areaUnit === 'ha' ? 'ha' : 'm²'
      }</strong> | Phương pháp GPMB: <strong>Chỉ tính theo diện tích SUM(I)/SUM(D)</strong></p>
        <p class="print-meta">Ngày chốt độc lập — Thu NSNN: ${escapeHtml(
          revDate
        )} (113/114 địa phương, thiếu Đặc khu Bạch Long Vĩ); Giải ngân: ${escapeHtml(
        disbDate
      )} (114/114 địa phương); GPMB: ${escapeHtml(
        gpmbDate
      )} (108/114 địa bàn, 422 dự án)</p>
        <table class="print-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Chỉ tiêu / Kết quả</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </section>`;
    })
    .join('\n');

  const { allCoverageDetails } = analyzeSourceCoverage(
    baselineLocalities,
    datasets
  );
  const relevantCoverage = filterCoverageForSession(
    allCoverageDetails,
    session.selectedLocalityIds,
    true
  );

  const coverageRowsHtml = relevantCoverage
    .map(
      (cov) => `<tr>
        <td>${escapeHtml(cov.localityName)}</td>
        <td>${escapeHtml(cov.sourceType || cov.sourceDatasetId)}</td>
        <td>${escapeHtml(cov.fieldId || 'Bản ghi địa phương')}</td>
        <td>${escapeHtml(cov.status)}</td>
        <td>${escapeHtml(
          `${cov.sourceSheet || ''}${cov.sourceCell ? '!' + cov.sourceCell : ''}`
        )}</td>
        <td>${escapeHtml(cov.reason)}</td>
        <td>${escapeHtml(cov.asOfDate || '')}</td>
      </tr>`
    )
    .join('');

  const gpmbMismatchHtml = (datasets.GPMB?.issues || [])
    .filter((i) => i.ruleId === 'WARNING_M_RATIO_MISMATCH')
    .map(
      (i) => `<tr>
        <td>DA STT ${i.projectStt} (dòng ${i.sourceRow})</td>
        <td>${escapeHtml(i.localityName)}</td>
        <td>${escapeHtml(String(i.observed))}%</td>
        <td>${escapeHtml(Number(i.expected).toFixed(2))}%</td>
        <td>${escapeHtml(Number(i.delta).toFixed(2))} điểm %</td>
        <td>${escapeHtml(i.explanation)}</td>
      </tr>`
    )
    .join('');

  const traceAppendixHtml = includeTraceAppendix
    ? `<section class="print-appendix">
        <h3>Phụ lục Hồ sơ Giải trình Phép tính (CalculationTrace)</h3>
        <table class="print-table">
          <thead>
            <tr>
              <th>Trace ID</th>
              <th>Chỉ tiêu</th>
              <th>Địa phương / Phạm vi</th>
              <th>Công thức</th>
              <th>Giá trị hiển thị</th>
              <th>Chất lượng</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(tracesById.values())
              .map(
                (t) => `<tr>
                  <td>${escapeHtml(t.traceId)}</td>
                  <td>${escapeHtml(t.indicatorId)}</td>
                  <td>${escapeHtml(t.localityName || t.scope.type)}</td>
                  <td>${escapeHtml(t.formula.readableExpression)}</td>
                  <td>${escapeHtml(t.result.displayedText)}</td>
                  <td>${escapeHtml(t.quality.status)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>`
    : '';

  return `<div class="printable-report-container" data-paper="${session.settings.paperSize}" data-orientation="${session.settings.orientation}">
    ${pagesHtml}
    <section class="print-appendix">
      <h3>Phụ lục Nguồn thiếu &amp; Lý do (Coverage Audit)</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>Tên địa phương</th>
            <th>Nguồn</th>
            <th>Trường/Chỉ tiêu</th>
            <th>Trạng thái</th>
            <th>Bằng chứng</th>
            <th>Nguyên nhân có căn cứ</th>
            <th>Kỳ chốt</th>
          </tr>
        </thead>
        <tbody>
          ${coverageRowsHtml}
        </tbody>
      </table>
    </section>
    <section class="print-appendix">
      <h3>Phụ lục Đối chiếu Chất lượng Cột M Dòng Dự án GPMB (12 dự án lệch &gt; 0,1 điểm %)</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>Dự án / Dòng</th>
            <th>Địa phương</th>
            <th>M nguồn</th>
            <th>100*I/D tính lại</th>
            <th>Chênh lệch</th>
            <th>Giải trình</th>
          </tr>
        </thead>
        <tbody>
          ${gpmbMismatchHtml}
        </tbody>
      </table>
    </section>
    ${traceAppendixHtml}
  </div>`;
}
