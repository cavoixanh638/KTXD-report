import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  confirmDatasetAsOfDate,
  createReportSession,
  cloneReportSession,
  renameReportSession,
  deleteReportSession,
  setSessionLocalities,
  rebindSessionDataset,
  clearSessionDatasetBinding,
  updateDatasetAsOfDateForSession,
  getSessionLocalitiesBaseline,
  resolveSessionDatasets,
  migrateLegacySessionLabels,
  sanitizeWorkspace,
  syncReportLabelsWithDatasetDates,
  formatVnDate,
  formatIsoDate,
} from '../core/sessions';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
  detectSheetFingerprint,
  parseWorkbookBytes,
} from '../core/sourceReaders';
import {
  evaluateSessionReport,
  EvaluatedSessionReport,
  computeBenchmarkRatio,
} from '../core/calculationTrace';
import { analyzeSourceCoverage } from '../core/coverage';
import { filterWarningsForSession } from '../core/warnings';
import { searchLocalities } from '../core/localities';
import { renderA4DocumentStudioHtml, computeAutoLayoutMode } from '../ui/reportStudio';
import {
  renderTraceInspectorHtml,
  renderCellTracePopoverHtml,
  escapeHtmlUi,
  TraceInspectorExtraMeta,
} from '../ui/cellInspector';
import { uiIcon } from '../ui/icons';
import { exportSessionReportToXlsxBytes } from '../export/xlsx';
import { generatePrintableReportHtml } from '../export/print';
import {
  exportWorkspaceBackupJson,
  restoreWorkspaceFromBackupJson,
} from '../backup/workspace';
import { saveWorkspacePersistent, loadWorkspacePersistent } from '../core/storage';
import {
  CalculationTrace,
  LocalityType,
  Workspace,
  ReportSession,
  Dataset,
  Locality,
  getDisbSchemaProfile,
} from '../core/types';
import {
  formatRevBenchmarkRowLabel,
  formatRevRealizedRowLabel,
  reportMainStt,
  TEMPLATE_14_ROWS_DEFAULT,
} from '../core/indicators';
import {
  getUncompletedProjectsForSession,
  formatProjectDeadline,
} from '../core/uncompletedProjects';

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

export type RightPanelMode = 'NONE' | 'TRACE' | 'WARNINGS' | 'TITLE' | 'INDICATORS';

export class KtxhOfflineApp {
  public workspace: Workspace;

  public isSidebarCollapsed = false;
  public rightPanelMode: RightPanelMode = 'NONE';
  public activeTraceId: string | undefined;
  public activeTrace: CalculationTrace | null = null;
  public activeTraceExtraMeta?: TraceInspectorExtraMeta;

  // Dual-pane collapsible blocks
  public sidebarSectionsOpen = {
    sources: true,
    localities: true,
    settings: true,
  };

  // Modals
  public showNewSessionModal = false;
  public newSessionNameDraft = 'Báo cáo KTXH phiên mới';
  public newSessionSourceMode: 'CURRENT' | 'EMBEDDED' | 'EMPTY' = 'CURRENT';
  public showRenameSessionModal = false;
  public renameSessionNameDraft = '';
  public showCoverageModal = false;
  public showIndicatorsModal = false;

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
  public localitySortOption: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'TYPE' | 'SELECTED_FIRST' =
    'SELECTED_FIRST';

  // Status & Autosave states
  public statusBannerMessage = '';
  public statusBannerType: 'info' | 'warning' | 'error' | 'success' = 'info';
  public lastSavedTimestamp = '';
  public isSaving = false;
  public autosaveTimer: number | null = null;
  public zoomScale = 1;

  // Uncompleted Projects editor state
  public editingProjectId: string | null = null;
  public isAddingProject = false;

  // NQ 11 Projects editor state
  public editingNq11Id: string | null = null;
  public isAddingNq11 = false;
  public targetNq11LocalityId: string | null = null;

  constructor() {
    this.workspace = createEmptyWorkspace('Hồ sơ Báo cáo KTXH Offline (MASTER V2.2)');
    this.initWorkspace();
  }

  public clearCellSelection(closeTracePanel = true): boolean {
    const hadSelection = Boolean(
      this.popoverCell ||
        this.activeTraceId ||
        this.activeTrace ||
        (closeTracePanel && this.rightPanelMode === 'TRACE')
    );
    if (!hadSelection) return false;
    this.popoverCell = null;
    this.activeTraceId = undefined;
    this.activeTrace = null;
    this.activeTraceExtraMeta = undefined;
    if (closeTracePanel && this.rightPanelMode === 'TRACE') {
      this.rightPanelMode = 'NONE';
    }
    return true;
  }

  public handleEscapeKey(
    activeEl?: { matches?: (sel: string) => boolean; blur?: () => void } | null
  ): boolean {
    if (this.editingProjectId || this.isAddingProject) {
      this.editingProjectId = null;
      this.isAddingProject = false;
      this.render();
      return true;
    }
    if (this.editingNq11Id || this.isAddingNq11) {
      this.editingNq11Id = null;
      this.isAddingNq11 = false;
      this.targetNq11LocalityId = null;
      this.render();
      return true;
    }
    if (
      this.showNewSessionModal ||
      this.showRenameSessionModal ||
      this.showCoverageModal ||
      this.showIndicatorsModal
    ) {
      this.showNewSessionModal = false;
      this.showRenameSessionModal = false;
      this.showCoverageModal = false;
      this.showIndicatorsModal = false;
      this.render();
      return true;
    }
    if (this.clearCellSelection(true)) {
      if (activeEl?.matches?.('.doc-cell, .report-cell')) {
        activeEl.blur?.();
      }
      this.render();
      return true;
    }
    if (this.rightPanelMode !== 'NONE') {
      this.rightPanelMode = 'NONE';
      this.render();
      return true;
    }
    return false;
  }

  private async initWorkspace(): Promise<void> {
    try {
      const loaded = await Promise.race([
        loadWorkspacePersistent(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (loaded && loaded.formatVersion === 2 && Array.isArray(loaded.sessions)) {
        this.workspace = loaded;
      }
      sanitizeWorkspace(this.workspace);
      migrateLegacySessionLabels(this.workspace);
      this.ensureInitialDatasetsAndEmptySession();
      this.lastSavedTimestamp = new Date().toLocaleTimeString('vi-VN');
      this.render();
    } catch (err) {
      try {
        this.workspace = createEmptyWorkspace('Hồ sơ Báo cáo KTXH Offline (MASTER V2.2)');
        this.ensureInitialDatasetsAndEmptySession();
        this.lastSavedTimestamp = new Date().toLocaleTimeString('vi-VN');
        this.statusBannerMessage = `Đã tự động khôi phục phiên mới an toàn (dữ liệu cache cũ lỗi: ${
          (err as Error)?.message || String(err)
        }).`;
        this.statusBannerType = 'warning';
        this.render();
      } catch (fatalErr) {
        this.renderFatalRecoveryScreen(fatalErr);
      }
    }
  }

  private renderFatalRecoveryScreen(err: unknown): void {
    const root = document.getElementById('app');
    if (!root) return;
    const msg = escapeHtmlUi(
      err instanceof Error ? err.stack || err.message : String(err)
    );
    root.innerHTML = `<div style="max-width:720px;margin:32px auto;padding:24px;border:1px solid #fca5a5;border-radius:10px;background:#fef2f2;color:#7f1d1d;font-family:system-ui,Segoe UI,sans-serif;">
      <h2 style="margin:0 0 10px 0;font-size:18px;display:flex;align-items:center;gap:8px;">${uiIcon('alert', 20)} Không thể khởi tạo Báo cáo KTXH Offline</h2>
      <p style="margin:0 0 12px 0;font-size:14px;">Bộ nhớ cache cũ của trình duyệt có thể đang bị lỗi hoặc kẹt khóa. Bạn hãy bấm nút bên dưới để làm sạch bộ nhớ tạm và khởi động lại ngay:</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#fff;padding:10px;border:1px solid #fecaca;border-radius:6px;font-size:12px;max-height:220px;overflow:auto;">${msg}</pre>
      <div style="margin-top:14px;">
        <button type="button" id="btn-fatal-reset-storage" style="padding:8px 16px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${uiIcon('undo', 15)} Xóa bộ nhớ tạm &amp; Tải lại ứng dụng</button>
      </div>
    </div>`;
    document.getElementById('btn-fatal-reset-storage')?.addEventListener('click', () => {
      try {
        localStorage.removeItem('KTXH_OFFLINE_WORKSPACE_CACHE_V2_2');
        localStorage.removeItem('KTXH_OFFLINE_SESSIONS_COMPACT_V2_2');
      } catch {
        // ignore
      }
      try {
        indexedDB.deleteDatabase('KTXH_OFFLINE_STUDIO_DB');
      } catch {
        // ignore
      }
      window.location.reload();
    });
  }

  private ensureInitialDatasetsAndEmptySession(): void {
    sanitizeWorkspace(this.workspace);
    const hasDisb = this.workspace.datasets.some((d) => d.sourceType === 'DISB');
    const hasRev = this.workspace.datasets.some((d) => d.sourceType === 'REV');
    const hasGpmb = this.workspace.datasets.some((d) => d.sourceType === 'GPMB');
    const needsLocalities = this.workspace.localities.length === 0;

    if (
      (!hasDisb || !hasRev || !hasGpmb || needsLocalities) &&
      typeof window !== 'undefined' &&
      window.__EMBEDDED_REFERENCE_FIXTURES__
    ) {
      const fixtures = window.__EMBEDDED_REFERENCE_FIXTURES__;

      if (!hasDisb || needsLocalities) {
        const disbBytes = base64ToUint8Array(fixtures.DISB_B64);
        const { dataset: disbDs, localities } = importDisbursementWorkbook(
          disbBytes,
          'Báo cáo giải ngân 15.10 sửa(1).xlsx'
        );
        if (!hasDisb) {
          registerDatasetInWorkspace(this.workspace, disbDs, localities);
        } else if (needsLocalities && localities.length > 0) {
          this.workspace.localities = localities;
        }
      }

      if (!hasRev) {
        const revBytes = base64ToUint8Array(fixtures.REV_B64);
        const { dataset: revDs } = importRevenueWorkbook(
          revBytes,
          'Bc thu 10 thang-19.10-BC (1)(1).xlsx',
          {
            confirmedAsOfDate: '2026-10-19',
            asOfConfirmationReason: 'Xác nhận ngày chốt sơ bộ kỳ 10 tháng năm 2026',
          }
        );
        registerDatasetInWorkspace(this.workspace, revDs);
      }

      if (!hasGpmb) {
        const gpmbBytes = base64ToUint8Array(fixtures.GPMB_B64);
        const { dataset: gpmbDs } = importGpmbWorkbook(
          gpmbBytes,
          'PL01_Tổng hợp DA_26.12.26(1).xlsx'
        );
        registerDatasetInWorkspace(this.workspace, gpmbDs);
      }
    }

    const latestDisb = [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'DISB');
    const latestRev = [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'REV');
    const latestGpmb = [...this.workspace.datasets].reverse().find((d) => d.sourceType === 'GPMB');
    const validIds = new Set(this.workspace.datasets.map((d) => d.id));

    for (const s of this.workspace.sessions) {
      if (!s.dataBindings) s.dataBindings = {};
      if (s.allowEmptySources) {
        // Respect sessions explicitly configured with independent/empty source slots;
        // clear dangling IDs without auto-attaching datasets from other sessions.
        if (s.dataBindings.DISB && !validIds.has(s.dataBindings.DISB)) delete s.dataBindings.DISB;
        if (s.dataBindings.REV && !validIds.has(s.dataBindings.REV)) delete s.dataBindings.REV;
        if (s.dataBindings.GPMB && !validIds.has(s.dataBindings.GPMB)) delete s.dataBindings.GPMB;
        continue;
      }
      if (latestDisb && (!s.dataBindings.DISB || !validIds.has(s.dataBindings.DISB))) {
        s.dataBindings.DISB = latestDisb.id;
      }
      if (latestRev && (!s.dataBindings.REV || !validIds.has(s.dataBindings.REV))) {
        s.dataBindings.REV = latestRev.id;
      }
      if (latestGpmb && (!s.dataBindings.GPMB || !validIds.has(s.dataBindings.GPMB))) {
        s.dataBindings.GPMB = latestGpmb.id;
      }
    }

    if (this.workspace.sessions.length === 0) {
      createReportSession(this.workspace, { name: 'Báo cáo KTXH phiên mới' });
    } else if (
      !this.workspace.activeSessionId ||
      !this.workspace.sessions.some((s) => s.id === this.workspace.activeSessionId)
    ) {
      this.workspace.activeSessionId = this.workspace.sessions[0].id;
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
    }, 1500);
  }

  private renderAutosavePill(): void {
    const pill = document.getElementById('autosave-status-pill');
    if (!pill) return;
    if (this.isSaving) {
      pill.className = 'autosave-pill autosave-saving';
      pill.innerHTML = `<span class="spinner-dot"></span> Đang lưu...`;
    } else {
      pill.className = 'autosave-pill autosave-saved';
      pill.innerHTML = `${uiIcon('check', 13)} Tự lưu ${escapeHtmlUi(this.lastSavedTimestamp)}`;
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

  /**
   * Loads the 3 embedded reference workbooks ONLY into the active session,
   * preserving source isolation across all other sessions.
   */
  public loadEmbeddedReferenceWorkbooks(revConfirmedDate = '2026-10-19'): void {
    const fixtures = window.__EMBEDDED_REFERENCE_FIXTURES__;
    if (!fixtures) {
      this.setStatus(
        'Không tìm thấy bộ fixture nhúng sẵn; vui lòng chọn 3 tệp .xlsx từ máy tính.',
        'warning'
      );
      return;
    }

    const activeSession = this.getActiveSession();
    if (!activeSession) {
      this.setStatus('Vui lòng chọn hoặc tạo một phiên báo cáo trước.', 'warning');
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

    rebindSessionDataset(this.workspace, activeSession.id, 'DISB', disbDs.id);
    rebindSessionDataset(this.workspace, activeSession.id, 'REV', revDs.id);
    rebindSessionDataset(this.workspace, activeSession.id, 'GPMB', gpmbDs.id);

    this.triggerAutosave();
    this.setStatus(
      revConfirmedDate
        ? `Đã nạp 3 nguồn tham chiếu cho riêng phiên "${activeSession.name}" (các phiên khác giữ nguyên).`
        : `Đã nạp 3 nguồn tham chiếu cho phiên "${activeSession.name}". Vui lòng xác nhận ngày chốt Thu NSNN.`,
      revConfirmedDate ? 'success' : 'warning'
    );
  }

  /**
   * Imports an Excel/CSV workbook and binds it ONLY to the currently active session.
   */
  private async importSelectedFiles(
    fileList: FileList | File[],
    expectedSourceType?: 'DISB' | 'REV' | 'GPMB'
  ): Promise<void> {
    const entries = await Promise.all(
      Array.from(fileList).map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      }))
    );
    for (const entry of entries) {
      this.handleWorkbookBytesUpload(entry.bytes, entry.name, expectedSourceType);
    }
  }

  public handleWorkbookBytesUpload(
    bytes: Uint8Array,
    filename: string,
    expectedSourceType?: 'DISB' | 'REV' | 'GPMB'
  ): void {
    const activeSession = this.getActiveSession();
    if (!activeSession) {
      this.setStatus('Chưa có phiên báo cáo đang mở để gắn nguồn.', 'error');
      return;
    }

    try {
      const wb = parseWorkbookBytes(bytes, filename);
      const visibleSheets = wb.sheets.filter((s) => s.state === 'visible');
      for (const s of visibleSheets) {
        const fp = detectSheetFingerprint(s);
        if (
          fp === 'DISB_V1' ||
          fp === 'DISB_TOTAL_LOCALITY_V2' ||
          fp === 'DISB_PHAN_CAP_XA_V1' ||
          fp === 'DISB_PHAN_CAP_XA_V2'
        ) {
          if (expectedSourceType && expectedSourceType !== 'DISB') {
            this.setStatus(
              `Tệp "${filename}" được nhận diện là nguồn Giải ngân (DISB), không khớp ô nguồn ${expectedSourceType} bạn vừa chọn.`,
              'warning'
            );
            return;
          }
          const { dataset, localities } = importDisbursementWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset, localities);
          rebindSessionDataset(this.workspace, activeSession.id, 'DISB', dataset.id);
          this.triggerAutosave();
          this.setStatus(
            fp === 'DISB_PHAN_CAP_XA_V2'
              ? `Đã cập nhật nguồn Giải ngân (Phân cấp xã · 15 cột) "${filename}" cho riêng phiên "${activeSession.name}" (${dataset.unitCount} ĐP, chốt ${formatVnDate(dataset.asOfDate)}).`
              : fp === 'DISB_PHAN_CAP_XA_V1'
              ? `Đã cập nhật nguồn Giải ngân (Phân cấp xã · 12 cột) "${filename}" cho riêng phiên "${activeSession.name}" (${dataset.unitCount} ĐP, chốt ${formatVnDate(dataset.asOfDate)}).`
              : `Đã cập nhật nguồn Giải ngân "${filename}" cho riêng phiên "${activeSession.name}" (${dataset.unitCount} ĐP, chốt ${formatVnDate(dataset.asOfDate)}).`,
            'success'
          );
          return;
        }
        if (fp === 'REV_V1') {
          if (expectedSourceType && expectedSourceType !== 'REV') {
            this.setStatus(
              `Tệp "${filename}" được nhận diện là nguồn Thu NSNN (REV), không khớp ô nguồn ${expectedSourceType} bạn vừa chọn.`,
              'warning'
            );
            return;
          }
          const { dataset } = importRevenueWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          rebindSessionDataset(this.workspace, activeSession.id, 'REV', dataset.id);
          this.triggerAutosave();
          this.setStatus(
            `Đã cập nhật nguồn Thu NSNN "${filename}" cho riêng phiên "${activeSession.name}" (${dataset.unitCount} ĐP, chốt ${formatVnDate(dataset.asOfDate) || 'chưa rõ'}).`,
            dataset.asOfStatus === 'REQUIRES_USER_CONFIRMATION' ? 'warning' : 'success'
          );
          return;
        }
        if (fp === 'GPMB_V1' || fp === 'GPMB_FLAT') {
          if (expectedSourceType && expectedSourceType !== 'GPMB') {
            this.setStatus(
              `Tệp "${filename}" được nhận diện là nguồn GPMB, không khớp ô nguồn ${expectedSourceType} bạn vừa chọn.`,
              'warning'
            );
            return;
          }
          const { dataset } = importGpmbWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          rebindSessionDataset(this.workspace, activeSession.id, 'GPMB', dataset.id);
          this.triggerAutosave();
          this.setStatus(
            `Đã cập nhật nguồn GPMB (${fp === 'GPMB_FLAT' ? 'bảng phẳng' : 'phân nhóm'}) "${filename}" cho riêng phiên "${activeSession.name}" (${dataset.unitCount} địa bàn, ${dataset.projectRowCount} DA).`,
            'success'
          );
          return;
        }
        if (fp === 'RESULT_TEMPLATE_V1') {
          this.setStatus(
            `Tệp "${filename}" là Bảng mẫu trình bày 14 dòng (RESULT_REFERENCE), không phải file số liệu nguồn.`,
            'info'
          );
          return;
        }
      }
      this.setStatus(
        `Không nhận diện được cấu trúc nguồn chuẩn trong "${filename}". Vui lòng kiểm tra sheet và cột tiêu đề.`,
        'error'
      );
    } catch (err) {
      this.setStatus(`Lỗi khi đọc tệp "${filename}": ${(err as Error).message}`, 'error');
    }
  }

  public getActiveSession(): ReportSession | undefined {
    return this.workspace.sessions.find((s) => s.id === this.workspace.activeSessionId);
  }

  public getLatestDatasetsMap(): { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset } {
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

  public getEffectiveBaselineLocalities(
    activeSession: ReportSession | undefined,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
  ): Locality[] {
    return getSessionLocalitiesBaseline(this.workspace, activeSession, datasets);
  }

  private legacyImportNeedsReview(datasets:{REV?:Dataset;DISB?:Dataset;GPMB?:Dataset}):string[] {
    const warnings:string[]=[];
    const rev=datasets.REV,disb=datasets.DISB;
    if (rev && rev.mappingVersion==='REV_ADAPTER_V2.2' && rev.workbookSha256!=='b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f') warnings.push('Thu NSNN: cần nhập lại Excel để kiểm tra tiêu đề cột thay vì cột R/W cũ.');
    if (disb && disb.schemaFingerprint==='DISB_V1' && disb.unitCount===109) warnings.push('Giải ngân: cần nhập lại Excel để kiểm tra đủ 114 địa phương và cấu trúc cột.');
    return warnings;
  }

  private evaluateActiveContext(): {
    activeSession: ReportSession | undefined;
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
    effectiveLocalities: Locality[];
    hasAllThreeSources: boolean;
    evaluatedReport: EvaluatedSessionReport | null;
  } {
    const activeSession = this.getActiveSession();
    const datasets = this.getLatestDatasetsMap();
    const effectiveLocalities = this.getEffectiveBaselineLocalities(activeSession, datasets);
    const hasAllThreeSources = Boolean(datasets.DISB && datasets.REV && datasets.GPMB && !this.legacyImportNeedsReview(datasets).length);
    let evaluatedReport: EvaluatedSessionReport | null = null;
    if (activeSession && hasAllThreeSources) {
      evaluatedReport = evaluateSessionReport({
        session: activeSession,
        baselineLocalities: effectiveLocalities,
        datasets,
      });
    }
    return {
      activeSession,
      datasets,
      effectiveLocalities,
      hasAllThreeSources,
      evaluatedReport,
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

    const {
      activeSession,
      datasets,
      effectiveLocalities,
      evaluatedReport,
    } = this.evaluateActiveContext();

    const topBarHtml = this.renderTopBar(activeSession);
    const leftSidebarHtml = this.renderLeftControlSidebar(
      activeSession,
      datasets,
      effectiveLocalities
    );
    const centerWorkspaceHtml = this.renderCenterCanvasArea(
      activeSession,
      evaluatedReport,
      datasets,
      effectiveLocalities
    );
    const rightPanelHtml = `<div id="right-context-panel-host" class="no-print">${this.renderRightContextPanel(
      activeSession,
      evaluatedReport,
      datasets
    )}</div>`;

    const statusBannerHtml = `<div id="status-banner-host" class="no-print">${this.renderStatusBannerMarkup()}</div>`;

    const popoverHtml = `<div id="popover-host" class="no-print">${this.renderCellPopoverHtml(
      evaluatedReport,
      datasets
    )}</div>`;
    const projectModalHtml = this.renderProjectModal(activeSession, datasets, effectiveLocalities);
    const nq11ModalHtml = this.renderNq11Modal(activeSession, effectiveLocalities);
    const newSessionModalHtml = this.renderNewSessionModal(datasets);
    const renameSessionModalHtml = this.renderRenameSessionModal(activeSession);
    const coverageModalHtml = this.renderCoverageModal(activeSession, datasets, effectiveLocalities);
    const indicatorsModalHtml = this.renderIndicatorsModal(activeSession, datasets);

    root.innerHTML = `
      <div class="studio-app-shell">
        ${topBarHtml}
        ${statusBannerHtml}
        <div class="studio-main-body">
          ${leftSidebarHtml}
          <main class="studio-center-workspace" id="studio-center-workspace">
            ${centerWorkspaceHtml}
          </main>
          ${rightPanelHtml}
        </div>
      </div>
      ${popoverHtml}
      ${projectModalHtml}
      ${nq11ModalHtml}
      ${newSessionModalHtml}
      ${renameSessionModalHtml}
      ${coverageModalHtml}
      ${indicatorsModalHtml}
      <div id="print-mount-area" class="print-only">
        ${
          evaluatedReport
            ? generatePrintableReportHtml({
                evaluated: evaluatedReport,
                baselineLocalities: effectiveLocalities,
                datasets,
                includeTraceAppendix: false,
                includeAppendix: false,
              })
            : ''
        }
      </div>
    `;

    this.bindDomEvents(evaluatedReport, datasets, effectiveLocalities);

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

  private renderStatusBannerMarkup(): string {
    if (!this.statusBannerMessage) return '';
    return `<div class="status-banner status-${this.statusBannerType} no-print">
      <span>${escapeHtmlUi(this.statusBannerMessage)}</span>
      <button type="button" class="btn-close-banner" id="btn-clear-banner" aria-label="Đóng thông báo">${uiIcon('close', 14)}</button>
    </div>`;
  }

  /**
   * Re-renders only the live A4 preview + print area + warning counters when
   * typing or toggling controls in the left sidebar, keeping sidebar scroll and input focus intact.
   */
  private refreshLiveReportArea(): void {
    const {
      activeSession,
      datasets,
      effectiveLocalities,
      evaluatedReport,
    } = this.evaluateActiveContext();

    const centerEl = document.getElementById('studio-center-workspace');
    if (centerEl) {
      centerEl.innerHTML = this.renderCenterCanvasArea(
        activeSession,
        evaluatedReport,
        datasets,
        effectiveLocalities
      );
    }

    const printArea = document.getElementById('print-mount-area');
    if (printArea) {
      printArea.innerHTML = evaluatedReport
        ? generatePrintableReportHtml({
            evaluated: evaluatedReport,
            baselineLocalities: effectiveLocalities,
            datasets,
            includeTraceAppendix: false,
            includeAppendix: false,
          })
        : '';
    }

    const locCountPill = document.getElementById('sidebar-loc-count-pill');
    if (locCountPill && activeSession) {
      locCountPill.textContent = `${activeSession.selectedLocalityIds.length}/${effectiveLocalities.length}`;
    }

    const sessionSel = document.getElementById('select-active-session') as HTMLSelectElement | null;
    if (sessionSel && activeSession) {
      const opt = Array.from(sessionSel.options).find((o) => o.value === activeSession.id);
      if (opt) {
        opt.textContent = this.formatSessionOptionLabel(activeSession);
      }
    }

    // Keep active trace & popover consistent with currently selected cells
    if (this.activeTraceId && (!evaluatedReport || !evaluatedReport.tracesById.has(this.activeTraceId))) {
      this.clearCellSelection(false);
    }
    const popoverHost = document.getElementById('popover-host');
    if (popoverHost) {
      popoverHost.innerHTML = this.renderCellPopoverHtml(evaluatedReport, datasets);
      this.bindPopoverEvents();
    }

    // Sync Right Context Drawer if currently open (e.g., Warnings list updates live on locality check/uncheck)
    const rightHost = document.getElementById('right-context-panel-host');
    if (rightHost) {
      rightHost.innerHTML = this.renderRightContextPanel(activeSession, evaluatedReport, datasets);
      this.bindRightPanelEvents();
    }

    this.bindCanvasInteractiveEvents(evaluatedReport, datasets);
  }

  private bindRightPanelEvents(): void {
    document.getElementById('btn-close-context-panel')?.addEventListener('click', () => {
      const closingTrace = this.rightPanelMode === 'TRACE';
      this.rightPanelMode = 'NONE';
      if (closingTrace && !this.popoverCell) {
        this.activeTraceId = undefined;
      }
      this.render();
    });
    document.querySelectorAll('[data-open-panel-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-open-panel-mode') as RightPanelMode;
        if (m) {
          this.rightPanelMode = m;
          this.render();
        }
      });
    });
    document.getElementById('btn-warnings-open-coverage')?.addEventListener('click', () => {
      this.showCoverageModal = true;
      this.render();
    });
  }

  private bindPopoverEvents(): void {
    document.getElementById('btn-close-popover')?.addEventListener('click', () => {
      this.popoverCell = null;
      if (this.rightPanelMode !== 'TRACE') {
        this.activeTraceId = undefined;
      }
      this.render();
    });
    document.getElementById('btn-open-full-trace')?.addEventListener('click', () => {
      this.popoverCell = null;
      this.rightPanelMode = 'TRACE';
      this.render();
    });
  }

  private formatSessionOptionLabel(s: ReportSession): string {
    const dsCount = ['DISB', 'REV', 'GPMB'].filter((t) =>
      Boolean(s.dataBindings?.[t as 'DISB' | 'REV' | 'GPMB'])
    ).length;
    const srcTag = dsCount < 3 ? ` · thiếu nguồn ${dsCount}/3` : '';
    return `${s.name} (${s.selectedLocalityIds.length} ĐP${srcTag})`;
  }

  private renderCellPopoverHtml(
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
  ): string {
    if (!this.popoverCell || !evaluatedReport) return '';
    const trace = evaluatedReport.tracesById.get(this.popoverCell.traceId);
    if (!trace) return '';
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    return `<div id="active-cell-popover" style="position:fixed; left:${Math.max(
      12,
      Math.min(this.popoverCell.clientX + 10, vw - 410)
    )}px; top:${Math.max(12, Math.min(this.popoverCell.clientY + 10, vh - 440))}px;">
      ${renderCellTracePopoverHtml(trace, { ...this.activeTraceExtraMeta, datasets })}
    </div>`;
  }

  private renderTopBar(activeSession: ReportSession | undefined): string {
    const sessionOptionsHtml = this.workspace.sessions
      .map(
        (s) => `<option value="${escapeHtmlUi(s.id)}" ${
          s.id === activeSession?.id ? 'selected' : ''
        }>${escapeHtmlUi(this.formatSessionOptionLabel(s))}</option>`
      )
      .join('');

    const canDeleteSession = this.workspace.sessions.length > 1 && Boolean(activeSession);

    return `<header class="studio-topbar no-print">
      <div class="topbar-left">
        <button
          type="button"
          class="btn btn-sm ${this.isSidebarCollapsed ? 'btn-primary' : 'btn-sidebar-toggle active'}"
          id="btn-toggle-sidebar"
          aria-expanded="${!this.isSidebarCollapsed}"
          title="${this.isSidebarCollapsed ? 'Mở thanh điều khiển trái' : 'Ẩn thanh điều khiển trái để xem báo cáo rộng hơn'}"
        >
          ${uiIcon(this.isSidebarCollapsed ? 'panel-left' : 'panel-left-close', 16)}
          <span class="hide-on-narrow">${this.isSidebarCollapsed ? 'Mở điều khiển trái' : 'Thu gọn'}</span>
        </button>

        <div class="topbar-brand">
          <span class="topbar-logo-badge">${uiIcon('logo-doc', 16)}</span>
          <div class="topbar-title-wrap">
            <span class="topbar-title">KTXH Offline</span>
            <span class="topbar-badge-offline" title="Chạy hoàn toàn trên máy, không cần internet">${uiIcon('shield-check', 12)} Offline 100%</span>
          </div>
        </div>

        <div class="topbar-session-bar">
          <label for="select-active-session" class="sr-only">Chọn phiên báo cáo</label>
          <select class="session-select-box" id="select-active-session" title="Chuyển đổi giữa các phiên báo cáo độc lập (mỗi phiên giữ nguồn Excel &amp; địa phương riêng)">
            ${sessionOptionsHtml}
          </select>
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            id="btn-topbar-rename-session"
            ${activeSession ? '' : 'disabled'}
            title="Sửa tên phiên làm việc đang mở"
          >
            ${uiIcon('pencil', 13)}
          </button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-topbar-new-session" title="Tạo phiên báo cáo mới (0 địa phương mặc định)">
            ${uiIcon('plus', 14)} Mới
          </button>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-topbar-clone-session" title="Nhân bản phiên hiện tại thành bản sao độc lập">
            ${uiIcon('copy', 14)}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-ghost-danger"
            id="btn-topbar-delete-session"
            ${canDeleteSession ? '' : 'disabled'}
            title="${canDeleteSession ? 'Xóa phiên đang mở' : 'Cần giữ ít nhất 1 phiên làm việc'}"
          >
            ${uiIcon('trash', 14)}
          </button>
        </div>
      </div>

      <div class="topbar-right">
        <span id="autosave-status-pill" class="autosave-pill ${
          this.isSaving ? 'autosave-saving' : 'autosave-saved'
        }">
          ${
            this.isSaving
              ? '<span class="spinner-dot"></span> Đang lưu...'
              : `${uiIcon('check', 13)} Tự lưu ${escapeHtmlUi(this.lastSavedTimestamp)}`
          }
        </span>

        <div class="topbar-backup-group" title="Lưu hoặc mở lại toàn bộ các phiên &amp; dữ liệu nguồn (.kxh.json)">
          <button type="button" class="btn btn-sm btn-secondary" id="btn-download-backup-json">
            ${uiIcon('save', 14)}
            <span>Lưu .kxh</span>
            ${this.workspace.unsavedChanges ? '<span class="unsaved-dot" title="Có thay đổi chưa xuất file .kxh.json"></span>' : ''}
          </button>
          <label class="btn btn-sm btn-secondary" title="Mở tệp sao lưu .kxh.json">
            ${uiIcon('upload', 14)}
            <span>Mở .kxh</span>
            <input type="file" id="input-restore-backup-file" accept=".json,.kxh.json" style="display:none" />
          </label>
        </div>

        <button type="button" class="btn btn-sm btn-secondary" id="btn-topbar-print" title="In hoặc lưu PDF theo khổ giấy A4 chuẩn hành chính">
          ${uiIcon('print', 14)} In / PDF
        </button>
        <button type="button" class="btn btn-sm btn-primary" id="btn-topbar-export-xlsx" title="Xuất tệp Excel (.xlsx) đúng định dạng bảng A4 kèm 5 sheet audit">
          ${uiIcon('excel', 14)} Xuất Excel
        </button>
      </div>
    </header>`;
  }

  private renderLeftControlSidebar(
    activeSession: ReportSession | undefined,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): string {
    const collapsedCls = this.isSidebarCollapsed ? 'collapsed' : '';
    if (!activeSession) {
      return `<aside class="dual-sidebar no-print ${collapsedCls}" id="left-control-sidebar" aria-hidden="${this.isSidebarCollapsed}">
        <div class="dual-sidebar-scroll"><div class="card"><p class="muted">Chưa có phiên nào.</p></div></div>
      </aside>`;
    }

    const loadedCount = ['DISB', 'REV', 'GPMB'].filter((t) =>
      Boolean(datasets[t as 'DISB' | 'REV' | 'GPMB'])
    ).length;

    const sourcesOpen = this.sidebarSectionsOpen.sources;
    const locOpen = this.sidebarSectionsOpen.localities;
    const settingsOpen = this.sidebarSectionsOpen.settings;

    const sourceTypes: Array<{
      type: 'DISB' | 'REV' | 'GPMB';
      shortTitle: string;
    }> = [
      { type: 'DISB', shortTitle: 'DISB · Giải ngân ĐTC' },
      { type: 'REV', shortTitle: 'REV · Thu NSNN' },
      { type: 'GPMB', shortTitle: 'GPMB · Dự án GPMB' },
    ];

    const sourceCardsHtml = sourceTypes
      .map(({ type, shortTitle }) => {
        const ds = datasets[type];
        const pool = this.workspace.datasets.filter((d) => d.sourceType === type);
        const slotOptionsHtml = [
          `<option value="__EMPTY__" ${!ds ? 'selected' : ''}>-- Chưa gắn nguồn ${type} --</option>`,
          ...pool.map(
            (cand) => `<option value="${escapeHtmlUi(cand.id)}" ${
              cand.id === ds?.id ? 'selected' : ''
            }>${escapeHtmlUi(cand.sourceFilename)} (${escapeHtmlUi(formatVnDate(cand.asOfDate) || 'chưa chốt')})</option>`
          ),
        ].join('');

        const scopeText = !ds
          ? ''
          : type === 'DISB' && getDisbSchemaProfile(ds.schemaFingerprint).isPhanCapXa
          ? `${ds.unitCount} ĐP · Phân cấp`
          : type === 'GPMB'
          ? `${ds.unitCount} ĐB · ${ds.projectRowCount ?? 0} DA`
          : `${ds.unitCount} ĐP`;

        let metaHtml = '';
        if (!ds) {
          metaHtml = `<div class="session-source-empty">Phiên này chưa gắn tệp ${type}. Chọn tệp bên dưới để nạp riêng cho phiên.</div>`;
        } else if (ds.asOfStatus === 'REQUIRES_USER_CONFIRMATION') {
          metaHtml = `
            <div class="rev-date-warn-box">
              <span>Cần xác nhận ngày chốt:</span>
              <div class="rev-date-warn-controls">
                <input type="date" id="input-confirm-rev-date" value="${
                  formatIsoDate(ds.asOfDate) || '2026-10-19'
                }" class="input-dataset-asof-date"/>
                <button type="button" class="btn btn-xs btn-primary" id="btn-confirm-rev-date" data-dataset-id="${escapeHtmlUi(
                  ds.id
                )}">Xác nhận</button>
              </div>
            </div>
          `;
        } else {
          metaHtml = `
            <div class="session-source-date-row">
              <span class="meta-label">Chốt:</span>
              <input
                type="date"
                class="input-dataset-asof-date"
                id="input-asof-date-${escapeHtmlUi(ds.id)}"
                data-dataset-id="${escapeHtmlUi(ds.id)}"
                data-source-type="${type}"
                value="${formatIsoDate(ds.asOfDate)}"
                title="Đổi ngày chốt cho riêng phiên này"
              />
              <button
                type="button"
                class="btn btn-xs btn-secondary btn-save-asof-date"
                data-dataset-id="${escapeHtmlUi(ds.id)}"
              >Lưu</button>
            </div>
          `;
        }

        const cardTitleTip = ds
          ? `${ds.sourceFilename} · Sheet: ${ds.sourceSheet} · SHA: ${ds.workbookSha256}`
          : `Chưa gắn nguồn ${type}`;

        return `<div class="session-source-card ${ds ? 'is-ready' : 'is-missing'}" title="${escapeHtmlUi(cardTitleTip)}">
          <div class="session-source-card-head">
            <span class="source-card-heading">${escapeHtmlUi(shortTitle)}</span>
            <span class="source-card-head-right">
              ${scopeText ? `<span class="source-scope-pill">${escapeHtmlUi(scopeText)}</span>` : ''}
              <span class="badge badge-xs ${ds ? 'badge-COMPLETE' : 'badge-WARNING'}">${
          ds ? 'Đã nạp' : 'Thiếu'
        }</span>
            </span>
          </div>
          <div class="session-source-picker-row">
            <select class="select-session-dataset" data-source-type="${type}" title="Chọn nguồn ${type} cho riêng phiên '${escapeHtmlUi(activeSession.name)}'">
              ${slotOptionsHtml}
            </select>
            <label class="btn btn-xs btn-outline-primary btn-slot-upload" title="Nạp tệp Excel ${type} mới cho riêng phiên này">
              ${uiIcon('upload', 12)} Tải
              <input type="file" class="input-slot-xlsx" data-slot-type="${type}" accept=".xlsx,.csv" style="display:none" />
            </label>
          </div>
          ${metaHtml}
        </div>`;
      })
      .join('');

    const s = activeSession.settings;

    return `<aside class="dual-sidebar no-print ${collapsedCls}" id="left-control-sidebar" aria-hidden="${this.isSidebarCollapsed}">
      <div class="dual-sidebar-scroll">
        <!-- KHỐI 1: NGUỒN DỮ LIỆU CỦA PHIÊN -->
        <section class="sidebar-block" id="sidebar-block-sources">
          <div class="sidebar-block-header">
            <button type="button" class="sidebar-block-toggle" data-toggle-block="sources" aria-expanded="${sourcesOpen}">
              <span class="block-title-wrap">
                ${uiIcon('database', 14)}
                <span>1. NGUỒN DỮ LIỆU PHIÊN</span>
              </span>
              <span class="block-head-right">
                <span class="badge badge-xs ${loadedCount === 3 ? 'badge-COMPLETE' : 'badge-WARNING'}">${loadedCount}/3</span>
                ${uiIcon(sourcesOpen ? 'chevron-up' : 'chevron-down', 14)}
              </span>
            </button>
          </div>
          <div class="sidebar-block-body ${sourcesOpen ? '' : 'is-hidden'}">
            <div class="per-session-hint">
              ${uiIcon('info', 12)}
              <span>Nạp hoặc đổi nguồn <strong>chỉ áp dụng cho phiên này</strong>. Các phiên khác giữ nguyên.</span>
            </div>

            <div class="compact-dropzone" id="dropzone-excel-files" tabindex="0" role="button" title="Kéo thả hoặc nhấn để nạp Excel (.xlsx, .csv) vào phiên đang mở">
              ${uiIcon('upload', 14)}
              <span>Kéo thả / Chọn tệp Excel (.xlsx, .csv)</span>
              <input type="file" id="input-xlsx-files" multiple accept=".xlsx,.csv" style="display:none" />
            </div>

            <div class="session-source-cards-list">
              ${sourceCardsHtml}
            </div>

            <div class="source-block-footer">
              <button type="button" class="btn-link-subtle" id="btn-open-coverage-modal">
                ${uiIcon('shield-check', 13)} Kiểm toán nguồn thiếu
              </button>
              <button type="button" class="btn-link-subtle" id="btn-load-embedded-confirmed" title="Gắn 3 file Excel tham chiếu mặc định vào phiên hiện tại">
                ${uiIcon('undo', 13)} Nạp 3 file mẫu
              </button>
            </div>
          </div>
        </section>

        <!-- KHỐI 2: ĐỊA PHƯƠNG CHỌN -->
        <section class="sidebar-block" id="sidebar-block-localities">
          <div class="sidebar-block-header">
            <button type="button" class="sidebar-block-toggle" data-toggle-block="localities" aria-expanded="${locOpen}">
              <span class="block-title-wrap">
                ${uiIcon('map-pin', 14)}
                <span>2. ĐỊA PHƯƠNG CHỌN</span>
              </span>
              <span class="block-head-right">
                <span class="badge badge-xs badge-info" id="sidebar-loc-count-pill">${activeSession.selectedLocalityIds.length}/${effectiveLocalities.length}</span>
                ${uiIcon(locOpen ? 'chevron-up' : 'chevron-down', 14)}
              </span>
            </button>
          </div>
          <div class="sidebar-block-body ${locOpen ? '' : 'is-hidden'}">
            <div class="loc-search-wrap">
              <span class="loc-search-icon">${uiIcon('search', 14)}</span>
              <input
                type="text"
                id="input-unified-loc-search"
                class="form-input loc-search-input"
                placeholder="Tìm nhanh xã/phường không dấu..."
                value="${escapeHtmlUi(this.localitySearchQuery)}"
              />
              <button
                type="button"
                id="btn-clear-loc-search"
                class="btn-clear-search ${this.localitySearchQuery ? '' : 'is-hidden'}"
                aria-label="Xóa từ khóa tìm kiếm"
                title="Xóa từ khóa tìm kiếm"
              >${uiIcon('close', 12)}</button>
            </div>

            <div class="loc-filter-mini-row">
              <select id="select-unified-loc-type" class="form-select-sm" title="Lọc theo loại đơn vị">
                <option value="ALL" ${this.localityTypeFilter === 'ALL' ? 'selected' : ''}>Tất cả (${effectiveLocalities.length})</option>
                <option value="XA" ${this.localityTypeFilter === 'XA' ? 'selected' : ''}>Xã</option>
                <option value="PHUONG" ${this.localityTypeFilter === 'PHUONG' ? 'selected' : ''}>Phường</option>
                <option value="DAC_KHU" ${this.localityTypeFilter === 'DAC_KHU' ? 'selected' : ''}>Đặc khu</option>
              </select>
              <select id="select-unified-loc-sort" class="form-select-sm" title="Sắp xếp danh sách">
                <option value="SELECTED_FIRST" ${this.localitySortOption === 'SELECTED_FIRST' ? 'selected' : ''}>Đã chọn trước</option>
                <option value="DEFAULT" ${this.localitySortOption === 'DEFAULT' ? 'selected' : ''}>Thứ tự gốc</option>
                <option value="NAME_ASC" ${this.localitySortOption === 'NAME_ASC' ? 'selected' : ''}>Tên A → Z</option>
                <option value="NAME_DESC" ${this.localitySortOption === 'NAME_DESC' ? 'selected' : ''}>Tên Z → A</option>
              </select>
            </div>

            <div id="unified-selection-bar">
              ${this.renderSelectedSummaryBar(activeSession)}
            </div>

            <div class="locality-items-list-box compact-loc-list" id="unified-locality-items-box">
              ${this.renderLocalityItemsHtml(activeSession, datasets, effectiveLocalities)}
            </div>
          </div>
        </section>

        <!-- KHỐI 3: TÙY CHỈNH BẢNG GỌN -->
        <section class="sidebar-block" id="sidebar-block-settings">
          <div class="sidebar-block-header">
            <button type="button" class="sidebar-block-toggle" data-toggle-block="settings" aria-expanded="${settingsOpen}">
              <span class="block-title-wrap">
                ${uiIcon('sliders', 14)}
                <span>3. TÙY CHỈNH BẢNG GỌN</span>
              </span>
              <span class="block-head-right">
                ${uiIcon(settingsOpen ? 'chevron-up' : 'chevron-down', 14)}
              </span>
            </button>
          </div>
          <div class="sidebar-block-body ${settingsOpen ? '' : 'is-hidden'}">
            <form id="form-edit-title-settings" class="settings-form-compact">
              <div class="setting-field-group">
                <label for="setting-report-title" class="setting-label">Tiêu đề báo cáo chính</label>
                <textarea id="setting-report-title" class="form-input form-textarea-compact" rows="2">${escapeHtmlUi(
                  s.reportTitle
                )}</textarea>
              </div>

              <div class="setting-field-group">
                <div class="setting-row-inline">
                  <label class="checkbox-label-compact">
                    <input type="checkbox" id="setting-show-subtitle" ${s.showSubtitle ? 'checked' : ''} />
                    <span>Hiện dòng chữ nhỏ in nghiêng</span>
                  </label>
                </div>
                <input
                  type="text"
                  id="setting-subtitle"
                  class="form-input form-input-compact"
                  placeholder="(Số liệu tổng hợp phục vụ chỉ đạo, điều hành)"
                  value="${escapeHtmlUi(s.subtitle || '')}"
                />
              </div>

              <div class="setting-divider"></div>
              <div class="setting-group-heading">Bật / tắt dòng hiển thị</div>

              <label class="toggle-switch-row">
                <span>Kết quả thu NSNN lũy kế (STT 2)</span>
                <input type="checkbox" id="setting-show-rev-realized-row" class="chk-live-setting" ${s.showRevRealizedRow ? 'checked' : ''} />
              </label>
              <label class="toggle-switch-row">
                <span>Dòng Tỷ lệ thu NSNN trung bình (STT ${reportMainStt(activeSession,'2')})</span>
                <input type="checkbox" id="setting-show-rev-benchmark-row" class="chk-live-setting" ${
                  s.showRevBenchmarkRow ? 'checked' : ''
                } />
              </label>

              <label class="toggle-switch-row">
                <span>So sánh KHV ĐTC đầu năm (Dòng ${reportMainStt(activeSession,'3')})</span>
                <input type="checkbox" id="setting-show-disb-adjustment" class="chk-live-setting" ${
                  s.showDisbPlanAdjustmentComparison !== false ? 'checked' : ''
                } />
              </label>

              <label class="toggle-switch-row">
                <span>Dòng ${reportMainStt(activeSession,'8')}: Dự án GPMB chưa hoàn thành</span>
                <input type="checkbox" id="setting-show-uncompleted-summary" class="chk-live-setting" ${
                  s.showUncompletedSummaryRow !== false ? 'checked' : ''
                } />
              </label>

              <label class="toggle-switch-row">
                <span>Bảng phụ lục danh mục dự án</span>
                <input type="checkbox" id="setting-show-uncompleted-table" class="chk-live-setting" ${
                  s.showUncompletedProjectsTable !== false ? 'checked' : ''
                } />
              </label>

              <label class="toggle-switch-row">
                <span>Dòng ${reportMainStt(activeSession,'9')}: Dự án theo NQ 11</span>
                <input type="checkbox" id="setting-show-nq11-row" class="chk-live-setting" ${
                  s.showNq11Row !== false ? 'checked' : ''
                } />
              </label>

              <div class="setting-divider"></div>
              <div class="setting-group-heading">Kích thước cột &amp; ngắt trang</div>

              <div class="setting-metric-row">
                <label for="setting-indicator-col-width">Cột Chỉ tiêu (px)</label>
                <div class="metric-ctrl-group">
                  <input
                    type="number"
                    id="setting-indicator-col-width"
                    class="form-input-sm input-num-compact"
                    value="${s.indicatorColumnWidthPx || 240}"
                    min="160"
                    max="600"
                    step="10"
                  />
                  <button type="button" class="btn btn-xs btn-secondary" id="btn-reset-ind-width" title="Mặc định 240px">240px</button>
                </div>
              </div>

              <div class="setting-metric-row">
                <label for="setting-proj-font-size">Cỡ chữ chi tiết DA</label>
                <div class="metric-ctrl-group">
                  <button type="button" class="btn btn-xs btn-secondary" id="btn-dec-proj-font" title="Giảm 0.5pt">-</button>
                  <input
                    type="number"
                    id="setting-proj-font-size"
                    class="form-input-sm input-num-tiny"
                    value="${s.uncompletedProjectsFontSizePt || 8}"
                    min="6"
                    max="16"
                    step="0.5"
                  />
                  <span class="unit-pt">pt</span>
                  <button type="button" class="btn btn-xs btn-secondary" id="btn-inc-proj-font" title="Tăng 0.5pt">+</button>
                </div>
              </div>

              <label class="toggle-switch-row">
                <span>Tách Dòng 8–9 sang trang 2</span>
                <input type="checkbox" id="setting-split-row8-to-new-page" ${
                  s.splitRow8ToNewPage ? 'checked' : ''
                } />
              </label>

              <div class="setting-footer-actions">
                <button type="button" class="btn btn-sm btn-secondary" id="btn-open-indicators-modal" style="width:100%;">
                  ${uiIcon('list', 13)} Tùy chỉnh nhãn &amp; ẩn/hiện 14 dòng mẫu
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </aside>`;
  }

  private renderCenterCanvasArea(
    activeSession: ReportSession | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): string {
    if (!activeSession) {
      return `<div class="studio-canvas-scroll"><div class="card empty-state-card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo ở thanh trên.</h3></div></div>`;
    }

    if (!evaluatedReport) {
      const stale=this.legacyImportNeedsReview(datasets);
      if (stale.length) return `<div class="studio-canvas-scroll"><div class="card empty-state-card"><h3>Cần nhập lại nguồn Excel trước khi xuất báo cáo</h3><p>${escapeHtmlUi(stale.join(' '))}</p><p>Dữ liệu cũ được giữ nguyên; hãy chọn lại tệp nguồn ở thanh bên trái để nhận diện đúng.</p></div></div>`;
      const missingList = (['DISB', 'REV', 'GPMB'] as const)
        .filter((t) => !datasets[t])
        .map((t) =>
          t === 'DISB' ? 'Giải ngân (DISB)' : t === 'REV' ? 'Thu NSNN (REV)' : 'GPMB'
        );

      return `<div class="studio-document-container">
        <div class="studio-canvas-toolbar no-print">
          <div class="toolbar-left">
            <span class="canvas-status-title">Phiên "${escapeHtmlUi(activeSession.name)}" · Chờ đủ 3 nguồn dữ liệu</span>
          </div>
          <div class="toolbar-right">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-open-coverage-modal-top">
              ${uiIcon('shield-check', 14)} Kiểm toán nguồn
            </button>
          </div>
        </div>
        <div class="studio-canvas-scroll">
          <div class="empty-studio-state">
            <div class="empty-studio-icon">${uiIcon('database', 32)}</div>
            <h3 class="empty-studio-title">Phiên "${escapeHtmlUi(activeSession.name)}" đang thiếu ${missingList.length} nguồn: ${escapeHtmlUi(missingList.join(', '))}</h3>
            <p class="empty-studio-desc">
              Mỗi phiên lưu nguồn Excel độc lập. Bạn có thể chọn/nạp từng file Excel ở thanh bên trái cho riêng phiên này, hoặc nạp bộ 3 file tham chiếu mặc định để xem ngay bảng báo cáo.
            </p>
            <div class="empty-studio-presets">
              <button type="button" class="btn btn-primary" id="btn-center-load-embedded">
                ${uiIcon('database', 14)} Nạp 3 file tham chiếu cho phiên này
              </button>
              <label class="btn btn-secondary">
                ${uiIcon('upload', 14)} Chọn file Excel từ máy tính
                <input type="file" id="input-center-xlsx-upload" multiple accept=".xlsx,.csv" style="display:none" />
              </label>
            </div>
          </div>
        </div>
      </div>`;
    }

    const layoutDecision = computeAutoLayoutMode({
      session: activeSession,
      selectedCount: activeSession.selectedLocalityIds.length,
      indicatorCount: evaluatedReport.rows.length,
    });
    const currentLayoutPref = activeSession.settings.tableLayoutMode || 'AUTO';
    const warnCount = evaluatedReport.sessionIssues.length;

    const toolbarHtml = `<div class="studio-canvas-toolbar no-print">
      <div class="toolbar-left">
        <span class="canvas-live-pill">Xem trước A4</span>
        <span class="auto-explanation-badge" title="${escapeHtmlUi(layoutDecision.reason)}">
          ${uiIcon('info', 13)}
          <span>${layoutDecision.mode === 'HORIZONTAL' ? 'Ngang' : 'Dọc'} · ${activeSession.selectedLocalityIds.length} ĐP · ${layoutDecision.pageCount} trang</span>
        </span>
      </div>

      <div class="toolbar-center">
        <div class="layout-segmented-control" role="group" aria-label="Bố cục bảng">
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'AUTO' ? 'active' : ''
          }" data-set-layout-mode="AUTO">Tự động</button>
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'HORIZONTAL' ? 'active' : ''
          }" data-set-layout-mode="HORIZONTAL">Ngang</button>
          <button type="button" class="segmented-btn ${
            currentLayoutPref === 'VERTICAL' ? 'active' : ''
          }" data-set-layout-mode="VERTICAL">Dọc</button>
        </div>
      </div>

      <div class="toolbar-right">
        <button type="button" class="btn btn-sm btn-warning-soft" id="btn-open-warnings-panel" title="Xem cảnh báo chất lượng nguồn &amp; lệch cột M">
          ${uiIcon('alert', 14)} Cảnh báo (${warnCount})
        </button>
        <div class="zoom-controls">
          <button type="button" class="btn btn-xs btn-ghost" id="btn-zoom-out" title="Thu nhỏ">-</button>
          <button type="button" class="btn btn-xs btn-ghost zoom-level-btn" id="btn-zoom-reset" title="Khôi phục 100%">${Math.round(
            this.zoomScale * 100
          )}%</button>
          <button type="button" class="btn btn-xs btn-ghost" id="btn-zoom-in" title="Phóng to">+</button>
        </div>
      </div>
    </div>`;

    const a4DocumentHtml = renderA4DocumentStudioHtml({
      evaluated: evaluatedReport,
      baselineLocalities: effectiveLocalities,
      datasets,
      activeTraceId: this.activeTraceId,
      zoomScale: this.zoomScale,
    });

    return `<div class="studio-document-container">
      ${toolbarHtml}
      <div class="studio-canvas-scroll" id="studio-canvas-scroll">
        ${a4DocumentHtml}
      </div>
    </div>`;
  }

  private renderRightContextPanel(
    activeSession: ReportSession | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
  ): string {
    if (this.rightPanelMode === 'NONE') {
      return '';
    }
    const mode = this.rightPanelMode === 'WARNINGS' ? 'WARNINGS' : 'TRACE';
    const panelTitle =
      mode === 'TRACE'
        ? 'Hồ sơ giải trình phép tính (CalculationTrace)'
        : 'Cảnh báo chất lượng & Kiểm toán nguồn';
    const panelContent =
      mode === 'TRACE'
        ? renderTraceInspectorHtml(this.activeTrace, {
            ...this.activeTraceExtraMeta,
            datasets,
          })
        : this.renderQualityWarningsList(activeSession, evaluatedReport, datasets);

    return `<aside class="studio-context-panel no-print">
      <div class="context-panel-header">
        <span class="context-panel-title">${escapeHtmlUi(panelTitle)}</span>
        <button type="button" class="btn-close-context-panel" id="btn-close-context-panel" title="Đóng bảng (Esc)" aria-label="Đóng">${uiIcon('close', 15)}</button>
      </div>
      <div class="context-panel-tabs">
        <button type="button" class="context-tab-btn ${
          mode === 'TRACE' ? 'active' : ''
        }" data-open-panel-mode="TRACE">Truy vết ô</button>
        <button type="button" class="context-tab-btn ${
          mode === 'WARNINGS' ? 'active' : ''
        }" data-open-panel-mode="WARNINGS">Cảnh báo (${evaluatedReport?.sessionIssues.length ?? 0})</button>
      </div>
      <div class="context-panel-body">
        ${panelContent}
      </div>
    </aside>`;
  }

  private renderQualityWarningsList(
    activeSession: ReportSession | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
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
      <div class="warnings-coverage-bridge">
        <span>Kiểm tra tổng thể đơn vị thiếu nguồn của phiên:</span>
        <button type="button" class="btn btn-xs btn-secondary" id="btn-warnings-open-coverage">
          ${uiIcon('shield-check', 12)} Kiểm toán nguồn
        </button>
      </div>
      <h4>Cảnh báo các xã đang chọn (${sessionWarnList.length})</h4>
      <div class="warnings-scroll-list">
        ${
          sessionWarnList.length === 0
            ? '<p class="muted">Không có cảnh báo chất lượng nào cho các địa phương đang chọn.</p>'
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

      <h4 style="margin-top:16px">Dự án GPMB có cột M lệch 100*I/D &gt; 0,1 điểm % (${mMismatchIssues.length})</h4>
      <div class="warnings-scroll-list">
        ${
          mMismatchIssues.length === 0
            ? '<p class="muted">Không ghi nhận chênh lệch cột M nào trong nguồn GPMB của phiên này.</p>'
            : mMismatchIssues
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
                .join('')
        }
      </div>
    </div>`;
  }

  private renderSelectedSummaryBar(activeSession: ReportSession): string {
    const count = activeSession.selectedLocalityIds.length;
    if (count === 0) return '';

    return `<div class="selection-summary-bar" id="unified-reorder-panel">
      <span class="reorder-title-sm">Thứ tự cột (${count})</span>
      <div class="reorder-actions">
        <button type="button" class="btn btn-xs btn-secondary" id="btn-reorder-az" title="Sắp xếp các cột đã chọn từ A đến Z">A→Z</button>
        <button type="button" class="btn btn-xs btn-secondary" id="btn-reorder-reverse" title="Đảo ngược thứ tự các cột đã chọn">Đảo</button>
        <button type="button" class="btn btn-xs btn-ghost btn-ghost-danger" id="btn-deselect-all-localities" title="Bỏ chọn toàn bộ về 0">Bỏ chọn</button>
      </div>
    </div>`;
  }

  private renderLocalityItemsHtml(
    activeSession: ReportSession,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): string {
    const filtered = searchLocalities(
      effectiveLocalities,
      this.localitySearchQuery,
      this.localityTypeFilter
    );

    const selectedIds = activeSession.selectedLocalityIds;
    const selectedOrderMap = new Map(selectedIds.map((id, idx) => [id, idx]));
    const revIdSet = new Set((datasets.REV?.records || []).map((r) => r.localityId));
    const gpmbIdSet = new Set((datasets.GPMB?.records || []).map((r) => r.localityId));

    const coverageFiltered = filtered.filter((loc) => {
      if (this.localityCoverageFilter === 'ALL') return true;
      const missingRev = Boolean(datasets.REV && !revIdSet.has(loc.id));
      const missingGpmb = Boolean(datasets.GPMB && !gpmbIdSet.has(loc.id));
      const isMissing = missingRev || missingGpmb;
      return this.localityCoverageFilter === 'MISSING' ? isMissing : !isMissing;
    });

    const sorted = [...coverageFiltered].sort((a, b) => {
      if (this.localitySortOption === 'NAME_ASC') return a.displayName.localeCompare(b.displayName, 'vi');
      if (this.localitySortOption === 'NAME_DESC') return b.displayName.localeCompare(a.displayName, 'vi');
      if (this.localitySortOption === 'TYPE') return a.type.localeCompare(b.type);
      if (this.localitySortOption === 'SELECTED_FIRST') {
        const aIdx = selectedOrderMap.get(a.id);
        const bIdx = selectedOrderMap.get(b.id);
        const aSel = aIdx !== undefined ? 1 : 0;
        const bSel = bIdx !== undefined ? 1 : 0;
        if (bSel !== aSel) return bSel - aSel;
        if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
        return 0;
      }
      return 0;
    });

    if (sorted.length === 0) {
      return '<p class="muted" style="padding:12px; font-size:12px;">Không tìm thấy địa phương nào khớp từ khóa.</p>';
    }

    return sorted
      .map((loc) => {
        const selectedIdx = selectedOrderMap.get(loc.id);
        const isChecked = selectedIdx !== undefined;
        const isMissingRev = Boolean(datasets.REV && !revIdSet.has(loc.id));
        const isMissingGpmb = Boolean(datasets.GPMB && !gpmbIdSet.has(loc.id));

        let warnTag = '';
        if (isMissingRev && isMissingGpmb) {
          warnTag = `<span class="missing-source-tag" title="Thiếu Thu NSNN và Không có nhiệm vụ GPMB">Thiếu Thu · GPMB</span>`;
        } else if (isMissingRev) {
          warnTag = `<span class="missing-source-tag" title="Chưa có bản ghi trong nguồn Thu NSNN của phiên này">Thiếu Thu</span>`;
        } else if (isMissingGpmb) {
          warnTag = `<span class="missing-source-tag note-gpmb-no-task" title="Không có dự án trong nguồn GPMB của phiên này">0 GPMB</span>`;
        }

        // Only append type badge when the name doesn't already include Xã/Phường/Đặc khu prefix
        const hasAdminPrefix = /^(Xã|Phường|Đặc khu)\s+/i.test(loc.displayName.trim());
        const typeLabel = loc.type === 'PHUONG' ? 'P' : loc.type === 'DAC_KHU' ? 'ĐK' : 'Xã';
        const typeBadgeHtml = hasAdminPrefix
          ? ''
          : `<span class="badge badge-xs badge-neutral">${typeLabel}</span>`;

        const orderBadgeHtml = isChecked
          ? `<span class="row-col-order" title="Thứ tự cột thứ ${selectedIdx + 1} trên bảng báo cáo">${selectedIdx + 1}</span>`
          : '';

        const reorderControlsHtml = isChecked
          ? `<div class="row-reorder-inline-btns">
              <button type="button" class="btn-row-move" data-move-dir="up" data-loc-id="${escapeHtmlUi(loc.id)}" ${
              selectedIdx === 0 ? 'disabled' : ''
            } title="Đưa cột lên trước (sang trái bảng)">▲</button>
              <button type="button" class="btn-row-move" data-move-dir="down" data-loc-id="${escapeHtmlUi(loc.id)}" ${
              selectedIdx === selectedIds.length - 1 ? 'disabled' : ''
            } title="Đưa cột xuống sau (sang phải bảng)">▼</button>
            </div>`
          : '';

        return `<div class="locality-row-item locality-row-compact ${isChecked ? 'checked' : ''}">
          <label class="locality-row-left">
            <input type="checkbox" class="chk-select-locality" data-loc-id="${escapeHtmlUi(
              loc.id
            )}" ${isChecked ? 'checked' : ''}/>
            ${orderBadgeHtml}
            <span class="locality-name-bold" title="${escapeHtmlUi(loc.displayName)}">${escapeHtmlUi(loc.displayName)}</span>
            ${typeBadgeHtml}
          </label>
          <div class="locality-row-right">
            ${warnTag}
            ${reorderControlsHtml}
          </div>
        </div>`;
      })
      .join('');
  }

  private renderNewSessionModal(datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }): string {
    if (!this.showNewSessionModal) return '';
    const active = this.getActiveSession();
    const curNames = [
      datasets.DISB ? `DISB: ${datasets.DISB.sourceFilename}` : 'DISB: (trống)',
      datasets.REV ? `REV: ${datasets.REV.sourceFilename}` : 'REV: (trống)',
      datasets.GPMB ? `GPMB: ${datasets.GPMB.sourceFilename}` : 'GPMB: (trống)',
    ].join(' · ');

    return `<div class="proj-modal-backdrop no-print" id="new-session-modal-backdrop">
      <div class="proj-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="new-session-modal-title">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title" id="new-session-modal-title">Tạo phiên báo cáo mới (0 địa phương mặc định)</h3>
          <button type="button" class="proj-modal-close" id="btn-close-new-session-modal" aria-label="Đóng">&times;</button>
        </div>
        <form id="form-new-session-modal">
          <div class="proj-modal-body">
            <div class="form-group">
              <label for="input-modal-session-name">Tên phiên báo cáo mới:</label>
              <input type="text" id="input-modal-session-name" class="form-input" value="${escapeHtmlUi(
                this.newSessionNameDraft
              )}" placeholder="Ví dụ: Báo cáo 5 xã tháng 11/2026" required />
            </div>

            <div class="form-group">
              <label>Bộ nguồn Excel ban đầu cho phiên mới:</label>
              <div class="source-mode-radio-list">
                <label class="source-mode-radio-item">
                  <input type="radio" name="new-session-source-mode" value="CURRENT" ${
                    this.newSessionSourceMode === 'CURRENT' ? 'checked' : ''
                  } />
                  <div>
                    <strong>Dùng bộ nguồn của phiên đang mở</strong>
                    <div class="muted-xs">${escapeHtmlUi(
                      active ? `${active.name}: ${curNames}` : curNames
                    )}</div>
                  </div>
                </label>

                <label class="source-mode-radio-item">
                  <input type="radio" name="new-session-source-mode" value="EMPTY" ${
                    this.newSessionSourceMode === 'EMPTY' ? 'checked' : ''
                  } />
                  <div>
                    <strong>Phiên trống chưa gắn nguồn (tự nạp bộ Excel riêng sau)</strong>
                    <div class="muted-xs">Phù hợp khi phiên này dùng 3 file Excel hoàn toàn khác với các phiên trước.</div>
                  </div>
                </label>

                <label class="source-mode-radio-item">
                  <input type="radio" name="new-session-source-mode" value="EMBEDDED" ${
                    this.newSessionSourceMode === 'EMBEDDED' ? 'checked' : ''
                  } />
                  <div>
                    <strong>Gắn 3 file Excel tham chiếu mặc định (DISB/REV/GPMB)</strong>
                    <div class="muted-xs">Khởi tạo nhanh từ 3 file tham chiếu đóng gói sẵn trong ứng dụng.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div class="proj-modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-cancel-new-session-modal">Hủy</button>
            <button type="submit" class="btn btn-primary">${uiIcon('plus', 14)} Tạo phiên mới</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  private renderRenameSessionModal(activeSession: ReportSession | undefined): string {
    if (!this.showRenameSessionModal || !activeSession) return '';

    return `<div class="proj-modal-backdrop no-print" id="rename-session-modal-backdrop">
      <div class="proj-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-session-modal-title">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title" id="rename-session-modal-title">Sửa tên phiên làm việc</h3>
          <button type="button" class="proj-modal-close" id="btn-close-rename-session-modal" aria-label="Đóng">&times;</button>
        </div>
        <form id="form-rename-session-modal">
          <div class="proj-modal-body">
            <div class="form-group">
              <label for="input-rename-session-name">Tên phiên báo cáo:</label>
              <input
                type="text"
                id="input-rename-session-name"
                class="form-input"
                value="${escapeHtmlUi(this.renameSessionNameDraft)}"
                placeholder="Nhập tên phiên báo cáo..."
                required
              />
            </div>
          </div>
          <div class="proj-modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-cancel-rename-session-modal">Hủy</button>
            <button type="submit" class="btn btn-primary">${uiIcon('check', 14)} Lưu tên mới</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  private renderCoverageModal(
    activeSession: ReportSession | undefined,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): string {
    if (!this.showCoverageModal || !activeSession) return '';
    const { bySource, allCoverageDetails } = analyzeSourceCoverage(effectiveLocalities, datasets);
    const totalExpected = effectiveLocalities.length;

    const revMissingNames = effectiveLocalities
      .filter((l) => datasets.REV && !datasets.REV.records.some((r) => r.localityId === l.id))
      .map((l) => l.displayName);
    const gpmbMissingNames = effectiveLocalities
      .filter((l) => datasets.GPMB && !datasets.GPMB.records.some((r) => r.localityId === l.id))
      .map((l) => l.displayName);
    const disbMissingNames = effectiveLocalities
      .filter((l) => datasets.DISB && !datasets.DISB.records.some((r) => r.localityId === l.id))
      .map((l) => l.displayName);

    const detailRows = allCoverageDetails.filter(
      (c) =>
        c.status === 'NO_LOCALITY_RECORD' ||
        c.status === 'PARTIAL_AGGREGATE' ||
        c.status === 'FIELD_MISSING' ||
        c.status === 'ERROR'
    );

    const revBmText = datasets.REV
      ? computeBenchmarkRatio({
          indicatorId: 'REV_RATE_Y',
          dataset: datasets.REV,
          baselineLocalities: effectiveLocalities,
          numeratorField: 'actual_total_revenue',
          denominatorField: 'annual_total_budget',
          scopeType: 'LOCALITIES_AVAILABLE_N',
          decimals: 2,
        }).displayedText
      : '—';

    return `<div class="proj-modal-backdrop no-print" id="coverage-modal-backdrop">
      <div class="proj-modal-dialog proj-modal-lg" role="dialog" aria-modal="true" aria-labelledby="coverage-modal-title">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title" id="coverage-modal-title">Kiểm toán nguồn &amp; đơn vị thiếu — Phiên "${escapeHtmlUi(
            activeSession.name
          )}"</h3>
          <button type="button" class="proj-modal-close" id="btn-close-coverage-modal" aria-label="Đóng">&times;</button>
        </div>
        <div class="proj-modal-body coverage-modal-body">
          <div class="coverage-summary-pills">
            <div class="cov-pill cov-pill-disb">
              <strong>Giải ngân ĐTC (${bySource.DISB?.presentLocalityCount ?? 0}/${totalExpected}):</strong>
              ${
                !datasets.DISB
                  ? 'Chưa gắn nguồn DISB cho phiên này.'
                  : disbMissingNames.length === 0
                  ? `Đủ ${totalExpected}/${totalExpected} đơn vị.`
                  : `Thiếu ${disbMissingNames.length} đơn vị: <em>${escapeHtmlUi(disbMissingNames.join(', '))}</em>.`
              }
            </div>
            <div class="cov-pill cov-pill-rev">
              <strong>Thu NSNN (${bySource.REV?.presentLocalityCount ?? 0}/${totalExpected} · Mốc chung ${escapeHtmlUi(revBmText)}):</strong>
              ${
                !datasets.REV
                  ? 'Chưa gắn nguồn REV cho phiên này.'
                  : revMissingNames.length === 0
                  ? `Đủ ${totalExpected}/${totalExpected} đơn vị.`
                  : `Thiếu ${revMissingNames.length} đơn vị: <em>${escapeHtmlUi(revMissingNames.join(', '))}</em> (NO_LOCALITY_RECORD).`
              }
            </div>
            <div class="cov-pill cov-pill-gpmb">
              <strong>GPMB (${bySource.GPMB?.presentLocalityCount ?? 0}/${totalExpected} · ${datasets.GPMB?.projectRowCount ?? 0} dự án):</strong>
              ${
                !datasets.GPMB
                  ? 'Chưa gắn nguồn GPMB cho phiên này.'
                  : gpmbMissingNames.length === 0
                  ? `Đủ ${totalExpected}/${totalExpected} địa bàn có dự án.`
                  : `Ghi nhận không có nhiệm vụ GPMB tại ${gpmbMissingNames.length} đơn vị: <em>${escapeHtmlUi(gpmbMissingNames.join(', '))}</em>.`
              }
            </div>
          </div>

          <div class="coverage-table-wrap">
            ${
              detailRows.length === 0
                ? '<p class="muted">Không có dòng thiếu hụt chi tiết nào trong phạm vi nguồn của phiên này.</p>'
                : `<table class="data-table data-table-sm" style="font-size:12px;">
                    <thead>
                      <tr>
                        <th>Địa phương</th>
                        <th>Nguồn</th>
                        <th>Trạng thái</th>
                        <th>Trường</th>
                        <th>Lý do ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${detailRows
                        .slice(0, 120)
                        .map(
                          (c) => `<tr>
                            <td><strong>${escapeHtmlUi(c.localityName)}</strong></td>
                            <td>${escapeHtmlUi(c.sourceType || c.sourceDatasetId)}</td>
                            <td><span class="badge badge-xs badge-${escapeHtmlUi(c.status)}">${escapeHtmlUi(
                            c.status
                          )}</span></td>
                            <td>${escapeHtmlUi(c.fieldId || 'Bản ghi đơn vị')}</td>
                            <td>${escapeHtmlUi(c.reason)}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>`
            }
          </div>
        </div>
        <div class="proj-modal-footer">
          <button type="button" class="btn btn-primary" id="btn-ok-coverage-modal">Đóng</button>
        </div>
      </div>
    </div>`;
  }

  private renderIndicatorsModal(
    activeSession: ReportSession | undefined,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
  ): string {
    if (!this.showIndicatorsModal || !activeSession) return '';

    const revDs = datasets.REV;
    const revUnits = revDs?.unitCount ?? 113;
    const totalExpected =
      this.getEffectiveBaselineLocalities(activeSession, datasets).length || 114;
    const revBmDefaultLabel = formatRevBenchmarkRowLabel({
      customLabel: activeSession.settings.revBenchmarkRowCustomLabel,
      unitCount: revUnits,
      expectedCount: totalExpected,
      asOfDate: revDs?.asOfDate,
    });

    const rowsHtml = [...activeSession.templateRows]
      .sort((a, b) => a.order - b.order)
      .map(
        (r) => `<div class="indicator-config-item" data-row-num="${r.rowNumber}">
          <div class="ind-config-header">
            <span class="badge badge-xs badge-neutral">Dòng ${r.rowNumber}</span>
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
            }" value="${escapeHtmlUi(r.customLabel)}" placeholder="Tên chỉ tiêu..." />
          </div>
        </div>`
      )
      .join('');

    return `<div class="proj-modal-backdrop no-print" id="indicators-modal-backdrop">
      <div class="proj-modal-dialog proj-modal-lg" role="dialog" aria-modal="true" aria-labelledby="indicators-modal-title">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title" id="indicators-modal-title">Tùy chỉnh nhãn &amp; ẩn/hiện 14 dòng chỉ tiêu mẫu</h3>
          <button type="button" class="proj-modal-close" id="btn-close-indicators-modal" aria-label="Đóng">&times;</button>
        </div>
        <div class="proj-modal-body indicators-modal-body">
          <p class="muted" style="margin-top:0;font-size:12px;">Thay đổi áp dụng ngay lên bảng A4 của phiên "${escapeHtmlUi(
            activeSession.name
          )}". Công thức và mã chỉ tiêu được giữ nguyên.</p>
          <div class="indicator-config-item" style="border-color:#93c5fd;background:#eff6ff;margin-bottom:10px;">
            <div class="ind-config-header">
              <span class="badge badge-xs badge-info">Tùy chọn Nhóm Thu</span>
              <code class="ind-config-code">REV_BENCHMARK_RATE</code>
              <label class="toggle-eye">
                <input type="checkbox" class="chk-toggle-rev-benchmark-instant" ${
                  activeSession.settings.showRevBenchmarkRow ? 'checked' : ''
                }/> Hiển thị thêm
              </label>
            </div>
            <div class="muted-xs" style="margin-top:4px;">Nhãn: <strong>${escapeHtmlUi(revBmDefaultLabel)}</strong></div>
          </div>
          <div class="indicators-modal-scroll">
            ${rowsHtml}
          </div>
        </div>
        <div class="proj-modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-restore-default-indicator-labels">${uiIcon('undo', 14)} Khôi phục tên mặc định</button>
          <button type="button" class="btn btn-primary" id="btn-ok-indicators-modal">Xong</button>
        </div>
      </div>
    </div>`;
  }

  private renderProjectModal(
    session: ReportSession | undefined,
    datasets: { GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): string {
    if (!session || (!this.editingProjectId && !this.isAddingProject)) {
      return '';
    }

    const selectedLocalities = effectiveLocalities.filter((l) =>
      session.selectedLocalityIds.includes(l.id)
    );

    if (this.isAddingProject) {
      const locOptionsHtml = selectedLocalities
        .map(
          (loc) =>
            `<option value="${escapeHtmlUi(loc.id)}">${escapeHtmlUi(loc.displayName)}</option>`
        )
        .join('');

      return `<div class="proj-modal-backdrop no-print" id="proj-modal-backdrop">
        <div class="proj-modal-dialog" role="dialog" aria-modal="true">
          <div class="proj-modal-header">
            <h3 class="proj-modal-title">Thêm dự án GPMB mới vào danh sách</h3>
            <button type="button" class="proj-modal-close" id="btn-close-proj-modal" aria-label="Đóng">&times;</button>
          </div>
          <form id="form-add-project">
            <div class="proj-modal-body">
              <div class="form-group">
                <label>Địa phương:</label>
                <select id="new-proj-locality" class="form-select" required>${locOptionsHtml}</select>
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
                <label>Hạn hoàn thành (chi tiết đến tháng):</label>
                <input type="text" id="new-proj-deadline" class="form-input" placeholder="Ví dụ: Hạn tháng 11/2026" value="Hạn tháng 11/2026" required />
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

    const uncompletedRes = getUncompletedProjectsForSession({
      session,
      gpmbDataset: datasets.GPMB,
      baselineLocalities: effectiveLocalities,
    });
    const proj = uncompletedRes.projects.find((p) => p.id === this.editingProjectId);
    if (!proj) return '';

    const overrides = session.settings.projectOverrides || {};
    const hasOverride = Boolean(overrides[proj.id]);

    return `<div class="proj-modal-backdrop no-print" id="proj-modal-backdrop">
      <div class="proj-modal-dialog" role="dialog" aria-modal="true">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title">Chỉnh sửa thông tin dự án GPMB</h3>
          <button type="button" class="proj-modal-close" id="btn-close-proj-modal" aria-label="Đóng">&times;</button>
        </div>
        <form id="form-edit-project" data-project-id="${escapeHtmlUi(proj.id)}">
          <div class="proj-modal-body">
            <div class="form-group">
              <label>Địa phương:</label>
              <input type="text" class="form-input" value="${escapeHtmlUi(
                proj.localityName
              )}" disabled style="background:#f1f5f9; cursor:not-allowed;" />
            </div>
            <div class="form-group">
              <label>Tên dự án:</label>
              <textarea id="edit-proj-name" class="form-input" rows="2" required>${escapeHtmlUi(
                proj.projectName
              )}</textarea>
            </div>
            <div class="form-group">
              <label>Tỷ lệ hoàn thành:</label>
              <input type="text" id="edit-proj-rate" class="form-input" value="${escapeHtmlUi(
                proj.completionRate
              )}" required />
            </div>
            <div class="form-group">
              <label>Hạn hoàn thành (chi tiết đến tháng):</label>
              <input type="text" id="edit-proj-deadline" class="form-input" value="${escapeHtmlUi(
                proj.deadline
              )}" required />
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
                    )}">Khôi phục mặc định</button>`
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

  private renderNq11Modal(
    session: ReportSession | undefined,
    effectiveLocalities: Locality[]
  ): string {
    if (!session || (!this.editingNq11Id && !this.isAddingNq11)) {
      return '';
    }

    const selectedLocalities = effectiveLocalities.filter((l) =>
      session.selectedLocalityIds.includes(l.id)
    );

    if (this.isAddingNq11) {
      const locOptionsHtml = selectedLocalities
        .map(
          (loc) =>
            `<option value="${escapeHtmlUi(loc.id)}"${
              loc.id === this.targetNq11LocalityId ? ' selected' : ''
            }>${escapeHtmlUi(loc.displayName)}</option>`
        )
        .join('');

      return `<div class="proj-modal-backdrop no-print" id="nq11-modal-backdrop">
        <div class="proj-modal-dialog" role="dialog" aria-modal="true">
          <div class="proj-modal-header">
            <h3 class="proj-modal-title">Thêm dự án theo NQ 11 có khó khăn, vướng mắc</h3>
            <button type="button" class="proj-modal-close" id="btn-close-nq11-modal" aria-label="Đóng">&times;</button>
          </div>
          <form id="form-add-nq11">
            <div class="proj-modal-body">
              <div class="form-group">
                <label>Địa phương (xã / phường):</label>
                <select id="new-nq11-locality" class="form-select" required>${locOptionsHtml}</select>
              </div>
              <div class="form-group">
                <label>Tên dự án:</label>
                <textarea id="new-nq11-name" class="form-input" rows="2" placeholder="Nhập tên dự án theo NQ 11..." required></textarea>
              </div>
              <div class="form-group">
                <label>Nội dung khó khăn, vướng mắc / Tiến độ:</label>
                <input type="text" id="new-nq11-issue" class="form-input" value="Đang có khó khăn, vướng mắc" required />
              </div>
              <div class="form-group">
                <label>Hạn hoàn thành (chi tiết đến tháng):</label>
                <input type="text" id="new-nq11-deadline" class="form-input" value="Hạn tháng 11/2026" required />
              </div>
            </div>
            <div class="proj-modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-nq11-modal">Hủy</button>
              <button type="submit" class="btn btn-primary">Thêm dự án NQ 11</button>
            </div>
          </form>
        </div>
      </div>`;
    }

    const nq11List = session.settings.nq11Projects || [];
    const proj = nq11List.find((p) => p.id === this.editingNq11Id);
    if (!proj) return '';

    return `<div class="proj-modal-backdrop no-print" id="nq11-modal-backdrop">
      <div class="proj-modal-dialog" role="dialog" aria-modal="true">
        <div class="proj-modal-header">
          <h3 class="proj-modal-title">Chỉnh sửa dự án theo NQ 11</h3>
          <button type="button" class="proj-modal-close" id="btn-close-nq11-modal" aria-label="Đóng">&times;</button>
        </div>
        <form id="form-edit-nq11" data-nq11-id="${escapeHtmlUi(proj.id)}">
          <div class="proj-modal-body">
            <div class="form-group">
              <label>Địa phương:</label>
              <input type="text" class="form-input" value="${escapeHtmlUi(
                proj.localityName
              )}" disabled style="background:#f1f5f9; cursor:not-allowed;" />
            </div>
            <div class="form-group">
              <label>Tên dự án:</label>
              <textarea id="edit-nq11-name" class="form-input" rows="2" required>${escapeHtmlUi(
                proj.projectName
              )}</textarea>
            </div>
            <div class="form-group">
              <label>Nội dung khó khăn, vướng mắc / Tiến độ:</label>
              <input type="text" id="edit-nq11-issue" class="form-input" value="${escapeHtmlUi(
                proj.issueContent || ''
              )}" required />
            </div>
            <div class="form-group">
              <label>Hạn hoàn thành (chi tiết đến tháng):</label>
              <input type="text" id="edit-nq11-deadline" class="form-input" value="${escapeHtmlUi(
                proj.deadline || 'Hạn tháng 11/2026'
              )}" required />
            </div>
          </div>
          <div class="proj-modal-footer">
            <div>
              <button type="button" class="btn btn-outline-danger btn-sm" id="btn-delete-nq11-project" data-nq11-id="${escapeHtmlUi(
                proj.id
              )}">Xóa dự án này</button>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-nq11-modal">Hủy</button>
              <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
            </div>
          </div>
        </form>
      </div>
    </div>`;
  }

  private bindCanvasInteractiveEvents(
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
  ): void {
    document.getElementById('btn-open-coverage-modal-top')?.addEventListener('click', () => {
      this.showCoverageModal = true;
      this.render();
    });
    document.getElementById('btn-center-load-embedded')?.addEventListener('click', () => {
      this.loadEmbeddedReferenceWorkbooks('2026-10-19');
    });
    const centerUpload = document.getElementById('input-center-xlsx-upload') as HTMLInputElement | null;
    centerUpload?.addEventListener('change', () => {
      if (centerUpload.files) {
        void this.importSelectedFiles(centerUpload.files);
      }
    });

    // Open localities focus from empty report state
    document.querySelectorAll('[data-action="open-localities-picker"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.isSidebarCollapsed = false;
        this.sidebarSectionsOpen.localities = true;
        this.render();
        setTimeout(() => {
          document.getElementById('input-unified-loc-search')?.focus();
        }, 40);
      });
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
      this.refreshLiveReportArea();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.zoomScale = Math.max(0.6, Math.round((this.zoomScale - 0.1) * 10) / 10);
      this.refreshLiveReportArea();
    });
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.zoomScale = 1;
      this.refreshLiveReportArea();
    });

    // Warnings panel
    document.getElementById('btn-open-warnings-panel')?.addEventListener('click', () => {
      this.rightPanelMode = this.rightPanelMode === 'WARNINGS' ? 'NONE' : 'WARNINGS';
      this.render();
    });

    // Click on A4 Title -> open sidebar settings block & focus title input
    document.querySelectorAll('[data-action="open-title-editor"]').forEach((el) => {
      el.addEventListener('click', () => {
        this.isSidebarCollapsed = false;
        this.sidebarSectionsOpen.settings = true;
        this.render();
        setTimeout(() => {
          const inp = document.getElementById('setting-report-title') as HTMLTextAreaElement | null;
          inp?.focus();
          inp?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 40);
      });
    });

    // Inline indicator edit on A4 paper
    document.querySelectorAll('.btn-inline-edit-ind').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const indId = btn.getAttribute('data-indicator-id');
        const rowNum = Number(btn.getAttribute('data-row-number'));
        const activeSession = this.getActiveSession();
        if (!activeSession) return;

        if (indId === 'REV_REALIZED') {
          const currentLabel=formatRevRealizedRowLabel({customLabel:activeSession.settings.revRealizedRowCustomLabel,asOfDate:datasets.REV?.asOfDate});
          const nextLabel=window.prompt('Đổi tên hiển thị dòng kết quả thu NSNN:',currentLabel);
          if (nextLabel?.trim()) {
            activeSession.settings.revRealizedRowCustomLabel=nextLabel.trim();
            this.triggerAutosave();
            this.render();
          }
          return;
        }

        if (indId === 'REV_BENCHMARK_RATE') {
          const { effectiveLocalities } = this.evaluateActiveContext();
          const revDs = datasets.REV;
          const currentLabel = formatRevBenchmarkRowLabel({
            customLabel: activeSession.settings.revBenchmarkRowCustomLabel,
            unitCount: revDs?.unitCount ?? 113,
            expectedCount: effectiveLocalities.length || 114,
            asOfDate: revDs?.asOfDate,
          });
          const nextLabel = window.prompt(
            'Đổi tên hiển thị dòng tỷ lệ hoàn thành thu NSNN chung:',
            currentLabel
          );
          if (nextLabel !== null && nextLabel.trim()) {
            activeSession.settings.revBenchmarkRowCustomLabel = nextLabel.trim();
            this.triggerAutosave();
            this.render();
          }
          return;
        }

        const row = activeSession.templateRows.find((r) => r.rowNumber === rowNum);
        if (!row) return;

        const newLabel = window.prompt(
          `Đổi tên hiển thị cho chỉ tiêu "${row.indicatorId}":`,
          row.customLabel
        );
        if (newLabel !== null && newLabel.trim()) {
          row.customLabel = newLabel.trim();
          this.triggerAutosave();
          this.render();
        }
      });
    });

    // Quick inline project font controls
    const adjustProjFont = (delta: number) => {
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      const current = activeSession.settings.uncompletedProjectsFontSizePt || 8;
      const next = Math.max(6, Math.min(16, Math.round((current + delta) * 2) / 2));
      activeSession.settings.uncompletedProjectsFontSizePt = next;
      const numInput = document.getElementById('setting-proj-font-size') as HTMLInputElement | null;
      if (numInput) numInput.value = String(next);
      this.triggerAutosave();
      this.refreshLiveReportArea();
    };
    document.getElementById('btn-quick-dec-proj-font')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      adjustProjFont(-0.5);
    });
    document.getElementById('btn-quick-inc-proj-font')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      adjustProjFont(0.5);
    });

    // Inline row 8 / 9 label buttons & project actions
    document.getElementById('btn-edit-uncompleted-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = this.getActiveSession();
      if (!s) return;
      const next = window.prompt(
        'Nhập tên hiển thị dòng số dự án chưa hoàn thành GPMB (STT 8):',
        s.settings.uncompletedRowCustomLabel || 'Số dự án chưa hoàn thành GPMB'
      );
      if (next !== null && next.trim()) {
        s.settings.uncompletedRowCustomLabel = next.trim();
        this.triggerAutosave();
        this.render();
      }
    });
    document.getElementById('btn-edit-uncompleted-list-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = this.getActiveSession();
      if (!s) return;
      const next = window.prompt(
        'Nhập tên hiển thị dòng danh sách dự án chưa hoàn thành GPMB:',
        s.settings.uncompletedProjectsListCustomLabel || 'Tên dự án chưa hoàn thành GPMB'
      );
      if (next !== null && next.trim()) {
        s.settings.uncompletedProjectsListCustomLabel = next.trim();
        this.triggerAutosave();
        this.render();
      }
    });
    document.getElementById('btn-edit-nq11-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = this.getActiveSession();
      if (!s) return;
      const next = window.prompt(
        'Nhập tên hiển thị dòng 9:',
        s.settings.nq11RowCustomLabel || 'Dự án theo NQ 11 trên địa bàn xã có khó khăn, vướng mắc'
      );
      if (next !== null && next.trim()) {
        s.settings.nq11RowCustomLabel = next.trim();
        this.triggerAutosave();
        this.render();
      }
    });

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
      const s = this.getActiveSession();
      if (!s) return;
      s.settings.showUncompletedProjectsTable =
        s.settings.showUncompletedProjectsTable === false ? true : false;
      const chk = document.getElementById('setting-show-uncompleted-table') as HTMLInputElement | null;
      if (chk) chk.checked = s.settings.showUncompletedProjectsTable !== false;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });

    document.querySelectorAll('.btn-action-add-nq11-loc').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isAddingNq11 = true;
        this.targetNq11LocalityId = btn.getAttribute('data-locality-id') || null;
        this.editingNq11Id = null;
        this.render();
      });
    });
    document.querySelectorAll('.btn-add-nq11-global').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isAddingNq11 = true;
        this.targetNq11LocalityId = null;
        this.editingNq11Id = null;
        this.render();
      });
    });
    document.querySelectorAll('.btn-action-edit-nq11').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nId = btn.getAttribute('data-nq11-id');
        if (nId) {
          this.editingNq11Id = nId;
          this.isAddingNq11 = false;
          this.render();
        }
      });
    });

    // Cell click -> Trace Popover
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
        const disbRec = datasets.DISB?.records.find((r) => r.localityId === locId);
        this.activeTraceExtraMeta = {
          officialNote: disbRec?.officialNote || null,
          inspectionMarker: disbRec?.inspectionMarker || null,
          datasets,
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
  }

  private bindDomEvents(
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): void {
    this.bindCanvasInteractiveEvents(evaluatedReport, datasets);

    // Sidebar collapse / expand toggle
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      this.render();
    });

    // Sidebar accordion section collapse toggles
    document.querySelectorAll('[data-toggle-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-toggle-block') as 'sources' | 'localities' | 'settings';
        if (key) {
          this.sidebarSectionsOpen[key] = !this.sidebarSectionsOpen[key];
          this.render();
        }
      });
    });

    // Topbar Session switcher
    const sessionSelect = document.getElementById('select-active-session') as HTMLSelectElement | null;
    sessionSelect?.addEventListener('change', () => {
      this.workspace.activeSessionId = sessionSelect.value;
      this.clearCellSelection(true);
      this.editingProjectId = null;
      this.editingNq11Id = null;
      this.triggerAutosave();
      this.render();
    });

    // Topbar Rename Session Modal open
    document.getElementById('btn-topbar-rename-session')?.addEventListener('click', () => {
      const s = this.getActiveSession();
      if (!s) return;
      this.renameSessionNameDraft = s.name;
      this.showRenameSessionModal = true;
      this.render();
      setTimeout(() => {
        const inp = document.getElementById('input-rename-session-name') as HTMLInputElement | null;
        inp?.select();
      }, 30);
    });

    // Topbar New Session Modal open
    document.getElementById('btn-topbar-new-session')?.addEventListener('click', () => {
      this.newSessionNameDraft = `Báo cáo KTXH phiên ${this.workspace.sessions.length + 1}`;
      this.newSessionSourceMode = 'CURRENT';
      this.showNewSessionModal = true;
      this.render();
      setTimeout(() => {
        const inp = document.getElementById('input-modal-session-name') as HTMLInputElement | null;
        inp?.select();
      }, 30);
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

    // Topbar Delete Session
    document.getElementById('btn-topbar-delete-session')?.addEventListener('click', () => {
      const activeSession = this.getActiveSession();
      if (!activeSession || this.workspace.sessions.length <= 1) return;
      if (window.confirm(`Bạn có chắc chắn muốn xóa phiên "${activeSession.name}"?`)) {
        deleteReportSession(this.workspace, activeSession.id, true);
        this.clearCellSelection(true);
        this.triggerAutosave();
        this.setStatus(`Đã xóa phiên "${activeSession.name}".`, 'info');
      }
    });

    // Topbar Export Excel
    document.getElementById('btn-topbar-export-xlsx')?.addEventListener('click', () => {
      const latest = this.evaluateActiveContext();
      if (!latest.activeSession || !latest.evaluatedReport) {
        this.setStatus('Phiên hiện tại chưa đủ 3 nguồn hoặc chưa có báo cáo để xuất Excel.', 'warning');
        return;
      }
      try {
        const bytes = exportSessionReportToXlsxBytes({
          evaluated: latest.evaluatedReport,
          baselineLocalities: latest.effectiveLocalities,
          datasets: latest.datasets,
        });
        const blob = new Blob([bytes as unknown as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bao_cao_KTXH_${latest.activeSession.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.setStatus('Đã xuất tệp Excel (.xlsx) thành công.', 'success');
      } catch (err) {
        this.setStatus(`Lỗi xuất Excel: ${(err as Error).message}`, 'error');
      }
    });

    // Topbar Print / PDF
    document.getElementById('btn-topbar-print')?.addEventListener('click', () => {
      if(!this.evaluateActiveContext().evaluatedReport){this.setStatus('Chưa có báo cáo hợp lệ; hãy nhập lại hoặc bổ sung nguồn Excel.','warning');return;}
      window.print();
    });

    // Backup & Restore (.kxh.json)
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

    const restoreInput = document.getElementById('input-restore-backup-file') as HTMLInputElement | null;
    restoreInput?.addEventListener('change', async () => {
      if (restoreInput.files && restoreInput.files[0]) {
        try {
          const text = await restoreInput.files[0].text();
          const restored = restoreWorkspaceFromBackupJson(text);
          this.workspace = restored;
          sanitizeWorkspace(this.workspace);
          this.triggerAutosave();
          this.setStatus(
            `Đã khôi phục hồ sơ "${restored.name}" (${restored.sessions.length} phiên).`,
            'success'
          );
        } catch (err) {
          this.setStatus(`Lỗi khôi phục hồ sơ: ${(err as Error).message}`, 'error');
        }
      }
    });

    // Status Banner close
    document.getElementById('btn-clear-banner')?.addEventListener('click', () => {
      this.statusBannerMessage = '';
      this.render();
    });

    // Per-session Source Rebind dropdowns
    document.querySelectorAll('.select-session-dataset').forEach((selEl) => {
      selEl.addEventListener('change', () => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        const sourceType = selEl.getAttribute('data-source-type') as 'DISB' | 'REV' | 'GPMB';
        const val = (selEl as HTMLSelectElement).value;
        if (!sourceType) return;
        if (val === '__EMPTY__') {
          clearSessionDatasetBinding(this.workspace, activeSession.id, sourceType);
          this.triggerAutosave();
          this.setStatus(
            `Đã gỡ nguồn ${sourceType} khỏi riêng phiên "${activeSession.name}".`,
            'info'
          );
        } else {
          rebindSessionDataset(this.workspace, activeSession.id, sourceType, val);
          this.triggerAutosave();
          this.setStatus(
            `Đã chuyển nguồn ${sourceType} của riêng phiên "${activeSession.name}".`,
            'success'
          );
        }
      });
    });

    // Per-slot direct file upload inside source card
    document.querySelectorAll('.input-slot-xlsx').forEach((inp) => {
      inp.addEventListener('change', () => {
        const input = inp as HTMLInputElement;
        const slot = input.getAttribute('data-slot-type') as 'DISB' | 'REV' | 'GPMB';
        if (input.files && input.files.length > 0) {
          void this.importSelectedFiles(input.files, slot);
        }
      });
    });

    // Drag & Drop excel uploader in Sidebar Block 1
    const dropzone = document.getElementById('dropzone-excel-files');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer?.files) {
          void this.importSelectedFiles(e.dataTransfer.files);
        }
      });
      dropzone.addEventListener('click', () => {
        document.getElementById('input-xlsx-files')?.click();
      });
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.getElementById('input-xlsx-files')?.click();
        }
      });
    }

    const inputFiles = document.getElementById('input-xlsx-files') as HTMLInputElement | null;
    inputFiles?.addEventListener('change', () => {
      if (inputFiles.files) {
        void this.importSelectedFiles(inputFiles.files);
      }
    });

    // Save asOfDate per-session (auto-clones dataset if shared with another session)
    document.querySelectorAll('.btn-save-asof-date').forEach((btnEl) => {
      btnEl.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        const dsId = btnEl.getAttribute('data-dataset-id');
        if (!activeSession || !dsId) return;
        const inputEl = document.getElementById(
          `input-asof-date-${dsId}`
        ) as HTMLInputElement | null;
        if (!inputEl || !inputEl.value) return;
        try {
          const updated = updateDatasetAsOfDateForSession(
            this.workspace,
            activeSession.id,
            dsId,
            inputEl.value
          );
          this.triggerAutosave();
          this.setStatus(
            `Đã cập nhật ngày chốt nguồn ${updated.sourceType} thành ${formatVnDate(
              updated.asOfDate
            )} cho riêng phiên "${activeSession.name}".`,
            'success'
          );
        } catch (err) {
          this.setStatus((err as Error).message, 'error');
        }
      });
    });

    // Confirm REV date
    document.getElementById('btn-confirm-rev-date')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const dsId = btn.getAttribute('data-dataset-id') || '';
      const activeSession = this.getActiveSession();
      const dateEl = document.getElementById('input-confirm-rev-date') as HTMLInputElement | null;
      if (!activeSession) return;
      try {
        updateDatasetAsOfDateForSession(
          this.workspace,
          activeSession.id,
          dsId,
          dateEl?.value || '2026-10-19',
          'Xác nhận ngày chốt thực tế'
        );
        this.triggerAutosave();
        this.setStatus('Đã xác nhận ngày chốt cho nguồn Thu NSNN của phiên này.', 'success');
      } catch (err) {
        confirmDatasetAsOfDate(
          this.workspace,
          dsId,
          dateEl?.value || '2026-10-19',
          'Xác nhận ngày chốt thực tế'
        );
        this.triggerAutosave();
        this.setStatus('Đã xác nhận ngày chốt cho nguồn Thu NSNN.', 'success');
      }
    });

    document.getElementById('btn-load-embedded-confirmed')?.addEventListener('click', () => {
      this.loadEmbeddedReferenceWorkbooks('2026-10-19');
    });

    // Modals: Coverage & Indicators
    document.getElementById('btn-open-coverage-modal')?.addEventListener('click', () => {
      this.showCoverageModal = true;
      this.render();
    });
    document.getElementById('btn-open-indicators-modal')?.addEventListener('click', () => {
      this.showIndicatorsModal = true;
      this.render();
    });

    // Close Right Context Drawer & Popover using shared binding helpers
    this.bindRightPanelEvents();
    this.bindPopoverEvents();

    // Live Block 3 Controls (Immediate update without form submit reload)
    const activeSession = this.getActiveSession();
    const applyLiveTitleAndTextSettings = () => {
      const s = this.getActiveSession();
      if (!s) return;
      const titleEl = document.getElementById('setting-report-title') as HTMLTextAreaElement | null;
      const subtitleEl = document.getElementById('setting-subtitle') as HTMLInputElement | null;
      const showSubEl = document.getElementById('setting-show-subtitle') as HTMLInputElement | null;
      if (titleEl && titleEl.value.trim()) s.settings.reportTitle = titleEl.value.trim();
      if (subtitleEl) s.settings.subtitle = subtitleEl.value;
      if (showSubEl) s.settings.showSubtitle = showSubEl.checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    };

    document.getElementById('setting-report-title')?.addEventListener('input', applyLiveTitleAndTextSettings);
    document.getElementById('setting-subtitle')?.addEventListener('input', applyLiveTitleAndTextSettings);
    document.getElementById('setting-show-subtitle')?.addEventListener('change', applyLiveTitleAndTextSettings);
    document.getElementById('form-edit-title-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      applyLiveTitleAndTextSettings();
    });

    document.getElementById('setting-show-rev-realized-row')?.addEventListener('change',(e)=>{
      if (!activeSession) return;
      activeSession.settings.showRevRealizedRow=(e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.render();
    });
    document.getElementById('setting-show-rev-benchmark-row')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.showRevBenchmarkRow = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });
    document.getElementById('setting-show-disb-adjustment')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.showDisbPlanAdjustmentComparison = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });
    document.getElementById('setting-show-uncompleted-summary')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.showUncompletedSummaryRow = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });
    document.getElementById('setting-show-uncompleted-table')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.showUncompletedProjectsTable = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });
    document.getElementById('setting-show-nq11-row')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.showNq11Row = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });
    document.getElementById('setting-split-row8-to-new-page')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      activeSession.settings.splitRow8ToNewPage = (e.target as HTMLInputElement).checked;
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });

    document.getElementById('setting-indicator-col-width')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      const parsed = Number((e.target as HTMLInputElement).value);
      if (parsed >= 160 && parsed <= 600) {
        activeSession.settings.indicatorColumnWidthPx = parsed;
        this.triggerAutosave();
        this.refreshLiveReportArea();
      }
    });
    document.getElementById('btn-reset-ind-width')?.addEventListener('click', () => {
      if (!activeSession) return;
      activeSession.settings.indicatorColumnWidthPx = 240;
      const inp = document.getElementById('setting-indicator-col-width') as HTMLInputElement | null;
      if (inp) inp.value = '240';
      this.triggerAutosave();
      this.refreshLiveReportArea();
    });

    const adjustSidebarProjFont = (delta: number) => {
      if (!activeSession) return;
      const current = activeSession.settings.uncompletedProjectsFontSizePt || 8;
      const next = Math.max(6, Math.min(16, Math.round((current + delta) * 2) / 2));
      activeSession.settings.uncompletedProjectsFontSizePt = next;
      const inp = document.getElementById('setting-proj-font-size') as HTMLInputElement | null;
      if (inp) inp.value = String(next);
      this.triggerAutosave();
      this.refreshLiveReportArea();
    };
    document.getElementById('btn-dec-proj-font')?.addEventListener('click', () => adjustSidebarProjFont(-0.5));
    document.getElementById('btn-inc-proj-font')?.addEventListener('click', () => adjustSidebarProjFont(0.5));
    document.getElementById('setting-proj-font-size')?.addEventListener('change', (e) => {
      if (!activeSession) return;
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val) && val >= 6 && val <= 16) {
        activeSession.settings.uncompletedProjectsFontSizePt = val;
        this.triggerAutosave();
        this.refreshLiveReportArea();
      }
    });

    if (activeSession) {
      this.bindLocalityCheckboxes(activeSession, datasets, effectiveLocalities);
      this.bindLocalityReorderEvents(activeSession, datasets, effectiveLocalities);
    }

    const locSearchInput = document.getElementById('input-unified-loc-search') as HTMLInputElement | null;
    locSearchInput?.addEventListener('input', () => {
      this.localitySearchQuery = locSearchInput.value;
      const clearBtn = document.getElementById('btn-clear-loc-search');
      if (clearBtn) clearBtn.classList.toggle('is-hidden', !this.localitySearchQuery);
      const s = this.getActiveSession();
      if (s) this.updateLocalityListView(s, datasets, effectiveLocalities);
    });
    document.getElementById('btn-clear-loc-search')?.addEventListener('click', () => {
      this.localitySearchQuery = '';
      if (locSearchInput) {
        locSearchInput.value = '';
        locSearchInput.focus();
      }
      document.getElementById('btn-clear-loc-search')?.classList.add('is-hidden');
      const s = this.getActiveSession();
      if (s) this.updateLocalityListView(s, datasets, effectiveLocalities);
    });
    const locTypeSelect = document.getElementById('select-unified-loc-type') as HTMLSelectElement | null;
    locTypeSelect?.addEventListener('change', () => {
      this.localityTypeFilter = locTypeSelect.value as 'ALL' | LocalityType;
      const s = this.getActiveSession();
      if (s) this.updateLocalityListView(s, datasets, effectiveLocalities);
    });
    const locSortSelect = document.getElementById('select-unified-loc-sort') as HTMLSelectElement | null;
    locSortSelect?.addEventListener('change', () => {
      this.localitySortOption = locSortSelect.value as KtxhOfflineApp['localitySortOption'];
      const s = this.getActiveSession();
      if (s) this.updateLocalityListView(s, datasets, effectiveLocalities);
    });

    // New Session Modal Events
    const closeNewSessionModal = () => {
      this.showNewSessionModal = false;
      this.render();
    };
    document.getElementById('btn-close-new-session-modal')?.addEventListener('click', closeNewSessionModal);
    document.getElementById('btn-cancel-new-session-modal')?.addEventListener('click', closeNewSessionModal);
    document.getElementById('new-session-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('new-session-modal-backdrop')) {
        closeNewSessionModal();
      }
    });
    document.querySelectorAll('input[name="new-session-source-mode"]').forEach((rEl) => {
      rEl.addEventListener('change', () => {
        const val = (rEl as HTMLInputElement).value as 'CURRENT' | 'EMBEDDED' | 'EMPTY';
        if (val) this.newSessionSourceMode = val;
      });
    });
    document.getElementById('form-new-session-modal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('input-modal-session-name') as HTMLInputElement | null;
      const sessionName = nameInput?.value.trim() || 'Báo cáo KTXH phiên mới';
      const checkedRadio = document.querySelector(
        'input[name="new-session-source-mode"]:checked'
      ) as HTMLInputElement | null;
      const mode = (checkedRadio?.value || this.newSessionSourceMode) as 'CURRENT' | 'EMBEDDED' | 'EMPTY';
      const prevSession = this.getActiveSession();

      let newSess: ReportSession;
      if (mode === 'EMPTY') {
        newSess = createReportSession(this.workspace, {
          name: sessionName,
          inheritEmptySources: true,
        });
      } else if (mode === 'CURRENT' && prevSession) {
        newSess = createReportSession(this.workspace, {
          name: sessionName,
          dataBindings: { ...prevSession.dataBindings },
          exactBindings: true,
        });
      } else {
        newSess = createReportSession(this.workspace, { name: sessionName });
        if (mode === 'EMBEDDED' && window.__EMBEDDED_REFERENCE_FIXTURES__) {
          this.showNewSessionModal = false;
          this.clearCellSelection(true);
          this.loadEmbeddedReferenceWorkbooks('2026-10-19');
          return;
        }
      }

      this.workspace.activeSessionId = newSess.id;
      this.showNewSessionModal = false;
      this.clearCellSelection(true);
      this.triggerAutosave();
      this.setStatus(
        mode === 'EMPTY'
          ? `Đã tạo phiên trống "${newSess.name}" (0 địa phương, chưa gắn nguồn — hãy nạp file Excel riêng cho phiên này).`
          : `Đã tạo phiên "${newSess.name}" (0 địa phương mặc định).`,
        'success'
      );
    });

    // Rename Session Modal Events
    const closeRenameSessionModal = () => {
      this.showRenameSessionModal = false;
      this.render();
    };
    document.getElementById('btn-close-rename-session-modal')?.addEventListener('click', closeRenameSessionModal);
    document.getElementById('btn-cancel-rename-session-modal')?.addEventListener('click', closeRenameSessionModal);
    document.getElementById('rename-session-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('rename-session-modal-backdrop')) {
        closeRenameSessionModal();
      }
    });
    document.getElementById('form-rename-session-modal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = this.getActiveSession();
      if (!s) return;
      const inp = document.getElementById('input-rename-session-name') as HTMLInputElement | null;
      const nextName = inp?.value.trim() || '';
      if (!nextName) return;
      try {
        renameReportSession(this.workspace, s.id, nextName);
        this.showRenameSessionModal = false;
        this.triggerAutosave();
        this.setStatus(`Đã đổi tên phiên làm việc thành "${nextName}".`, 'success');
      } catch (err) {
        this.setStatus((err as Error).message, 'error');
      }
    });

    // Coverage Modal Events
    const closeCoverageModal = () => {
      this.showCoverageModal = false;
      this.render();
    };
    document.getElementById('btn-close-coverage-modal')?.addEventListener('click', closeCoverageModal);
    document.getElementById('btn-ok-coverage-modal')?.addEventListener('click', closeCoverageModal);
    document.getElementById('coverage-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('coverage-modal-backdrop')) {
        closeCoverageModal();
      }
    });

    // Indicators Modal Events (including previously unbound visibility/label/reset handlers!)
    const closeIndicatorsModal = () => {
      this.showIndicatorsModal = false;
      this.render();
    };
    document.getElementById('btn-close-indicators-modal')?.addEventListener('click', closeIndicatorsModal);
    document.getElementById('btn-ok-indicators-modal')?.addEventListener('click', closeIndicatorsModal);
    document.getElementById('indicators-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('indicators-modal-backdrop')) {
        closeIndicatorsModal();
      }
    });
    document.querySelectorAll('.chk-toggle-row-visibility').forEach((chkEl) => {
      chkEl.addEventListener('change', () => {
        const s = this.getActiveSession();
        if (!s) return;
        const rowNum = Number(chkEl.getAttribute('data-row-num'));
        const row = s.templateRows.find((r) => r.rowNumber === rowNum);
        if (row) {
          row.visible = (chkEl as HTMLInputElement).checked;
          this.triggerAutosave();
          this.refreshLiveReportArea();
        }
      });
    });
    document.querySelectorAll('.input-ind-custom-label').forEach((inpEl) => {
      inpEl.addEventListener('input', () => {
        const s = this.getActiveSession();
        if (!s) return;
        const rowNum = Number(inpEl.getAttribute('data-row-num'));
        const row = s.templateRows.find((r) => r.rowNumber === rowNum);
        const val = (inpEl as HTMLInputElement).value;
        if (row && val.trim()) {
          row.customLabel = val;
          this.triggerAutosave();
          this.refreshLiveReportArea();
        }
      });
    });
    document.querySelectorAll('.chk-toggle-rev-benchmark-instant').forEach((chkEl) => {
      chkEl.addEventListener('change', () => {
        const s = this.getActiveSession();
        if (!s) return;
        s.settings.showRevBenchmarkRow = (chkEl as HTMLInputElement).checked;
        const sidebarChk = document.getElementById('setting-show-rev-benchmark-row') as HTMLInputElement | null;
        if (sidebarChk) sidebarChk.checked = s.settings.showRevBenchmarkRow;
        this.triggerAutosave();
        this.refreshLiveReportArea();
      });
    });
    document.getElementById('btn-restore-default-indicator-labels')?.addEventListener('click', () => {
      const s = this.getActiveSession();
      if (!s) return;
      s.templateRows = TEMPLATE_14_ROWS_DEFAULT.map((r) => ({ ...r }));
      syncReportLabelsWithDatasetDates(this.workspace);
      this.triggerAutosave();
      this.render();
    });

    // Project Modal Events
    const closeProjModal = () => {
      this.editingProjectId = null;
      this.isAddingProject = false;
      this.render();
    };
    document.getElementById('btn-close-proj-modal')?.addEventListener('click', closeProjModal);
    document.getElementById('btn-cancel-proj-modal')?.addEventListener('click', closeProjModal);
    document.getElementById('proj-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('proj-modal-backdrop')) closeProjModal();
    });
    document.getElementById('form-edit-project')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const pId = (e.target as HTMLElement).getAttribute('data-project-id');
      if (!pId) return;
      const nameVal = (document.getElementById('edit-proj-name') as HTMLTextAreaElement | null)?.value.trim();
      const rateVal = (document.getElementById('edit-proj-rate') as HTMLInputElement | null)?.value.trim();
      const deadlineVal = (document.getElementById('edit-proj-deadline') as HTMLInputElement | null)?.value.trim();
      const hiddenVal = (document.getElementById('edit-proj-hidden') as HTMLInputElement | null)?.checked ?? false;
      if (!activeSession.settings.projectOverrides) activeSession.settings.projectOverrides = {};
      activeSession.settings.projectOverrides[pId] = {
        projectName: nameVal,
        completionRate: rateVal,
        deadline: deadlineVal ? formatProjectDeadline(deadlineVal) : 'Hạn tháng 11/2026',
        isHidden: hiddenVal,
      };
      this.editingProjectId = null;
      this.triggerAutosave();
      this.setStatus('Đã cập nhật dự án thành công.', 'success');
    });
    document.getElementById('btn-reset-proj-override')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const pId = (e.currentTarget as HTMLElement).getAttribute('data-project-id');
      if (pId && activeSession.settings.projectOverrides) {
        delete activeSession.settings.projectOverrides[pId];
        this.editingProjectId = null;
        this.triggerAutosave();
        this.setStatus('Đã khôi phục dữ liệu gốc cho dự án.', 'info');
      }
    });
    document.getElementById('form-add-project')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const locId = (document.getElementById('new-proj-locality') as HTMLSelectElement | null)?.value;
      const loc = effectiveLocalities.find((l) => l.id === locId);
      if (!locId || !loc) return;
      const nameVal = (document.getElementById('new-proj-name') as HTMLInputElement | null)?.value.trim();
      const rateVal = (document.getElementById('new-proj-rate') as HTMLInputElement | null)?.value.trim();
      const deadlineVal = (document.getElementById('new-proj-deadline') as HTMLInputElement | null)?.value.trim();
      if (!activeSession.settings.customProjects) activeSession.settings.customProjects = [];
      activeSession.settings.customProjects.push({
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        localityId: loc.id,
        localityName: loc.displayName,
        projectStt: activeSession.settings.customProjects.length + 1,
        projectName: nameVal || 'Dự án mới',
        completionRate: rateVal || '0,00%',
        deadline: deadlineVal ? formatProjectDeadline(deadlineVal) : 'Hạn tháng 11/2026',
        isCustom: true,
      });
      this.isAddingProject = false;
      this.triggerAutosave();
      this.setStatus(`Đã thêm dự án mới cho ${loc.displayName}.`, 'success');
    });

    // NQ 11 Modal Events
    const closeNq11Modal = () => {
      this.editingNq11Id = null;
      this.isAddingNq11 = false;
      this.targetNq11LocalityId = null;
      this.render();
    };
    document.getElementById('btn-close-nq11-modal')?.addEventListener('click', closeNq11Modal);
    document.getElementById('btn-cancel-nq11-modal')?.addEventListener('click', closeNq11Modal);
    document.getElementById('nq11-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('nq11-modal-backdrop')) closeNq11Modal();
    });
    document.getElementById('btn-delete-nq11-project')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const nId = (e.currentTarget as HTMLElement).getAttribute('data-nq11-id');
      if (nId && activeSession.settings.nq11Projects) {
        activeSession.settings.nq11Projects = activeSession.settings.nq11Projects.filter((p) => p.id !== nId);
        this.editingNq11Id = null;
        this.triggerAutosave();
        this.setStatus('Đã xóa dự án NQ 11 thành công.', 'info');
      }
    });
    document.getElementById('form-edit-nq11')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const nId = (e.target as HTMLElement).getAttribute('data-nq11-id');
      if (!nId) return;
      const nameVal = (document.getElementById('edit-nq11-name') as HTMLTextAreaElement | null)?.value.trim();
      const issueVal = (document.getElementById('edit-nq11-issue') as HTMLInputElement | null)?.value.trim();
      const deadlineVal = (document.getElementById('edit-nq11-deadline') as HTMLInputElement | null)?.value.trim();
      const item = (activeSession.settings.nq11Projects || []).find((p) => p.id === nId);
      if (item) {
        item.projectName = nameVal || 'Dự án NQ 11';
        item.issueContent = issueVal || 'Đang có khó khăn, vướng mắc';
        item.deadline = deadlineVal ? formatProjectDeadline(deadlineVal) : 'Hạn tháng 11/2026';
      }
      this.editingNq11Id = null;
      this.triggerAutosave();
      this.setStatus('Đã cập nhật dự án NQ 11 thành công.', 'success');
    });
    document.getElementById('form-add-nq11')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSession) return;
      const locId = (document.getElementById('new-nq11-locality') as HTMLSelectElement | null)?.value;
      const loc = effectiveLocalities.find((l) => l.id === locId);
      if (!locId || !loc) return;
      const nameVal = (document.getElementById('new-nq11-name') as HTMLTextAreaElement | null)?.value.trim();
      const issueVal = (document.getElementById('new-nq11-issue') as HTMLInputElement | null)?.value.trim();
      const deadlineVal = (document.getElementById('new-nq11-deadline') as HTMLInputElement | null)?.value.trim();
      if (!activeSession.settings.nq11Projects) activeSession.settings.nq11Projects = [];
      activeSession.settings.nq11Projects.push({
        id: `nq11_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        localityId: loc.id,
        localityName: loc.displayName,
        projectName: nameVal || 'Dự án theo NQ 11',
        issueContent: issueVal || 'Đang có khó khăn, vướng mắc',
        deadline: deadlineVal ? formatProjectDeadline(deadlineVal) : 'Hạn tháng 11/2026',
      });
      this.isAddingNq11 = false;
      this.targetNq11LocalityId = null;
      this.triggerAutosave();
      this.setStatus(`Đã thêm dự án NQ 11 cho ${loc.displayName}.`, 'success');
    });

    // Global Escape Key Handler
    window.onkeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const activeEl =
        typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      this.handleEscapeKey(activeEl);
    };
  }

  private updateLocalityListView(
    activeSession: ReportSession,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): void {
    const selBar = document.getElementById('unified-selection-bar');
    if (selBar) {
      selBar.innerHTML = this.renderSelectedSummaryBar(activeSession);
    }
    const box = document.getElementById('unified-locality-items-box');
    if (box) {
      box.innerHTML = this.renderLocalityItemsHtml(activeSession, datasets, effectiveLocalities);
    }
    const countPill = document.getElementById('sidebar-loc-count-pill');
    if (countPill) {
      countPill.textContent = `${activeSession.selectedLocalityIds.length}/${effectiveLocalities.length}`;
    }
    this.bindLocalityCheckboxes(activeSession, datasets, effectiveLocalities);
    this.bindLocalityReorderEvents(activeSession, datasets, effectiveLocalities);
  }

  private bindLocalityReorderEvents(
    activeSession: ReportSession,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): void {
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
      this.updateLocalityListView(activeSession, datasets, effectiveLocalities);
      this.refreshLiveReportArea();
    };

    document.querySelectorAll('.btn-row-move').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const locId = btn.getAttribute('data-loc-id');
        const dir = btn.getAttribute('data-move-dir') as 'up' | 'down';
        if (locId && dir) handleMove(locId, dir);
      });
    });

    document.getElementById('btn-deselect-all-localities')?.addEventListener('click', () => {
      setSessionLocalities(this.workspace, activeSession.id, []);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession, datasets, effectiveLocalities);
      this.refreshLiveReportArea();
    });

    document.getElementById('btn-reorder-az')?.addEventListener('click', () => {
      const localitiesMap = new Map(effectiveLocalities.map((l) => [l.id, l]));
      const sorted = [...activeSession.selectedLocalityIds].sort((a, b) => {
        const nameA = localitiesMap.get(a)?.displayName || '';
        const nameB = localitiesMap.get(b)?.displayName || '';
        return nameA.localeCompare(nameB, 'vi');
      });
      setSessionLocalities(this.workspace, activeSession.id, sorted);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession, datasets, effectiveLocalities);
      this.refreshLiveReportArea();
    });

    document.getElementById('btn-reorder-reverse')?.addEventListener('click', () => {
      const reversed = [...activeSession.selectedLocalityIds].reverse();
      setSessionLocalities(this.workspace, activeSession.id, reversed);
      this.triggerAutosave();
      this.updateLocalityListView(activeSession, datasets, effectiveLocalities);
      this.refreshLiveReportArea();
    });
  }

  private bindLocalityCheckboxes(
    activeSession: ReportSession,
    datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset },
    effectiveLocalities: Locality[]
  ): void {
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
        this.updateLocalityListView(activeSession, datasets, effectiveLocalities);
        this.refreshLiveReportArea();
      });
    });
  }
}

// Auto mount if in browser
if (typeof window !== 'undefined') {
  const mountApp = () => {
    try {
      const app = new KtxhOfflineApp();
      window.__KTXH_APP__ = app;
    } catch (err) {
      const root = document.getElementById('app');
      if (root) {
        root.innerHTML = `<div style="max-width:720px;margin:32px auto;padding:20px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#7f1d1d;font-family:sans-serif;">
          <h3>Lỗi khởi tạo ứng dụng KTXH Offline</h3>
          <pre style="white-space:pre-wrap;font-size:12px;">${escapeHtmlUi(
            err instanceof Error ? err.stack || err.message : String(err)
          )}</pre>
        </div>`;
      }
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', mountApp);
  } else {
    mountApp();
  }
}
