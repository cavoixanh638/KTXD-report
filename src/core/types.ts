export type ValueState =
  | 'VALUE'
  | 'ZERO'
  | 'MISSING'
  | 'FORMULA_ERROR'
  | 'INVALID'
  | 'NOT_APPLICABLE'
  | 'OUT_OF_SCOPE';

export type CalculationQuality =
  | 'COMPLETE'
  | 'PARTIAL_AGGREGATE'
  | 'PASS_WITH_MISSING_COMPONENTS'
  | 'INSUFFICIENT_COMPONENTS'
  | 'DENOMINATOR_ZERO'
  | 'SOURCE_ERROR'
  | 'INCOMPARABLE_SCOPE'
  | 'MANUAL_UNVERIFIED';

export type ExclusionReason =
  | 'OUT_OF_SCOPE'
  | 'SOURCE_NOT_PRESENT'
  | 'MISSING_INPUT'
  | 'FORMULA_ERROR'
  | 'INVALID_INPUT'
  | 'DUPLICATE_IDENTIFIER'
  | 'NO_VALID_DENOMINATOR'
  | 'UNCONFIRMED_MATCH'
  | 'DATE_MISMATCH'
  | 'USER_EXCLUDED_WITH_REASON'
  | 'SCENARIO_EXCLUSION'
  | 'NOT_APPLICABLE';

export type CoverageStatus =
  | 'NO_LOCALITY_RECORD'
  | 'FIELD_MISSING'
  | 'PARTIAL_AGGREGATE'
  | 'ZERO_VALID'
  | 'ERROR'
  | 'DATE_UNVERIFIED'
  | 'UNMATCHED';

export interface SourceCellRef {
  datasetId: string;
  fileName: string;
  fileSha256: string;
  sheetName: string;
  sheetIndex: number;
  sheetVisibility: string;
  address: string;
  sourceFormula?: string;
  sourceFormulaDependencies?: string[];
  sourceFormulaVerification?: 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE';
  cachedValue?: string | number | null;
  asOfDate: string;
  mappingVersion: string;
}

export interface CoverageDetail {
  localityId: string;
  localityName: string;
  sourceDatasetId: string;
  sourceType?: 'REV' | 'DISB' | 'GPMB';
  fieldId?: string;
  status: CoverageStatus;
  reason: string;
  sourceSheet?: string;
  sourceCell?: string;
  asOfDate?: string;
  impactOnComputation?: string;
}

export interface ZeroDenominatorContributor {
  recordId: string;
  localityId?: string;
  localityName?: string;
  numeratorFieldId: string;
  denominatorFieldId: string;
  numeratorExactDecimal: string;
  denominatorExactDecimal: '0';
  numeratorSource: SourceCellRef;
  denominatorSource: SourceCellRef;
}

export interface CalculationTrace {
  traceId: string;
  indicatorId: string;
  indicatorLabel?: string;
  localityId?: string;
  localityName?: string;
  resultKind: 'SOURCE_VALUE' | 'CALCULATED';
  result: {
    exactDecimal: string | null;
    displayedText: string;
    canonicalUnit: string;
    displayUnit: string;
    state: ValueState;
  };
  formula: {
    formulaId: string;
    formulaVersion: string;
    readableExpression: string;
    expressionTree: Record<string, unknown>;
    method: string;
    roundingPolicy: string;
    tolerancePolicy: string;
  };
  scope: {
    type: string;
    sourceDatasetIds: string[];
    selectedLocalityIds: string[];
    expectedCount?: number;
    matchingPolicyId: string;
    asOfDates: string[];
  };
  operands: Array<{
    role: string;
    fieldId: string;
    exactValue: string | null;
    unit: string;
    state: ValueState;
    sources: SourceCellRef[];
  }>;
  population: {
    eligibleCount: number;
    includedCount: number;
    excludedCount: number;
    missingCount: number;
    includedRecordIds: string[];
    excludedRecordIds: string[];
  };
  coverageDetails: CoverageDetail[];
  exclusions: Array<{
    recordId: string;
    affectedOperand: string;
    reasonCode: ExclusionReason;
    explanation: string;
    sourceCell?: string;
    sourceValue?: string | null;
  }>;
  zeroDenominatorContributors?: ZeroDenominatorContributor[];
  steps: Array<{
    operation: string;
    inputs: string[];
    output: string | null;
    inputUnit?: string;
    outputUnit?: string;
    reason: string;
  }>;
  quality: {
    status: CalculationQuality;
    warningIds: string[];
    missingDeclaredAmount?: string;
    coverageRatio?: string;
    approvedByUser?: boolean;
    approvalReason?: string;
  };
  sourceRefs: SourceCellRef[];
  createdAt: string;
  engineVersion: string;
  datasetHashes: string[];
}

export type LocalityType = 'XA' | 'PHUONG' | 'DAC_KHU';

export interface Locality {
  id: string;
  displayName: string;
  canonicalName: string;
  canonicalNameNFC: string;
  shortName: string;
  type: LocalityType;
  aliases: string[];
  officialCode?: string;
  adminContext?: string;
  matchStatus: 'CONFIRMED' | 'NEEDS_CONFIRMATION';
  matchEvidence?: string;
  matchConfidence?: number;
}

export interface MetricCellValue {
  raw: string | number | null;
  normalizedValue: string | null;
  normalizedDecimal: string | null;
  unit: string;
  state: ValueState;
  cellType: 'n' | 's' | 'str' | 'e' | 'b' | 'empty';
  sourceRow: number;
  sourceColumn: string;
  extractionConfidence: number;
  provenance: {
    filename: string;
    fileSha256: string;
    sheet: string;
    sheetIndex: number;
    sheetVisibility: string;
    cell: string;
    formula?: string;
    cachedValue?: string | number | null;
    asOfDate: string;
    mappingVersion: string;
  };
}

export interface AdjustedScenarioCandidate {
  rawText: string;
  rateCandidate?: string;
  numerator?: string | null;
  denominator?: string | null;
  excludedItems: string[];
  sourceCells: string[];
  reviewStatus: 'UNVERIFIED_NOTE' | 'VERIFIED_ADJUSTED_SCENARIO' | 'MANUAL_UNVERIFIED';
}

export interface SourceRecord {
  id: string;
  datasetId: string;
  localityId: string;
  localityName: string;
  sourceRow: number;
  projectRowId?: string;
  projectStt?: number;
  projectName?: string;
  capitalType?: string;
  inspectionMarker?: string | null;
  officialNote?: string | null;
  adjustedScenarios?: AdjustedScenarioCandidate[];
  metrics: Record<string, MetricCellValue>;
}

export interface QualityIssue {
  id: string;
  ruleId: string;
  severity: 'BLOCKER' | 'ERROR' | 'WARNING' | 'INFO';
  status: 'OPEN' | 'ACKNOWLEDGED';
  datasetId: string;
  sourceType: 'REV' | 'DISB' | 'GPMB';
  rowId: string;
  sourceRow: number;
  projectStt?: number;
  localityId: string;
  localityName: string;
  fieldId: string;
  sourceCell: string;
  sourceCells?: Record<string, string>;
  observed: string | number | null;
  expected?: string | number | null;
  delta?: string | number | null;
  threshold?: string | number | null;
  explanation: string;
  acknowledgedAt?: string;
}

export interface IdentityCheckResult {
  equation: 'F=G+H' | 'I=J+K' | 'I=L+M+N';
  row: number;
  localityId: string;
  localityName: string;
  status: 'PASS_COMPLETE' | 'PASS_WITH_MISSING_COMPONENTS' | 'FAIL';
  totalExact: string | null;
  sumComponentsExact: string | null;
  missingFields: string[];
  trace: CalculationTrace;
}

export interface Dataset {
  id: string;
  sourceType: 'REV' | 'DISB' | 'GPMB' | 'MANUAL';
  sourceFilename: string;
  sourceHash: string;
  workbookSha256: string;
  sourceSheet: string;
  sheetIndex: number;
  sheetVisibility: 'visible' | 'hidden' | 'veryHidden';
  schemaFingerprint: string;
  importSelectionMode: 'AUTO_VISIBLE_SINGLE' | 'MANUAL_CONFIRMED';
  manualSelectionReason?: string;
  mappingVersion: string;
  calculationPolicyVersion: string;
  unitCount: number;
  projectRowCount?: number;
  asOfDate: string; // YYYY-MM-DD
  reportPeriodLabel: string;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  asOfStatus: 'DETECTED_CONFIRMED' | 'MANUAL_CONFIRMED' | 'REQUIRES_USER_CONFIRMATION';
  asOfDateEvidence: string;
  asOfDateConfirmation?: {
    confirmedByUser: boolean;
    confirmedAt: string | null;
    reason?: string;
  };
  importedAt: string;
  records: SourceRecord[];
  summaryRecord?: SourceRecord;
  citySummaryRecord?: SourceRecord;
  unplannedDisbursementRecord?: SourceRecord;
  localityGroupSummaries?: Record<string, { row: number; rawM: string | number | null; formulaM?: string }>;
  issues: QualityIssue[];
  identityChecks?: IdentityCheckResult[];
  allSheetsMeta: Array<{ index: number; name: string; state: 'visible' | 'hidden' | 'veryHidden' }>;
}

export type BenchmarkScope =
  | 'LOCALITIES_FULL_114'
  | 'LOCALITIES_AVAILABLE_N'
  | 'PROJECT_PORTFOLIO_CITY'
  | 'CITY_TOTAL_OFFICIAL'
  | 'SELECTED_UNITS'
  | 'MANUAL_CONFIRMED';

export interface BenchmarkConfig {
  scope: BenchmarkScope;
  numeratorField: string;
  denominatorField: string;
  coverageActual: number;
  coverageExpected?: number;
  datasetId: string;
  asOfDate: string;
  manuallyApprovedPartial?: boolean;
  manualConfirmationReason?: string;
  excludeUnplanned251163?: boolean;
}

export interface ManualOverride {
  id: string;
  indicatorId: string;
  localityId: string;
  overrideValue: string;
  reason: string;
  createdAt: string;
  authorLabel?: string;
}

export interface TemplateRowCustomConfig {
  rowNumber: number; // 3..16
  indicatorId: string;
  sttLabel: string;
  customLabel: string;
  groupName?: string;
  visible: boolean;
  order: number;
}

export interface ComparisonRuleConfig {
  higherThresholdPp: number; // default 0
  lowerThresholdPp: number; // default 0
  higherLabel: string; // 'cao hơn'
  lowerLabel: string; // 'thấp hơn'
  equalLabel: string; // 'tương đương'
  insufficientBasisLabel: string; // 'Chưa đủ cơ sở đánh giá'
  allowPartialBenchmarkEvaluation: boolean;
  partialApprovalReason?: string;
}

export interface ReportSession {
  id: string;
  name: string;
  description?: string;
  sessionRevision: number;
  createdAt: string;
  updatedAt: string;
  selectedLocalityIds: string[]; // Always [] on new session!
  indicatorIds: string[];
  templateRows: TemplateRowCustomConfig[];
  dataBindings: {
    REV?: string;
    DISB?: string;
    GPMB?: string;
  };
  benchmarkBindings: Record<string, BenchmarkConfig>;
  comparisonRules: ComparisonRuleConfig;
  settings: {
    reportTitle: string;
    decimalsMoney: number;
    decimalsPercent: number;
    decimalsArea: number;
    decimals: number;
    areaUnit: 'm2' | 'ha';
    moneyUnit: 'million' | 'billion';
    gpmbDefaultMethod: 'AREA_WEIGHTED'; // Strictly AREA_WEIGHTED only per R06
    paperSize: 'A4' | 'A3';
    orientation: 'landscape' | 'portrait';
    fontFamily: string;
    fontSizePx: number;
    columnWidthPx: number;
    showBenchmarkRows: boolean;
    showCommentRows: boolean;
    showScopeFootnotes: boolean;
  };
  overrides: ManualOverride[];
  templateId?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  sessionId?: string;
  datasetId?: string;
  details: string;
}

export interface Workspace {
  formatVersion: number;
  schemaVersion: string;
  name: string;
  updatedAt: string;
  unsavedChanges: boolean;
  localities: Locality[];
  datasets: Dataset[];
  sessions: ReportSession[];
  activeSessionId?: string;
  auditLog: AuditEntry[];
  checksum?: string;
}
