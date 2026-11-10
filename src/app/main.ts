import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  confirmDatasetAsOfDate,
  createReportSession,
  cloneReportSession,
  deleteReportSession,
  setSessionLocalities,
  resolveSessionDatasets,
  migrateLegacySessionLabels,
  syncReportLabelsWithDatasetDates,
  formatVnDate,
  formatIsoDate,
} from '../core/sessions';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
  detectSheetFingerprint,
  parseXlsxBytes,
  parseWorkbookBytes,
} from '../core/sourceReaders';
import {
  evaluateSessionReport,
  EvaluatedSessionReport,
} from '../core/calculationTrace';
import { analyzeSourceCoverage } from '../core/coverage';
import { summarizeDatasetWarnings, filterWarningsForSession } from '../core/warnings';
import { searchLocalities } from '../core/localities';
import { renderA4DocumentStudioHtml, computeAutoLayoutMode } from '../ui/reportStudio';
import { renderReportGridHtml } from '../ui/reportGrid';
import { renderTraceInspectorHtml, renderCellTracePopoverHtml, escapeHtmlUi } from '../ui/cellInspector';
import { exportSessionReportToXlsxBytes } from '../export/xlsx';
import { generatePrintableReportHtml } from '../export/print';
import {
  exportWorkspaceBackupJson,
  restoreWorkspaceFromBackupJson,
} from '../backup/workspace';
import { saveWorkspacePersistent, loadWorkspacePersistent } from '../core/storage';
import { CalculationTrace, LocalityType, Workspace, QualityIssue, ReportSession, Dataset } from '../core/types';
import { getUncompletedProjectsForSession } from '../core/uncompletedProjects';

declare global {
  interface Window {
    __EMBEDDED_REFERENCE_FIXTURES__?: {
      DISB_B64: string;
      REV_B64: string;
      GPMB_B64: string;
    };
    __KTXH_APP__?: KtxhOfflineApp;
  }
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binString = atob(b64);
  const len = binString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

export type RightPanelMode = 'NONE' | 'TRACE' | 'TITLE' | 'INDICATORS' | 'WARNINGS';

export class KtxhOfflineApp {
  public workspace: Workspace;
  public activeTab:
    | 'STUDIO'
    | 'SESSIONS'
    | 'IMPORT'
    | 'LOCALITIES'
    | 'REPORT'
    | 'INSPECTOR'
    | 'BENCHMARKS'
    | 'EXPORT' = 'REPORT';

  public isSidebarCollapsed = false;
  public rightPanelMode: RightPanelMode = 'NONE';
  public activeTraceId: string | undefined;
  public activeTrace: CalculationTrace | null = null;
  public activeTraceExtraMeta?: {
    officialNote?: string | null;
    inspectionMarker?: string | null;
  };

  // Popover state
  public popoverCell: {
    traceId: string;
    localityId: string;
    indicatorId: string;
    clientX: number;
    clientY: number;
  } | null = null;

  // Filter & Search states
  public localitySearchQuery = '';
  public localityTypeFilter: 'ALL' | LocalityType = 'ALL';
  public localityCoverageFilter: 'ALL' | 'COMPLETE' | 'MISSING' = 'ALL';
  public localitySortOption: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'TYPE' | 'SELECTED_FIRST' = 'SELECTED_FIRST';
  public warningRuleFilter = 'ALL';

  // Status & Autosave states
  public statusBannerMessage = '';
  public statusBannerType: 'info' | 'warning' | 'error' | 'success' = 'info';
  public lastSavedTimestamp = '';
  public isSaving = false;
  public autosaveTimer: number | null = null;
  public zoomScale = 1;
  public isPrintPreviewActive = false;

  // Uncompleted Projects editor state
  public editingProjectId: string | null = null;
  public isAddingProject = false;

  constructor() {
    this.workspace = createEmptyWorkspace('Hồ sơ Báo cáo KTXH Offline (MASTER V2.2)');
    this.initWorkspace();
  }

  private async initWorkspace(): Promise<void> {
    const loaded = await loadWorkspacePersistent();
    if (loaded && loaded.formatVersion === 2 && Array.isArray(loaded.sessions)) {
      this.workspace = loaded;
    }
    migrateLegacySessionLabels(this.workspace);
    this.ensureInitialDatasetsAndEmptySession();
    this.lastSavedTimestamp = new Date().toLocaleTimeString('vi-VN');
    this.render();
  }

  private ensureInitialDatasetsAndEmptySession(): void {
    if (
      this.workspace.datasets.length === 0 &&
      typeof window !== 'undefined' &&
      window.__EMBEDDED_REFERENCE_FIXTURES__
    ) {
      const fixtures = window.__EMBEDDED_REFERENCE_FIXTURES__;
      const disbBytes = base64ToUint8Array(fixtures.DISB_B64);
      const revBytes = base64ToUint8Array(fixtures.REV_B64);
      const gpmbBytes = base64ToUint8Array(fixtures.GPMB_B64);

      const { dataset: disbDs, localities } = importDisbursementWorkbook(
        disbBytes,
        'Báo cáo giải ngân 15.10 sửa(1).xlsx'
      );
      registerDatasetInWorkspace(this.workspace, disbDs, localities);

      const { dataset: revDs } = importRevenueWorkbook(
        revBytes,
        'Bc thu 10 thang-19.10-BC (1)(1).xlsx',
        {
          confirmedAsOfDate: '2026-10-19',
          asOfConfirmationReason: 'Xác nhận ngày chốt sơ bộ kỳ 10 tháng năm 2026',
        }
      );
      registerDatasetInWorkspace(this.workspace, revDs);

      const { dataset: gpmbDs } = importGpmbWorkbook(
        gpmbBytes,
        'PL01_Tổng hợp DA_26.12.26(1).xlsx'
      );
      registerDatasetInWorkspace(this.workspace, gpmbDs);

      for (const s of this.workspace.sessions) {
        if (!s.dataBindings.DISB) s.dataBindings.DISB = disbDs.id;
        if (!s.dataBindings.REV) s.dataBindings.REV = revDs.id;
        if (!s.dataBindings.GPMB) s.dataBindings.GPMB = gpmbDs.id;
      }
    }

    if (this.workspace.sessions.length === 0) {
      createReportSession(this.workspace, { name: 'Báo cáo KTXH phiên mới' });
    }
  }

  public triggerAutosave(): void {
    this.workspace.unsavedChanges = true;
    this.workspace.updatedAt = new Date().toISOString();
    this.isSaving = true;
    this.renderAutosavePill();

    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
    }

    this.autosaveTimer = window.setTimeout(async () => {
      await saveWorkspacePersistent(this.workspace);
      this.isSaving = false;
      this.lastSavedTimestamp = new Date().toLocaleTimeString('vi-VN');
      this.renderAutosavePill();
    }, 3000);
  }

  private renderAutosavePill(): void {
    const pill = document.getElementById('autosave-status-pill');
    if (!pill) return;
    if (this.isSaving) {
      pill.className = 'autosave-pill autosave-saving';
      pill.innerHTML = `<span class="spinner-dot"></span> Đang lưu...`;
    } else {
      pill.className = 'autosave-pill autosave-saved';
      pill.innerHTML = `✓ Đã tự động lưu lúc ${escapeHtmlUi(this.lastSavedTimestamp)}`;
    }
  }

  public setStatus(
    msg: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ): void {
    this.statusBannerMessage = msg;
    this.statusBannerType = type;
    this.render();
  }

  public loadEmbeddedReferenceWorkbooks(revConfirmedDate = ''): void {
    const fixtures = window.__EMBEDDED_REFERENCE_FIXTURES__;
    if (!fixtures) {
      this.setStatus(
        'Không tìm thấy bộ fixture nhúng sẵn; vui lòng chọn 3 tệp .xlsx từ máy tính.',
        'warning'
      );
      return;
    }

    const disbBytes = base64ToUint8Array(fixtures.DISB_B64);
    const revBytes = base64ToUint8Array(fixtures.REV_B64);
    const gpmbBytes = base64ToUint8Array(fixtures.GPMB_B64);

    const { dataset: disbDs, localities } = importDisbursementWorkbook(
      disbBytes,
      'Báo cáo giải ngân 15.10 sửa(1).xlsx'
    );
    registerDatasetInWorkspace(this.workspace, disbDs, localities);

    const { dataset: revDs } = importRevenueWorkbook(
      revBytes,
      'Bc thu 10 thang-19.10-BC (1)(1).xlsx',
      revConfirmedDate
        ? {
            confirmedAsOfDate: revConfirmedDate,
            asOfConfirmationReason: 'Xác nhận ngày chốt sơ bộ kỳ 10 tháng năm 2026',
          }
        : {}
    );
    registerDatasetInWorkspace(this.workspace, revDs);

    const { dataset: gpmbDs } = importGpmbWorkbook(
      gpmbBytes,
      'PL01_Tổng hợp DA_26.12.26(1).xlsx'
    );
    registerDatasetInWorkspace(this.workspace, gpmbDs);

    for (const s of this.workspace.sessions) {
      s.dataBindings.DISB = disbDs.id;
      s.dataBindings.REV = revDs.id;
      s.dataBindings.GPMB = gpmbDs.id;
    }

    this.triggerAutosave();
    this.setStatus(
      revConfirmedDate
        ? `Đã nạp đủ 3 nguồn tham chiếu (DISB 114, REV 113 chốt ${revConfirmedDate}, GPMB 108/422 dự án).`
        : 'Đã nạp 3 nguồn tham chiếu. Lưu ý: Nguồn Thu NSNN (10T-19.10) chưa rõ ngày chốt — vui lòng xác nhận ngày chốt thực tế ở mục Nhập nguồn!',
      revConfirmedDate ? 'success' : 'warning'
    );
  }

  public handleWorkbookBytesUpload(bytes: Uint8Array, filename: string): void {
    try {
      const wb = parseWorkbookBytes(bytes, filename);
      const visibleSheets = wb.sheets.filter((s) => s.state === 'visible');
      for (const s of visibleSheets) {
        const fp = detectSheetFingerprint(s);
        if (fp === 'DISB_V1') {
          const { dataset, localities } = importDisbursementWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset, localities);
          for (const sess of this.workspace.sessions) {
            sess.dataBindings.DISB = dataset.id;
          }
          syncReportLabelsWithDatasetDates(this.workspace);
          this.triggerAutosave();
          this.setStatus(
            `Đã nhận diện & nhập nguồn Giải ngân "${filename}" (${dataset.unitCount} địa phương, ngày chốt ${formatVnDate(dataset.asOfDate)}).`,
            'success'
          );
          this.render();
          return;
        }
        if (fp === 'REV_V1') {
          const { dataset } = importRevenueWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          for (const sess of this.workspace.sessions) {
            sess.dataBindings.REV = dataset.id;
          }
          syncReportLabelsWithDatasetDates(this.workspace);
          this.triggerAutosave();
          this.setStatus(
            `Đã nhận diện & nhập nguồn Thu NSNN "${filename}" (${dataset.unitCount} địa phương, ngày chốt ${formatVnDate(dataset.asOfDate)}).`,
            'success'
          );
          this.render();
          return;
        }
        if (fp === 'GPMB_V1' || fp === 'GPMB_FLAT') {
          const { dataset } = importGpmbWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          for (const sess of this.workspace.sessions) {
            sess.dataBindings.GPMB = dataset.id;
          }
          syncReportLabelsWithDatasetDates(this.workspace);
          this.triggerAutosave();
          this.setStatus(
            `Đã nhận diện & nhập nguồn GPMB (${fp === 'GPMB_FLAT' ? 'bảng phẳng CSDL' : 'bảng phân nhóm'}) "${filename}" (${dataset.unitCount} địa bàn, ${dataset.projectRowCount} dòng dự án, ngày chốt ${formatVnDate(dataset.asOfDate)}).`,
            'success'
          );
          this.render();
          return;
        }
        if (fp === 'RESULT_TEMPLATE_V1') {
          this.setStatus(
            `Tệp "${filename}" được nhận diện là Bảng mẫu trình bày 14 dòng (RESULT_REFERENCE). Hệ thống chỉ lấy cấu trúc 14 dòng chỉ tiêu, tuyệt đối không lấy sẵn 11 xã hay mốc 76% / 70,8% cũ.`,
            'info'
          );
          return;
        }
      }
      this.setStatus(
        `Không nhận diện được cấu trúc nguồn chuẩn của "${filename}". Yêu cầu nạp tệp đúng profile hoặc mở Mapping Wizard.`,
        'error'
      );
    } catch (err) {
      this.setStatus(`Lỗi khi đọc tệp "${filename}": ${(err as Error).message}`, 'error');
    }
  }

  public getActiveSession() {
    return this.workspace.sessions.find(
      (s) => s.id === this.workspace.activeSessionId
    );
  }

  public getLatestDatasetsMap() {
    const activeSession = this.getActiveSession();
    if (activeSession) {
      return resolveSessionDatasets(this.workspace, activeSession);
    }
    return {
      REV: [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'REV'),
      DISB: [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'DISB'),
      GPMB: [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'GPMB'),
    };
  }

  public render(): void {
    const root = document.getElementById('app');
    if (!root) return;

    const activeEl = document.activeElement;
    let focusedInputId: string | null = null;
    let selStart: number | null = null;
    let selEnd: number | null = null;
    if (
      activeEl &&
      (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) &&
      activeEl.id
    ) {
      focusedInputId = activeEl.id;
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }

    const activeSession = this.getActiveSession();
    const datasets = this.getLatestDatasetsMap();
    const hasAllThreeSources = Boolean(
      datasets.DISB && datasets.REV && datasets.GPMB
    );
    const revNeedsDateConfirm =
      datasets.REV && datasets.REV.asOfStatus === 'REQUIRES_USER_CONFIRMATION';

    let evaluatedReport: EvaluatedSessionReport | null = null;
    if (activeSession && hasAllThreeSources) {
      evaluatedReport = evaluateSessionReport({
        session: activeSession,
        baselineLocalities: this.workspace.localities,
        datasets,
      });
    }

    // Top Bar Render
    const topBarHtml = this.renderTopBar(activeSession);

    // Left Navigation Items
    const leftNavHtml = this.renderLeftNav(activeSession);

    // Center Workspace Content
    const centerWorkspaceHtml = this.renderCenterContent(
      activeSession,
      evaluatedReport,
      datasets,
      Boolean(revNeedsDateConfirm)
    );

    // Right Context Panel
    const rightPanelHtml = this.renderRightContextPanel(
      activeSession,
      evaluatedReport,
      datasets
    );

    // Status Banner
    const statusBannerHtml = this.statusBannerMessage
      ? `<div class="status-banner status-${this.statusBannerType} no-print">
          <span>${escapeHtmlUi(this.statusBannerMessage)}</span>
          <button type="button" class="btn-close-banner" id="btn-clear-banner">&times;</button>
        </div>`
      : '';

    // Cell Popover
    let popoverHtml = '';
    if (this.popoverCell && evaluatedReport) {
      const trace = evaluatedReport.tracesById.get(this.popoverCell.traceId);
      if (trace) {
        popoverHtml = `<div id="active-cell-popover" style="position:fixed; left:${Math.min(
          this.popoverCell.clientX + 10,
          window.innerWidth - 360
        )}px; top:${Math.min(this.popoverCell.clientY + 10, window.innerHeight - 300)}px;">
          ${renderCellTracePopoverHtml(trace, this.activeTraceExtraMeta)}
        </div>`;
      }
    }

    const projectModalHtml = this.renderProjectModal(activeSession, datasets);

    root.innerHTML = `
      <div class="studio-app-shell">
        ${topBarHtml}
        ${statusBannerHtml}
        <div class="studio-main-body">
          <aside class="studio-sidebar no-print ${this.isSidebarCollapsed ? 'collapsed' : ''}">
            ${leftNavHtml}
            <div class="sidebar-footer">
              <button type="button" class="btn-toggle-sidebar" id="btn-toggle-sidebar" title="Thu gọn / Mở rộng thanh điều hướng">
                <span>${this.isSidebarCollapsed ? '▶' : '◀'}</span>
                <span class="sidebar-nav-label">Thu gọn</span>
              </button>
            </div>
          </aside>
          <main class="studio-center-workspace">
            ${centerWorkspaceHtml}
          </main>
          ${rightPanelHtml}
        </div>
      </div>
      ${popoverHtml}
      ${projectModalHtml}
      <div id="print-mount-area" class="print-only">
        ${
          evaluatedReport
            ? generatePrintableReportHtml({
                evaluated: evaluatedReport,
                baselineLocalities: this.workspace.localities,
                datasets,
                includeTraceAppendix: false,
                includeAppendix: false,
              })
            : ''
        }
      </div>
    `;

    this.bindDomEvents(evaluatedReport, datasets);

    if (focusedInputId) {
      const restoredInput = document.getElementById(focusedInputId) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (restoredInput) {
        restoredInput.focus();
        if (selStart !== null && selEnd !== null) {
          try {
            restoredInput.setSelectionRange(selStart, selEnd);
          } catch (_) {}
        }
      }
    }
  }

  private renderTopBar(activeSession: Workspace['sessions'][number] | undefined): string {
    const sessionOptionsHtml = this.workspace.sessions
      .map(
        (s) => `<option value="${escapeHtmlUi(s.id)}" ${
          s.id === activeSession?.id ? 'selected' : ''
        }>${escapeHtmlUi(s.name)} (${s.selectedLocalityIds.length} ĐP)</option>`
      )
      .join('');

    const backupStatusBadge = this.workspace.unsavedChanges
      ? `<span class="badge badge-WARNING" title="Có chỉnh sửa chưa xuất file .kxh.json">Chưa sao lưu (.kxh.json)</span>`
      : `<span class="badge badge-COMPLETE" title="Đã lưu an toàn">Đã sao lưu</span>`;

    return `<header class="studio-topbar no-print">
      <div class="topbar-group-brand">
        <span class="topbar-logo">🏛️</span>
        <div class="topbar-title-wrap">
          <span class="topbar-title">Báo cáo Kinh tế – Xã hội</span>
          <span class="topbar-badge-offline">Offline 100%</span>
        </div>
      </div>

      <div class="topbar-group-session">
        <select class="session-select-box" id="select-active-session" title="Chuyển đổi phiên làm việc">
          ${sessionOptionsHtml}
        </select>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-topbar-new-session" title="Tạo phiên mới với 0 địa phương mặc định">+ Phiên mới</button>
        <button type="button" class="btn btn-sm" id="btn-topbar-clone-session" title="Nhân bản phiên hiện tại">Nhân bản</button>
      </div>

      <div class="topbar-group-autosave">
        <span id="autosave-status-pill" class="autosave-pill ${
          this.isSaving ? 'autosave-saving' : 'autosave-saved'
        }">
          ${
            this.isSaving
              ? 'Đang lưu...'
              : `✓ Đã tự động lưu lúc ${escapeHtmlUi(this.lastSavedTimestamp)}`
          }
        </span>
        ${backupStatusBadge}
      </div>

      <div class="topbar-group-export">
        <button type="button" class="btn btn-sm btn-primary" id="btn-topbar-export-xlsx" title="Tải xuống tệp Excel đúng kiểu số numeric kèm 5 sheet audit">
          <span>📊</span> Xuất Excel
        </button>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-topbar-print" title="Xem trước in hoặc lưu PDF theo chuẩn văn bản hành chính">
          <span>🖨️</span> Xuất PDF / In
        </button>
      </div>
    </header>`;
  }

  private renderLeftNav(activeSession: Workspace['sessions'][number] | undefined): string {
    const navItems: Array<{ id: KtxhOfflineApp['activeTab']; icon: string; label: string }> = [
      { id: 'REPORT', icon: '📄', label: 'Báo cáo tổng hợp' },
      { id: 'SESSIONS', icon: '📁', label: `Quản lý phiên (${this.workspace.sessions.length})` },
      { id: 'IMPORT', icon: '📥', label: 'Dữ liệu nguồn' },
      {
        id: 'LOCALITIES',
        icon: '📍',
        label: `Danh mục địa phương (${activeSession?.selectedLocalityIds.length ?? 0}/114)`,
      },
      { id: 'BENCHMARKS', icon: '⚙️', label: 'Chỉ tiêu & tùy chỉnh' },
      { id: 'INSPECTOR', icon: '🔍', label: 'Kiểm tra & truy vết' },
      { id: 'EXPORT', icon: '📤', label: 'Xuất & in báo cáo' },
    ];

    return `<nav class="sidebar-nav-list">
      ${navItems
        .map(
          (item) => `<button type="button" class="sidebar-nav-item ${
            this.activeTab === item.id || (this.activeTab === 'STUDIO' && item.id === 'REPORT') ? 'active' : ''
          }" data-nav-tab="${item.id}" title="${escapeHtmlUi(item.label)}">
            <span class="sidebar-nav-icon">${item.icon}</span>
            <span class="sidebar-nav-label">${escapeHtmlUi(item.label)}</span>
          </button>`
        )
        .join('')}
    </nav>`;
  }

  private renderCenterContent(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    },
    revNeedsDateConfirm: boolean
  ): string {
    // If not in primary report studio tab, render dedicated tab views
    if (this.activeTab === 'SESSIONS') {
      return this.renderSessionsPage(datasets);
    }
    if (this.activeTab === 'IMPORT') {
      return this.renderImportPage(datasets);
    }
    if (this.activeTab === 'LOCALITIES') {
      return this.renderUnifiedLocalitiesPage(activeSession);
    }
    if (this.activeTab === 'BENCHMARKS') {
      return this.renderBenchmarksAndSettingsPage(activeSession, evaluatedReport, datasets);
    }
    if (this.activeTab === 'INSPECTOR') {
      return `<section class="page-section"><div class="card">${renderTraceInspectorHtml(
        this.activeTrace,
        this.activeTraceExtraMeta
      )}</div></section>`;
    }
    if (this.activeTab === 'EXPORT') {
      return this.renderExportAndBackupPage(activeSession, evaluatedReport, datasets);
    }

    // Default primary view: REPORT (WYSIWYG A4 Document Studio)
    if (!activeSession) {
      return `<div class="card empty-state-card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo ở trên.</h3></div>`;
    }
    if (!evaluatedReport) {
      return `<div class="card empty-state-card">
        <h3>Chưa có đủ 3 nguồn dữ liệu</h3>
        <p>Hệ thống cần đủ 3 nguồn: Giải ngân (DISB), Thu NSNN (REV) và GPMB để đánh giá 14 dòng chỉ tiêu.</p>
        <button type="button" class="btn btn-primary" data-nav-tab="IMPORT">Chuyển tới Nhập nguồn</button>
      </div>`;
    }

    const layoutDecision = computeAutoLayoutMode({
      session: activeSession,
      selectedCount: activeSession.selectedLocalityIds.length,
      indicatorCount: evaluatedReport.rows.length,
    });

    const currentLayoutPref = activeSession.settings.tableLayoutMode || 'AUTO';

    const studioToolbarHtml = `<div class="studio-canvas-toolbar no-print">
      <div class="toolbar-left">
        <span class="toolbar-group-label">Bố cục bảng:</span>
        <div class="layout-segmented-control">
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'AUTO' ? 'active' : ''
          }" data-set-layout-mode="AUTO" title="Tự động tính toán theo kích thước A4 ngang">
            Tự động (khuyến nghị)
          </button>
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'HORIZONTAL' ? 'active' : ''
          }" data-set-layout-mode="HORIZONTAL" title="Địa phương theo chiều ngang (Cột = Địa phương, Dòng = Chỉ tiêu)">
            Địa phương ngang
          </button>
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'VERTICAL' ? 'active' : ''
          }" data-set-layout-mode="VERTICAL" title="Địa phương theo chiều dọc (Dòng = Địa phương, Cột = Chỉ tiêu)">
            Địa phương dọc
          </button>
        </div>
        <span class="auto-explanation-badge" title="${escapeHtmlUi(layoutDecision.reason)}">
          ℹ️ ${escapeHtmlUi(layoutDecision.reason)}
        </span>
      </div>

      <div class="toolbar-center">
        <button type="button" class="btn btn-sm btn-secondary" id="btn-studio-edit-title" title="Chỉnh sửa tên báo cáo, cơ quan, kỳ, căn lề">
          ✏️ Sửa tiêu đề
        </button>
        <button type="button" class="btn btn-sm btn-secondary" data-nav-tab="LOCALITIES" title="Chọn xã, phường, đặc khu">
          📍 Địa phương (${activeSession.selectedLocalityIds.length}/114)
        </button>
      </div>

      <div class="toolbar-right">
        <div class="zoom-controls">
          <button type="button" class="btn btn-sm" id="btn-zoom-out" title="Thu nhỏ">-</button>
          <span class="zoom-level-label" style="min-width:44px; text-align:center">${Math.round(
            this.zoomScale * 100
          )}%</span>
          <button type="button" class="btn btn-sm" id="btn-zoom-in" title="Phóng to">+</button>
          <button type="button" class="btn btn-sm" id="btn-zoom-reset" title="Khôi phục 100%">100%</button>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-open-warnings-panel" title="Xem danh sách cảnh báo chất lượng">
          ⚠️ Cảnh báo (${evaluatedReport.sessionIssues.length})
        </button>
      </div>
    </div>`;

    const a4DocumentHtml = renderA4DocumentStudioHtml({
      evaluated: evaluatedReport,
      baselineLocalities: this.workspace.localities,
      datasets,
      activeTraceId: this.activeTraceId,
      zoomScale: this.zoomScale,
    });

    return `<div class="studio-document-container">
      ${studioToolbarHtml}
      <div class="studio-canvas-scroll">
        ${a4DocumentHtml}
      </div>
    </div>`;
  }

  private renderRightContextPanel(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): string {
    if (this.rightPanelMode === 'NONE') {
      return '';
    }

    let panelContent = '';
    let panelTitle = '';

    if (this.rightPanelMode === 'TRACE') {
      panelTitle = 'Hồ sơ giải trình phép tính (CalculationTrace)';
      panelContent = renderTraceInspectorHtml(
        this.activeTrace,
        this.activeTraceExtraMeta
      );
    } else if (this.rightPanelMode === 'TITLE') {
      panelTitle = 'Tùy chỉnh tiêu đề & Văn bản hành chính';
      panelContent = this.renderTitleSettingsForm(activeSession);
    } else if (this.rightPanelMode === 'INDICATORS') {
      panelTitle = 'Quản lý 14 dòng chỉ tiêu mẫu';
      panelContent = this.renderIndicatorsManager(activeSession);
    } else if (this.rightPanelMode === 'WARNINGS') {
      panelTitle = 'Cảnh báo chất lượng & Kiểm toán nguồn';
      panelContent = this.renderQualityWarningsList(activeSession, evaluatedReport, datasets);
    }

    return `<aside class="studio-context-panel no-print">
      <div class="context-panel-header">
        <span class="context-panel-title">${escapeHtmlUi(panelTitle)}</span>
        <button type="button" class="btn-close-context-panel" id="btn-close-context-panel" title="Đóng panel">&times;</button>
      </div>
      <div class="context-panel-tabs">
        <button type="button" class="context-tab-btn ${
          this.rightPanelMode === 'TRACE' ? 'active' : ''
        }" data-open-panel-mode="TRACE">Truy vết</button>
        <button type="button" class="context-tab-btn ${
          this.rightPanelMode === 'TITLE' ? 'active' : ''
        }" data-open-panel-mode="TITLE">Tiêu đề</button>
        <button type="button" class="context-tab-btn ${
          this.rightPanelMode === 'INDICATORS' ? 'active' : ''
        }" data-open-panel-mode="INDICATORS">Chỉ tiêu</button>
        <button type="button" class="context-tab-btn ${
          this.rightPanelMode === 'WARNINGS' ? 'active' : ''
        }" data-open-panel-mode="WARNINGS">Cảnh báo</button>
      </div>
      <div class="context-panel-body">
        ${panelContent}
      </div>
    </aside>`;
  }

  private renderTitleSettingsForm(activeSession: Workspace['sessions'][number] | undefined): string {
    if (!activeSession) return '<p>Chưa chọn phiên.</p>';
    const s = activeSession.settings;

    return `<form id="form-edit-title-settings" class="settings-form">
      <div class="form-group">
        <label>Tiêu đề báo cáo chính:</label>
        <textarea id="setting-report-title" class="form-input" rows="2">${escapeHtmlUi(
          s.reportTitle
        )}</textarea>
      </div>

      <div class="form-group">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label style="margin:0; font-weight:600;">Dòng chữ nhỏ in nghiêng dưới tiêu đề:</label>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" id="setting-show-subtitle" ${s.showSubtitle ? 'checked' : ''} />
            <span>Hiện dòng này</span>
          </label>
        </div>
        <input type="text" id="setting-subtitle" class="form-input" placeholder="Ví dụ: (Số liệu tổng hợp phục vụ công tác chỉ đạo, điều hành)" value="${escapeHtmlUi(
          s.subtitle || ''
        )}"/>
        <small class="text-muted" style="font-size:11px; display:block; margin-top:3px;">
          Hiển thị dòng chữ nhỏ, in nghiêng căn giữa ngay dưới tiêu đề chính (trên Studio, bản in PDF và file Excel).
        </small>
      </div>

      <div class="form-group">
        <label>Cơ quan cấp trên:</label>
        <input type="text" id="setting-agency-name" class="form-input" value="${escapeHtmlUi(
          s.agencyName || 'ỦY BAN NHÂN DÂN THÀNH PHỐ'
        )}"/>
      </div>

      <div class="form-group">
        <label>Đơn vị ban hành:</label>
        <input type="text" id="setting-sub-agency-name" class="form-input" value="${escapeHtmlUi(
          s.subAgencyName || 'SỞ KẾ HOẠCH VÀ ĐẦU TƯ'
        )}"/>
      </div>

      <div class="form-group">
        <label>Căn lề tiêu đề:</label>
        <select id="setting-title-align" class="form-select">
          <option value="center" ${s.titleAlign === 'center' ? 'selected' : ''}>Căn giữa (Center)</option>
          <option value="left" ${s.titleAlign === 'left' ? 'selected' : ''}>Căn trái (Left)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Cỡ chữ tiêu đề (px):</label>
        <input type="number" id="setting-title-size" class="form-input-sm" value="${
          s.titleFontSizePx || 16
        }" min="12" max="24"/>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="setting-title-uppercase" ${
            s.titleUppercase !== false ? 'checked' : ''
          }/>
          In hoa toàn bộ tiêu đề (UPPERCASE)
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="setting-show-signatures" ${
            s.showSignatures !== false ? 'checked' : ''
          }/>
          Hiển thị khu vực chữ ký ở trang cuối
        </label>
      </div>

      <div class="form-group" style="border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 12px;">
        <label style="font-weight: 600;">Chiều rộng cột Chỉ tiêu / Kết quả thực hiện (px):</label>
        <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
          <input type="number" id="setting-indicator-col-width" class="form-input-sm" value="${
            s.indicatorColumnWidthPx || 240
          }" min="160" max="600" step="10" style="width: 110px;" />
          <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-reset-ind-width" title="Khôi phục độ rộng mặc định 240px">Mặc định (240px)</button>
        </div>
        <small class="text-muted" style="font-size:11px; display:block; margin-top:4px;">
          Chiều rộng cột STT giữ cố định mặc định (30px). Phần chiều rộng thừa/thiếu sẽ tự động chia đều về các cột của các xã/phường.
        </small>
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px">Lưu thay đổi định dạng & tiêu đề</button>
    </form>`;
  }

  private renderIndicatorsManager(activeSession: Workspace['sessions'][number] | undefined): string {
    if (!activeSession) return '<p>Chưa chọn phiên.</p>';

    const rowsHtml = activeSession.templateRows
      .sort((a, b) => a.order - b.order)
      .map(
        (r) => `<div class="indicator-config-item" data-row-num="${r.rowNumber}">
          <div class="ind-config-header">
            <span class="badge badge-sm">Dòng ${r.rowNumber}</span>
            <code class="ind-config-code">${escapeHtmlUi(r.indicatorId)}</code>
            <label class="toggle-eye" title="Ẩn / Hiện chỉ tiêu">
              <input type="checkbox" class="chk-toggle-row-visibility" data-row-num="${
                r.rowNumber
              }" ${r.visible ? 'checked' : ''}/> Hiển thị
            </label>
          </div>
          <div class="ind-config-inputs">
            <input type="text" class="form-input-sm input-ind-custom-label" data-row-num="${
              r.rowNumber
            }" value="${escapeHtmlUi(r.customLabel)}" placeholder="Tên chỉ tiêu..."/>
          </div>
        </div>`
      )
      .join('');

    return `<div class="indicators-manager-container">
      <p class="muted">Tùy chỉnh nhãn hiển thị và ẩn/hiện cho từng dòng trong 14 dòng mẫu. Việc đổi nhãn không làm thay đổi ID, công thức và dữ liệu nguồn.</p>
      <div class="indicators-list-scroll">
        ${rowsHtml}
      </div>
      <button type="button" class="btn btn-secondary" id="btn-restore-default-indicator-labels" style="width:100%; margin-top:10px">
        Khôi phục tên chỉ tiêu mặc định
      </button>
    </div>`;
  }

  private renderQualityWarningsList(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): string {
    const sessionWarnList = evaluatedReport
      ? filterWarningsForSession(
          evaluatedReport.sessionIssues,
          activeSession?.selectedLocalityIds || []
        )
      : [];

    const mMismatchIssues = (datasets.GPMB?.issues || []).filter(
      (i) => i.ruleId === 'WARNING_M_RATIO_MISMATCH'
    );

    return `<div class="quality-warnings-container">
      <h4>Cảnh báo liên quan (${sessionWarnList.length})</h4>
      <div class="warnings-scroll-list">
        ${
          sessionWarnList.length === 0
            ? '<p class="muted">Không có cảnh báo chất lượng nào đối với các địa phương đang chọn.</p>'
            : sessionWarnList
                .map(
                  (w) => `<div class="warning-alert-item warning-severity-${escapeHtmlUi(
                    w.severity
                  )}">
                    <div class="warn-title-row">
                      <strong>${escapeHtmlUi(w.localityName)}</strong>
                      <span class="badge badge-sm badge-${escapeHtmlUi(w.severity)}">${escapeHtmlUi(
                    w.ruleId
                  )}</span>
                    </div>
                    <div class="warn-desc">${escapeHtmlUi(w.explanation)}</div>
                    <div class="warn-source">Ô: <code>${escapeHtmlUi(w.sourceCell)}</code></div>
                  </div>`
                )
                .join('')
        }
      </div>

      <h4 style="margin-top:16px">12 dự án GPMB có cột M lệch 100*I/D > 0,1 điểm %</h4>
      <div class="warnings-scroll-list">
        ${mMismatchIssues
          .map(
            (iss) => `<div class="m-mismatch-item">
              <div>DA STT <strong>${iss.projectStt}</strong> (dòng ${iss.sourceRow}) — <strong>${escapeHtmlUi(
              iss.localityName
            )}</strong></div>
              <div>M nguồn: <strong>${escapeHtmlUi(String(iss.observed))}%</strong> | Tính lại: <strong>${Number(
              iss.expected
            ).toFixed(2)}%</strong> (chênh lệch: <span class="text-danger">${Number(
              iss.delta
            ).toFixed(2)} điểm %</span>)</div>
            </div>`
          )
          .join('')}
      </div>
    </div>`;
  }

  private renderSelectedReorderPanel(
    activeSession: Workspace['sessions'][number]
  ): string {
    const selectedIds = activeSession.selectedLocalityIds;
    if (selectedIds.length === 0) {
      return '';
    }

    const localitiesMap = new Map(this.workspace.localities.map((l) => [l.id, l]));
    const chipsHtml = selectedIds
      .map((id, idx) => {
        const loc = localitiesMap.get(id);
        const name = loc ? loc.displayName : id;
        return `<div class="selected-chip" data-loc-id="${escapeHtmlUi(id)}">
          <span class="chip-order-badge">#${idx + 1}</span>
          <span class="chip-name" title="${escapeHtmlUi(name)}">${escapeHtmlUi(name)}</span>
          <div class="chip-actions">
            <button type="button" class="btn-chip-move" data-move-dir="up" data-loc-id="${escapeHtmlUi(id)}" title="Di chuyển lên trước (sang trái trên bảng)">▲</button>
            <button type="button" class="btn-chip-move" data-move-dir="down" data-loc-id="${escapeHtmlUi(id)}" title="Di chuyển xuống sau (sang phải trên bảng)">▼</button>
            <button type="button" class="btn-chip-remove" data-remove-loc-id="${escapeHtmlUi(id)}" title="Bỏ chọn">&times;</button>
          </div>
        </div>`;
      })
      .join('');

    return `<div class="selected-reorder-panel" id="unified-reorder-panel">
      <div class="reorder-header-row">
        <div class="reorder-title">
          <strong>Thứ tự hiển thị cột trên bảng báo cáo (${selectedIds.length} địa phương đã chọn):</strong>
          <span class="muted" style="margin-left: 8px; font-size: 12px">(Cột xuất hiện từ trái sang phải theo đúng thứ tự này)</span>
        </div>
        <div class="reorder-actions">
          <button type="button" class="btn btn-xs btn-secondary" id="btn-reorder-az">Tên A &rarr; Z</button>
          <button type="button" class="btn btn-xs btn-secondary" id="btn-reorder-za">Tên Z &rarr; A</button>
          <button type="button" class="btn btn-xs btn-secondary" id="btn-reorder-reverse">Đảo ngược</button>
        </div>
      </div>
      <div class="selected-chips-grid">
        ${chipsHtml}
      </div>
    </div>`;
  }

  private renderLocalityItemsHtml(
    activeSession: Workspace['sessions'][number]
  ): string {
    const filtered = searchLocalities(
      this.workspace.localities,
      this.localitySearchQuery,
      this.localityTypeFilter
    );

    const selectedSet = new Set(activeSession.selectedLocalityIds);

    // Filter by coverage status if chosen
    const coverageFiltered = filtered.filter((loc) => {
      if (this.localityCoverageFilter === 'ALL') return true;
      const isMissing =
        loc.displayName === 'Đặc khu Bạch Long Vĩ' ||
        ['Phường Lưu Kiếm', 'Phường Ái Quốc', 'Xã Hùng Thắng', 'Xã Thái Tân', 'Xã Tân Minh'].includes(
          loc.displayName
        );
      return this.localityCoverageFilter === 'MISSING' ? isMissing : !isMissing;
    });

    // Sorting
    const sorted = [...coverageFiltered].sort((a, b) => {
      if (this.localitySortOption === 'NAME_ASC') return a.displayName.localeCompare(b.displayName, 'vi');
      if (this.localitySortOption === 'NAME_DESC') return b.displayName.localeCompare(a.displayName, 'vi');
      if (this.localitySortOption === 'TYPE') return a.type.localeCompare(b.type);
      if (this.localitySortOption === 'SELECTED_FIRST') {
        const aSel = selectedSet.has(a.id) ? 1 : 0;
        const bSel = selectedSet.has(b.id) ? 1 : 0;
        if (bSel !== aSel) return bSel - aSel;
        const aIdx = activeSession.selectedLocalityIds.indexOf(a.id);
        const bIdx = activeSession.selectedLocalityIds.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return 0;
      }
      return 0; // Default order
    });

    if (sorted.length === 0) {
      return '<p class="muted" style="padding:16px">Không tìm thấy địa phương nào khớp từ khóa.</p>';
    }

    return sorted
      .map((loc) => {
        const isChecked = selectedSet.has(loc.id);
        const isMissingGpmb = [
          'Phường Lưu Kiếm',
          'Phường Ái Quốc',
          'Xã Hùng Thắng',
          'Xã Thái Tân',
          'Xã Tân Minh',
          'Đặc khu Bạch Long Vĩ',
        ].includes(loc.displayName);
        const isMissingRev = loc.displayName === 'Đặc khu Bạch Long Vĩ';

        let warnTag = '';
        if (isMissingRev && isMissingGpmb) {
          warnTag = `<span class="missing-source-tag" title="Chưa có bản ghi Thu NSNN; GPMB ghi nhận mặc định không có nhiệm vụ">Thiếu Thu • Không có GPMB</span>`;
        } else if (isMissingGpmb) {
          warnTag = `<span class="missing-source-tag note-gpmb-no-task" title="Ghi nhận mặc định: Không có nhiệm vụ GPMB">Không có GPMB</span>`;
        }

        let moveButtons = '';
        if (isChecked) {
          moveButtons = `<div class="row-reorder-btns">
            <button type="button" class="btn-row-move" data-move-dir="up" data-loc-id="${escapeHtmlUi(loc.id)}" title="Chuyển cột lên trước (sang trái trên bảng)">▲</button>
            <button type="button" class="btn-row-move" data-move-dir="down" data-loc-id="${escapeHtmlUi(loc.id)}" title="Chuyển cột xuống sau (sang phải trên bảng)">▼</button>
          </div>`;
        }

        return `<label class="locality-row-item ${isChecked ? 'checked' : ''}">
          <div class="locality-row-left">
            <input type="checkbox" class="chk-select-locality" data-loc-id="${escapeHtmlUi(
              loc.id
            )}" ${isChecked ? 'checked' : ''}/>
            ${moveButtons}
            <span class="locality-name-bold">${escapeHtmlUi(loc.displayName)}</span>
            <span class="badge badge-sm">${escapeHtmlUi(loc.type)}</span>
          </div>
          <div class="locality-row-right">
            ${warnTag}
          </div>
        </label>`;
      })
      .join('');
  }

  private renderUnifiedLocalitiesPage(
    activeSession: Workspace['sessions'][number] | undefined
  ): string {
    if (!activeSession) {
      return `<div class="card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo.</h3></div>`;
    }

    return `<section class="page-section">
      <div class="card unified-locality-container">
        <div class="locality-header-title">
          <h2>Danh sách địa phương (${this.workspace.localities.length || 114} đơn vị)</h2>
          <p>
            Theo quy tắc chuẩn hành chính MASTER V2.2: Phiên mới bắt đầu với <strong>0 địa phương được chọn</strong>.
            Gộp chung xã, phường, đặc khu trong <strong>một danh sách duy nhất</strong> để dễ dàng tìm kiếm và lựa chọn tùy ý.
          </p>
        </div>

        <div class="locality-filter-toolbar">
          <input type="text" id="input-unified-loc-search" class="form-input locality-search-input" placeholder="Tìm kiếm xã, phường, đặc khu (có dấu hoặc không dấu, ví dụ: 'cam giang', 'bach long vi')..." value="${escapeHtmlUi(
            this.localitySearchQuery
          )}"/>

          <select id="select-unified-loc-type" class="form-select-sm">
            <option value="ALL" ${this.localityTypeFilter === 'ALL' ? 'selected' : ''}>Tất cả loại (${
      this.workspace.localities.length
    })</option>
            <option value="XA" ${this.localityTypeFilter === 'XA' ? 'selected' : ''}>Xã</option>
            <option value="PHUONG" ${this.localityTypeFilter === 'PHUONG' ? 'selected' : ''}>Phường</option>
            <option value="DAC_KHU" ${this.localityTypeFilter === 'DAC_KHU' ? 'selected' : ''}>Đặc khu</option>
          </select>

          <select id="select-unified-loc-sort" class="form-select-sm">
            <option value="SELECTED_FIRST" ${this.localitySortOption === 'SELECTED_FIRST' ? 'selected' : ''}>Đã chọn lên đầu</option>
            <option value="DEFAULT" ${this.localitySortOption === 'DEFAULT' ? 'selected' : ''}>Thứ tự gốc</option>
            <option value="NAME_ASC" ${this.localitySortOption === 'NAME_ASC' ? 'selected' : ''}>Tên A &rarr; Z</option>
            <option value="NAME_DESC" ${this.localitySortOption === 'NAME_DESC' ? 'selected' : ''}>Tên Z &rarr; A</option>
          </select>

          <span class="locality-count-pill" id="unified-locality-count-pill">
            Đã chọn: <strong>${activeSession.selectedLocalityIds.length}</strong> / ${
      this.workspace.localities.length || 114
    }
          </span>
        </div>

        <div class="toolbar-row">
          <button type="button" class="btn btn-sm btn-secondary" id="btn-select-all-localities">Chọn tất cả</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-deselect-all-localities">Bỏ chọn tất cả (Về 0)</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-preset-5-xa">Mẫu 5 xã</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-preset-7-phuong">Mẫu 7 phường</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-preset-11-xa">Mẫu 11 xã</button>
          <button type="button" class="btn btn-sm btn-primary" data-nav-tab="REPORT">Xem báo cáo A4 &rarr;</button>
        </div>

        <div id="unified-reorder-container">
          ${this.renderSelectedReorderPanel(activeSession)}
        </div>

        <div class="locality-items-list-box" id="unified-locality-items-box">
          ${this.renderLocalityItemsHtml(activeSession)}
        </div>
      </div>
    </section>`;
  }

  private renderSessionsPage(datasets: {
    REV?: Workspace['datasets'][number];
    DISB?: Workspace['datasets'][number];
    GPMB?: Workspace['datasets'][number];
  }): string {
    const kpiHtml = `<div class="kpi-summary-grid">
      <div class="kpi-box">
        <div class="kpi-box-title">1. Giải ngân Đầu tư công (DISB)</div>
        <div class="kpi-box-value">${datasets.DISB ? `${datasets.DISB.unitCount}/114 địa phương` : 'Chưa nạp'}</div>
        <div class="kpi-box-sub">Ngày chốt: <strong>${escapeHtmlUi(formatVnDate(datasets.DISB?.asOfDate) || '15/10/2026')}</strong> | Mốc chuẩn: <strong>67,10%</strong></div>
      </div>
      <div class="kpi-box">
        <div class="kpi-box-title">2. Thu Ngân sách Nhà nước (REV)</div>
        <div class="kpi-box-value">${datasets.REV ? `${datasets.REV.unitCount}/114 địa phương` : 'Chưa nạp'}</div>
        <div class="kpi-box-sub">Ngày chốt: <strong>${escapeHtmlUi(formatVnDate(datasets.REV?.asOfDate) || '19/10/2026')}</strong> | Thiếu: <strong>Đặc khu Bạch Long Vĩ</strong></div>
      </div>
      <div class="kpi-box">
        <div class="kpi-box-title">3. Giải phóng mặt bằng (GPMB)</div>
        <div class="kpi-box-value">${datasets.GPMB ? `${datasets.GPMB.unitCount}/114 địa bàn (${datasets.GPMB.projectRowCount} DA)` : 'Chưa nạp'}</div>
        <div class="kpi-box-sub">Ngày chốt: <strong>${escapeHtmlUi(formatVnDate(datasets.GPMB?.asOfDate) || '26/10/2026')}</strong> | Tỷ lệ diện tích: <strong>72,13%</strong></div>
      </div>
    </div>`;

    const sessionsListHtml =
      this.workspace.sessions.length === 0
        ? `<div class="card empty-state-card">
            <h3>Chưa có phiên báo cáo nào</h3>
            <p>Khi tạo phiên mới, danh sách địa phương luôn <strong>rỗng (0 địa phương mặc định)</strong>. Bạn có thể tạo nhiều phiên độc lập và chuyển đổi qua lại không mất thiết lập.</p>
          </div>`
        : `<table class="data-table">
            <thead>
              <tr>
                <th>Tên phiên báo cáo</th>
                <th>Số địa phương đã chọn</th>
                <th>Danh sách địa phương</th>
                <th>Phiên bản</th>
                <th>Cập nhật lúc</th>
                <th>Thao tác nhanh</th>
              </tr>
            </thead>
            <tbody>
              ${this.workspace.sessions
                .map((s) => {
                  const isActive = s.id === this.workspace.activeSessionId;
                  const locNames = s.selectedLocalityIds
                    .map(
                      (id) =>
                        this.workspace.localities.find((l) => l.id === id)
                          ?.displayName || id
                    )
                    .join(', ');
                  return `<tr class="${isActive ? 'row-active' : ''}">
                    <td><strong>${escapeHtmlUi(s.name)}</strong> ${
                    isActive
                      ? '<span class="badge badge-COMPLETE">Đang mở</span>'
                      : ''
                  }</td>
                    <td><strong>${s.selectedLocalityIds.length}</strong> đơn vị</td>
                    <td>${escapeHtmlUi(locNames || '(Rỗng — 0 địa phương mặc định)')}</td>
                    <td>v${s.sessionRevision}</td>
                    <td>${escapeHtmlUi(s.updatedAt.slice(0, 19).replace('T', ' '))}</td>
                    <td class="actions-cell">
                      <button type="button" class="btn btn-sm btn-primary" data-action="open-session-report" data-session-id="${escapeHtmlUi(
                        s.id
                      )}">Mở báo cáo A4</button>
                      <button type="button" class="btn btn-sm btn-secondary" data-action="clone-session" data-session-id="${escapeHtmlUi(
                        s.id
                      )}">Nhân bản</button>
                      <button type="button" class="btn btn-sm btn-danger" data-action="delete-session" data-session-id="${escapeHtmlUi(
                        s.id
                      )}">Xóa</button>
                    </td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>`;

    return `<section class="page-section">
      <div class="card">
        <h2>Quản lý Phiên Báo cáo &amp; Tổng quan Nguồn Dữ liệu</h2>
        <p>Ba nguồn dữ liệu chuẩn đã sẵn sàng. Phiên mới khởi tạo với <strong>0 địa phương mặc định</strong> (Quy tắc R02).</p>
        ${kpiHtml}
        <div class="toolbar-row">
          <input type="text" id="input-new-session-name" class="form-input" placeholder="Nhập tên phiên mới (VD: Báo cáo 5 xã khu vực A)..." value="Báo cáo KTXH phiên mới" />
          <button type="button" class="btn btn-primary" id="btn-create-session">+ Tạo phiên mới (0 địa phương)</button>
          <button type="button" class="btn btn-secondary" id="btn-quick-load-3-sources">Nạp lại 3 nguồn Excel tham chiếu</button>
        </div>
      </div>
      <div class="card">
        <h3>Danh sách phiên báo cáo trong bộ hồ sơ (${this.workspace.sessions.length} phiên)</h3>
        ${sessionsListHtml}
      </div>
    </section>`;
  }

  private renderImportPage(datasets: {
    REV?: Workspace['datasets'][number];
    DISB?: Workspace['datasets'][number];
    GPMB?: Workspace['datasets'][number];
  }): string {
    const { allCoverageDetails } = analyzeSourceCoverage(
      this.workspace.localities,
      datasets
    );

    const dsCardsHtml = ['DISB', 'REV', 'GPMB']
      .map((type) => {
        const ds = datasets[type as 'DISB' | 'REV' | 'GPMB'];
        const label =
          type === 'DISB'
            ? 'Giải ngân vốn ĐTC'
            : type === 'REV'
            ? 'Thu Ngân sách Nhà nước'
            : 'Giải phóng mặt bằng';
        if (!ds) {
          return `<div class="card source-card source-card-compact card-missing">
            <div class="source-card-header">
              <div class="source-card-title"><strong>${label}</strong> <span class="source-card-code">(${type})</span></div>
              <span class="badge badge-MISSING">Chưa nạp</span>
            </div>
            <div class="source-card-body-compact">
              <div class="muted" style="padding: 12px 0; text-align: center">Chưa có tệp dữ liệu. Kéo thả hoặc chọn tệp bên trên.</div>
            </div>
          </div>`;
        }
        return `<div class="card source-card source-card-compact card-loaded">
          <div class="source-card-header">
            <div class="source-card-title">
              <strong>${label}</strong>
              <span class="source-card-code">(${type})</span>
            </div>
            <span class="badge badge-COMPLETE">Đã nạp</span>
          </div>
          <div class="source-card-body-compact">
            <div class="source-meta-row">
              <span class="meta-lbl">Tệp:</span>
              <span class="meta-val" title="${escapeHtmlUi(ds.sourceFilename)}"><strong>${escapeHtmlUi(ds.sourceFilename)}</strong></span>
            </div>
            <div class="source-meta-row">
              <span class="meta-lbl">Sheet:</span>
              <span class="meta-val">${escapeHtmlUi(ds.sourceSheet)} (${escapeHtmlUi(ds.sheetVisibility)})</span>
            </div>
            <div class="source-meta-row">
              <span class="meta-lbl">Phạm vi:</span>
              <span class="meta-val"><strong>${ds.unitCount}</strong> địa phương ${ds.projectRowCount ? `(${ds.projectRowCount} DA)` : ''}</span>
            </div>
            <div class="source-meta-row date-edit-meta-row">
              <span class="meta-lbl">Ngày chốt:</span>
              <div class="source-date-editor">
                <input
                  type="date"
                  class="input-dataset-asof-date"
                  id="input-asof-date-${escapeHtmlUi(ds.id)}"
                  data-dataset-id="${escapeHtmlUi(ds.id)}"
                  data-source-type="${escapeHtmlUi(ds.sourceType)}"
                  value="${formatIsoDate(ds.asOfDate)}"
                  title="Nhấp để thay đổi ngày chốt số liệu"
                />
                <button
                  type="button"
                  class="btn btn-xs btn-primary btn-save-asof-date"
                  data-dataset-id="${escapeHtmlUi(ds.id)}"
                  title="Lưu ngày chốt và tự động cập nhật vào bảng báo cáo"
                >Lưu</button>
              </div>
            </div>
            <div class="source-meta-row">
              <span class="meta-lbl">Mã SHA:</span>
              <span class="meta-val"><code>${escapeHtmlUi(ds.workbookSha256.slice(0, 10))}...</code></span>
            </div>
          </div>
          ${
            ds.asOfStatus === 'REQUIRES_USER_CONFIRMATION'
              ? `<div class="date-confirm-box" style="margin-top:8px; padding-top:6px; border-top: 1px dashed #fde68a;">
                  <span class="badge badge-ERROR" style="margin-bottom:4px; display:inline-block">Cần xác nhận ngày chốt:</span>
                  <div style="display:flex; gap:6px; align-items:center">
                    <input type="date" id="input-confirm-rev-date" value="2026-10-19" class="form-input-sm" style="flex:1"/>
                    <button type="button" class="btn btn-sm btn-primary" id="btn-confirm-rev-date" data-dataset-id="${escapeHtmlUi(
                      ds.id
                    )}">Xác nhận</button>
                  </div>
                </div>`
              : ''
          }
        </div>`;
      })
      .join('');

    return `<section class="page-section">
      <div class="card import-top-card">
        <div class="import-header-compact">
          <div class="import-title-group">
            <h3>Dữ liệu nguồn Excel / CSV &amp; Tự động nhận diện (PH1-01 &amp; GPMB Bảng phẳng)</h3>
            <p class="muted">Hệ thống tự động nhận diện các tệp DISB, REV, GPMB (cả bảng phân nhóm và bảng phẳng CSDL) từ cấu trúc sheet và tiêu đề.</p>
          </div>
          <div class="import-actions-group">
            <label class="btn btn-sm btn-primary">
              Chọn tệp từ máy tính...
              <input type="file" id="input-xlsx-files-btn" multiple accept=".xlsx,.csv" style="display:none" />
            </label>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-load-embedded-confirmed">Nạp lại 3 file tham chiếu &amp; Chốt REV</button>
          </div>
        </div>
        <div class="dropzone-box-compact" id="dropzone-excel-files">
          <span class="dropzone-icon">📥</span>
          <span class="dropzone-text">Kéo thả các file Excel / CSV vào đây hoặc bấm để chọn tệp (.xlsx, .csv)</span>
          <input type="file" id="input-xlsx-files" multiple accept=".xlsx,.csv" style="display:none" />
        </div>
      </div>

      <div class="card-grid-3">
        ${dsCardsHtml}
      </div>

      <div class="card coverage-summary-card">
        <div class="coverage-summary-header">
          <h4>Kiểm toán nguồn thiếu (Coverage Audit — MASTER V2.2)</h4>
          <button type="button" class="btn btn-xs btn-outline" id="btn-toggle-coverage-table">Chi tiết 7 địa bàn thiếu</button>
        </div>
        <div class="coverage-summary-pills">
          <div class="cov-pill cov-pill-rev">
            <strong>Thu NSNN (113/114):</strong> Thiếu 1 đơn vị: <em>Đặc khu Bạch Long Vĩ</em> (Chưa có bản ghi - NO_LOCALITY_RECORD)
          </div>
          <div class="cov-pill cov-pill-gpmb">
            <strong>GPMB (108/114):</strong> Ghi nhận mặc định 6 đơn vị không có nhiệm vụ GPMB: <em>Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ</em> (422 dự án, 3 DA thiếu diện tích ghi nhận I)
          </div>
          <div class="cov-pill cov-pill-disb">
            <strong>Giải ngân ĐTC (114/114):</strong> Đủ 114/114 địa phương
          </div>
        </div>
        <div class="coverage-details-drawer" id="coverage-details-drawer" style="display:none; margin-top:12px;">
          <table class="data-table data-table-sm" style="font-size: 12px">
            <thead>
              <tr>
                <th>Địa phương</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Trường thiếu</th>
                <th>Lý do có căn cứ</th>
                <th>Ngày chốt</th>
              </tr>
            </thead>
            <tbody>
              ${allCoverageDetails
                .filter((c) => c.status === 'NO_LOCALITY_RECORD' || c.status === 'PARTIAL_AGGREGATE')
                .map(
                  (c) => `<tr>
                    <td><strong>${escapeHtmlUi(c.localityName)}</strong></td>
                    <td>${escapeHtmlUi(c.sourceType || c.sourceDatasetId)}</td>
                    <td><span class="badge badge-${escapeHtmlUi(c.status)}">${escapeHtmlUi(
                    c.status
                  )}</span></td>
                    <td>${escapeHtmlUi(c.fieldId || 'Bản ghi địa phương')}</td>
                    <td>${escapeHtmlUi(c.reason)}</td>
                    <td>${escapeHtmlUi(c.asOfDate || '')}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  private renderBenchmarksAndSettingsPage(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): string {
    if (!activeSession) return '<div class="card"><p>Chưa chọn phiên.</p></div>';
    const bm = evaluatedReport?.benchmarks;

    return `<section class="page-section">
      <div class="card">
        <h2>Mốc So sánh Chuẩn Chung &amp; Tùy chỉnh Bảng 14 Dòng</h2>
        <p>Mọi tỷ lệ chuẩn chung đều tính bằng <strong>SUM(tử số) / SUM(mẫu số)</strong> trên toàn phạm vi hợp lệ.</p>
        <ul class="benchmark-summary-list">
          <li><strong>Giải ngân 114 địa phương (15/10/2026):</strong> Tỷ lệ chung = <strong>${escapeHtmlUi(
            bm?.disbRateBenchmark?.displayedText || '67,10%'
          )}</strong> | Vốn giao bình quân = <strong>${escapeHtmlUi(
      bm?.disbPlanAvg?.displayedText || '136,41 tỷ đồng'
    )}</strong>.</li>
          <li><strong>Thu NSNN 113 địa phương:</strong> Tổng thu/Dự toán năm = <strong>${escapeHtmlUi(
            bm?.revRateBenchmark?.displayedText || '111,30%'
          )}</strong>.</li>
          <li><strong>GPMB danh mục 108 địa bàn:</strong> Tỷ lệ diện tích = <strong>${escapeHtmlUi(
            bm?.gpmbRateBenchmark?.displayedText || '72,13%'
          )}</strong> (<code>PARTIAL_AGGREGATE</code>).</li>
        </ul>
      </div>

      <div class="card">
        <h3>Tùy chỉnh Nhãn &amp; Ẩn/Hiện 14 Dòng Chỉ tiêu Mẫu</h3>
        ${this.renderIndicatorsManager(activeSession)}
      </div>
    </section>`;
  }

  private renderExportAndBackupPage(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): string {
    void evaluatedReport;
    void datasets;

    return `<section class="page-section">
      <div class="card">
        <h2>Xuất Báo cáo &amp; In ấn WYSIWYG</h2>
        <div class="toolbar-row">
          <button type="button" class="btn btn-primary" id="btn-export-xlsx-full">
            <span>📊</span> Xuất Excel (.xlsx có ô số numeric + 5 sheet audit)
          </button>
          <button type="button" class="btn btn-secondary" id="btn-trigger-window-print">
            <span>🖨️</span> In / Lưu PDF qua trình duyệt (A4 ngang)
          </button>
        </div>
      </div>

      <div class="card">
        <h3>Sao lưu &amp; Khôi phục Toàn bộ Hồ sơ (.kxh.json)</h3>
        <p>Đảm bảo an toàn 100% không mất dữ liệu: Tải về tệp sao lưu <code>.kxh.json</code> chứa toàn bộ workspace, phiên, dữ liệu đã chuẩn hóa và checksum SHA-256.</p>
        <div class="toolbar-row">
          <button type="button" class="btn btn-primary" id="btn-download-backup-json">Lưu toàn bộ hồ sơ (.kxh.json)</button>
          <label class="btn btn-secondary">
            Mở bộ hồ sơ từ tệp (.kxh.json)
            <input type="file" id="input-restore-backup-file" accept=".json,.kxh.json" style="display:none"/>
          </label>
        </div>
      </div>
    </section>`;
  }

  private updateLocalityListView(activeSession: Workspace['sessions'][number]): void {
    const reorderBox = document.getElementById('unified-reorder-container');
    if (reorderBox) {
      reorderBox.innerHTML = this.renderSelectedReorderPanel(activeSession);
    }
    const box = document.getElementById('unified-locality-items-box');
    if (box) {
      box.innerHTML = this.renderLocalityItemsHtml(activeSession);
    }
    const pill = document.getElementById('unified-locality-count-pill');
    if (pill) {
      pill.innerHTML = `Đã chọn: <strong>${activeSession.selectedLocalityIds.length}</strong> / ${
        this.workspace.localities.length || 114
      }`;
    }
    this.bindLocalityCheckboxes(activeSession);
    this.bindLocalityReorderEvents(activeSession);
  }

  private bindLocalityReorderEvents(activeSession: Workspace['sessions'][number]): void {
    const handleMove = (locId: string, dir: 'up' | 'down') => {
      const ids = [...activeSession.selectedLocalityIds];
      const idx = ids.indexOf(locId);
      if (idx === -1) return;
      if (dir === 'up' && idx > 0) {
        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
      } else if (dir === 'down' && idx < ids.length - 1) {
        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
      } else {
        return;
      }
      setSessionLocalities(this.workspace, activeSession.id, ids);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession);
    };

    document.querySelectorAll('.btn-chip-move, .btn-row-move').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const locId = btn.getAttribute('data-loc-id');
        const dir = btn.getAttribute('data-move-dir') as 'up' | 'down';
        if (locId && dir) handleMove(locId, dir);
      });
    });

    document.querySelectorAll('.btn-chip-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const locId = btn.getAttribute('data-remove-loc-id');
        if (!locId) return;
        const set = new Set(activeSession.selectedLocalityIds);
        set.delete(locId);
        setSessionLocalities(this.workspace, activeSession.id, Array.from(set));
        this.triggerAutosave();
        this.updateLocalityListView(activeSession);
      });
    });

    document.getElementById('btn-reorder-az')?.addEventListener('click', () => {
      const localitiesMap = new Map(this.workspace.localities.map((l) => [l.id, l]));
      const sorted = [...activeSession.selectedLocalityIds].sort((a, b) => {
        const nameA = localitiesMap.get(a)?.displayName || '';
        const nameB = localitiesMap.get(b)?.displayName || '';
        return nameA.localeCompare(nameB, 'vi');
      });
      setSessionLocalities(this.workspace, activeSession.id, sorted);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession);
    });

    document.getElementById('btn-reorder-za')?.addEventListener('click', () => {
      const localitiesMap = new Map(this.workspace.localities.map((l) => [l.id, l]));
      const sorted = [...activeSession.selectedLocalityIds].sort((a, b) => {
        const nameA = localitiesMap.get(a)?.displayName || '';
        const nameB = localitiesMap.get(b)?.displayName || '';
        return nameB.localeCompare(nameA, 'vi');
      });
      setSessionLocalities(this.workspace, activeSession.id, sorted);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession);
    });

    document.getElementById('btn-reorder-reverse')?.addEventListener('click', () => {
      const reversed = [...activeSession.selectedLocalityIds].reverse();
      setSessionLocalities(this.workspace, activeSession.id, reversed);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession);
    });
  }

  private bindLocalityCheckboxes(activeSession: Workspace['sessions'][number]): void {
    const itemsBox = document.getElementById('unified-locality-items-box');
    const chks = itemsBox
      ? itemsBox.querySelectorAll('.chk-select-locality')
      : document.querySelectorAll('.chk-select-locality');

    chks.forEach((chkEl) => {
      chkEl.addEventListener('change', () => {
        const locId = chkEl.getAttribute('data-loc-id');
        if (!locId) return;

        const isChecked = (chkEl as HTMLInputElement).checked;
        const set = new Set(activeSession.selectedLocalityIds);
        if (isChecked) {
          set.add(locId);
        } else {
          set.delete(locId);
        }
        setSessionLocalities(this.workspace, activeSession.id, Array.from(set));
        this.triggerAutosave();
        this.updateLocalityListView(activeSession);
      });
    });
  }

  private renderProjectModal(
    session: ReportSession | undefined,
    datasets: { GPMB?: Dataset }
  ): string {
    if (!session || (!this.editingProjectId && !this.isAddingProject)) {
      return '';
    }

    const baselineLocalities = this.workspace.localities;
    const selectedLocalities = baselineLocalities.filter((l) =>
      session.selectedLocalityIds.includes(l.id)
    );

    if (this.isAddingProject) {
      const locOptionsHtml = selectedLocalities
        .map(
          (loc) =>
            `<option value="${escapeHtmlUi(loc.id)}">${escapeHtmlUi(
              loc.displayName
            )}</option>`
        )
        .join('');

      return `<div class="proj-modal-backdrop" id="proj-modal-backdrop">
        <div class="proj-modal-dialog">
          <div class="proj-modal-header">
            <h3 class="proj-modal-title">Thêm dự án GPMB mới vào danh sách</h3>
            <button type="button" class="proj-modal-close" id="btn-close-proj-modal">&times;</button>
          </div>
          <form id="form-add-project">
            <div class="proj-modal-body">
              <div class="form-group">
                <label>Địa phương:</label>
                <select id="new-proj-locality" class="form-select" required>
                  ${locOptionsHtml}
                </select>
              </div>
              <div class="form-group">
                <label>Tên dự án:</label>
                <input type="text" id="new-proj-name" class="form-input" placeholder="Nhập tên dự án..." required />
              </div>
              <div class="form-group">
                <label>Tỷ lệ hoàn thành:</label>
                <input type="text" id="new-proj-rate" class="form-input" placeholder="Ví dụ: 75,50%" value="0,00%" required />
              </div>
              <div class="form-group">
                <label>Hạn hoàn thành:</label>
                <input type="text" id="new-proj-deadline" class="form-input" placeholder="Ví dụ: 31/12/2026 hoặc Trong năm 2026" value="31/12/2026" required />
              </div>
            </div>
            <div class="proj-modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-proj-modal">Hủy</button>
              <button type="submit" class="btn btn-primary">Thêm dự án</button>
            </div>
          </form>
        </div>
      </div>`;
    }

    // Editing existing project
    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities,
    });
    const proj = uncompletedRes.projects.find((p) => p.id === this.editingProjectId);
    if (!proj) {
      return '';
    }

    const overrides = session.settings.projectOverrides || {};
    const hasOverride = Boolean(overrides[proj.id]);

    return `<div class="proj-modal-backdrop" id="proj-modal-backdrop">
      <div class="proj-modal-dialog">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title">Chỉnh sửa thông tin dự án GPMB</h3>
          <button type="button" class="proj-modal-close" id="btn-close-proj-modal">&times;</button>
        </div>
        <form id="form-edit-project" data-project-id="${escapeHtmlUi(proj.id)}">
          <div class="proj-modal-body">
            <div class="form-group">
              <label>Địa phương:</label>
              <input type="text" class="form-input" value="${escapeHtmlUi(proj.localityName)}" disabled style="background:#f1f5f9; cursor:not-allowed;" />
            </div>
            <div class="form-group">
              <label>Tên dự án:</label>
              <textarea id="edit-proj-name" class="form-input" rows="2" required>${escapeHtmlUi(proj.projectName)}</textarea>
            </div>
            <div class="form-group">
              <label>Tỷ lệ hoàn thành:</label>
              <input type="text" id="edit-proj-rate" class="form-input" value="${escapeHtmlUi(proj.completionRate)}" required />
            </div>
            <div class="form-group">
              <label>Hạn hoàn thành:</label>
              <input type="text" id="edit-proj-deadline" class="form-input" value="${escapeHtmlUi(proj.deadline)}" required />
            </div>
            <div class="form-group">
              <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="edit-proj-hidden" ${proj.isHidden ? 'checked' : ''} />
                <span>Ẩn dự án này khỏi danh mục báo cáo</span>
              </label>
            </div>
          </div>
          <div class="proj-modal-footer">
            <div>
              ${
                hasOverride
                  ? `<button type="button" class="btn btn-outline-danger btn-sm" id="btn-reset-proj-override" data-project-id="${escapeHtmlUi(
                      proj.id
                    )}" title="Khôi phục lại tên, tỷ lệ, hạn hoàn thành từ file gốc">Khôi phục mặc định</button>`
                  : ''
              }
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-proj-modal">Hủy</button>
              <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
            </div>
          </div>
        </form>
      </div>
    </div>`;
  }

  private bindDomEvents(
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): void {
    // Navigation tabs
    document.querySelectorAll('[data-nav-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-nav-tab') as KtxhOfflineApp['activeTab'];
        if (tab) {
          this.activeTab = tab;
          this.popoverCell = null;
          this.render();
        }
      });
    });

    // Toggle Left Nav Sidebar
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      this.render();
    });

    // Topbar Session switch
    const sessionSelect = document.getElementById(
      'select-active-session'
    ) as HTMLSelectElement | null;
    sessionSelect?.addEventListener('change', () => {
      this.workspace.activeSessionId = sessionSelect.value;
      this.popoverCell = null;
      this.triggerAutosave();
      this.render();
    });

    // Topbar New Session
    document.getElementById('btn-topbar-new-session')?.addEventListener('click', () => {
      const name = window.prompt('Nhập tên phiên báo cáo mới:', 'Báo cáo KTXH phiên mới');
      if (name) {
        const s = createReportSession(this.workspace, { name });
        this.workspace.activeSessionId = s.id;
        this.triggerAutosave();
        this.setStatus(`Đã tạo phiên "${s.name}" (0 địa phương mặc định).`, 'success');
      }
    });

    // Topbar Clone Session
    document.getElementById('btn-topbar-clone-session')?.addEventListener('click', () => {
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      const cloned = cloneReportSession(
        this.workspace,
        activeSession.id,
        `${activeSession.name} (Bản sao)`
      );
      this.triggerAutosave();
      this.setStatus(`Đã nhân bản thành phiên "${cloned.name}".`, 'success');
    });

    // Topbar Export Excel Quick
    const handleExportXlsx = () => {
      const activeSession = this.getActiveSession();
      if (!activeSession || !evaluatedReport) {
        this.setStatus('Chưa có báo cáo để xuất.', 'warning');
        return;
      }
      try {
        const bytes = exportSessionReportToXlsxBytes({
          evaluated: evaluatedReport,
          baselineLocalities: this.workspace.localities,
          datasets,
        });
        const blob = new Blob([bytes as unknown as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bao_cao_KTXH_${activeSession.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.setStatus('Đã xuất tệp Excel (.xlsx) thành công.', 'success');
      } catch (err) {
        this.setStatus(`Lỗi xuất Excel: ${(err as Error).message}`, 'error');
      }
    };
    document.getElementById('btn-topbar-export-xlsx')?.addEventListener('click', handleExportXlsx);
    document.getElementById('btn-export-xlsx-full')?.addEventListener('click', handleExportXlsx);
    document.getElementById('btn-export-xlsx-quick')?.addEventListener('click', handleExportXlsx);

    // Topbar Print / PDF
    const handlePrint = () => {
      window.print();
    };
    document.getElementById('btn-topbar-print')?.addEventListener('click', handlePrint);
    document.getElementById('btn-trigger-window-print')?.addEventListener('click', handlePrint);
    document.getElementById('btn-print-quick')?.addEventListener('click', handlePrint);

    // Banner close
    document.getElementById('btn-clear-banner')?.addEventListener('click', () => {
      this.statusBannerMessage = '';
      this.render();
    });

    // Layout mode segmented controls
    document.querySelectorAll('[data-set-layout-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-set-layout-mode') as 'AUTO' | 'HORIZONTAL' | 'VERTICAL';
        const activeSession = this.getActiveSession();
        if (activeSession && mode) {
          activeSession.settings.tableLayoutMode = mode;
          this.triggerAutosave();
          this.render();
        }
      });
    });

    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.zoomScale = Math.min(2, Math.round((this.zoomScale + 0.1) * 10) / 10);
      this.render();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.zoomScale = Math.max(0.6, Math.round((this.zoomScale - 0.1) * 10) / 10);
      this.render();
    });
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.zoomScale = 1;
      this.render();
    });

    // Open Title Editor Panel
    document.getElementById('btn-studio-edit-title')?.addEventListener('click', () => {
      this.rightPanelMode = 'TITLE';
      this.render();
    });
    document.querySelectorAll('[data-action="open-title-editor"]').forEach((el) => {
      el.addEventListener('click', () => {
        this.rightPanelMode = 'TITLE';
        this.render();
      });
    });

    // Close Context Panel
    document.getElementById('btn-close-context-panel')?.addEventListener('click', () => {
      this.rightPanelMode = 'NONE';
      this.render();
    });

    // Switch Panel Tabs
    document.querySelectorAll('[data-open-panel-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-open-panel-mode') as RightPanelMode;
        if (m) {
          this.rightPanelMode = m;
          this.render();
        }
      });
    });

    // Title settings form submit
    document.getElementById('form-edit-title-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;

      const titleEl = document.getElementById('setting-report-title') as HTMLTextAreaElement | null;
      const subtitleEl = document.getElementById('setting-subtitle') as HTMLInputElement | null;
      const showSubtitleEl = document.getElementById('setting-show-subtitle') as HTMLInputElement | null;
      const agencyEl = document.getElementById('setting-agency-name') as HTMLInputElement | null;
      const subAgencyEl = document.getElementById('setting-sub-agency-name') as HTMLInputElement | null;
      const alignEl = document.getElementById('setting-title-align') as HTMLSelectElement | null;
      const sizeEl = document.getElementById('setting-title-size') as HTMLInputElement | null;
      const uppercaseEl = document.getElementById('setting-title-uppercase') as HTMLInputElement | null;
      const sigEl = document.getElementById('setting-show-signatures') as HTMLInputElement | null;
      const indWidthEl = document.getElementById('setting-indicator-col-width') as HTMLInputElement | null;

      activeSession.settings.reportTitle = titleEl?.value.trim() || activeSession.settings.reportTitle;
      activeSession.settings.subtitle = subtitleEl?.value.trim() || '';
      activeSession.settings.showSubtitle = showSubtitleEl?.checked ?? false;
      activeSession.settings.agencyName = agencyEl?.value.trim() || '';
      activeSession.settings.subAgencyName = subAgencyEl?.value.trim() || '';
      activeSession.settings.titleAlign = (alignEl?.value as 'center' | 'left') || 'center';
      activeSession.settings.titleFontSizePx = Number(sizeEl?.value) || 16;
      activeSession.settings.titleUppercase = uppercaseEl?.checked ?? true;
      activeSession.settings.showSignatures = sigEl?.checked ?? true;

      if (indWidthEl) {
        const parsed = Number(indWidthEl.value);
        if (parsed >= 160 && parsed <= 600) {
          activeSession.settings.indicatorColumnWidthPx = parsed;
        }
      }

      this.triggerAutosave();
      this.setStatus('Đã cập nhật tiêu đề và định dạng báo cáo.', 'success');
      this.render();
    });

    document.getElementById('btn-reset-ind-width')?.addEventListener('click', (e) => {
      e.preventDefault();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      activeSession.settings.indicatorColumnWidthPx = 240;
      this.triggerAutosave();
      this.setStatus('Đã khôi phục chiều rộng cột chỉ tiêu về mặc định 240px.', 'info');
      this.render();
    });

    // Inline edit indicator display label
    document.querySelectorAll('.btn-inline-edit-ind').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const indId = btn.getAttribute('data-indicator-id');
        const rowNum = Number(btn.getAttribute('data-row-number'));
        const activeSession = this.getActiveSession();
        if (!activeSession) return;

        const row = activeSession.templateRows.find((r) => r.rowNumber === rowNum);
        if (!row) return;

        const newLabel = window.prompt(`Đổi tên hiển thị cho chỉ tiêu "${row.indicatorId}":`, row.customLabel);
        if (newLabel !== null && newLabel.trim()) {
          row.customLabel = newLabel.trim();
          this.triggerAutosave();
          this.render();
        }
      });
    });

    // Uncompleted Projects toolbar & modal events
    document.querySelectorAll('.btn-action-edit-proj').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-project-id');
        if (pId) {
          this.editingProjectId = pId;
          this.isAddingProject = false;
          this.render();
        }
      });
    });

    document.getElementById('btn-add-custom-project')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAddingProject = true;
      this.editingProjectId = null;
      this.render();
    });

    document.getElementById('btn-toggle-projects-table')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      activeSession.settings.showUncompletedProjectsTable =
        activeSession.settings.showUncompletedProjectsTable === false ? true : false;
      this.triggerAutosave();
      this.render();
    });

    document.getElementById('btn-edit-uncompleted-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      const current =
        activeSession.settings.uncompletedRowCustomLabel ||
        'Trong đó: Số dự án GPMB chưa hoàn thành';
      const next = window.prompt(
        'Nhập tên hiển thị dòng tổng hợp số dự án GPMB chưa hoàn thành:',
        current
      );
      if (next !== null && next.trim()) {
        activeSession.settings.uncompletedRowCustomLabel = next.trim();
        this.triggerAutosave();
        this.render();
      }
    });

    document.getElementById('btn-close-proj-modal')?.addEventListener('click', () => {
      this.editingProjectId = null;
      this.isAddingProject = false;
      this.render();
    });

    document.getElementById('btn-cancel-proj-modal')?.addEventListener('click', () => {
      this.editingProjectId = null;
      this.isAddingProject = false;
      this.render();
    });

    document.getElementById('proj-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('proj-modal-backdrop')) {
        this.editingProjectId = null;
        this.isAddingProject = false;
        this.render();
      }
    });

    document.getElementById('form-edit-project')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;

      const pId = (e.target as HTMLElement).getAttribute('data-project-id');
      if (!pId) return;

      const nameVal = (
        document.getElementById('edit-proj-name') as HTMLTextAreaElement | null
      )?.value.trim();
      const rateVal = (
        document.getElementById('edit-proj-rate') as HTMLInputElement | null
      )?.value.trim();
      const deadlineVal = (
        document.getElementById('edit-proj-deadline') as HTMLInputElement | null
      )?.value.trim();
      const hiddenVal =
        (document.getElementById('edit-proj-hidden') as HTMLInputElement | null)
          ?.checked ?? false;

      if (!activeSession.settings.projectOverrides) {
        activeSession.settings.projectOverrides = {};
      }

      activeSession.settings.projectOverrides[pId] = {
        projectName: nameVal,
        completionRate: rateVal,
        deadline: deadlineVal,
        isHidden: hiddenVal,
      };

      this.editingProjectId = null;
      this.triggerAutosave();
      this.setStatus('Đã cập nhật dự án thành công.', 'success');
      this.render();
    });

    document.getElementById('btn-reset-proj-override')?.addEventListener('click', (e) => {
      e.preventDefault();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;

      const pId = (e.currentTarget as HTMLElement).getAttribute('data-project-id');
      if (pId && activeSession.settings.projectOverrides) {
        delete activeSession.settings.projectOverrides[pId];
        this.editingProjectId = null;
        this.triggerAutosave();
        this.setStatus('Đã khôi phục dữ liệu gốc cho dự án.', 'info');
        this.render();
      }
    });

    document.getElementById('form-add-project')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeSession = this.getActiveSession();
      if (!activeSession) return;

      const locSelect = document.getElementById(
        'new-proj-locality'
      ) as HTMLSelectElement | null;
      const nameInput = document.getElementById(
        'new-proj-name'
      ) as HTMLInputElement | null;
      const rateInput = document.getElementById(
        'new-proj-rate'
      ) as HTMLInputElement | null;
      const deadlineInput = document.getElementById(
        'new-proj-deadline'
      ) as HTMLInputElement | null;

      const locId = locSelect?.value;
      const loc = this.workspace.localities.find((l) => l.id === locId);
      if (!locId || !loc) return;

      if (!activeSession.settings.customProjects) {
        activeSession.settings.customProjects = [];
      }

      const customId = `custom_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      activeSession.settings.customProjects.push({
        id: customId,
        localityId: loc.id,
        localityName: loc.displayName,
        projectStt: activeSession.settings.customProjects.length + 1,
        projectName: nameInput?.value.trim() || 'Dự án mới',
        completionRate: rateInput?.value.trim() || '0,00%',
        deadline: deadlineInput?.value.trim() || 'Trong năm 2026',
        isCustom: true,
      });

      this.isAddingProject = false;
      this.triggerAutosave();
      this.setStatus(`Đã thêm dự án mới cho ${loc.displayName}.`, 'success');
      this.render();
    });

    // Interactive Cell click -> Popover
    document.querySelectorAll('.doc-cell, .report-cell').forEach((cellEl) => {
      cellEl.addEventListener('click', (e) => {
        const mouseEv = e as MouseEvent;
        const traceId = cellEl.getAttribute('data-trace-id');
        const locId = cellEl.getAttribute('data-locality-id') || '';
        const indId = cellEl.getAttribute('data-indicator-id') || '';

        if (!traceId || !evaluatedReport) return;
        const trace = evaluatedReport.tracesById.get(traceId);
        if (!trace) return;

        this.activeTraceId = traceId;
        this.activeTrace = trace;

        // Check for official note in DISB dataset
        const disbRec = datasets.DISB?.records.find((r) => r.localityId === locId);
        this.activeTraceExtraMeta = {
          officialNote: disbRec?.officialNote || null,
          inspectionMarker: disbRec?.inspectionMarker || null,
        };

        this.popoverCell = {
          traceId,
          localityId: locId,
          indicatorId: indId,
          clientX: mouseEv.clientX,
          clientY: mouseEv.clientY,
        };

        this.render();
      });
    });

    // Close popover
    document.getElementById('btn-close-popover')?.addEventListener('click', () => {
      this.popoverCell = null;
      this.render();
    });

    // Button on popover: Open full trace panel
    document.getElementById('btn-open-full-trace')?.addEventListener('click', () => {
      this.popoverCell = null;
      this.rightPanelMode = 'TRACE';
      this.render();
    });

    // Button on toolbar: Open warnings panel
    document.getElementById('btn-open-warnings-panel')?.addEventListener('click', () => {
      this.rightPanelMode = 'WARNINGS';
      this.render();
    });

    // Presets
    const setLocalitiesPreset = (ids: string[], label: string) => {
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      setSessionLocalities(this.workspace, activeSession.id, ids);
      this.triggerAutosave();
      this.setStatus(`Đã chọn ${label} (${ids.length} địa phương).`, 'success');
    };

    document.getElementById('btn-preset-5-xa')?.addEventListener('click', () => {
      const ids = this.workspace.localities
        .filter((l) => l.type === 'XA')
        .slice(0, 5)
        .map((l) => l.id);
      setLocalitiesPreset(ids, 'Mẫu 5 xã');
    });
    document.getElementById('btn-empty-preset-5-xa')?.addEventListener('click', () => {
      const ids = this.workspace.localities
        .filter((l) => l.type === 'XA')
        .slice(0, 5)
        .map((l) => l.id);
      setLocalitiesPreset(ids, 'Mẫu 5 xã');
    });

    document.getElementById('btn-preset-7-phuong')?.addEventListener('click', () => {
      const ids = this.workspace.localities
        .filter((l) => l.type === 'PHUONG')
        .slice(0, 7)
        .map((l) => l.id);
      setLocalitiesPreset(ids, 'Mẫu 7 phường');
    });
    document.getElementById('btn-empty-preset-7-phuong')?.addEventListener('click', () => {
      const ids = this.workspace.localities
        .filter((l) => l.type === 'PHUONG')
        .slice(0, 7)
        .map((l) => l.id);
      setLocalitiesPreset(ids, 'Mẫu 7 phường');
    });

    document.getElementById('btn-preset-11-xa')?.addEventListener('click', () => {
      // 11 communes from sample sheet
      const sample11Names = [
        'Hồng Châu',
        'Khúc Thừa Dụ',
        'Vĩnh Lại',
        'Chí Minh',
        'Đại Sơn',
        'Lạc Phượng',
        'Tân An',
        'Tứ Kỳ',
        'Ninh Giang',
        'Tân Kỳ',
        'Nguyên Giáp',
      ];
      const ids: string[] = [];
      for (const name of sample11Names) {
        const found = this.workspace.localities.find((l) => l.displayName.includes(name) || l.shortName === name);
        if (found) ids.push(found.id);
      }
      setLocalitiesPreset(ids.slice(0, 11), 'Mẫu 11 xã');
    });
    document.getElementById('btn-empty-preset-11-xa')?.addEventListener('click', () => {
      const ids = this.workspace.localities.slice(0, 11).map((l) => l.id);
      setLocalitiesPreset(ids, 'Mẫu 11 địa phương');
    });

    document.getElementById('btn-select-all-localities')?.addEventListener('click', () => {
      const ids = this.workspace.localities.map((l) => l.id);
      setLocalitiesPreset(ids, 'Toàn bộ 114 địa phương');
    });

    document.getElementById('btn-deselect-all-localities')?.addEventListener('click', () => {
      setLocalitiesPreset([], 'Rỗng (0 địa phương)');
    });
    document.getElementById('btn-clear-localities')?.addEventListener('click', () => {
      setLocalitiesPreset([], 'Rỗng (0 địa phương)');
    });

    const activeSession = this.getActiveSession();
    if (activeSession) {
      this.bindLocalityCheckboxes(activeSession);
      this.bindLocalityReorderEvents(activeSession);
    }

    // Locality search input
    const locSearchInput = document.getElementById(
      'input-unified-loc-search'
    ) as HTMLInputElement | null;
    locSearchInput?.addEventListener('input', () => {
      this.localitySearchQuery = locSearchInput.value;
      const s = this.getActiveSession();
      if (!s) return;
      this.updateLocalityListView(s);
    });

    // Locality type filter
    const locTypeSelect = document.getElementById(
      'select-unified-loc-type'
    ) as HTMLSelectElement | null;
    locTypeSelect?.addEventListener('change', () => {
      this.localityTypeFilter = locTypeSelect.value as 'ALL' | LocalityType;
      const s = this.getActiveSession();
      if (!s) return;
      this.updateLocalityListView(s);
    });

    // Locality sort option
    const locSortSelect = document.getElementById(
      'select-unified-loc-sort'
    ) as HTMLSelectElement | null;
    locSortSelect?.addEventListener('change', () => {
      this.localitySortOption = locSortSelect.value as any;
      const s = this.getActiveSession();
      if (!s) return;
      this.updateLocalityListView(s);
    });

    // Toggle coverage details drawer
    document.getElementById('btn-toggle-coverage-table')?.addEventListener('click', () => {
      const drawer = document.getElementById('coverage-details-drawer');
      const btn = document.getElementById('btn-toggle-coverage-table');
      if (drawer) {
        const isHidden = drawer.style.display === 'none';
        drawer.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? 'Ẩn chi tiết kiểm toán' : 'Chi tiết 7 địa bàn thiếu';
      }
    });

    // Drag and drop zone
    const dropzone = document.getElementById('dropzone-excel-files');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer?.files) {
          for (const f of Array.from(e.dataTransfer.files)) {
            const buf = await f.arrayBuffer();
            this.handleWorkbookBytesUpload(new Uint8Array(buf), f.name);
          }
        }
      });
      dropzone.addEventListener('click', () => {
        document.getElementById('input-xlsx-files')?.click();
      });
    }

    const inputFiles = document.getElementById(
      'input-xlsx-files'
    ) as HTMLInputElement | null;
    inputFiles?.addEventListener('change', async () => {
      if (inputFiles.files) {
        for (const f of Array.from(inputFiles.files)) {
          const buf = await f.arrayBuffer();
          this.handleWorkbookBytesUpload(new Uint8Array(buf), f.name);
        }
      }
    });

    const inputFilesBtn = document.getElementById(
      'input-xlsx-files-btn'
    ) as HTMLInputElement | null;
    inputFilesBtn?.addEventListener('change', async () => {
      if (inputFilesBtn.files) {
        for (const f of Array.from(inputFilesBtn.files)) {
          const buf = await f.arrayBuffer();
          this.handleWorkbookBytesUpload(new Uint8Array(buf), f.name);
        }
      }
    });

    // Save asOfDate for any dataset (DISB, REV, GPMB)
    document.querySelectorAll('.btn-save-asof-date').forEach((btnEl) => {
      btnEl.addEventListener('click', () => {
        const dsId = btnEl.getAttribute('data-dataset-id');
        if (!dsId) return;
        const ds = this.workspace.datasets.find((d) => d.id === dsId);
        if (!ds) return;
        const inputEl = document.getElementById(
          `input-asof-date-${dsId}`
        ) as HTMLInputElement | null;
        if (!inputEl || !inputEl.value) return;

        const newDateIso = inputEl.value; // e.g. "2026-10-25"
        ds.asOfDate = newDateIso;
        ds.asOfStatus = 'MANUAL_CONFIRMED';
        ds.asOfDateConfirmation = {
          confirmedByUser: true,
          confirmedAt: new Date().toISOString(),
          reason: 'Người dùng điều chỉnh trực tiếp trong mục Quản lý dữ liệu nguồn',
        };

        // Update provenance in dataset records
        for (const rec of ds.records) {
          for (const m of Object.values(rec.metrics)) {
            m.provenance.asOfDate = ds.asOfDate;
          }
        }

        // Auto-update dates in all session report labels
        syncReportLabelsWithDatasetDates(this.workspace);
        this.triggerAutosave();

        const dateVn = formatVnDate(newDateIso);
        this.setStatus(
          `Đã cập nhật ngày chốt nguồn ${ds.sourceType} thành ${dateVn}. Tiêu đề chỉ tiêu trong bảng báo cáo đã tự động đồng bộ!`,
          'success'
        );
        this.render();
      });
    });

    // Confirm REV date
    document.getElementById('btn-confirm-rev-date')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const dsId = btn.getAttribute('data-dataset-id') || '';
      const dateEl = document.getElementById('input-confirm-rev-date') as HTMLInputElement | null;
      try {
        confirmDatasetAsOfDate(
          this.workspace,
          dsId,
          dateEl?.value || '2026-10-19',
          'Xác nhận ngày chốt thực tế'
        );
        this.triggerAutosave();
        this.setStatus('Đã xác nhận ngày chốt cho nguồn Thu NSNN.', 'success');
      } catch (err) {
        this.setStatus((err as Error).message, 'error');
      }
    });

    // Embedded load
    document.getElementById('btn-load-embedded-confirmed')?.addEventListener('click', () => {
      this.loadEmbeddedReferenceWorkbooks('2026-10-19');
    });
    document.getElementById('btn-quick-load-3-sources')?.addEventListener('click', () => {
      this.loadEmbeddedReferenceWorkbooks('2026-10-19');
    });

    // Create session in sessions page
    document.getElementById('btn-create-session')?.addEventListener('click', () => {
      const nameInput = document.getElementById('input-new-session-name') as HTMLInputElement | null;
      const name = nameInput?.value || 'Phiên báo cáo mới';
      const s = createReportSession(this.workspace, { name });
      this.workspace.activeSessionId = s.id;
      this.triggerAutosave();
      this.setStatus(`Đã tạo phiên "${s.name}" (0 địa phương mặc định).`, 'success');
    });

    // Session row actions
    document.querySelectorAll('[data-action="open-session-report"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        if (id) {
          this.workspace.activeSessionId = id;
          this.activeTab = 'REPORT';
          this.triggerAutosave();
          this.render();
        }
      });
    });

    document.querySelectorAll('[data-action="clone-session"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        if (id) {
          const src = this.workspace.sessions.find((s) => s.id === id);
          const cloned = cloneReportSession(
            this.workspace,
            id,
            `${src?.name || 'Phiên'} (Bản sao)`
          );
          this.triggerAutosave();
          this.setStatus(`Đã nhân bản thành "${cloned.name}".`, 'success');
        }
      });
    });

    document.querySelectorAll('[data-action="delete-session"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        if (id && window.confirm('Bạn có chắc chắn muốn xóa phiên báo cáo này?')) {
          deleteReportSession(this.workspace, id, true);
          this.triggerAutosave();
          this.setStatus('Đã xóa phiên báo cáo.', 'info');
        }
      });
    });

    // Backup & Restore
    document.getElementById('btn-download-backup-json')?.addEventListener('click', () => {
      const jsonStr = exportWorkspaceBackupJson(this.workspace);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KTXH_Workspace_Backup_${Date.now()}.kxh.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.workspace.unsavedChanges = false;
      this.render();
      this.setStatus('Đã lưu toàn bộ hồ sơ (.kxh.json) thành công.', 'success');
    });

    const restoreInput = document.getElementById(
      'input-restore-backup-file'
    ) as HTMLInputElement | null;
    restoreInput?.addEventListener('change', async () => {
      if (restoreInput.files && restoreInput.files[0]) {
        try {
          const text = await restoreInput.files[0].text();
          const restored = restoreWorkspaceFromBackupJson(text);
          this.workspace = restored;
          this.triggerAutosave();
          this.setStatus(
            `Đã khôi phục thành công hồ sơ "${restored.name}" (${restored.sessions.length} phiên).`,
            'success'
          );
        } catch (err) {
          this.setStatus(`Lỗi khôi phục hồ sơ: ${(err as Error).message}`, 'error');
        }
      }
    });

    // Close popover on Escape key
    window.onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.popoverCell) {
          this.popoverCell = null;
          this.render();
        } else if (this.rightPanelMode !== 'NONE') {
          this.rightPanelMode = 'NONE';
          this.render();
        }
      }
    };
  }
}

// Auto mount if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new KtxhOfflineApp();
    window.__KTXH_APP__ = app;
    app.render();
  });
}
