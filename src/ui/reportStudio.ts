import { EvaluatedSessionReport, EvaluatedReportRow, EvaluatedReportCell } from '../core/calculationTrace';
import { analyzeSourceCoverage } from '../core/coverage';
import { Dataset, Locality, ReportSession } from '../core/types';
import { escapeHtmlUi } from './cellInspector';

export function formatReportCellValue(
  cell: EvaluatedReportCell | undefined,
  displayUnit: string,
  moneyUnit: 'billion' | 'million' = 'billion'
): string {
  if (!cell) return 'Chưa có số liệu';
  const text = cell.displayedText;
  if (!text) return '';
  if (
    cell.state === 'OUT_OF_SCOPE' ||
    cell.state === 'NOT_APPLICABLE' ||
    cell.state === 'INVALID' ||
    cell.state === 'FORMULA_ERROR'
  ) {
    return text;
  }
  let result = text;
  if ((displayUnit === 'billion_vnd' || cell.unitLabel === 'tỷ đồng') && moneyUnit === 'billion') {
    if (!result.includes('tỷ') && !result.includes('triệu')) {
      if (/^[-+]?[\d.,\s]+$/.test(result.trim())) {
        result = `${result} tỷ`;
      }
    }
  }
  if (cell.adjustmentNote) {
    result = `${result} (${cell.adjustmentNote})`;
  }
  return result;
}

export function renderIndicatorLabelHtml(label: string): string {
  const escaped = escapeHtmlUi(label);
  return escaped.replace(/(\(?đến ngày[^\)]*\)?)/gi, '<strong>$1</strong>');
}

export interface LayoutDecision {
  mode: 'HORIZONTAL' | 'VERTICAL';
  userPreference: 'AUTO' | 'HORIZONTAL' | 'VERTICAL';
  reason: string;
  isAuto: boolean;
  pageCount: number;
}

export function computeAutoLayoutMode(params: {
  session: ReportSession;
  selectedCount: number;
  indicatorCount: number;
}): LayoutDecision {
  const { session, selectedCount, indicatorCount } = params;
  const userPref = session.settings.tableLayoutMode || 'AUTO';

  if (userPref === 'HORIZONTAL') {
    const maxCols = session.settings.paperSize === 'A3' ? 12 : 7;
    const pages = selectedCount === 0 ? 1 : Math.ceil(selectedCount / maxCols);
    return {
      mode: 'HORIZONTAL',
      userPreference: 'HORIZONTAL',
      reason: 'Người dùng chọn thủ công: Địa phương theo chiều ngang (Cột = Địa phương, Dòng = Chỉ tiêu)',
      isAuto: false,
      pageCount: pages,
    };
  }

  if (userPref === 'VERTICAL') {
    const maxRows = 18;
    const pages = selectedCount === 0 ? 1 : Math.ceil(selectedCount / maxRows);
    return {
      mode: 'VERTICAL',
      userPreference: 'VERTICAL',
      reason: 'Người dùng chọn thủ công: Địa phương theo chiều dọc (Dòng = Địa phương, Cột = Chỉ tiêu)',
      isAuto: false,
      pageCount: pages,
    };
  }

  // AUTO Mode: Decision logic optimized for A4 Landscape
  // If <= 7 localities, Horizontal layout fits on 1 single page without horizontal splitting
  if (selectedCount <= 7) {
    return {
      mode: 'HORIZONTAL',
      userPreference: 'AUTO',
      reason: `Đã tự động chọn bố cục Địa phương theo chiều ngang (${selectedCount} địa phương vừa vặn 1 trang A4 ngang)`,
      isAuto: true,
      pageCount: 1,
    };
  }

  // If > 7 localities:
  // In vertical layout, each page fits ~18 locality rows with 14 indicator columns on A4 landscape.
  // This avoids wide horizontal splitting when tracking 8..25 localities.
  if (selectedCount > 7 && selectedCount <= 35) {
    const pages = Math.ceil(selectedCount / 18);
    return {
      mode: 'VERTICAL',
      userPreference: 'AUTO',
      reason: `Đã tự động chọn bố cục Địa phương theo chiều dọc (${selectedCount} địa phương tối ưu đọc liên tục trên A4 ngang, chia ${pages} trang)`,
      isAuto: true,
      pageCount: pages,
    };
  }

  // For very large numbers of localities (> 35):
  const vertPages = Math.ceil(selectedCount / 18);
  return {
    mode: 'VERTICAL',
    userPreference: 'AUTO',
    reason: `Đã tự động chọn bố cục Địa phương theo chiều dọc (${selectedCount} địa phương, ${vertPages} trang A4 ngang)`,
    isAuto: true,
    pageCount: vertPages,
  };
}

export function renderA4DocumentStudioHtml(params: {
  evaluated: EvaluatedSessionReport;
  baselineLocalities: Locality[];
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  activeTraceId?: string;
  zoomScale?: number;
}): string {
  const { evaluated, baselineLocalities, datasets, activeTraceId, zoomScale = 1 } = params;
  const { session, selectedLocalities, rows } = evaluated;

  if (selectedLocalities.length === 0) {
    return `<div class="empty-studio-state">
      <div class="empty-studio-icon">📄</div>
      <h3 class="empty-studio-title">Phiên báo cáo "${escapeHtmlUi(session.name)}" đang có 0 địa phương được chọn</h3>
      <p class="empty-studio-desc">
        Theo chuẩn hành chính MASTER V2.2, phiên báo cáo mới khởi tạo rỗng (không mặc định xã/phường).
        Hãy chọn địa phương để xem ngay báo cáo tính toán thật trên khổ A4 ngang.
      </p>
      <div class="empty-studio-presets">
        <button type="button" class="btn btn-primary" data-nav-tab="LOCALITIES">
          <span class="btn-icon">📋</span> Mở Danh mục chọn địa phương (114 đơn vị)
        </button>
        <button type="button" class="btn btn-secondary" id="btn-empty-preset-5-xa">
          <span class="btn-icon">⚡</span> Xem nhanh mẫu 5 xã
        </button>
        <button type="button" class="btn btn-secondary" id="btn-empty-preset-7-phuong">
          <span class="btn-icon">⚡</span> Xem nhanh mẫu 7 phường
        </button>
        <button type="button" class="btn btn-secondary" id="btn-empty-preset-11-xa">
          <span class="btn-icon">⚡</span> Xem mẫu 11 xã (từ file mẫu)
        </button>
      </div>
    </div>`;
  }

  const layout = computeAutoLayoutMode({
    session,
    selectedCount: selectedLocalities.length,
    indicatorCount: rows.length,
  });

  const { bySource } = analyzeSourceCoverage(baselineLocalities, datasets);
  const revMissingNames =
    bySource.REV?.missingLocalities.map((m) => m.localityName).join(', ') || 'Không';
  const gpmbMissingNames =
    bySource.GPMB?.missingLocalities.map((m) => m.localityName).join(', ') || 'Không';

  const revDate = datasets.REV?.asOfDate || 'Chưa xác nhận';
  const disbDate = datasets.DISB?.asOfDate || '15/10/2026';
  const gpmbDate = datasets.GPMB?.asOfDate || '26/10/2026';

  // Build sheets based on layout mode
  let sheetsHtml = '';
  if (layout.mode === 'HORIZONTAL') {
    sheetsHtml = renderHorizontalPages({
      evaluated,
      session,
      selectedLocalities,
      rows,
      activeTraceId,
      disbDate,
      revDate,
      gpmbDate,
      revMissingNames,
      gpmbMissingNames,
    });
  } else {
    sheetsHtml = renderVerticalPages({
      evaluated,
      session,
      selectedLocalities,
      rows,
      activeTraceId,
      disbDate,
      revDate,
      gpmbDate,
      revMissingNames,
      gpmbMissingNames,
    });
  }

  const scaleStyle = zoomScale !== 1 ? `transform: scale(${zoomScale}); transform-origin: top center;` : '';

  return `<div class="a4-canvas-viewport">
    <div class="a4-canvas-canvas" style="${scaleStyle}">
      ${sheetsHtml}
    </div>
  </div>`;
}

function renderHorizontalPages(params: {
  evaluated: EvaluatedSessionReport;
  session: ReportSession;
  selectedLocalities: Locality[];
  rows: EvaluatedReportRow[];
  activeTraceId?: string;
  disbDate: string;
  revDate: string;
  gpmbDate: string;
  revMissingNames: string;
  gpmbMissingNames: string;
}): string {
  const {
    evaluated,
    session,
    selectedLocalities,
    rows,
    activeTraceId,
    disbDate,
    revDate,
    gpmbDate,
    revMissingNames,
    gpmbMissingNames,
  } = params;

  const maxCols = session.settings.paperSize === 'A3' ? 12 : 7;
  const chunks: Locality[][] = [];
  for (let i = 0; i < selectedLocalities.length; i += maxCols) {
    chunks.push(selectedLocalities.slice(i, i + maxCols));
  }
  if (chunks.length === 0) chunks.push([]);

  return chunks
    .map((chunk, pageIdx) => {
      const headerColsHtml = chunk
        .map(
          (loc) => `<th class="doc-th doc-th-locality" style="min-width:${session.settings.columnWidthPx || 120}px">
            <div class="doc-loc-name">${escapeHtmlUi(loc.displayName)}</div>
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

          const cellsHtml = chunk
            .map((loc) => {
              const cell = r.cellsByLocalityId[loc.id];
              if (!cell) {
                return `<td class="doc-td doc-cell-missing">Chưa có số liệu</td>`;
              }
              const isSelected = activeTraceId === cell.traceId;
              const warnIcon = cell.hasWarning
                ? `<span class="cell-warn-pill" title="Có cảnh báo chất lượng hoặc đối chiếu M">⚠</span>`
                : '';
              const noteIcon = cell.officialNote
                ? `<span class="cell-note-pill" title="Có ghi chú nguyên văn cột Q">📝</span>`
                : '';

              const formattedVal = formatReportCellValue(
                cell,
                r.indicator.displayUnit,
                session.settings.moneyUnit
              );

              return `<td class="doc-td doc-cell state-${escapeHtmlUi(
                cell.state
              )} quality-${escapeHtmlUi(cell.qualityStatus)} ${
                isSelected ? 'doc-cell-active' : ''
              }" tabindex="0" role="button" data-trace-id="${escapeHtmlUi(
                cell.traceId
              )}" data-locality-id="${escapeHtmlUi(
                loc.id
              )}" data-indicator-id="${escapeHtmlUi(
                r.indicator.id
              )}" title="Nhấn để xem cách tính chi tiết và nguồn số liệu">
                <div class="cell-content">
                  <span class="cell-val">${escapeHtmlUi(formattedVal)}</span>
                  ${warnIcon}${noteIcon}
                </div>
              </td>`;
            })
            .join('');

          const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
          return `<tr class="doc-row ${hasStt ? 'doc-row-primary' : 'doc-row-sub'}" data-row-number="${r.rowConfig.rowNumber}">
            <td class="doc-td doc-td-stt">${escapeHtmlUi(r.rowConfig.sttLabel || '')}</td>
            <td class="doc-td doc-td-indicator">
              <div class="indicator-name-group">
                <span class="indicator-name-text">${renderIndicatorLabelHtml(r.rowConfig.customLabel)}</span>
                <button type="button" class="btn-inline-edit-ind" data-indicator-id="${escapeHtmlUi(
                  r.indicator.id
                )}" data-row-number="${r.rowConfig.rowNumber}" title="Đổi tên hiển thị chỉ tiêu">✎</button>
              </div>
            </td>
            ${cellsHtml}
          </tr>`;
        })
        .join('');

      return renderPaperSheetHtml({
        session,
        contentHtml: `
          <div class="table-responsive">
            <table class="doc-table doc-table-horizontal">
              <thead>
                <tr>
                  <th class="doc-th doc-th-stt">STT</th>
                  <th class="doc-th doc-th-indicator">Chỉ tiêu / Kết quả thực hiện</th>
                  ${headerColsHtml}
                </tr>
              </thead>
              <tbody>
                ${bodyRowsHtml}
              </tbody>
            </table>
          </div>
        `,
        pageIdx: pageIdx + 1,
        totalPages: chunks.length,
        disbDate,
        revDate,
        gpmbDate,
        revMissingNames,
        gpmbMissingNames,
      });
    })
    .join('');
}

function renderVerticalPages(params: {
  evaluated: EvaluatedSessionReport;
  session: ReportSession;
  selectedLocalities: Locality[];
  rows: EvaluatedReportRow[];
  activeTraceId?: string;
  disbDate: string;
  revDate: string;
  gpmbDate: string;
  revMissingNames: string;
  gpmbMissingNames: string;
}): string {
  const {
    evaluated,
    session,
    selectedLocalities,
    rows,
    activeTraceId,
    disbDate,
    revDate,
    gpmbDate,
    revMissingNames,
    gpmbMissingNames,
  } = params;

  const maxRowsPerPage = 18;
  const chunks: Locality[][] = [];
  for (let i = 0; i < selectedLocalities.length; i += maxRowsPerPage) {
    chunks.push(selectedLocalities.slice(i, i + maxRowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  // Indicator column headers
  const displayRows = rows.filter((r) => r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT');
  const indicatorHeadersHtml = displayRows
    .map((r) => {
      const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
      const unitBadge =
        r.indicator.displayUnit === 'billion_vnd'
          ? session.settings.moneyUnit === 'billion'
            ? 'tỷ'
            : 'triệu'
          : r.indicator.displayUnit === 'm2'
          ? session.settings.areaUnit === 'ha'
            ? 'ha'
            : 'm²'
          : r.indicator.displayUnit === 'percent'
          ? '%'
          : '';
      const unitSuffix = unitBadge ? ` (${unitBadge})` : '';

      return `<th class="doc-th doc-th-ind-vert ${hasStt ? 'doc-th-primary' : 'doc-th-sub'}" title="${escapeHtmlUi(
        r.rowConfig.customLabel
      )}">
        <div class="ind-vert-name">${renderIndicatorLabelHtml(r.rowConfig.customLabel)}${escapeHtmlUi(unitSuffix)}</div>
      </th>`;
    })
    .join('');

  return chunks
    .map((chunk, pageIdx) => {
      const bodyRowsHtml = chunk
        .map((loc, locIdx) => {
          const globalStt = (pageIdx * maxRowsPerPage) + locIdx + 1;
          const cellsHtml = displayRows
            .map((r) => {
              const cell = r.cellsByLocalityId[loc.id];
              if (!cell) {
                return `<td class="doc-td doc-cell-missing">-</td>`;
              }
              const isSelected = activeTraceId === cell.traceId;
              const warnIcon = cell.hasWarning ? `<span class="cell-warn-pill">⚠</span>` : '';
              const noteIcon = cell.officialNote ? `<span class="cell-note-pill">📝</span>` : '';
              const formattedVal = formatReportCellValue(
                cell,
                r.indicator.displayUnit,
                session.settings.moneyUnit
              );

              return `<td class="doc-td doc-cell state-${escapeHtmlUi(
                cell.state
              )} ${isSelected ? 'doc-cell-active' : ''}" tabindex="0" role="button" data-trace-id="${escapeHtmlUi(
                cell.traceId
              )}" data-locality-id="${escapeHtmlUi(
                loc.id
              )}" data-indicator-id="${escapeHtmlUi(
                r.indicator.id
              )}" title="${escapeHtmlUi(loc.displayName)} — ${escapeHtmlUi(
                r.rowConfig.customLabel
              )}: ${escapeHtmlUi(formattedVal)}">
                <div class="cell-content">
                  <span class="cell-val">${escapeHtmlUi(formattedVal)}</span>
                  ${warnIcon}${noteIcon}
                </div>
              </td>`;
            })
            .join('');

          return `<tr class="doc-row">
            <td class="doc-td doc-td-stt">${globalStt}</td>
            <td class="doc-td doc-td-loc-name">
              <strong>${escapeHtmlUi(loc.displayName)}</strong>
            </td>
            ${cellsHtml}
          </tr>`;
        })
        .join('');

      return renderPaperSheetHtml({
        session,
        contentHtml: `
          <div class="table-responsive">
            <table class="doc-table doc-table-vertical">
              <thead>
                <tr>
                  <th class="doc-th doc-th-stt">STT</th>
                  <th class="doc-th doc-th-loc-name">Tên địa phương</th>
                  ${indicatorHeadersHtml}
                </tr>
              </thead>
              <tbody>
                ${bodyRowsHtml}
              </tbody>
            </table>
          </div>
        `,
        pageIdx: pageIdx + 1,
        totalPages: chunks.length,
        disbDate,
        revDate,
        gpmbDate,
        revMissingNames,
        gpmbMissingNames,
      });
    })
    .join('');
}

function renderPaperSheetHtml(params: {
  session: ReportSession;
  contentHtml: string;
  pageIdx: number;
  totalPages: number;
  disbDate: string;
  revDate: string;
  gpmbDate: string;
  revMissingNames: string;
  gpmbMissingNames: string;
}): string {
  const {
    session,
    contentHtml,
    pageIdx,
    totalPages,
    disbDate,
    revDate,
    gpmbDate,
    revMissingNames,
    gpmbMissingNames,
  } = params;

  const titleAlign = session.settings.titleAlign || 'center';
  const titleClass = session.settings.titleUppercase !== false ? 'text-uppercase' : '';
  const titleFontSize = session.settings.titleFontSizePx || 16;
  const isLastPage = pageIdx === totalPages;

  return `<div class="a4-paper-sheet a4-landscape" data-page-number="${pageIdx}">
    <!-- TIÊU ĐỀ BÁO CÁO (CĂN GIỮA) -->
    <div class="doc-title-block text-center">
      <h1 class="doc-title ${titleClass}" style="font-size:${titleFontSize}px" data-action="open-title-editor" title="Nhấp chuột vào tiêu đề để đổi tên báo cáo">
        ${escapeHtmlUi(session.settings.reportTitle)}
        <button type="button" class="btn-inline-pencil" title="Sửa tiêu đề báo cáo">✎</button>
      </h1>
    </div>

    <!-- BẢNG DỮ LIỆU TÍNH TOÁN -->
    <div class="doc-body-table">
      ${contentHtml}
    </div>
  </div>`;
}
