import { EvaluatedSessionReport } from '../core/calculationTrace';
import { isSharedReportIndicator } from '../core/indicators';
import { Dataset, Locality } from '../core/types';
import { escapeHtmlUi } from './cellInspector';
import {
  formatReportCellValue,
  renderIndicatorLabelHtml,
  renderReportCellValueHtml,
} from './reportStudio';

export function renderReportGridHtml(params: {
  evaluated: EvaluatedSessionReport;
  baselineLocalities: Locality[];
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  activeTraceId?: string;
}): string {
  const { evaluated, activeTraceId } = params;
  const { session, selectedLocalities, rows } = evaluated;

  if (selectedLocalities.length === 0) {
    return `<div class="empty-session-banner">
      <h3>Phiên báo cáo "${escapeHtmlUi(session.name)}" hiện có 0 địa phương được chọn</h3>
      <p>Theo quy tắc chuẩn MASTER V2.2, phiên mới khởi tạo với danh sách địa phương rỗng (không chọn sẵn 11 xã mẫu). Hãy bấm nút chọn nhanh bên dưới hoặc chuyển sang thẻ <strong>"3. Chọn địa phương"</strong> để chọn 1, 5, 7, 11 hoặc số lượng xã/phường/đặc khu bất kỳ.</p>
      <div class="empty-session-actions">
        <button type="button" class="btn btn-primary" data-nav-tab="LOCALITIES">Chuyển tới Thẻ 3. Chọn địa phương (114 đơn vị)</button>
        <button type="button" class="btn btn-secondary" id="btn-empty-preset-5-xa">Xem ngay mẫu 5 xã</button>
        <button type="button" class="btn btn-secondary" id="btn-empty-preset-7-phuong">Xem ngay mẫu 7 phường</button>
      </div>
    </div>`;
  }

  const headerColsHtml = selectedLocalities
    .map(
      (loc) => `<th class="locality-col-header" style="min-width:${session.settings.columnWidthPx}px">
        <div class="loc-header-name">${escapeHtmlUi(loc.displayName)}</div>
      </th>`
    )
    .join('');

  const displayRows = rows.filter((r) => r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT');
  const bodyRowsHtml = displayRows
    .map((r) => {
      const unitBadge =
        r.indicator.displayUnit === 'billion_vnd'
          ? session.settings.moneyUnit === 'billion'
            ? 'tỷ đồng'
            : 'triệu đồng'
          : r.indicator.displayUnit === 'm2'
          ? session.settings.areaUnit === 'ha'
            ? 'ha'
            : 'm²'
          : r.indicator.displayUnit === 'percent'
          ? '%'
          : 'nhận xét';

      const shared = isSharedReportIndicator(r.indicator.id);
      const span = shared && selectedLocalities.length > 1 ? ` colspan="${selectedLocalities.length}"` : '';
      const cellsHtml = (shared ? selectedLocalities.slice(0, 1) : selectedLocalities)
        .map((loc) => {
          const cell = r.cellsByLocalityId[loc.id];
          if (!cell) {
            return `<td class="report-cell cell-missing"${span}>Chưa có số liệu</td>`;
          }
          const isSelected = activeTraceId === cell.traceId;
          const warnBadge = cell.hasWarning
            ? `<span class="cell-warn-icon" title="Có cảnh báo chất lượng hoặc ghi chú nguồn">⚠</span>`
            : '';
          const noteBadge = cell.officialNote
            ? `<span class="cell-note-icon" title="Có ghi chú cột Q nguyên văn">📝</span>`
            : '';

          const formattedVal = formatReportCellValue(
            cell,
            r.indicator.displayUnit,
            session.settings.moneyUnit,
            session.settings.areaUnit
          );

          return `<td class="report-cell state-${escapeHtmlUi(
            cell.state
          )} quality-${escapeHtmlUi(cell.qualityStatus)} ${
            isSelected ? 'cell-selected' : ''
          }"${span} tabindex="0" role="button" data-trace-id="${escapeHtmlUi(
            cell.traceId
          )}" data-locality-id="${escapeHtmlUi(
            loc.id
          )}" data-indicator-id="${escapeHtmlUi(r.indicator.id)}">
            <div class="cell-main-val">${renderReportCellValueHtml(formattedVal)} ${warnBadge}${noteBadge}</div>
          </td>`;
        })
        .join('');

      const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
      return `<tr class="${hasStt ? 'doc-row-primary' : 'doc-row-sub'}" data-row-number="${r.rowConfig.rowNumber}" data-indicator-id="${escapeHtmlUi(
        r.indicator.id
      )}">
        <td class="sticky-col stt-col">${escapeHtmlUi(r.rowConfig.sttLabel || '')}</td>
        <td class="sticky-col indicator-col">
          <div class="ind-label">${renderIndicatorLabelHtml(r.rowConfig.customLabel)}</div>
        </td>
        ${cellsHtml}
      </tr>`;
    })
    .join('');

  return `<div class="report-grid-wrapper" style="font-family:${escapeHtmlUi(
    session.settings.fontFamily
  )}; font-size:${session.settings.fontSizePx}px">
    <div class="report-title-banner" style="text-align: center">
      <h2>${escapeHtmlUi(session.settings.reportTitle)}</h2>
    </div>

    <div class="table-scroll-container">
      <table class="ktxh-report-table">
        <thead>
          <tr>
            <th class="sticky-col stt-col">STT</th>
            <th class="sticky-col indicator-col">Chỉ tiêu / Kết quả</th>
            ${headerColsHtml}
          </tr>
        </thead>
        <tbody>
          ${bodyRowsHtml}
        </tbody>
      </table>
    </div>

  </div>`;
}
