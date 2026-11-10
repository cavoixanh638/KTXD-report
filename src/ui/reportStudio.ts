import { EvaluatedSessionReport, EvaluatedReportRow, EvaluatedReportCell } from '../core/calculationTrace';
import { analyzeSourceCoverage } from '../core/coverage';
import { Dataset, Locality, ReportSession } from '../core/types';
import { escapeHtmlUi } from './cellInspector';
import {
  getUncompletedProjectsForSession,
  getNq11ProjectsForSession,
  UncompletedProject,
} from '../core/uncompletedProjects';

export function formatReportCellValue(
  cell: EvaluatedReportCell | undefined,
  displayUnit: string,
  moneyUnit: 'billion' | 'million' = 'billion',
  areaUnit: 'm2' | 'ha' = 'm2'
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
  if (displayUnit === 'm2' || cell.unitLabel === 'm²' || cell.unitLabel === 'm2' || cell.unitLabel === 'ha') {
    if (!result.includes('m2') && !result.includes('m²') && !result.includes('ha')) {
      if (/^[-+]?[\d.,\s]+$/.test(result.trim())) {
        const u = areaUnit === 'ha' || cell.unitLabel === 'ha' ? 'ha' : 'm2';
        result = `${result} ${u}`;
      }
    }
  }
  if (cell.adjustmentNote) {
    result = `${result} (${cell.adjustmentNote})`;
  }
  return result;
}

export function renderReportCellValueHtml(formattedVal: string): string {
  if (!formattedVal) return '';
  const escaped = escapeHtmlUi(formattedVal);
  const match = escaped.match(/^([\s\S]+?)\s*(\([^)]+\))$/);
  if (match) {
    const mainVal = match[1].trim();
    const subNote = match[2].trim();
    return `<span class="val-primary">${mainVal}</span> <span class="val-note">${subNote}</span>`;
  }
  return `<span class="val-primary">${escaped}</span>`;
}

export function renderIndicatorLabelHtml(label: string): string {
  const escaped = escapeHtmlUi(label);
  return escaped.replace(/(\(?đến ngày[^\)]*\)?)/gi, '<strong>$1</strong>');
}

export function renderUncompletedProjectsTableHtml(params: {
  session: ReportSession;
  gpmbDataset?: Dataset;
  baselineLocalities: Locality[];
  isPrintMode?: boolean;
}): string {
  const { session, gpmbDataset, baselineLocalities, isPrintMode = false } = params;

  const uncompletedRes = getUncompletedProjectsForSession({
    session,
    gpmbDataset,
    baselineLocalities,
  });

  const { projects } = uncompletedRes;
  if (projects.length === 0) {
    return '';
  }

  // If hidden by user:
  if (session.settings.showUncompletedProjectsTable === false) {
    if (isPrintMode) {
      return '';
    }
    return `<div class="doc-appendix-projects-hidden no-print">
      <button type="button" class="btn btn-sm btn-outline-primary" id="btn-toggle-projects-table" title="Nhấp để hiện lại bảng danh mục chi tiết các dự án GPMB">
        <span>👁</span> Hiện bảng chi tiết danh mục dự án GPMB (${projects.length} dự án)
      </button>
    </div>`;
  }

  const rowsHtml = projects
    .map((p, idx) => {
      const editBtn = isPrintMode
        ? ''
        : `<td class="text-center no-print" style="width: 70px;">
            <button type="button" class="btn-action-edit-proj" data-project-id="${escapeHtmlUi(
              p.id
            )}" title="Sửa tên, tỷ lệ, hạn hoàn thành">✎ Sửa</button>
          </td>`;

      return `<tr>
        <td class="stt-col" style="text-align: center; width: 32px;">${idx + 1}</td>
        <td class="loc-col" style="text-align: center; width: 140px; font-weight: 600;">${escapeHtmlUi(
          p.localityName
        )}</td>
        <td class="proj-name-col" style="text-align: left; white-space: normal; word-wrap: break-word;">${escapeHtmlUi(
          p.projectName
        )}</td>
        <td class="rate-col" style="text-align: center; width: 130px; font-weight: 600;">${escapeHtmlUi(
          p.completionRate
        )}</td>
        <td class="deadline-col" style="text-align: center; width: 130px;">${escapeHtmlUi(
          p.deadline
        )}</td>
        ${editBtn}
      </tr>`;
    })
    .join('');

  const tableClass = isPrintMode
    ? 'print-table projects-print-table'
    : 'doc-table projects-table';
  const actionsTh = isPrintMode
    ? ''
    : `<th class="no-print" style="width: 70px; text-align: center;">Thao tác</th>`;

  const toolbarHtml = isPrintMode
    ? ''
    : `<div class="projects-block-toolbar no-print">
        <button type="button" class="btn btn-sm btn-outline-primary" id="btn-add-custom-project" title="Thêm dự án vào danh sách">
          <span>+</span> Thêm dự án
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-toggle-projects-table" title="Ẩn bảng danh mục dự án">
          <span>👁</span> Ẩn bảng chi tiết dự án
        </button>
      </div>`;

  return `<div class="doc-appendix-projects">
    <div class="projects-header-wrap">
      <h3 class="projects-title-text">DANH MỤC CÁC DỰ ÁN GPMB CHƯA HOÀN THÀNH</h3>
      ${toolbarHtml}
    </div>
    <div class="table-responsive">
      <table class="${tableClass}">
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">STT</th>
            <th style="width: 140px; text-align: center;">Địa phương</th>
            <th style="text-align: left;">Tên dự án</th>
            <th style="width: 130px; text-align: center;">Tỷ lệ hoàn thành</th>
            <th style="width: 130px; text-align: center;">Hạn hoàn thành</th>
            ${actionsTh}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>`;
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
    const isSplit = Boolean(
      session.settings.splitRow8ToNewPage &&
        session.settings.showUncompletedSummaryRow !== false
    );
    const pages = isSplit ? 2 : 1;
    return {
      mode: 'HORIZONTAL',
      userPreference: 'AUTO',
      reason: isSplit
        ? `Đã chọn bố cục Địa phương theo chiều ngang (tách ${pages} trang: trang 1 chỉ tiêu 1–7, trang 2 dự án GPMB)`
        : `Đã tự động chọn bố cục Địa phương theo chiều ngang (${selectedCount} địa phương vừa vặn 1 trang A4 ngang)`,
      isAuto: true,
      pageCount: pages,
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
      datasets,
      baselineLocalities,
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
      datasets,
      baselineLocalities,
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
  datasets?: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  baselineLocalities?: Locality[];
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
    datasets,
    baselineLocalities,
  } = params;

  const uncompletedRes =
    datasets?.GPMB && baselineLocalities
      ? getUncompletedProjectsForSession({
          session,
          gpmbDataset: datasets.GPMB,
          baselineLocalities,
        })
      : null;

  const indWidth = session.settings.indicatorColumnWidthPx || 240;

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
          (loc) => `<th class="doc-th doc-th-locality"${session.settings.columnWidthPx ? ` style="width:${session.settings.columnWidthPx}px"` : ''}>
            <div class="doc-loc-name">${escapeHtmlUi(loc.displayName)}</div>
          </th>`
        )
        .join('');

      const displayRows = rows.filter((r) => r.indicator.id !== 'DISB_PLAN_VS_AVG_COMMENT');
      const bodyRowsHtml = displayRows
        .map((r) => {
          const cellsHtml = chunk
            .map((loc) => {
              const cell = r.cellsByLocalityId[loc.id];
              if (!cell) {
                return `<td class="doc-td doc-cell-missing">Chưa có số liệu</td>`;
              }
              const isSelected = activeTraceId === cell.traceId;
              const formattedVal = formatReportCellValue(
                cell,
                r.indicator.displayUnit,
                session.settings.moneyUnit,
                session.settings.areaUnit
              );

              return `<td class="doc-td doc-cell state-${escapeHtmlUi(
                cell.state
              )} quality-${escapeHtmlUi(cell.qualityStatus)} ${cell.hasWarning ? 'has-warning' : ''} ${cell.officialNote ? 'has-note' : ''} ${
                isSelected ? 'doc-cell-active' : ''
              }" tabindex="0" role="button" data-trace-id="${escapeHtmlUi(
                cell.traceId
              )}" data-locality-id="${escapeHtmlUi(
                loc.id
              )}" data-indicator-id="${escapeHtmlUi(
                r.indicator.id
              )}" title="Nhấn để xem cách tính chi tiết và nguồn số liệu">
                <div class="cell-content">
                  <span class="cell-val">${renderReportCellValueHtml(formattedVal)}</span>
                </div>
              </td>`;
            })
            .join('');

          const hasStt = Boolean(r.rowConfig.sttLabel && r.rowConfig.sttLabel.trim());
          return `<tr class="doc-row ${hasStt ? 'doc-row-primary' : 'doc-row-sub'}" data-row-number="${r.rowConfig.rowNumber}">
            <td class="doc-td doc-td-stt">${escapeHtmlUi(r.rowConfig.sttLabel || '')}</td>
            <td class="doc-td doc-td-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px;">
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

      let uncompletedSummaryRowHtml = '';
      if (session.settings.showUncompletedSummaryRow !== false && uncompletedRes) {
        // 1. Dòng chính STT 8: Số dự án chưa hoàn thành GPMB
        const row8CellsHtml = chunk
          .map((loc) => {
            const summaryText = uncompletedRes.summaryTextByLocalityId[loc.id] || 'Đã hoàn thành';
            return `<td class="doc-td doc-cell state-VALUE quality-DIRECT_SOURCE" style="text-align: center; vertical-align: top; font-weight: 600;">
              <div class="cell-content">
                <span class="cell-val"><span class="val-primary">${escapeHtmlUi(summaryText)}</span></span>
              </div>
            </td>`;
          })
          .join('');

        const row8Html = `<tr class="doc-row doc-row-primary doc-row-uncompleted-count" data-row-type="uncompleted-count">
          <td class="doc-td doc-td-stt" style="vertical-align: top;">8</td>
          <td class="doc-td doc-td-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px; vertical-align: top;">
            <div class="indicator-name-group">
              <span class="indicator-name-text" style="font-weight: 600;">${escapeHtmlUi(
                session.settings.uncompletedRowCustomLabel || 'Số dự án chưa hoàn thành GPMB'
              )}</span>
              <button type="button" class="btn-inline-edit-ind" id="btn-edit-uncompleted-label" title="Đổi tên dòng số dự án chưa hoàn thành">✎</button>
            </div>
          </td>
          ${row8CellsHtml}
        </tr>`;

        // 2. Dòng con ngay dưới dòng 8 (không STT): Tên dự án chưa hoàn thành GPMB
        const projFontPt = session.settings.uncompletedProjectsFontSizePt;
        const subRowCellsHtml = chunk
          .map((loc) => {
            const projListHtml =
              uncompletedRes.projectListHtmlByLocalityId[loc.id] ||
              '<div class="text-muted" style="text-align: center;">-</div>';
            return `<td class="doc-td doc-cell doc-cell-proj-list state-VALUE quality-DIRECT_SOURCE" style="text-align: left; vertical-align: top; padding: 2pt 3.5pt; ${
              projFontPt ? `font-size: ${projFontPt}pt;` : ''
            }">
              ${projListHtml}
            </td>`;
          })
          .join('');

        const subRowHtml = `<tr class="doc-row doc-row-sub doc-row-uncompleted-names" data-row-type="uncompleted-names">
          <td class="doc-td doc-td-stt" style="vertical-align: top;"></td>
          <td class="doc-td doc-td-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px; vertical-align: top;">
            <div class="indicator-name-group">
              <span class="indicator-name-text" style="font-style: italic; font-weight: normal;">${escapeHtmlUi(
                session.settings.uncompletedProjectsListCustomLabel || 'Tên dự án chưa hoàn thành GPMB'
              )}</span>
              <button type="button" class="btn-inline-edit-ind no-print" id="btn-edit-uncompleted-list-label" title="Đổi tên dòng danh sách dự án">✎</button>
              <span class="proj-font-ctrls no-print" style="margin-left: 6px; display: inline-flex; align-items: center; gap: 2px;">
                <button type="button" class="btn-inline-font-ctrl" id="btn-quick-dec-proj-font" title="Giảm cỡ chữ danh sách dự án (hiện tại: ${projFontPt || 8}pt)">-A</button>
                <span style="font-size: 10px; color: #64748b; padding: 0 2px;">${projFontPt || 8}pt</span>
                <button type="button" class="btn-inline-font-ctrl" id="btn-quick-inc-proj-font" title="Tăng cỡ chữ danh sách dự án (hiện tại: ${projFontPt || 8}pt)">+A</button>
              </span>
            </div>
          </td>
          ${subRowCellsHtml}
        </tr>`;

        uncompletedSummaryRowHtml = `${row8Html}\n${subRowHtml}`;
      }

      let nq11RowHtml = '';
      if (session.settings.showNq11Row !== false) {
        const nq11Res = getNq11ProjectsForSession({
          session,
          selectedLocalities: chunk,
        });

        const projFontPt = session.settings.uncompletedProjectsFontSizePt;
        const nq11CellsHtml = chunk
          .map((loc) => {
            const cellHtml =
              nq11Res.htmlByLocalityId[loc.id] ||
              '<div class="text-muted" style="text-align: center;">-</div>';
            return `<td class="doc-td doc-cell doc-cell-nq11-list state-VALUE quality-DIRECT_SOURCE" style="text-align: left; vertical-align: top; padding: 2pt 3.5pt; ${
              projFontPt ? `font-size: ${projFontPt}pt;` : ''
            }">
              ${cellHtml}
            </td>`;
          })
          .join('');

        nq11RowHtml = `<tr class="doc-row doc-row-primary doc-row-nq11" data-row-type="nq11">
          <td class="doc-td doc-td-stt" style="vertical-align: top;">9</td>
          <td class="doc-td doc-td-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px; vertical-align: top;">
            <div class="indicator-name-group">
              <span class="indicator-name-text" style="font-weight: 600;">${escapeHtmlUi(
                session.settings.nq11RowCustomLabel || 'Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc'
              )}</span>
              <button type="button" class="btn-inline-edit-ind no-print" id="btn-edit-nq11-label" title="Đổi tên dòng 9">✎</button>
              <button type="button" class="btn btn-xs btn-outline-primary no-print btn-add-nq11-global" style="margin-left: 6px; padding: 1px 6px; font-size: 10px; height: 18px; line-height: 16px;" title="Thêm dự án NQ 11">+ Thêm</button>
            </div>
          </td>
          ${nq11CellsHtml}
        </tr>`;
      }

      const appendixProjectsHtml =
        pageIdx === chunks.length - 1 &&
        datasets?.GPMB &&
        baselineLocalities
          ? renderUncompletedProjectsTableHtml({
              session,
              gpmbDataset: datasets.GPMB,
              baselineLocalities,
              isPrintMode: false,
            })
          : '';

      const isSplit = Boolean(
        session.settings.splitRow8ToNewPage &&
          (uncompletedSummaryRowHtml || nq11RowHtml)
      );

      if (isSplit) {
        const totalPages = chunks.length * 2;
        const page1 = renderPaperSheetHtml({
          session,
          contentHtml: `
            <div class="table-responsive">
              <table class="doc-table doc-table-horizontal">
                <thead>
                  <tr>
                    <th class="doc-th doc-th-stt">STT</th>
                    <th class="doc-th doc-th-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px;">Chỉ tiêu / Kết quả thực hiện</th>
                    ${headerColsHtml}
                  </tr>
                </thead>
                <tbody>
                  ${bodyRowsHtml}
                </tbody>
              </table>
            </div>
          `,
          pageIdx: pageIdx * 2 + 1,
          totalPages,
          disbDate,
          revDate,
          gpmbDate,
          revMissingNames,
          gpmbMissingNames,
          isContinuationPage: false,
        });

        const page2 = renderPaperSheetHtml({
          session,
          contentHtml: `
            <div class="table-responsive">
              <table class="doc-table doc-table-horizontal">
                <thead>
                  <tr>
                    <th class="doc-th doc-th-stt">STT</th>
                    <th class="doc-th doc-th-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px;">Chỉ tiêu / Kết quả thực hiện</th>
                    ${headerColsHtml}
                  </tr>
                </thead>
                <tbody>
                  ${uncompletedSummaryRowHtml}
                  ${nq11RowHtml}
                </tbody>
              </table>
            </div>
            ${appendixProjectsHtml}
          `,
          pageIdx: pageIdx * 2 + 2,
          totalPages,
          disbDate,
          revDate,
          gpmbDate,
          revMissingNames,
          gpmbMissingNames,
          isContinuationPage: true,
        });

        return `${page1}\n${page2}`;
      }

      return renderPaperSheetHtml({
        session,
        contentHtml: `
          <div class="table-responsive">
            <table class="doc-table doc-table-horizontal">
              <thead>
                <tr>
                  <th class="doc-th doc-th-stt">STT</th>
                  <th class="doc-th doc-th-indicator" style="width: ${indWidth}px; max-width: ${indWidth}px;">Chỉ tiêu / Kết quả thực hiện</th>
                  ${headerColsHtml}
                </tr>
              </thead>
              <tbody>
                ${bodyRowsHtml}
                ${uncompletedSummaryRowHtml}
                ${nq11RowHtml}
              </tbody>
            </table>
          </div>
          ${appendixProjectsHtml}
        `,
        pageIdx: pageIdx + 1,
        totalPages: chunks.length,
        disbDate,
        revDate,
        gpmbDate,
        revMissingNames,
        gpmbMissingNames,
        isContinuationPage: false,
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
  datasets?: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  baselineLocalities?: Locality[];
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
    datasets,
    baselineLocalities,
  } = params;

  const uncompletedRes =
    datasets?.GPMB && baselineLocalities
      ? getUncompletedProjectsForSession({
          session,
          gpmbDataset: datasets.GPMB,
          baselineLocalities,
        })
      : null;

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

  const uncompletedHeadersTh =
    session.settings.showUncompletedSummaryRow !== false && uncompletedRes
      ? `<th class="doc-th doc-th-ind-vert doc-th-primary" title="Số dự án chưa hoàn thành GPMB">
          <div class="ind-vert-name"><strong>8. ${escapeHtmlUi(
            session.settings.uncompletedRowCustomLabel || 'Số DA chưa hoàn thành GPMB'
          )}</strong></div>
        </th>
        <th class="doc-th doc-th-ind-vert doc-th-sub" title="Tên dự án chưa hoàn thành GPMB">
          <div class="ind-vert-name">${escapeHtmlUi(
            session.settings.uncompletedProjectsListCustomLabel || 'Tên DA chưa hoàn thành GPMB'
          )}</div>
        </th>`
      : '';

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
              const formattedVal = formatReportCellValue(
                cell,
                r.indicator.displayUnit,
                session.settings.moneyUnit,
                session.settings.areaUnit
              );

              return `<td class="doc-td doc-cell state-${escapeHtmlUi(
                cell.state
              )} quality-${escapeHtmlUi(cell.qualityStatus)} ${cell.hasWarning ? 'has-warning' : ''} ${cell.officialNote ? 'has-note' : ''} ${isSelected ? 'doc-cell-active' : ''}" tabindex="0" role="button" data-trace-id="${escapeHtmlUi(
                cell.traceId
              )}" data-locality-id="${escapeHtmlUi(
                loc.id
              )}" data-indicator-id="${escapeHtmlUi(
                r.indicator.id
              )}" title="${escapeHtmlUi(loc.displayName)} — ${escapeHtmlUi(
                r.rowConfig.customLabel
              )}: ${escapeHtmlUi(formattedVal)}">
                <div class="cell-content">
                  <span class="cell-val">${renderReportCellValueHtml(formattedVal)}</span>
                </div>
              </td>`;
            })
            .join('');

          const uncompletedTds =
            session.settings.showUncompletedSummaryRow !== false && uncompletedRes
              ? `<td class="doc-td doc-cell" style="text-align: center; font-weight: 600;">
                  <div class="cell-content">
                    <span class="cell-val"><span class="val-primary">${escapeHtmlUi(
                      uncompletedRes.summaryTextByLocalityId[loc.id] || 'Đã hoàn thành'
                    )}</span></span>
                  </div>
                </td>
                <td class="doc-td doc-cell" style="text-align: left; vertical-align: top; padding: 3pt 4pt;">
                  ${uncompletedRes.projectListHtmlByLocalityId[loc.id] || '<span class="text-muted">-</span>'}
                </td>`
              : '';

          return `<tr class="doc-row">
            <td class="doc-td doc-td-stt">${globalStt}</td>
            <td class="doc-td doc-td-loc-name">
              <strong>${escapeHtmlUi(loc.displayName)}</strong>
            </td>
            ${cellsHtml}
            ${uncompletedTds}
          </tr>`;
        })
        .join('');

      const appendixProjectsHtml =
        pageIdx === chunks.length - 1 &&
        datasets?.GPMB &&
        baselineLocalities
          ? renderUncompletedProjectsTableHtml({
              session,
              gpmbDataset: datasets.GPMB,
              baselineLocalities,
              isPrintMode: false,
            })
          : '';

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
                  ${uncompletedHeadersTh}
                </tr>
              </thead>
              <tbody>
                ${bodyRowsHtml}
              </tbody>
            </table>
          </div>
          ${appendixProjectsHtml}
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
  isContinuationPage?: boolean;
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
    isContinuationPage = false,
  } = params;

  const titleAlign = session.settings.titleAlign || 'center';
  const titleClass = session.settings.titleUppercase !== false ? 'text-uppercase' : '';
  const titleFontSize = session.settings.titleFontSizePx || 16;
  const isLastPage = pageIdx === totalPages;

  return `<div class="a4-paper-sheet a4-landscape" data-page-number="${pageIdx}">
    ${
      totalPages > 1
        ? `<div class="doc-page-badge no-print" style="position: absolute; top: 10px; right: 14px; font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; font-family: sans-serif;">Trang ${pageIdx}/${totalPages}</div>`
        : ''
    }
    <!-- TIÊU ĐỀ BÁO CÁO (CĂN GIỮA) -->
    <div class="doc-title-block text-center">
      <h1 class="doc-title ${titleClass}" style="font-size:${titleFontSize}px" data-action="open-title-editor" title="Nhấp chuột vào tiêu đề để đổi tên báo cáo">
        ${escapeHtmlUi(session.settings.reportTitle)}${
          isContinuationPage
            ? ' <span class="title-continuation" style="font-size: 0.85em; font-weight: normal; font-style: italic; text-transform: none;">(tiếp theo)</span>'
            : ''
        }
        <button type="button" class="btn-inline-pencil" title="Sửa tiêu đề báo cáo">✎</button>
      </h1>
      ${
        !isContinuationPage && session.settings.showSubtitle && session.settings.subtitle
          ? `<div class="doc-subtitle-block text-center" data-action="open-title-editor" title="Nhấp chuột để sửa hoặc ẩn dòng chữ nhỏ">
              <em class="doc-subtitle-text">${escapeHtmlUi(session.settings.subtitle)}</em>
              <button type="button" class="btn-inline-pencil" title="Sửa dòng chữ nhỏ">✎</button>
            </div>`
          : ''
      }
    </div>

    <!-- BẢNG DỮ LIỆU TÍNH TOÁN -->
    <div class="doc-body-table">
      ${contentHtml}
    </div>
  </div>`;
}
