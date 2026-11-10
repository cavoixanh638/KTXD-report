import { EvaluatedSessionReport } from '../core/calculationTrace';
import { analyzeSourceCoverage, filterCoverageForSession } from '../core/coverage';
import { Dataset, Locality } from '../core/types';
import {
  formatReportCellValue,
  renderIndicatorLabelHtml,
  renderReportCellValueHtml,
  renderUncompletedProjectsTableHtml,
} from '../ui/reportStudio';
import { getUncompletedProjectsForSession } from '../core/uncompletedProjects';

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
  includeAppendix?: boolean;
}): string {
  const {
    evaluated,
    baselineLocalities,
    datasets,
    includeTraceAppendix = false,
    includeAppendix = true,
  } = params;
  const { session, selectedLocalities, rows, tracesById } = evaluated;

  const maxColsPerPage = session.settings.paperSize === 'A3' ? 12 : 7;
  const chunks: Locality[][] = [];
  if (selectedLocalities.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < selectedLocalities.length; i += maxColsPerPage) {
      chunks.push(selectedLocalities.slice(i, i + maxColsPerPage));
    }
  }

  const displayRows = rows.filter(
    (r) => r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT' && r.rowConfig.visible !== false
  );

  const uncompletedRes =
    datasets?.GPMB && baselineLocalities
      ? getUncompletedProjectsForSession({
          session,
          gpmbDataset: datasets.GPMB,
          baselineLocalities,
        })
      : null;

  const indWidth = session.settings.indicatorColumnWidthPx || 240;

  const pagesHtml = chunks
    .map((chunk, pageIdx) => {
      const headerCols = chunk
        .map((loc) => `<th class="doc-th-locality">${escapeHtml(loc.displayName)}</th>`)
        .join('');

      const bodyRows = displayRows
        .map((r) => {
          const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
          const cells = chunk
            .map((loc) => {
              const c = r.cellsByLocalityId[loc.id];
              const formattedVal = formatReportCellValue(
                c,
                r.indicator.displayUnit,
                session.settings.moneyUnit,
                session.settings.areaUnit
              );
              return `<td class="print-cell">${renderReportCellValueHtml(formattedVal)}</td>`;
            })
            .join('');
          return `<tr class="${hasStt ? 'doc-row-primary' : 'doc-row-sub'}">
            <td class="stt-col">${escapeHtml(r.rowConfig.sttLabel || '')}</td>
            <td class="label-col" style="width: ${indWidth}px; max-width: ${indWidth}px;">${renderIndicatorLabelHtml(r.rowConfig.customLabel)}</td>
            ${cells}
          </tr>`;
        })
        .join('');

      let uncompletedSummaryRow = '';
      if (session.settings.showUncompletedSummaryRow !== false && uncompletedRes) {
        const uncompletedCells = chunk
          .map((loc) => {
            const summaryText = uncompletedRes.summaryTextByLocalityId[loc.id] || 'Đã hoàn thành';
            return `<td class="print-cell" style="text-align: center; font-style: italic;">${escapeHtml(
              summaryText
            )}</td>`;
          })
          .join('');

        uncompletedSummaryRow = `<tr class="doc-row-sub">
          <td class="stt-col"></td>
          <td class="label-col" style="width: ${indWidth}px; max-width: ${indWidth}px; font-style: italic;">${escapeHtml(
            session.settings.uncompletedRowCustomLabel || 'Trong đó: Số dự án GPMB chưa hoàn thành'
          )}</td>
          ${uncompletedCells}
        </tr>`;
      }

      const appendixProjectsHtml =
        pageIdx === chunks.length - 1 &&
        session.settings.showUncompletedProjectsTable !== false &&
        datasets?.GPMB &&
        baselineLocalities
          ? renderUncompletedProjectsTableHtml({
              session,
              gpmbDataset: datasets.GPMB,
              baselineLocalities,
              isPrintMode: true,
            })
          : '';

      return `<section class="print-page-chunk">
        <div class="print-title-center">
          <h2>${escapeHtml(session.settings.reportTitle)} ${
            chunks.length > 1 ? `(Phần ${pageIdx + 1}/${chunks.length})` : ''
          }</h2>
          ${
            session.settings.showSubtitle && session.settings.subtitle
              ? `<div class="print-subtitle-block"><em>${escapeHtml(session.settings.subtitle)}</em></div>`
              : ''
          }
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th class="stt-col">STT</th>
              <th class="label-col" style="width: ${indWidth}px; max-width: ${indWidth}px;">Chỉ tiêu / Kết quả thực hiện</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            ${uncompletedSummaryRow}
          </tbody>
        </table>
        ${appendixProjectsHtml}
      </section>`;
    })
    .join('\n');

  let appendixHtml = '';
  if (includeAppendix) {
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
          <td>${Number(i.expected).toFixed(2)}%</td>
          <td>${Number(i.delta).toFixed(2)} pp</td>
          <td>M khác 100*I/D &gt; 0,1 điểm % (${i.explanation})</td>
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

    appendixHtml = `
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
    `;
  }

  return `<div class="printable-report-container" data-paper="${session.settings.paperSize}" data-orientation="${session.settings.orientation}">
    ${pagesHtml}
    ${appendixHtml}
  </div>`;
}
