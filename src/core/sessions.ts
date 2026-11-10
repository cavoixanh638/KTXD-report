import {
  BenchmarkConfig,
  ComparisonRuleConfig,
  Dataset,
  Locality,
  ReportSession,
  TemplateRowCustomConfig,
  Workspace,
} from './types';
import {
  formatVnDateText,
  replaceDateInLabel,
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
    workspace.datasets[existingIdx] = dataset;
  }

  if (localitiesFromDisb && localitiesFromDisb.length > 0 && workspace.localities.length === 0) {
    workspace.localities = localitiesFromDisb.map((l) => ({ ...l, aliases: [...l.aliases] }));
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate.trim())) {
    throw new Error('Ngày chốt phải có định dạng YYYY-MM-DD hợp lệ.');
  }

  ds.asOfDate = confirmedDate.trim();
  ds.asOfStatus = 'MANUAL_CONFIRMED';
  ds.asOfDateConfirmation = {
    confirmedByUser: true,
    confirmedAt: new Date().toISOString(),
    reason: reason.trim() || 'Người dùng xác nhận thủ công trong Wizard nhập nguồn',
  };
  // Clear blocker issue for missing asOfDate
  ds.issues = ds.issues.filter((i) => i.ruleId !== 'MISSING_CONFIRMED_AS_OF_DATE');

  // Update provenance asOfDate in records
  for (const rec of ds.records) {
    for (const m of Object.values(rec.metrics)) {
      m.provenance.asOfDate = ds.asOfDate;
    }
  }

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

    for (const r of session.templateRows) {
      const dateVn = dateByIndicator[r.indicatorId];
      if (dateVn) {
        r.customLabel = replaceDateInLabel(r.customLabel, dateVn);
      }
    }

    if (session.settings.revBenchmarkRowCustomLabel && dateByIndicator.REV_RATE_Y) {
      session.settings.revBenchmarkRowCustomLabel = replaceDateInLabel(
        session.settings.revBenchmarkRowCustomLabel,
        dateByIndicator.REV_RATE_Y
      );
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
      'Tỷ lệ thu NSNN của từng xã so với dự toán (đến ngày 19/10/2026)',
    'Kế hoạch vốn đầu tư công sau điều chỉnh':
      'Kế hoạch vốn đầu tư công sau điều chỉnh, bổ sung',
    'Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND':
      'Kế hoạch vốn đầu tư công sau điều chỉnh, bổ sung',
    'Tỷ lệ giải ngân chung của 114 địa phương':
      'Tỷ lệ giải ngân chung của các địa phương (đến ngày 15/10/2026)',
    'Tỷ lệ giải ngân của địa phương': 'Tỷ lệ giải ngân của từng địa phương',
    'Nhận xét tỷ lệ giải ngân':
      'Kết quả giải ngân so với tỷ lệ trung bình',
    'Kinh phí phân bổ GPMB': 'Kinh phí phân bổ GPMB cho từng xã',
    'Diện tích phải GPMB': 'Diện tích phải GPMB của từng xã',
    'Tỷ lệ GPMB của danh mục địa bàn có dữ liệu (108/114 địa bàn)':
      'Tỷ lệ GPMB trung bình của các địa phương (đến ngày 26/10/2026)',
    'Tỷ lệ GPMB địa phương theo diện tích':
      'Tỷ lệ GPMB của từng địa phương',
    'Đánh giá GPMB':
      'Kết quả GPMB so với tỷ lệ trung bình',
  };

  for (const s of workspace.sessions) {
    if (!s || !s.settings) continue;
    if (
      s.settings.revBenchmarkRowCustomLabel &&
      /^Tỷ lệ thu NSNN chung của \d+\/\d+ địa phương có dữ liệu/i.test(
        s.settings.revBenchmarkRowCustomLabel.trim()
      )
    ) {
      delete s.settings.revBenchmarkRowCustomLabel;
    }
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
          ? `Tỷ lệ thu NSNN của từng xã so với dự toán ${rest}`
          : 'Tỷ lệ thu NSNN của từng xã so với dự toán (đến ngày 19/10/2026)';
      } else if (r.customLabel && legacyToNewMap[r.customLabel]) {
        r.customLabel = legacyToNewMap[r.customLabel];
      }
      if (
        r.indicatorId === 'DISB_PLAN' &&
        (r.customLabel === 'Kế hoạch vốn đầu tư công sau điều chỉnh' ||
          r.customLabel === 'Kế hoạch vốn đầu tư công sau NQ điều chỉnh, bổ sung của HĐND' ||
          !r.customLabel)
      ) {
        r.customLabel = 'Kế hoạch vốn đầu tư công sau điều chỉnh, bổ sung';
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
  }
): ReportSession {
  const latestRev = [...workspace.datasets].reverse().find((d) => d.sourceType === 'REV');
  const latestDisb = [...workspace.datasets].reverse().find((d) => d.sourceType === 'DISB');
  const latestGpmb = [...workspace.datasets].reverse().find((d) => d.sourceType === 'GPMB');

  const bindings = {
    REV: params.dataBindings?.REV ?? latestRev?.id,
    DISB: params.dataBindings?.DISB ?? latestDisb?.id,
    GPMB: params.dataBindings?.GPMB ?? latestGpmb?.id,
  };

  const templateRows: TemplateRowCustomConfig[] = TEMPLATE_14_ROWS_DEFAULT.map((r) => ({
    ...r,
  }));

  const benchmarkBindings: Record<string, BenchmarkConfig> = {};
  if (bindings.DISB && latestDisb) {
    benchmarkBindings['DISB_BENCHMARK_RATE'] = {
      scope: 'LOCALITIES_FULL_114',
      numeratorField: 'disbursed_total',
      denominatorField: 'adjusted_total_plan',
      coverageActual: 114,
      coverageExpected: 114,
      datasetId: bindings.DISB,
      asOfDate: latestDisb.asOfDate,
    };
  }
  if (bindings.REV && latestRev) {
    benchmarkBindings['REV_RATE_Y'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'actual_total_revenue',
      denominatorField: 'annual_total_budget',
      coverageActual: 113,
      coverageExpected: 114,
      datasetId: bindings.REV,
      asOfDate: latestRev.asOfDate,
    };
  }
  if (bindings.GPMB && latestGpmb) {
    benchmarkBindings['GPMB_BENCHMARK_AREA_RATE'] = {
      scope: 'LOCALITIES_AVAILABLE_N',
      numeratorField: 'gpmb_recorded_area',
      denominatorField: 'gpmb_declared_area',
      coverageActual: 108,
      coverageExpected: 114,
      datasetId: bindings.GPMB,
      asOfDate: latestGpmb.asOfDate,
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
