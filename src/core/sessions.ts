import {
  BenchmarkConfig,
  ComparisonRuleConfig,
  Dataset,
  Locality,
  ReportSession,
  TemplateRowCustomConfig,
  Workspace,
} from './types';
import { createLocalityFromName } from './localities';
import { chooseLatestSources, hasTrustedSourceDate, isValidSourceDate, SOURCE_TYPES, LatestSourcePlan } from './latestSources';
import {
  formatVnDateText,
  replaceDateInLabel,
  normalizeLocalityReportLabel,
  formatBenchmarkReportLabel,
  TEMPLATE_14_ROWS_DEFAULT,
} from './indicators';

export function createEmptyWorkspace(name = 'Hồ sơ Báo cáo KTXH 2026'): Workspace {
  return {
    formatVersion: 2,
    schemaVersion: '2.2.0',
    name,
    updatedAt: new Date().toISOString(),
    unsavedChanges: false,
    localities: [],
    datasets: [],
    sessions: [],
    activeSessionId: undefined,
    auditLog: [
      {
        id: `AUDIT_${Date.now()}_INIT`,
        timestamp: new Date().toISOString(),
        action: 'WORKSPACE_CREATED',
        details: `Khởi tạo bộ hồ sơ "${name}" (MASTER SPEC V2.2)`,
      },
    ],
  };
}

export function registerDatasetInWorkspace(
  workspace: Workspace,
  dataset: Dataset,
  localitiesFromDisb?: Locality[]
): Dataset {
  // Immutable dataset registration: never overwrite existing dataset versions (T17)
  const existingIdx = workspace.datasets.findIndex((d) => d.id === dataset.id);
  if (existingIdx === -1) {
    workspace.datasets.push(dataset);
  } else {
    // Only update if confirming asOfDate on the exact same dataset hash
    const previous = workspace.datasets[existingIdx];
    // A repeat import of identical workbook content must not win a same-date tie.
    if (previous.workbookSha256 === dataset.workbookSha256 && previous.importedAt) {
      dataset.importedAt = previous.importedAt;
      const sameMapping = previous.sourceType === dataset.sourceType &&
        previous.mappingVersion === dataset.mappingVersion &&
        previous.schemaFingerprint === dataset.schemaFingerprint &&
        previous.sourceSheet === dataset.sourceSheet;
      // Reuse a confirmed dataset with identical content/mapping, especially a
      // manually dated CSV. Never erase its date merely because it is reimported.
      // A genuinely different mapping still follows the existing reparse path.
      if (sameMapping && hasTrustedSourceDate(previous) &&
          (previous.asOfStatus === 'MANUAL_CONFIRMED' ||
           !hasTrustedSourceDate(dataset) || previous.asOfDate === dataset.asOfDate)) {
        dataset = previous;
      }
    }
    workspace.datasets[existingIdx] = dataset;
  }

  if (localitiesFromDisb && localitiesFromDisb.length > 0) {
    if (workspace.localities.length === 0) {
      workspace.localities = localitiesFromDisb.map((l) => ({ ...l, aliases: [...l.aliases] }));
    } else {
      const existingIds = new Set(workspace.localities.map((l) => l.id));
      const existingNames = new Set(workspace.localities.map((l) => l.canonicalNameNFC));
      for (const loc of localitiesFromDisb) {
        if (!existingIds.has(loc.id) && !existingNames.has(loc.canonicalNameNFC)) {
          workspace.localities.push({ ...loc, aliases: [...loc.aliases] });
          existingIds.add(loc.id);
          existingNames.add(loc.canonicalNameNFC);
        }
      }
    }
  }

  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_IMPORT_${dataset.sourceType}`,
    timestamp: new Date().toISOString(),
    action: 'DATASET_REGISTERED',
    datasetId: dataset.id,
    details: `Đăng ký nguồn ${dataset.sourceType} (${dataset.sourceFilename}, sheet "${dataset.sourceSheet}", SHA=${dataset.workbookSha256.slice(0, 12)}, ngày chốt=${dataset.asOfDate || 'CHƯA XÁC NHẬN'})`,
  });

  return dataset;
}

/** Synchronize metadata/provenance after an explicit cutoff confirmation. */
function updateConfirmedPeriodMetadata(ds: Dataset): void {
  if (ds.sourceType === 'DISB' || ds.sourceType === 'GPMB' || ds.sourceType === 'REV') {
    const label = 'Đến ngày ' + formatVnDate(ds.asOfDate);
    if (!ds.periodLabel || /^(?:Chưa xác nhận|Đến|Lũy kế đến)/i.test(ds.periodLabel)) ds.periodLabel = label;
    if (!ds.reportPeriodLabel || /^(?:Chưa xác nhận|Đến|Lũy kế đến)/i.test(ds.reportPeriodLabel)) ds.reportPeriodLabel = label;
  }
  for (const rec of [...ds.records, ds.summaryRecord, ds.citySummaryRecord, ds.unplannedDisbursementRecord]) {
    if (!rec) continue;
    for (const metric of Object.values(rec.metrics)) metric.provenance.asOfDate = ds.asOfDate;
  }
}

export function confirmDatasetAsOfDate(
  workspace: Workspace,
  datasetId: string,
  confirmedDate: string,
  reason: string
): Dataset {
  const ds = workspace.datasets.find((d) => d.id === datasetId);
  if (!ds) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  if (!isValidSourceDate(confirmedDate.trim())) {
    throw new Error('Ngày chốt phải có định dạng YYYY-MM-DD hợp lệ.');
  }

  ds.asOfDate = confirmedDate.trim();
  ds.asOfStatus = 'MANUAL_CONFIRMED';
  ds.periodEnd = ds.asOfDate;
  ds.periodStart = ds.asOfDate.slice(0,4)+'-01-01';
  ds.asOfDateConfirmation = {
    confirmedByUser: true,
    confirmedAt: new Date().toISOString(),
    reason: reason.trim() || 'Người dùng xác nhận thủ công trong Wizard nhập nguồn',
  };
  // Clear blocker issue for missing asOfDate
  ds.issues = ds.issues.filter((i) => i.ruleId !== 'MISSING_CONFIRMED_AS_OF_DATE');

  updateConfirmedPeriodMetadata(ds);

  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_CONFIRM_DATE`,
    timestamp: new Date().toISOString(),
    action: 'DATASET_AS_OF_DATE_CONFIRMED',
    datasetId: ds.id,
    details: `Xác nhận ngày chốt ${ds.asOfDate} cho nguồn ${ds.sourceType} (${reason})`,
  });

  return ds;
}

export function formatVnDate(dateStr: string | undefined): string {
  return formatVnDateText(dateStr);
}

export function formatIsoDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mon = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mon}-${d}`;
  }
  return clean;
}

export function syncReportLabelsWithDatasetDates(workspace: Workspace): void {
  for (const session of workspace.sessions) {
    const datasets = resolveSessionDatasets(workspace, session);
    const dateByIndicator: Record<string, string> = {
      DISB_BENCHMARK_RATE: formatVnDate(datasets.DISB?.asOfDate),
      REV_RATE_Y: formatVnDate(datasets.REV?.asOfDate),
      GPMB_BENCHMARK_AREA_RATE: formatVnDate(datasets.GPMB?.asOfDate),
    };

    const expectedCount = getSessionLocalitiesBaseline(workspace, session, datasets).length || 114;
    for (const r of session.templateRows) {
      r.customLabel = normalizeLocalityReportLabel(r.indicatorId, r.customLabel);
      const dateVn = dateByIndicator[r.indicatorId];
      if (dateVn) r.customLabel = replaceDateInLabel(r.customLabel, dateVn);
      if (r.indicatorId === 'DISB_BENCHMARK_RATE' || r.indicatorId === 'GPMB_BENCHMARK_AREA_RATE') {
        const ds = r.indicatorId === 'DISB_BENCHMARK_RATE' ? datasets.DISB : datasets.GPMB;
        r.customLabel = formatBenchmarkReportLabel({
          indicatorId: r.indicatorId, customLabel: r.customLabel,
          unitCount: ds?.unitCount, expectedCount, asOfDate: ds?.asOfDate,
        });
      }
    }
    if (session.settings.revBenchmarkRowCustomLabel) {
      session.settings.revBenchmarkRowCustomLabel = formatBenchmarkReportLabel({
        indicatorId: 'REV_BENCHMARK_RATE',
        customLabel: session.settings.revBenchmarkRowCustomLabel,
        unitCount: datasets.REV?.unitCount, expectedCount, asOfDate: datasets.REV?.asOfDate,
      });
    }
  }
}

export function sanitizeWorkspace(workspace: Workspace): void {
  if (!Array.isArray(workspace.localities)) workspace.localities = [];
  if (!Array.isArray(workspace.auditLog)) workspace.auditLog = [];
  if (!Array.isArray(workspace.datasets)) {
    workspace.datasets = [];
  } else {
    workspace.datasets = workspace.datasets.filter(
      (d) => Boolean(d && typeof d.id === 'string' && Array.isArray(d.records))
    );
    for (const d of workspace.datasets) {
      if (!Array.isArray(d.issues)) d.issues = [];
      if (!Array.isArray(d.allSheetsMeta)) d.allSheetsMeta = [];
    }
  }
  if (!Array.isArray(workspace.sessions)) {
    workspace.sessions = [];
  } else {
    workspace.sessions = workspace.sessions.filter(Boolean);
    for (const s of workspace.sessions) {
      if (!Array.isArray(s.selectedLocalityIds)) s.selectedLocalityIds = [];
      if (!Array.isArray(s.templateRows) || s.templateRows.length === 0) {
        s.templateRows = TEMPLATE_14_ROWS_DEFAULT.map((r) => ({ ...r }));
      }
      if (!Array.isArray(s.indicatorIds)) {
        s.indicatorIds = s.templateRows.map((r) => r.indicatorId);
      }
      if (!s.dataBindings) s.dataBindings = {};
      if (!s.benchmarkBindings) s.benchmarkBindings = {};
      if (!Array.isArray(s.overrides)) s.overrides = [];
      const rawRules = (s.comparisonRules || {}) as Partial<ComparisonRuleConfig>;
      s.comparisonRules = {
        higherThresholdPp: 0,
        lowerThresholdPp: 0,
        higherLabel: 'cao hơn',
        lowerLabel: 'thấp hơn',
        equalLabel: 'tương đương',
        insufficientBasisLabel: 'Chưa đủ cơ sở đánh giá',
        allowPartialBenchmarkEvaluation: false,
        ...rawRules,
      };
      const rawSettings = (s.settings || {}) as Partial<ReportSession['settings']>;
      s.settings = {
        reportTitle: 'TÌNH HÌNH THỰC HIỆN MỘT SỐ CHỈ TIÊU KINH TẾ - XÃ HỘI CỦA CÁC ĐỊA PHƯƠNG',
        decimalsMoney: 2,
        decimalsPercent: 2,
        decimalsArea: 0,
        decimals: 2,
        areaUnit: 'm2',
        moneyUnit: 'billion',
        gpmbDefaultMethod: 'AREA_WEIGHTED',
        paperSize: 'A4',
        orientation: 'landscape',
        fontFamily: 'Times New Roman',
        fontSizePx: 13,
        columnWidthPx: 130,
        showBenchmarkRows: true,
        showCommentRows: true,
        showScopeFootnotes: true,
        ...rawSettings,
      };
    }
  }
}

export function migrateLegacySessionLabels(workspace: Workspace): void {
  const legacyToNewMap: Record<string, string> = {
    'Dự toán thu NSNN năm': 'Dự toán thu NSNN giao từng địa phương tại QĐ 5055',
    'Tỷ lệ thu NSNN so với dự toán':
      'Tỷ lệ thu NSNN của từng địa phương so với dự toán (đến ngày 19/10/2026)',
    'Kế hoạch vốn đầu tư công sau điều chỉnh':
      'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung',
    'Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND':
      'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung',
    'Tỷ lệ giải ngân chung của 114 địa phương':
      'Tỷ lệ giải ngân trung bình của 114 địa phương (đến ngày 15/10/2026)',
    'Tỷ lệ giải ngân của địa phương': 'Tỷ lệ giải ngân của từng địa phương',
    'Nhận xét tỷ lệ giải ngân':
      'Kết quả giải ngân so với tỷ lệ trung bình',
    'Kinh phí phân bổ GPMB': 'Kinh phí phân bổ GPMB cho từng địa phương',
    'Diện tích phải GPMB': 'Diện tích phải GPMB của từng địa phương',
    'Tỷ lệ GPMB của danh mục địa bàn có dữ liệu (108/114 địa bàn)':
      'Tỷ lệ GPMB trung bình của 114 địa phương (đến ngày 26/10/2026)',
    'Tỷ lệ GPMB địa phương theo diện tích':
      'Tỷ lệ GPMB của từng địa phương',
    'Đánh giá GPMB':
      'Kết quả GPMB so với tỷ lệ trung bình',
  };

  for (const s of workspace.sessions) {
    if (!s || !s.settings) continue;
    if (!Array.isArray(s.templateRows)) continue;
    for (const r of s.templateRows) {
      if (
        r.indicatorId === 'REV_RATE_Y' &&
        r.customLabel &&
        /^Tỷ lệ thu NSNN so với dự toán\b/i.test(r.customLabel.trim())
      ) {
        const rest = r.customLabel
          .trim()
          .replace(/^Tỷ lệ thu NSNN so với dự toán/i, '')
          .trim();
        r.customLabel = rest
          ? `Tỷ lệ thu NSNN của từng địa phương so với dự toán ${rest}`
          : 'Tỷ lệ thu NSNN của từng địa phương so với dự toán (đến ngày 19/10/2026)';
      } else if (r.customLabel && legacyToNewMap[r.customLabel]) {
        r.customLabel = legacyToNewMap[r.customLabel];
      }
      if (
        r.indicatorId === 'DISB_PLAN' &&
        (r.customLabel === 'Kế hoạch vốn đầu tư công sau điều chỉnh' ||
          r.customLabel === 'Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND' ||
          !r.customLabel)
      ) {
        r.customLabel = 'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung';
      }
    }
    if (
      s.settings.subtitle === '(Số liệu tính toán tự động từ nguồn DISB, REV và GPMB theo MASTER V2.2)' ||
      !s.settings.subtitle
    ) {
      s.settings.subtitle = '(Số liệu tổng hợp phục vụ công tác chỉ đạo, điều hành)';
    }
    if (s.settings.showSubtitle === undefined) {
      s.settings.showSubtitle = true;
    }
  }
  syncReportLabelsWithDatasetDates(workspace);
}

export function createReportSession(
  workspace: Workspace,
  params: {
    name: string;
    description?: string;
    dataBindings?: { REV?: string; DISB?: string; GPMB?: string };
    inheritEmptySources?: boolean;
    exactBindings?: boolean;
  }
): ReportSession {
  const latestRev = [...workspace.datasets].reverse().find((d) => d.sourceType === 'REV');
  const latestDisb = [...workspace.datasets].reverse().find((d) => d.sourceType === 'DISB');
  const latestGpmb = [...workspace.datasets].reverse().find((d) => d.sourceType === 'GPMB');

  const bindings: { REV?: string; DISB?: string; GPMB?: string } = params.inheritEmptySources
    ? {}
    : params.exactBindings
    ? {
        REV: params.dataBindings?.REV,
        DISB: params.dataBindings?.DISB,
        GPMB: params.dataBindings?.GPMB,
      }
    : {
        REV: params.dataBindings?.REV ?? latestRev?.id,
        DISB: params.dataBindings?.DISB ?? latestDisb?.id,
        GPMB: params.dataBindings?.GPMB ?? latestGpmb?.id,
      };

  const boundDisb = bindings.DISB
    ? workspace.datasets.find((d) => d.id === bindings.DISB)
    : undefined;
  const boundRev = bindings.REV
    ? workspace.datasets.find((d) => d.id === bindings.REV)
    : undefined;
  const boundGpmb = bindings.GPMB
    ? workspace.datasets.find((d) => d.id === bindings.GPMB)
    : undefined;

  const templateRows: TemplateRowCustomConfig[] = TEMPLATE_14_ROWS_DEFAULT.map((r) => ({
    ...r,
  }));

  const benchmarkBindings: Record<string, BenchmarkConfig> = {};
  if (bindings.DISB && boundDisb) {
    benchmarkBindings['DISB_BENCHMARK_RATE'] = {
      scope: 'LOCALITIES_FULL_114',
      numeratorField: 'disbursed_total',
      denominatorField: 'adjusted_total_plan',
      coverageActual: boundDisb.unitCount || 114,
      coverageExpected: boundDisb.unitCount || 114,
      datasetId: bindings.DISB,
      asOfDate: boundDisb.asOfDate,
    };
  }
  if (bindings.REV && boundRev) {
    benchmarkBindings['REV_RATE_Y'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'actual_total_revenue',
      denominatorField: 'annual_total_budget',
      coverageActual: boundRev.unitCount || 113,
      coverageExpected: boundDisb?.unitCount || workspace.localities.length || 114,
      datasetId: bindings.REV,
      asOfDate: boundRev.asOfDate,
    };
  }
  if (bindings.GPMB && boundGpmb) {
    benchmarkBindings['GPMB_BENCHMARK_AREA_RATE'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'gpmb_recorded_area',
      denominatorField: 'gpmb_declared_area',
      coverageActual: boundGpmb.unitCount || 108,
      coverageExpected: boundDisb?.unitCount || workspace.localities.length || 114,
      datasetId: bindings.GPMB,
      asOfDate: boundGpmb.asOfDate,
    };
  }

  const comparisonRules: ComparisonRuleConfig = {
    higherThresholdPp: 0,
    lowerThresholdPp: 0,
    higherLabel: 'cao hơn',
    lowerLabel: 'thấp hơn',
    equalLabel: 'tương đương',
    insufficientBasisLabel: 'Chưa đủ cơ sở đánh giá',
    allowPartialBenchmarkEvaluation: false,
  };

  const session: ReportSession = {
    id: `SESSION_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: params.name.trim() || 'Phiên báo cáo mới',
    description: params.description,
    sessionRevision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedLocalityIds: [], // STRICT RULE: Always empty [] when creating a new session!
    indicatorIds: templateRows.map((r) => r.indicatorId),
    templateRows,
    dataBindings: bindings,
    allowEmptySources: Boolean(
      params.inheritEmptySources ||
        (params.exactBindings && (!bindings.DISB || !bindings.REV || !bindings.GPMB))
    ),
    benchmarkBindings,
    comparisonRules,
    settings: {
      reportTitle: 'TÌNH HÌNH THỰC HIỆN MỘT SỐ CHỈ TIÊU KINH TẾ - XÃ HỘI CỦA CÁC ĐỊA PHƯƠNG',
      decimalsMoney: 2,
      decimalsPercent: 2,
      decimalsArea: 0,
      decimals: 2,
      areaUnit: 'm2',
      moneyUnit: 'billion',
      gpmbDefaultMethod: 'AREA_WEIGHTED',
      paperSize: 'A4',
      orientation: 'landscape',
      fontFamily: 'Times New Roman',
      fontSizePx: 13,
      columnWidthPx: 130,
      showBenchmarkRows: true,
      showCommentRows: true,
      showScopeFootnotes: true,
      tableLayoutMode: 'AUTO',
      agencyName: 'ỦY BAN NHÂN DÂN THÀNH PHỐ',
      subAgencyName: 'SỞ KẾ HOẠCH VÀ ĐẦU TƯ',
      periodText: 'Kỳ báo cáo: Tháng 10 năm 2026',
      subtitle: '(Số liệu tổng hợp phục vụ công tác chỉ đạo, điều hành)',
      showSubtitle: true,
      titleAlign: 'center',
      titleFontSizePx: 16,
      titleUppercase: true,
      showSignatures: true,
      signatoryLeftTitle: 'NGƯỜI LẬP BIỂU',
      signatoryLeftName: '(Ký, ghi rõ họ tên)',
      signatoryRightTitle: 'THỦ TRƯỞNG ĐƠN VỊ',
      signatoryRightName: '(Ký, ghi rõ họ tên và đóng dấu)',
      summaryNoteText: '',
      showSummaryNote: false,
      zoomScale: 1,
    },
    overrides: [],
    templateId: 'RESULT_REFERENCE_14_ROWS',
  };

  workspace.sessions.push(session);
  workspace.activeSessionId = session.id;
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_CREATE_SESSION`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_CREATED',
    sessionId: session.id,
    details: `Tạo phiên "${session.name}" với 0 địa phương mặc định`,
  });

  return session;
}

export function cloneReportSession(
  workspace: Workspace,
  sourceSessionId: string,
  newName: string
): ReportSession {
  const src = workspace.sessions.find((s) => s.id === sourceSessionId);
  if (!src) {
    throw new Error(`Session ${sourceSessionId} not found`);
  }

  const cloned: ReportSession = JSON.parse(JSON.stringify(src));
  cloned.id = `SESSION_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  cloned.name = newName.trim() || `${src.name} (Bản sao)`;
  cloned.sessionRevision = 1;
  cloned.createdAt = new Date().toISOString();
  cloned.updatedAt = new Date().toISOString();

  workspace.sessions.push(cloned);
  workspace.activeSessionId = cloned.id;
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_CLONE_SESSION`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_CLONED',
    sessionId: cloned.id,
    details: `Nhân bản phiên "${src.name}" thành "${cloned.name}"`,
  });

  return cloned;
}

export function renameReportSession(
  workspace: Workspace,
  sessionId: string,
  newName: string
): ReportSession {
  const session = workspace.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const cleanName = newName.trim();
  if (!cleanName) {
    throw new Error('Tên phiên báo cáo không được để trống.');
  }
  const prevName = session.name;
  session.name = cleanName;
  session.sessionRevision += 1;
  session.updatedAt = new Date().toISOString();
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_RENAME_SESSION`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_RENAMED',
    sessionId: session.id,
    details: `Đổi tên phiên "${prevName}" thành "${cleanName}"`,
  });
  return session;
}

export function deleteReportSession(
  workspace: Workspace,
  sessionId: string,
  confirmedByUser: boolean
): void {
  if (!confirmedByUser) {
    throw new Error('CONFIRMATION_REQUIRED: Xóa phiên báo cáo yêu cầu người dùng xác nhận.');
  }
  const idx = workspace.sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const removed = workspace.sessions[idx];
  workspace.sessions.splice(idx, 1);
  if (workspace.activeSessionId === sessionId) {
    workspace.activeSessionId = workspace.sessions[0]?.id;
  }
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_DELETE_SESSION`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_DELETED',
    sessionId,
    details: `Đã xóa phiên "${removed.name}" sau khi người dùng xác nhận`,
  });
}

export function setSessionLocalities(
  workspace: Workspace,
  sessionId: string,
  localityIds: string[]
): ReportSession {
  const session = workspace.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Deduplicate while preserving order
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of localityIds) {
    if (!seen.has(id)) {
      seen.add(id);
      uniqueIds.push(id);
    }
  }

  session.selectedLocalityIds = uniqueIds;
  session.sessionRevision += 1;
  session.updatedAt = new Date().toISOString();
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;

  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_SET_LOCALITIES`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_LOCALITIES_UPDATED',
    sessionId: session.id,
    details: `Cập nhật danh sách địa phương phiên "${session.name}": ${uniqueIds.length} địa phương`,
  });

  return session;
}

function syncSessionBenchmarkBindingForDataset(
  workspace: Workspace,
  session: ReportSession,
  ds: Dataset
): void {
  const disbDs = session.dataBindings.DISB
    ? workspace.datasets.find((d) => d.id === session.dataBindings.DISB)
    : undefined;
  const expectedCount = disbDs?.unitCount || workspace.localities.length || 114;

  if (ds.sourceType === 'DISB') {
    session.benchmarkBindings['DISB_BENCHMARK_RATE'] = {
      scope: 'LOCALITIES_FULL_114',
      numeratorField: 'disbursed_total',
      denominatorField: 'adjusted_total_plan',
      coverageActual: ds.unitCount || expectedCount,
      coverageExpected: ds.unitCount || expectedCount,
      datasetId: ds.id,
      asOfDate: ds.asOfDate,
    };
  } else if (ds.sourceType === 'REV') {
    session.benchmarkBindings['REV_RATE_Y'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'actual_total_revenue',
      denominatorField: 'annual_total_budget',
      coverageActual: ds.unitCount,
      coverageExpected: expectedCount,
      datasetId: ds.id,
      asOfDate: ds.asOfDate,
    };
  } else if (ds.sourceType === 'GPMB') {
    session.benchmarkBindings['GPMB_BENCHMARK_AREA_RATE'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'gpmb_recorded_area',
      denominatorField: 'gpmb_declared_area',
      coverageActual: ds.unitCount,
      coverageExpected: expectedCount,
      datasetId: ds.id,
      asOfDate: ds.asOfDate,
    };
  }
}

export function rebindSessionDataset(
  workspace: Workspace,
  sessionId: string,
  sourceType: 'REV' | 'DISB' | 'GPMB',
  newDatasetId: string
): ReportSession {
  const session = workspace.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const ds = workspace.datasets.find((d) => d.id === newDatasetId && d.sourceType === sourceType);
  if (!ds) {
    throw new Error(`Dataset ${newDatasetId} of type ${sourceType} not found`);
  }

  session.dataBindings[sourceType] = newDatasetId;
  session.allowEmptySources = false;
  syncSessionBenchmarkBindingForDataset(workspace, session, ds);
  session.sessionRevision += 1;
  session.updatedAt = new Date().toISOString();
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;

  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_REBIND_DATASET`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_DATASET_REBOUND',
    sessionId: session.id,
    datasetId: newDatasetId,
    details: `Chuyển nguồn ${sourceType} của phiên "${session.name}" sang dataset ${newDatasetId}`,
  });

  return session;
}

export function clearSessionDatasetBinding(
  workspace: Workspace,
  sessionId: string,
  sourceType: 'REV' | 'DISB' | 'GPMB'
): ReportSession {
  const session = workspace.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  delete session.dataBindings[sourceType];
  session.allowEmptySources = true;
  if (sourceType === 'DISB') delete session.benchmarkBindings['DISB_BENCHMARK_RATE'];
  if (sourceType === 'REV') delete session.benchmarkBindings['REV_RATE_Y'];
  if (sourceType === 'GPMB') delete session.benchmarkBindings['GPMB_BENCHMARK_AREA_RATE'];
  session.sessionRevision += 1;
  session.updatedAt = new Date().toISOString();
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;

  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_UNBIND_DATASET`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_DATASET_UNBOUND',
    sessionId: session.id,
    details: `Gỡ nguồn ${sourceType} khỏi riêng phiên "${session.name}"`,
  });

  return session;
}

export function updateDatasetAsOfDateForSession(
  workspace: Workspace,
  sessionId: string,
  datasetId: string,
  newDateIso: string,
  reason = 'Người dùng điều chỉnh ngày chốt cho phiên hiện tại'
): Dataset {
  const session = workspace.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const sourceDs = workspace.datasets.find((d) => d.id === datasetId);
  if (!sourceDs) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  const cleanDate = newDateIso.trim();
  if (!isValidSourceDate(cleanDate)) {
    throw new Error('Ngày chốt phải có định dạng YYYY-MM-DD hợp lệ.');
  }

  const sharedByOtherSession = workspace.sessions.some(
    (s) =>
      s.id !== sessionId &&
      (s.dataBindings.DISB === datasetId ||
        s.dataBindings.REV === datasetId ||
        s.dataBindings.GPMB === datasetId)
  );

  let targetDs = sourceDs;
  if (sharedByOtherSession && (sourceDs.sourceType === 'DISB' || sourceDs.sourceType === 'REV' || sourceDs.sourceType === 'GPMB')) {
    const clonedDs: Dataset = JSON.parse(JSON.stringify(sourceDs));
    clonedDs.id = `${sourceDs.id}__S_${sessionId.slice(-5)}_${Date.now().toString(36)}`;
    workspace.datasets.push(clonedDs);
    session.dataBindings[sourceDs.sourceType] = clonedDs.id;
    targetDs = clonedDs;
  }

  targetDs.asOfDate = cleanDate;
  targetDs.asOfStatus = 'MANUAL_CONFIRMED';
  targetDs.periodEnd = cleanDate;
  targetDs.periodStart = cleanDate.slice(0,4)+'-01-01';
  targetDs.asOfDateConfirmation = {
    confirmedByUser: true,
    confirmedAt: new Date().toISOString(),
    reason,
  };
  targetDs.issues = targetDs.issues.filter((i) => i.ruleId !== 'MISSING_CONFIRMED_AS_OF_DATE');

  updateConfirmedPeriodMetadata(targetDs);

  syncSessionBenchmarkBindingForDataset(workspace, session, targetDs);
  session.sessionRevision += 1;
  session.updatedAt = new Date().toISOString();
  syncReportLabelsWithDatasetDates(workspace);
  workspace.updatedAt = new Date().toISOString();
  workspace.unsavedChanges = true;
  workspace.auditLog.push({
    id: `AUDIT_${Date.now()}_AS_OF_DATE_SESSION`,
    timestamp: new Date().toISOString(),
    action: 'SESSION_DATASET_AS_OF_DATE_UPDATED',
    sessionId: session.id,
    datasetId: targetDs.id,
    details: `Cập nhật ngày chốt ${targetDs.asOfDate} cho nguồn ${targetDs.sourceType} trong phiên "${session.name}"`,
  });

  return targetDs;
}

export function getSessionLocalitiesBaseline(
  workspace: Workspace,
  session: ReportSession | undefined,
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset }
): Locality[] {
  const byId = new Map(workspace.localities.map((l) => [l.id, l]));

  if (datasets.DISB && datasets.DISB.records.length > 0) {
    const out: Locality[] = [];
    const seen = new Set<string>();

    for (const rec of datasets.DISB.records) {
      if (
        !rec.localityId ||
        rec.localityId === 'CITY_TOTAL' ||
        rec.localityId === 'LOCALITIES_BLOCK_114' ||
        rec.localityId === 'UNPLANNED_ROW_145' ||
        seen.has(rec.localityId)
      ) {
        continue;
      }
      seen.add(rec.localityId);
      const known = byId.get(rec.localityId);
      if (known) {
        out.push(known);
      } else if (rec.localityName) {
        out.push(createLocalityFromName(rec.localityName, datasets.DISB.id));
      }
    }

    if (session) {
      for (const selId of session.selectedLocalityIds) {
        if (!seen.has(selId)) {
          const known = byId.get(selId);
          if (known) {
            seen.add(selId);
            out.push(known);
          }
        }
      }
    }

    if (out.length > 0) {
      return out;
    }
  }

  if (workspace.localities.length > 0) {
    return workspace.localities;
  }

  const fallbackOut: Locality[] = [];
  const seenFb = new Set<string>();
  for (const ds of [datasets.REV, datasets.GPMB]) {
    if (!ds) continue;
    for (const rec of ds.records) {
      if (rec.localityId && rec.localityName && !seenFb.has(rec.localityId)) {
        seenFb.add(rec.localityId);
        fallbackOut.push(createLocalityFromName(rec.localityName, ds.id));
      }
    }
  }
  return fallbackOut;
}

export function resolveSessionDatasets(
  workspace: Workspace,
  session: ReportSession
): { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset } {
  if (!session || !session.dataBindings) return {};
  return {
    REV: session.dataBindings.REV
      ? workspace.datasets.find((d) => d.id === session.dataBindings.REV)
      : undefined,
    DISB: session.dataBindings.DISB
      ? workspace.datasets.find((d) => d.id === session.dataBindings.DISB)
      : undefined,
    GPMB: session.dataBindings.GPMB
      ? workspace.datasets.find((d) => d.id === session.dataBindings.GPMB)
      : undefined,
  };
}

/** Commit only a complete, still-current preview; all validation precedes mutation. */
export function applyLatestSources(workspace: Workspace, sessionId: string, preview: LatestSourcePlan): ReportSession {
  const session = workspace.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error('Không tìm thấy phiên báo cáo.');
  const current = chooseLatestSources(workspace, session);
  if (!preview.complete || !current.complete || SOURCE_TYPES.some(t => current.bindings[t] !== preview.bindings[t])) {
    throw new Error('Bộ nguồn chưa đủ hoặc đã thay đổi; hãy xem lại trước khi nạp.');
  }
  for (const t of SOURCE_TYPES) {
    if (session.dataBindings[t] !== current.bindings[t]) rebindSessionDataset(workspace, sessionId, t, current.bindings[t]!);
  }
  return session;
}
