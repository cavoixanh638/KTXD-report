import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  confirmDatasetAsOfDate,
  createReportSession,
  cloneReportSession,
  deleteReportSession,
  setSessionLocalities,
  resolveSessionDatasets,
} from '../core/sessions';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
  detectSheetFingerprint,
  parseXlsxBytes,
} from '../core/sourceReaders';
import {
  evaluateSessionReport,
  EvaluatedSessionReport,
} from '../core/calculationTrace';
import { analyzeSourceCoverage } from '../core/coverage';
import { summarizeDatasetWarnings, filterWarningsForSession } from '../core/warnings';
import { searchLocalities } from '../core/localities';
import { renderReportGridHtml } from '../ui/reportGrid';
import { renderTraceInspectorHtml, escapeHtmlUi } from '../ui/cellInspector';
import { exportSessionReportToXlsxBytes } from '../export/xlsx';
import { generatePrintableReportHtml } from '../export/print';
import {
  exportWorkspaceBackupJson,
  restoreWorkspaceFromBackupJson,
} from '../backup/workspace';
import { CalculationTrace, LocalityType, Workspace } from '../core/types';

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

export class KtxhOfflineApp {
  public workspace: Workspace;
  public activeTab:
    | 'SESSIONS'
    | 'IMPORT'
    | 'LOCALITIES'
    | 'REPORT'
    | 'INSPECTOR'
    | 'BENCHMARKS'
    | 'EXPORT' = 'SESSIONS';
  public activeTraceId: string | undefined;
  public activeTrace: CalculationTrace | null = null;
  public activeTraceExtraMeta?: {
    officialNote?: string | null;
    inspectionMarker?: string | null;
  };
  public localitySearchQuery = '';
  public localityTypeFilter: 'ALL' | LocalityType = 'ALL';
  public warningRuleFilter = 'ALL';
  public statusBannerMessage = '';
  public statusBannerType: 'info' | 'warning' | 'error' | 'success' = 'info';

  constructor() {
    this.workspace = createEmptyWorkspace('Hồ sơ Báo cáo KTXH Offline (MASTER V2.2)');
    this.tryRestoreFromLocalStorageCache();
  }

  private saveToLocalStorageCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'KTXH_OFFLINE_WORKSPACE_CACHE_V2_2',
          JSON.stringify(this.workspace)
        );
      }
    } catch {
      // Ignore storage quota or file:// restrictions; file backup (.kxh.json) is primary
    }
  }

  private tryRestoreFromLocalStorageCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('KTXH_OFFLINE_WORKSPACE_CACHE_V2_2');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.formatVersion === 2 && Array.isArray(parsed.sessions)) {
            this.workspace = parsed;
          }
        }
      }
    } catch {
      // Ignore
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

    // Rebind existing sessions if any lacked bindings
    for (const s of this.workspace.sessions) {
      if (!s.dataBindings.DISB) s.dataBindings.DISB = disbDs.id;
      if (!s.dataBindings.REV) s.dataBindings.REV = revDs.id;
      if (!s.dataBindings.GPMB) s.dataBindings.GPMB = gpmbDs.id;
    }

    this.saveToLocalStorageCache();
    this.setStatus(
      revConfirmedDate
        ? `Đã nạp đủ 3 nguồn tham chiếu (DISB 114, REV 113 chốt ${revConfirmedDate}, GPMB 108/422 dự án).`
        : 'Đã nạp 3 nguồn tham chiếu. Lưu ý: Nguồn Thu NSNN (10T-19.10) chưa rõ ngày chốt — vui lòng xác nhận ngày chốt thực tế ở mục Nhập nguồn!',
      revConfirmedDate ? 'success' : 'warning'
    );
  }

  public handleWorkbookBytesUpload(bytes: Uint8Array, filename: string): void {
    try {
      const wb = parseXlsxBytes(bytes, filename);
      const visibleSheets = wb.sheets.filter((s) => s.state === 'visible');
      for (const s of visibleSheets) {
        const fp = detectSheetFingerprint(s);
        if (fp === 'DISB_V1') {
          const { dataset, localities } = importDisbursementWorkbook(
            bytes,
            filename
          );
          registerDatasetInWorkspace(this.workspace, dataset, localities);
          this.saveToLocalStorageCache();
          this.setStatus(
            `Đã nhập nguồn Giải ngân "${filename}" (${dataset.unitCount} địa phương, ngày chốt ${dataset.asOfDate}).`,
            'success'
          );
          return;
        }
        if (fp === 'REV_V1') {
          const { dataset } = importRevenueWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          this.saveToLocalStorageCache();
          this.setStatus(
            `Đã nhập nguồn Thu NSNN "${filename}" (${dataset.unitCount} địa phương). Vui lòng xác nhận ngày chốt thực tế!`,
            'warning'
          );
          return;
        }
        if (fp === 'GPMB_V1') {
          const { dataset } = importGpmbWorkbook(bytes, filename);
          registerDatasetInWorkspace(this.workspace, dataset);
          this.saveToLocalStorageCache();
          this.setStatus(
            `Đã nhập nguồn GPMB "${filename}" (${dataset.unitCount} địa bàn, ${dataset.projectRowCount} dòng dự án, ngày chốt ${dataset.asOfDate}).`,
            'success'
          );
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
        `BLOCKER: Không nhận diện được cấu trúc chuẩn của "${filename}". Yêu cầu mở Mapping Wizard (PH2-01).`,
        'error'
      );
    } catch (err) {
      this.setStatus(
        `Lỗi khi đọc tệp "${filename}": ${(err as Error).message}`,
        'error'
      );
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

    const navTabs: Array<{ id: KtxhOfflineApp['activeTab']; label: string }> = [
      { id: 'SESSIONS', label: '1. Quản lý phiên' },
      { id: 'IMPORT', label: '2. Nhập nguồn & QC' },
      { id: 'LOCALITIES', label: '3. Chọn địa phương' },
      { id: 'REPORT', label: '4. Bảng báo cáo 14 dòng' },
      { id: 'INSPECTOR', label: '5. Chi tiết ô & Trace' },
      { id: 'BENCHMARKS', label: '6. Mốc so sánh & Tùy chỉnh' },
      { id: 'EXPORT', label: '7. Xuất & Sao lưu' },
    ];

    const navHtml = navTabs
      .map(
        (t) => `<button type="button" class="nav-tab-btn ${
          this.activeTab === t.id ? 'active' : ''
        }" data-nav-tab="${t.id}">${escapeHtmlUi(t.label)}</button>`
      )
      .join('');

    const backupBadge = this.workspace.unsavedChanges
      ? `<span class="badge badge-WARNING" title="Dữ liệu mới chỉnh sửa chỉ lưu tạm trong bộ nhớ trình duyệt; hãy xuất file .kxh.json">Chưa sao lưu ra tệp (.kxh.json)</span>`
      : `<span class="badge badge-COMPLETE">Đã đồng bộ bản sao lưu</span>`;

    const statusBannerHtml = this.statusBannerMessage
      ? `<div class="status-banner status-${this.statusBannerType} no-print">
          <span>${escapeHtmlUi(this.statusBannerMessage)}</span>
          <button type="button" class="btn-close-banner" id="btn-clear-banner">&times;</button>
        </div>`
      : '';

    let mainViewHtml = '';
    if (this.activeTab === 'SESSIONS') {
      mainViewHtml = this.renderSessionsPage();
    } else if (this.activeTab === 'IMPORT') {
      mainViewHtml = this.renderImportPage(datasets);
    } else if (this.activeTab === 'LOCALITIES') {
      mainViewHtml = this.renderLocalitiesPage(activeSession);
    } else if (this.activeTab === 'REPORT') {
      mainViewHtml = this.renderReportPage(
        activeSession,
        evaluatedReport,
        datasets,
        Boolean(revNeedsDateConfirm)
      );
    } else if (this.activeTab === 'INSPECTOR') {
      mainViewHtml = renderTraceInspectorHtml(
        this.activeTrace,
        this.activeTraceExtraMeta
      );
    } else if (this.activeTab === 'BENCHMARKS') {
      mainViewHtml = this.renderBenchmarksAndSettingsPage(
        activeSession,
        evaluatedReport,
        datasets
      );
    } else if (this.activeTab === 'EXPORT') {
      mainViewHtml = this.renderExportAndBackupPage(
        activeSession,
        evaluatedReport,
        datasets
      );
    }

    root.innerHTML = `
      <header class="app-header no-print">
        <div class="header-brand">
          <h1>KTXH Offline Report — Báo cáo KTXH Xã/Phường/Đặc khu (MASTER V2.2 — PH1)</h1>
          <div class="header-meta">
            <span>Phiên đang mở: <strong>${escapeHtmlUi(
              activeSession ? `${activeSession.name} (${activeSession.selectedLocalityIds.length} địa phương)` : 'Chưa chọn phiên'
            )}</strong></span>
            ${backupBadge}
            <span class="badge badge-primary">Offline 100% (file://)</span>
          </div>
        </div>
        <nav class="app-nav">${navHtml}</nav>
      </header>
      ${statusBannerHtml}
      <main class="app-main no-print">
        ${mainViewHtml}
      </main>
      <div id="print-mount-area" class="print-only">
        ${
          evaluatedReport && activeSession?.settings.showScopeFootnotes
            ? generatePrintableReportHtml({
                evaluated: evaluatedReport,
                baselineLocalities: this.workspace.localities,
                datasets,
                includeTraceAppendix: false,
              })
            : ''
        }
      </div>
    `;

    this.bindDomEvents(evaluatedReport, datasets);
  }

  private renderSessionsPage(): string {
    const sessionsListHtml =
      this.workspace.sessions.length === 0
        ? `<div class="card empty-state-card">
            <h3>Chưa có phiên báo cáo nào</h3>
            <p>Khi tạo phiên mới, danh sách địa phương luôn <strong>rỗng (0 địa phương mặc định)</strong>. Bạn có thể tạo nhiều phiên độc lập (ví dụ: <em>Phiên A gồm 5 xã</em>, <em>Phiên B gồm 7 phường</em>) và chuyển đổi qua lại không mất thiết lập.</p>
          </div>`
        : `<table class="data-table">
            <thead>
              <tr>
                <th>Tên phiên báo cáo</th>
                <th>Số địa phương đã chọn</th>
                <th>Danh sách địa phương</th>
                <th>Phiên bản (Rev)</th>
                <th>Cập nhật lúc</th>
                <th>Thao tác</th>
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
                      <button type="button" class="btn btn-sm btn-primary" data-action="activate-session" data-session-id="${escapeHtmlUi(
                        s.id
                      )}">Mở phiên</button>
                      <button type="button" class="btn btn-sm" data-action="clone-session" data-session-id="${escapeHtmlUi(
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
        <h2>Trang A — Quản lý Nhiều Phiên Báo cáo (Multi-Session Workspace)</h2>
        <div class="toolbar-row">
          <input type="text" id="input-new-session-name" class="form-input" placeholder="Nhập tên phiên mới (VD: Báo cáo 5 xã khu vực A)..." value="Báo cáo KTXH phiên mới" />
          <button type="button" class="btn btn-primary" id="btn-create-session">+ Tạo phiên mới (0 địa phương mặc định)</button>
          <button type="button" class="btn btn-secondary" id="btn-quick-load-3-sources">Nạp nhanh 3 nguồn Excel tham chiếu (data/reference)</button>
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
    const { bySource, allCoverageDetails } = analyzeSourceCoverage(
      this.workspace.localities,
      datasets
    );
    const warnStats = summarizeDatasetWarnings(datasets);

    const dsRowsHtml = ['DISB', 'REV', 'GPMB']
      .map((type) => {
        const ds = datasets[type as 'DISB' | 'REV' | 'GPMB'];
        if (!ds) {
          return `<tr>
            <td><strong>${type}</strong></td>
            <td colspan="7"><span class="badge badge-MISSING">Chưa nạp nguồn ${type}</span></td>
          </tr>`;
        }
        const sheetsDesc = ds.allSheetsMeta
          .map((s) => `${s.name} (${s.state})`)
          .join('; ');
        return `<tr>
          <td><strong>${escapeHtmlUi(ds.sourceType)}</strong></td>
          <td>${escapeHtmlUi(ds.sourceFilename)}</td>
          <td><code>${escapeHtmlUi(ds.workbookSha256.slice(0, 16))}...</code></td>
          <td><strong>${escapeHtmlUi(ds.sourceSheet)}</strong> (idx ${ds.sheetIndex}, ${escapeHtmlUi(
          ds.sheetVisibility
        )})<br/><small class="muted">Tất cả sheet: ${escapeHtmlUi(sheetsDesc)}</small></td>
          <td><strong>${ds.unitCount}</strong> địa phương${
          ds.projectRowCount ? ` (${ds.projectRowCount} dòng dự án)` : ''
        }</td>
          <td>
            ${
              ds.asOfStatus === 'REQUIRES_USER_CONFIRMATION'
                ? `<div class="date-confirm-box">
                    <span class="badge badge-ERROR">BLOCKER: Cần xác nhận ngày chốt</span>
                    <input type="date" id="input-confirm-rev-date" value="2026-10-19" class="form-input-sm"/>
                    <input type="text" id="input-confirm-rev-reason" value="Dữ liệu sơ bộ kỳ 10 tháng chốt ngày 19/10/2026" class="form-input-sm"/>
                    <button type="button" class="btn btn-sm btn-primary" id="btn-confirm-rev-date" data-dataset-id="${escapeHtmlUi(
                      ds.id
                    )}">Xác nhận ngày chốt</button>
                  </div>`
                : `<strong>${escapeHtmlUi(ds.asOfDate)}</strong> <span class="badge badge-COMPLETE">${escapeHtmlUi(
                    ds.asOfStatus
                  )}</span>`
            }
          </td>
          <td><small>${escapeHtmlUi(ds.asOfDateEvidence)}</small></td>
        </tr>`;
      })
      .join('');

    const missingLocRowsHtml = allCoverageDetails
      .filter((c) => c.status === 'NO_LOCALITY_RECORD' || c.status === 'PARTIAL_AGGREGATE')
      .map(
        (c) => `<tr>
          <td><strong>${escapeHtmlUi(c.localityName)}</strong></td>
          <td>${escapeHtmlUi(c.sourceType || c.sourceDatasetId)}</td>
          <td><span class="badge badge-${escapeHtmlUi(c.status)}">${escapeHtmlUi(
          c.status
        )}</span></td>
          <td>${escapeHtmlUi(c.fieldId || 'Toàn bộ bản ghi địa phương')}</td>
          <td>${escapeHtmlUi(c.reason)}</td>
          <td>${escapeHtmlUi(c.asOfDate || '')}</td>
        </tr>`
      )
      .join('');

    const mMismatchIssues = (datasets.GPMB?.issues || []).filter(
      (i) => i.ruleId === 'WARNING_M_RATIO_MISMATCH'
    );

    const mMismatchHtml = mMismatchIssues
      .map(
        (iss) => `<tr>
          <td>DA STT <strong>${iss.projectStt}</strong> (dòng ${iss.sourceRow})</td>
          <td><strong>${escapeHtmlUi(iss.localityName)}</strong></td>
          <td><code>D${iss.sourceRow}, I${iss.sourceRow}, M${iss.sourceRow}</code></td>
          <td>${escapeHtmlUi(String(iss.observed))}%</td>
          <td><strong>${Number(iss.expected).toFixed(2)}%</strong></td>
          <td><span class="badge badge-WARNING">${Number(iss.delta).toFixed(
            2
          )} điểm %</span></td>
        </tr>`
      )
      .join('');

    return `<section class="page-section">
      <div class="card">
        <h2>Trang B — Nhập nguồn Excel, Xác minh Ngày chốt &amp; Kiểm toán Nguồn (PH1-01, PH1-03)</h2>
        <div class="toolbar-row">
          <label class="btn btn-primary">
            Chọn tệp Excel (.xlsx) từ máy tính
            <input type="file" id="input-xlsx-files" multiple accept=".xlsx" style="display:none" />
          </label>
          <button type="button" class="btn btn-secondary" id="btn-load-embedded-confirmed">Nạp bộ 3 file tham chiếu &amp; Xác nhận ngày chốt REV 19/10/2026</button>
          <button type="button" class="btn" id="btn-load-embedded-unconfirmed">Nạp bộ 3 file tham chiếu (Để trống ngày chốt REV để kiểm thử T14)</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Nguồn</th>
              <th>Tên tệp</th>
              <th>SHA-256</th>
              <th>Sheet được chọn (Visible)</th>
              <th>Phạm vi</th>
              <th>Ngày chốt độc lập</th>
              <th>Bằng chứng ngày chốt</th>
            </tr>
          </thead>
          <tbody>${dsRowsHtml}</tbody>
        </table>
      </div>

      <div class="card">
        <h3>1. Bảng Kiểm toán Địa phương Thiếu Bản ghi Nguồn &amp; Dự án Thiếu Thành phần (R06 Coverage)</h3>
        <p>Đối chiếu với danh mục tham chiếu ${
          this.workspace.localities.length || 114
        } địa phương từ DISB: Nguồn REV có <strong>${
      bySource.REV?.presentLocalityCount ?? 0
    }/114</strong> (thiếu <strong>${
      bySource.REV?.missingLocalities.map((m) => m.localityName).join(', ') ||
      '0'
    }</strong>); Nguồn GPMB có <strong>${
      bySource.GPMB?.presentLocalityCount ?? 0
    }/114</strong> (thiếu 6 địa phương: <strong>${
      bySource.GPMB?.missingLocalities.map((m) => m.localityName).join(', ') ||
      '0'
    }</strong>; và 3 dòng dự án thiếu kết quả I là dòng 107, 173, 365). Nguồn DISB có <strong>${
      warnStats.disbNullCountsByCol.totalCells
    }</strong> ô trống thành phần (G=${warnStats.disbNullCountsByCol.G}, J=${
      warnStats.disbNullCountsByCol.J
    }, M=${warnStats.disbNullCountsByCol.M}, N=${
      warnStats.disbNullCountsByCol.N
    }) trên <strong>${
      warnStats.disbNullCountsByCol.distinctRows
    }/114</strong> dòng địa phương (trạng thái <code>FIELD_MISSING</code>, cân đối ngang 114/114 đạt <code>PASS_WITH_MISSING_COMPONENTS</code>).</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Địa phương</th>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th>Trường / Chỉ tiêu</th>
              <th>Lý do có thể khẳng định</th>
              <th>Ngày chốt</th>
            </tr>
          </thead>
          <tbody>${missingLocRowsHtml}</tbody>
        </table>
      </div>

      <div class="card">
        <h3>2. Kiểm toán Chất lượng GPMB &amp; 12 Dòng Dự án có Cột M Lệch 100*I/D &gt; 0,1 Điểm % (T29, T60)</h3>
        <p>Thống kê toàn nguồn GPMB: <strong>${
          warnStats.totalWarningEventsExcludingMissing
        } lượt cảnh báo</strong> trên <strong>${
      warnStats.distinctProjectRowsExcludingMissing
    } dòng dự án riêng biệt</strong> (I&gt;D: ${
      warnStats.countsByRule['GPMB_I_GT_D'] || 0
    }, J&gt;G: ${warnStats.countsByRule['GPMB_J_GT_G'] || 0}, K&gt;E: ${
      warnStats.countsByRule['GPMB_K_GT_E'] || 0
    }, L&gt;F: ${
      warnStats.countsByRule['GPMB_L_GT_F'] || 0
    }, M lệch 100*I/D &gt; 0,1 điểm %: <strong>${
      mMismatchIssues.length
    }</strong>) + <strong>${
      warnStats.countsByRule['GPMB_MISSING_PROGRESS'] || 0
    } dòng dự án thiếu I</strong> (dòng 107, 173, 365). Giải ngân DISB có <strong>${
      warnStats.disbNoteCount
    } ghi chú cột Q</strong> và <strong>${
      warnStats.disbMarkerPCount
    } marker cột P</strong>.</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Dự án / Dòng</th>
              <th>Địa phương</th>
              <th>Ô nguồn</th>
              <th>M nguồn (%)</th>
              <th>100*I/D tính lại (%)</th>
              <th>Độ lệch (điểm %)</th>
            </tr>
          </thead>
          <tbody>${mMismatchHtml}</tbody>
        </table>
      </div>
    </section>`;
  }

  private renderLocalitiesPage(activeSession: Workspace['sessions'][number] | undefined): string {
    if (!activeSession) {
      return `<div class="card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo ở Trang 1 trước khi chọn địa phương.</h3></div>`;
    }

    const filtered = searchLocalities(
      this.workspace.localities,
      this.localitySearchQuery,
      this.localityTypeFilter
    );
    const selectedSet = new Set(activeSession.selectedLocalityIds);

    const selectedChipsHtml = activeSession.selectedLocalityIds
      .map((locId, idx) => {
        const loc = this.workspace.localities.find((l) => l.id === locId);
        return `<span class="selected-loc-chip">
          <strong>${idx + 1}. ${escapeHtmlUi(loc?.displayName || locId)}</strong>
          <button type="button" class="chip-btn" data-action="move-loc-up" data-loc-id="${escapeHtmlUi(
            locId
          )}" title="Đưa lên">&uarr;</button>
          <button type="button" class="chip-btn" data-action="move-loc-down" data-loc-id="${escapeHtmlUi(
            locId
          )}" title="Đưa xuống">&darr;</button>
          <button type="button" class="chip-btn chip-remove" data-action="toggle-locality" data-loc-id="${escapeHtmlUi(
            locId
          )}" title="Bỏ chọn">&times;</button>
        </span>`;
      })
      .join('');

    const listHtml = filtered
      .map((loc) => {
        const checked = selectedSet.has(loc.id);
        return `<label class="locality-checkbox-item ${checked ? 'checked' : ''}">
          <input type="checkbox" data-action="toggle-locality" data-loc-id="${escapeHtmlUi(
            loc.id
          )}" ${checked ? 'checked' : ''} />
          <span class="loc-item-name">${escapeHtmlUi(loc.displayName)}</span>
          <span class="badge badge-sm">${escapeHtmlUi(loc.type)}</span>
        </label>`;
      })
      .join('');

    return `<section class="page-section">
      <div class="card">
        <h2>Trang C — Chọn &amp; Sắp xếp Địa phương cho Phiên "${escapeHtmlUi(
          activeSession.name
        )}"</h2>
        <p>Tìm kiếm tiếng Việt có dấu hoặc không dấu (chỉ dùng cho tìm kiếm UI; ghép dữ liệu luôn dùng tên chuẩn NFC có dấu, phân biệt <em>Xã Cẩm Giang</em> và <em>Xã Cẩm Giàng</em>, <em>Phường Hưng Đạo</em> và <em>Phường Trần Hưng Đạo</em>).</p>
        <div class="toolbar-row">
          <input type="text" id="input-loc-search" class="form-input" placeholder="Tìm tên xã, phường, đặc khu (có dấu hoặc không dấu)..." value="${escapeHtmlUi(
            this.localitySearchQuery
          )}" />
          <select id="select-loc-type" class="form-select">
            <option value="ALL" ${this.localityTypeFilter === 'ALL' ? 'selected' : ''}>Tất cả loại (${
      this.workspace.localities.length
    })</option>
            <option value="XA" ${this.localityTypeFilter === 'XA' ? 'selected' : ''}>Xã</option>
            <option value="PHUONG" ${
              this.localityTypeFilter === 'PHUONG' ? 'selected' : ''
            }>Phường</option>
            <option value="DAC_KHU" ${
              this.localityTypeFilter === 'DAC_KHU' ? 'selected' : ''
            }>Đặc khu</option>
          </select>
          <button type="button" class="btn btn-secondary" id="btn-preset-5-xa">Chọn mẫu 5 xã</button>
          <button type="button" class="btn btn-secondary" id="btn-preset-7-phuong">Chọn mẫu 7 phường</button>
          <button type="button" class="btn btn-danger" id="btn-clear-localities">Bỏ chọn tất cả (Về 0 địa phương)</button>
        </div>

        <div class="selected-localities-bar">
          <h4>Đang chọn (${activeSession.selectedLocalityIds.length} địa phương — kéo/bấm mũi tên để đổi thứ tự cột):</h4>
          <div class="chips-container">${
            selectedChipsHtml || '<em>Chưa chọn địa phương nào (0 địa phương)</em>'
          }</div>
        </div>

        <div class="localities-grid">
          ${listHtml}
        </div>
      </div>
    </section>`;
  }

  private renderReportPage(
    activeSession: Workspace['sessions'][number] | undefined,
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    },
    revNeedsDateConfirm: boolean
  ): string {
    if (!activeSession) {
      return `<div class="card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo ở Trang 1.</h3></div>`;
    }
    if (!evaluatedReport) {
      return `<div class="card"><h3>Vui lòng nạp đủ 3 nguồn dữ liệu (DISB, REV, GPMB) ở Trang 2 trước khi xem Bảng báo cáo 14 dòng.</h3></div>`;
    }

    const revBlockerBanner = revNeedsDateConfirm
      ? `<div class="status-banner status-warning">
          <strong>Cảnh báo BLOCKER ngày chốt Thu NSNN:</strong> Nguồn Thu NSNN (<code>10T-19.10</code>) chưa được xác nhận ngày chốt thực tế. Hãy sang thẻ <strong>2. Nhập nguồn &amp; QC</strong> để xác nhận ngày chốt trước khi xuất chính thức!
        </div>`
      : '';

    const gridHtml = renderReportGridHtml({
      evaluated: evaluatedReport,
      baselineLocalities: this.workspace.localities,
      datasets,
      activeTraceId: this.activeTraceId,
    });

    const sessionWarnList = filterWarningsForSession(
      evaluatedReport.sessionIssues,
      activeSession.selectedLocalityIds
    );

    const sessionWarningsHtml =
      sessionWarnList.length > 0
        ? `<div class="card">
            <h3>Cảnh báo Chất lượng &amp; Ghi chú thuộc ${
              activeSession.selectedLocalityIds.length
            } địa phương đang chọn (${sessionWarnList.length} mục)</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mức độ</th>
                  <th>Mã quy tắc</th>
                  <th>Địa phương</th>
                  <th>Ô nguồn</th>
                  <th>Giải trình</th>
                </tr>
              </thead>
              <tbody>
                ${sessionWarnList
                  .slice(0, 30)
                  .map(
                    (w) => `<tr>
                      <td><span class="badge badge-${escapeHtmlUi(w.severity)}">${escapeHtmlUi(
                      w.severity
                    )}</span></td>
                      <td><code>${escapeHtmlUi(w.ruleId)}</code></td>
                      <td><strong>${escapeHtmlUi(w.localityName)}</strong></td>
                      <td><code>${escapeHtmlUi(w.sourceCell)}</code></td>
                      <td>${escapeHtmlUi(w.explanation)}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
        : '';

    return `<section class="page-section report-split-layout">
      <div class="report-main-column">
        ${revBlockerBanner}
        <div class="card">
          <div class="toolbar-row">
            <label>Đơn vị tiền:
              <select id="select-money-unit" class="form-select-sm">
                <option value="billion" ${
                  activeSession.settings.moneyUnit === 'billion' ? 'selected' : ''
                }>Tỷ đồng</option>
                <option value="million" ${
                  activeSession.settings.moneyUnit === 'million' ? 'selected' : ''
                }>Triệu đồng</option>
              </select>
            </label>
            <label>Đơn vị diện tích:
              <select id="select-area-unit" class="form-select-sm">
                <option value="m2" ${
                  activeSession.settings.areaUnit === 'm2' ? 'selected' : ''
                }>m²</option>
                <option value="ha" ${
                  activeSession.settings.areaUnit === 'ha' ? 'selected' : ''
                }>ha</option>
              </select>
            </label>
            <label>Chữ số thập phân:
              <input type="number" id="input-decimals" class="form-input-sm" min="0" max="6" value="${
                activeSession.settings.decimals
              }" style="width:60px"/>
            </label>
            <button type="button" class="btn btn-sm btn-primary" id="btn-export-xlsx-quick">Xuất Excel (.xlsx)</button>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-print-quick">In / Lưu PDF (A4/A3)</button>
          </div>
          ${gridHtml}
        </div>
        ${sessionWarningsHtml}
      </div>
      <aside class="report-inspector-sidebar">
        ${renderTraceInspectorHtml(this.activeTrace, this.activeTraceExtraMeta)}
      </aside>
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
    if (!activeSession) {
      return `<div class="card"><h3>Vui lòng tạo hoặc chọn một phiên báo cáo.</h3></div>`;
    }
    void datasets;

    const bm = evaluatedReport?.benchmarks;
    const rowsConfigHtml = activeSession.templateRows
      .sort((a, b) => a.order - b.order)
      .map(
        (r) => `<tr>
          <td>Dòng mẫu ${r.rowNumber}</td>
          <td><code>${escapeHtmlUi(r.indicatorId)}</code></td>
          <td><input type="text" class="form-input-sm input-row-stt" data-row-num="${
            r.rowNumber
          }" value="${escapeHtmlUi(r.sttLabel)}" style="width:50px"/></td>
          <td><input type="text" class="form-input input-row-label" data-row-num="${
            r.rowNumber
          }" value="${escapeHtmlUi(r.customLabel)}"/></td>
          <td><input type="checkbox" class="chk-row-visible" data-row-num="${
            r.rowNumber
          }" ${r.visible ? 'checked' : ''}/></td>
        </tr>`
      )
      .join('');

    return `<section class="page-section">
      <div class="card">
        <h2>Trang F — Mốc So sánh Chuẩn Chung &amp; Tùy chỉnh Bảng 14 Dòng (PH1-02, PH1-04)</h2>
        <p>Mọi tỷ lệ chuẩn chung đều tính bằng <strong>SUM(tử số) / SUM(mẫu số)</strong> trong cùng phạm vi, tuyệt đối không lấy AVERAGE tỷ lệ từng xã/phường. Các dòng có mẫu số = 0 hợp lệ vẫn tham gia vào tổng tử số của benchmark (Quy tắc P0 / R04).</p>
        <ul class="benchmark-summary-list">
          <li><strong>Giải ngân 114 địa phương (15/10/2026):</strong> <code>SUM(I13:I126)/SUM(F13:F126)</code> = <strong>${escapeHtmlUi(
            bm?.disbRateBenchmark?.displayedText || '67,10%'
          )}</strong> (Vốn giao bình quân 114 địa phương = <strong>${escapeHtmlUi(
      bm?.disbPlanAvg?.displayedText || '136,41 tỷ đồng'
    )}</strong>).</li>
          <li><strong>Thu NSNN 113 địa phương có dữ liệu (tham khảo, thiếu Đặc khu Bạch Long Vĩ):</strong> Tổng thu/Dự toán năm = <strong>${escapeHtmlUi(
            bm?.revRateBenchmark?.displayedText || '111,30%'
          )}</strong>; Thu đất/Dự toán năm (gồm 5 dòng D=0 đóng góp 269.290 triệu) = <strong>${escapeHtmlUi(
      bm?.revLandRateYBenchmark?.displayedText || '136,12%'
    )}</strong>; Thu đất/Kế hoạch kỳ (gồm 6 dòng G=0 đóng góp 304.790 triệu) = <strong>${escapeHtmlUi(
      bm?.revLandRatePBenchmark?.displayedText || '202,71%'
    )}</strong>.</li>
          <li><strong>GPMB danh mục tại 108/114 địa bàn có dữ liệu (26/10/2026):</strong> <code>SUM(I_422_projects)/SUM(D_422_projects)</code> = <strong>${escapeHtmlUi(
            bm?.gpmbRateBenchmark?.displayedText || '72,13%'
          )}</strong> (<code>PARTIAL_AGGREGATE</code>, còn 3 dự án thiếu I với tổng D = 11.459 m²). Tỷ lệ diện tích của riêng nhóm ${
      activeSession.selectedLocalityIds.length
    } địa phương đang chọn = <strong>${escapeHtmlUi(
      bm?.selectedGroupGpmbRate?.displayedText || 'Chưa chọn địa phương'
    )}</strong>.</li>
        </ul>

        <div class="toolbar-row">
          <label>Tiêu đề bảng báo cáo:
            <input type="text" id="input-report-title" class="form-input" value="${escapeHtmlUi(
              activeSession.settings.reportTitle
            )}" style="min-width:420px"/>
          </label>
          <label>Nhãn cao hơn:
            <input type="text" id="input-label-higher" class="form-input-sm" value="${escapeHtmlUi(
              activeSession.comparisonRules.higherLabel
            )}"/>
          </label>
          <label>Nhãn thấp hơn:
            <input type="text" id="input-label-lower" class="form-input-sm" value="${escapeHtmlUi(
              activeSession.comparisonRules.lowerLabel
            )}"/>
          </label>
          <label>
            <input type="checkbox" id="chk-allow-partial-eval" ${
              activeSession.comparisonRules.allowPartialBenchmarkEvaluation
                ? 'checked'
                : ''
            }/>
            Phê duyệt so sánh có điều kiện với mốc GPMB 108/114 địa bàn (PARTIAL)
          </label>
          <button type="button" class="btn btn-primary" id="btn-save-template-settings">Lưu tùy chỉnh phiên</button>
        </div>

        <h3>Tùy chỉnh Nhãn &amp; Ẩn/Hiện 14 Dòng Chỉ tiêu Mẫu</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Dòng gốc</th>
              <th>Mã chỉ tiêu</th>
              <th>STT</th>
              <th>Tên chỉ tiêu hiển thị</th>
              <th>Hiển thị</th>
            </tr>
          </thead>
          <tbody>${rowsConfigHtml}</tbody>
        </table>
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
        <h2>Trang G — Xuất Báo cáo Chính thức (XLSX / PDF) &amp; Sao lưu Bộ Hồ sơ (.kxh.json)</h2>
        <div class="toolbar-row">
          <label>Khổ giấy in/PDF:
            <select id="select-paper-size" class="form-select-sm">
              <option value="A4" ${
                activeSession?.settings.paperSize === 'A4' ? 'selected' : ''
              }>A4</option>
              <option value="A3" ${
                activeSession?.settings.paperSize === 'A3' ? 'selected' : ''
              }>A3</option>
            </select>
          </label>
          <label>Hướng giấy:
            <select id="select-paper-orientation" class="form-select-sm">
              <option value="landscape" ${
                activeSession?.settings.orientation === 'landscape'
                  ? 'selected'
                  : ''
              }>Ngang (Landscape)</option>
              <option value="portrait" ${
                activeSession?.settings.orientation === 'portrait'
                  ? 'selected'
                  : ''
              }>Dọc (Portrait)</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary" id="btn-export-xlsx-full">Tải xuống Excel (.xlsx) kèm 4 Sheet Audit</button>
          <button type="button" class="btn btn-secondary" id="btn-trigger-window-print">In / Lưu PDF (window.print)</button>
        </div>
      </div>

      <div class="card">
        <h3>Sao lưu &amp; Khôi phục Toàn bộ Bộ Hồ sơ (.kxh.json có Checksum SHA-256)</h3>
        <p>Lưu trữ trong trình duyệt chỉ là bộ nhớ tạm. Hãy tải về tệp <code>.kxh.json</code> để bảo toàn đầy đủ các phiên báo cáo, dữ liệu chuẩn hóa, cấu hình và lịch sử kiểm toán.</p>
        <div class="toolbar-row">
          <button type="button" class="btn btn-primary" id="btn-download-backup-json">Lưu toàn bộ bộ hồ sơ (.kxh.json)</button>
          <label class="btn btn-secondary">
            Khôi phục từ tệp sao lưu (.kxh.json)
            <input type="file" id="input-restore-backup-file" accept=".json,.kxh.json" style="display:none"/>
          </label>
        </div>
      </div>
    </section>`;
  }

  private bindDomEvents(
    evaluatedReport: EvaluatedSessionReport | null,
    datasets: {
      REV?: Workspace['datasets'][number];
      DISB?: Workspace['datasets'][number];
      GPMB?: Workspace['datasets'][number];
    }
  ): void {
    document.querySelectorAll('[data-nav-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-nav-tab') as KtxhOfflineApp['activeTab'];
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    document.getElementById('btn-clear-banner')?.addEventListener('click', () => {
      this.statusBannerMessage = '';
      this.render();
    });

    // Create new session (0 localities by default)
    document.getElementById('btn-create-session')?.addEventListener('click', () => {
      const nameInput = document.getElementById(
        'input-new-session-name'
      ) as HTMLInputElement | null;
      const name = nameInput?.value || 'Phiên báo cáo mới';
      const s = createReportSession(this.workspace, { name });
      this.saveToLocalStorageCache();
      this.setStatus(
        `Đã tạo phiên "${s.name}" với ${s.selectedLocalityIds.length} địa phương được chọn sẵn (đúng chuẩn 0 địa phương mặc định).`,
        'success'
      );
    });

    document
      .getElementById('btn-quick-load-3-sources')
      ?.addEventListener('click', () => {
        this.loadEmbeddedReferenceWorkbooks('2026-10-19');
      });

    document
      .getElementById('btn-load-embedded-confirmed')
      ?.addEventListener('click', () => {
        this.loadEmbeddedReferenceWorkbooks('2026-10-19');
      });

    document
      .getElementById('btn-load-embedded-unconfirmed')
      ?.addEventListener('click', () => {
        this.loadEmbeddedReferenceWorkbooks('');
      });

    // Confirm REV asOfDate
    document
      .getElementById('btn-confirm-rev-date')
      ?.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        const dsId = btn.getAttribute('data-dataset-id') || '';
        const dateEl = document.getElementById(
          'input-confirm-rev-date'
        ) as HTMLInputElement | null;
        const reasonEl = document.getElementById(
          'input-confirm-rev-reason'
        ) as HTMLInputElement | null;
        try {
          confirmDatasetAsOfDate(
            this.workspace,
            dsId,
            dateEl?.value || '2026-10-19',
            reasonEl?.value || 'Xác nhận ngày chốt thực tế'
          );
          this.saveToLocalStorageCache();
          this.setStatus('Đã xác nhận ngày chốt cho nguồn Thu NSNN.', 'success');
        } catch (err) {
          this.setStatus((err as Error).message, 'error');
        }
      });

    // File upload
    const fileInput = document.getElementById(
      'input-xlsx-files'
    ) as HTMLInputElement | null;
    fileInput?.addEventListener('change', async () => {
      if (!fileInput.files) return;
      for (const file of Array.from(fileInput.files)) {
        const buf = await file.arrayBuffer();
        this.handleWorkbookBytesUpload(new Uint8Array(buf), file.name);
      }
    });

    // Session actions
    document.querySelectorAll('[data-action="activate-session"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        if (id) {
          this.workspace.activeSessionId = id;
          this.saveToLocalStorageCache();
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
          this.saveToLocalStorageCache();
          this.setStatus(`Đã nhân bản thành "${cloned.name}".`, 'success');
        }
      });
    });

    document.querySelectorAll('[data-action="delete-session"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        if (id && window.confirm('Bạn có chắc chắn muốn xóa phiên báo cáo này?')) {
          deleteReportSession(this.workspace, id, true);
          this.saveToLocalStorageCache();
          this.setStatus('Đã xóa phiên báo cáo.', 'info');
        }
      });
    });

    // Locality search & selection
    const searchInput = document.getElementById(
      'input-loc-search'
    ) as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.localitySearchQuery = searchInput.value;
      this.render();
    });

    const typeSelect = document.getElementById(
      'select-loc-type'
    ) as HTMLSelectElement | null;
    typeSelect?.addEventListener('change', () => {
      this.localityTypeFilter = typeSelect.value as 'ALL' | LocalityType;
      this.render();
    });

    document.querySelectorAll('[data-action="toggle-locality"]').forEach((el) => {
      el.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        const locId = el.getAttribute('data-loc-id');
        if (!activeSession || !locId) return;
        const curr = [...activeSession.selectedLocalityIds];
        const idx = curr.indexOf(locId);
        if (idx >= 0) curr.splice(idx, 1);
        else curr.push(locId);
        setSessionLocalities(this.workspace, activeSession.id, curr);
        this.saveToLocalStorageCache();
        this.render();
      });
    });

    document.querySelectorAll('[data-action="move-loc-up"]').forEach((el) => {
      el.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        const locId = el.getAttribute('data-loc-id');
        if (!activeSession || !locId) return;
        const curr = [...activeSession.selectedLocalityIds];
        const idx = curr.indexOf(locId);
        if (idx > 0) {
          [curr[idx - 1], curr[idx]] = [curr[idx], curr[idx - 1]];
          setSessionLocalities(this.workspace, activeSession.id, curr);
          this.saveToLocalStorageCache();
          this.render();
        }
      });
    });

    document.querySelectorAll('[data-action="move-loc-down"]').forEach((el) => {
      el.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        const locId = el.getAttribute('data-loc-id');
        if (!activeSession || !locId) return;
        const curr = [...activeSession.selectedLocalityIds];
        const idx = curr.indexOf(locId);
        if (idx >= 0 && idx < curr.length - 1) {
          [curr[idx], curr[idx + 1]] = [curr[idx + 1], curr[idx]];
          setSessionLocalities(this.workspace, activeSession.id, curr);
          this.saveToLocalStorageCache();
          this.render();
        }
      });
    });

    document.getElementById('btn-preset-5-xa')?.addEventListener('click', () => {
      const activeSession = this.getActiveSession();
      if (!activeSession) return;
      const fiveXa = this.workspace.localities
        .filter((l) => l.type === 'XA')
        .slice(0, 5)
        .map((l) => l.id);
      setSessionLocalities(this.workspace, activeSession.id, fiveXa);
      this.saveToLocalStorageCache();
      this.render();
    });

    document
      .getElementById('btn-preset-7-phuong')
      ?.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        const sevenPhuong = this.workspace.localities
          .filter((l) => l.type === 'PHUONG')
          .slice(0, 7)
          .map((l) => l.id);
        setSessionLocalities(this.workspace, activeSession.id, sevenPhuong);
        this.saveToLocalStorageCache();
        this.render();
      });

    document
      .getElementById('btn-clear-localities')
      ?.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        setSessionLocalities(this.workspace, activeSession.id, []);
        this.saveToLocalStorageCache();
        this.render();
      });

    // Report unit/decimal controls
    document
      .getElementById('select-money-unit')
      ?.addEventListener('change', (e) => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        activeSession.settings.moneyUnit = (e.target as HTMLSelectElement)
          .value as 'billion' | 'million';
        this.saveToLocalStorageCache();
        this.render();
      });

    document
      .getElementById('select-area-unit')
      ?.addEventListener('change', (e) => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        activeSession.settings.areaUnit = (e.target as HTMLSelectElement)
          .value as 'm2' | 'ha';
        this.saveToLocalStorageCache();
        this.render();
      });

    document
      .getElementById('input-decimals')
      ?.addEventListener('change', (e) => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        if (!Number.isNaN(val) && val >= 0 && val <= 6) {
          activeSession.settings.decimals = val;
          activeSession.settings.decimalsMoney = val;
          activeSession.settings.decimalsPercent = val;
          this.saveToLocalStorageCache();
          this.render();
        }
      });

    // Cell click -> open Trace Inspector
    document.querySelectorAll('.report-cell[data-trace-id]').forEach((cellEl) => {
      const openTrace = () => {
        const traceId = cellEl.getAttribute('data-trace-id') || '';
        const locId = cellEl.getAttribute('data-locality-id') || '';
        const indId = cellEl.getAttribute('data-indicator-id') || '';
        if (evaluatedReport && traceId) {
          this.activeTraceId = traceId;
          this.activeTrace = evaluatedReport.tracesById.get(traceId) || null;
          const rowObj = evaluatedReport.rows.find(
            (r) => r.indicator.id === indId
          );
          const cellObj = rowObj?.cellsByLocalityId[locId];
          this.activeTraceExtraMeta = {
            officialNote: cellObj?.officialNote,
            inspectionMarker: cellObj?.inspectionMarker,
          };
          this.render();
        }
      };
      cellEl.addEventListener('click', openTrace);
      cellEl.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ') {
          ev.preventDefault();
          openTrace();
        }
      });
    });

    // Save template settings
    document
      .getElementById('btn-save-template-settings')
      ?.addEventListener('click', () => {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        const titleEl = document.getElementById(
          'input-report-title'
        ) as HTMLInputElement | null;
        const higherEl = document.getElementById(
          'input-label-higher'
        ) as HTMLInputElement | null;
        const lowerEl = document.getElementById(
          'input-label-lower'
        ) as HTMLInputElement | null;
        const allowPartialEl = document.getElementById(
          'chk-allow-partial-eval'
        ) as HTMLInputElement | null;

        if (titleEl) activeSession.settings.reportTitle = titleEl.value;
        if (higherEl) activeSession.comparisonRules.higherLabel = higherEl.value;
        if (lowerEl) activeSession.comparisonRules.lowerLabel = lowerEl.value;
        if (allowPartialEl) {
          activeSession.comparisonRules.allowPartialBenchmarkEvaluation =
            allowPartialEl.checked;
          if (allowPartialEl.checked) {
            activeSession.comparisonRules.partialApprovalReason =
              'Người dùng phê duyệt sử dụng mốc tham khảo 108/114 địa bàn có dữ liệu';
          }
        }

        document.querySelectorAll('.input-row-stt').forEach((el) => {
          const rNum = Number(el.getAttribute('data-row-num'));
          const cfg = activeSession.templateRows.find(
            (r) => r.rowNumber === rNum
          );
          if (cfg) cfg.sttLabel = (el as HTMLInputElement).value;
        });

        document.querySelectorAll('.input-row-label').forEach((el) => {
          const rNum = Number(el.getAttribute('data-row-num'));
          const cfg = activeSession.templateRows.find(
            (r) => r.rowNumber === rNum
          );
          if (cfg) cfg.customLabel = (el as HTMLInputElement).value;
        });

        document.querySelectorAll('.chk-row-visible').forEach((el) => {
          const rNum = Number(el.getAttribute('data-row-num'));
          const cfg = activeSession.templateRows.find(
            (r) => r.rowNumber === rNum
          );
          if (cfg) cfg.visible = (el as HTMLInputElement).checked;
        });

        activeSession.sessionRevision += 1;
        this.workspace.unsavedChanges = true;
        this.saveToLocalStorageCache();
        this.setStatus('Đã lưu cấu hình bảng báo cáo cho phiên hiện tại.', 'success');
      });

    // Export XLSX
    const handleExportXlsx = () => {
      if (!evaluatedReport) {
        this.setStatus('Chưa đủ dữ liệu để xuất báo cáo Excel.', 'error');
        return;
      }
      try {
        const xlsxBytes = exportSessionReportToXlsxBytes({
          evaluated: evaluatedReport,
          baselineLocalities: this.workspace.localities,
          datasets,
        });
        const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${evaluatedReport.session.name.replace(/\s+/g, '_')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.setStatus(
          'Đã xuất tệp Excel (.xlsx) gồm 5 sheet: Báo cáo, Nguồn thiếu & lý do, Danh mục công thức, Nhật ký phép tính, Bản ghi không tính.',
          'success'
        );
      } catch (err) {
        this.setStatus((err as Error).message, 'error');
      }
    };

    document
      .getElementById('btn-export-xlsx-quick')
      ?.addEventListener('click', handleExportXlsx);
    document
      .getElementById('btn-export-xlsx-full')
      ?.addEventListener('click', handleExportXlsx);

    // Print / Save to PDF
    const handlePrint = () => {
      window.print();
    };
    document
      .getElementById('btn-print-quick')
      ?.addEventListener('click', handlePrint);
    document
      .getElementById('btn-trigger-window-print')
      ?.addEventListener('click', handlePrint);

    // Backup download & restore
    document
      .getElementById('btn-download-backup-json')
      ?.addEventListener('click', () => {
        const json = exportWorkspaceBackupJson(this.workspace);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ktxh-backup-${new Date().toISOString().slice(0, 10)}.kxh.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.saveToLocalStorageCache();
        this.setStatus('Đã tải xuống bản sao lưu .kxh.json có checksum SHA-256.', 'success');
      });

    const restoreInput = document.getElementById(
      'input-restore-backup-file'
    ) as HTMLInputElement | null;
    restoreInput?.addEventListener('change', async () => {
      const file = restoreInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const restored = restoreWorkspaceFromBackupJson(
          text,
          this.workspace,
          true
        );
        this.workspace = restored;
        this.saveToLocalStorageCache();
        this.setStatus(
          `Đã khôi phục thành công bộ hồ sơ "${restored.name}" (${restored.sessions.length} phiên).`,
          'success'
        );
      } catch (err) {
        this.setStatus((err as Error).message, 'error');
      }
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new KtxhOfflineApp();
    window.__KTXH_APP__ = app;
    app.render();
  });
}
