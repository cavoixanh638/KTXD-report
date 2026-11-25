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
  equation:
    | 'F=G+H'
    | 'I=J+K'
    | 'I=L+M+N'
    | 'C=D+E+F'
    | 'G=H+I+J'
    | 'C=D+E'
    | 'F=G+H+I'
    | 'J=K+L+M';
  row: number;
  localityId: string;
  localityName: string;
  status: 'PASS_COMPLETE' | 'PASS_WITH_MISSING_COMPONENTS' | 'FAIL';
  totalExact: string | null;
  sumComponentsExact: string | null;
  missingFields: string[];
  trace: CalculationTrace;
}

export interface SourceMappingColumn {
  field: string;
  column: string;
  header: string;
  unit: string;
}
export interface SourceValidationCheck {
  code: string;
  label: string;
  checked: number;
  failed: number;
  severity: 'INFO' | 'WARNING' | 'REVIEW';
  detail: string;
  examples?: string[];
}
export interface SourceValidation {
  version: 'SCHEMA_GUARD_V1';
  workbookSha256: string;
  sheet: string;
  schemaSignature: string;
  headerRows: number[];
  columnCount: number;
  headerColumnCount: number;
  columns: SourceMappingColumn[];
  status: 'VERIFIED' | 'NEEDS_REVIEW';
  checks: SourceValidationCheck[];
  checkedAt: string;
  reviewedAt?: string;
  reviewReason?: string;
  historicalDatasetId?: string;
  historicalDate?: string;
  previousColumnCount?: number;
  changedColumns?: Array<{field:string; before:string; after:string}>;
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
  sourceValidation?: SourceValidation;
  /** Real workbook addresses for an independently resolved DISB layout. */
  disbLayout?: DisbResolvedLayout;
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
  localityGroupSummaries?: Record<string, { row: number; rawM: string | number | null; formulaM?: string; columnM?:string }>;
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
  allowEmptySources?: boolean;
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
    indicatorColumnWidthPx?: number;
    showBenchmarkRows: boolean;
    showCommentRows: boolean;
    showDisbPlanAdjustmentComparison?: boolean;
    showScopeFootnotes: boolean;
    tableLayoutMode?: 'AUTO' | 'HORIZONTAL' | 'VERTICAL';
    agencyName?: string;
    subAgencyName?: string;
    periodText?: string;
    subtitle?: string;
    showSubtitle?: boolean;
    titleAlign?: 'center' | 'left';
    titleFontSizePx?: number;
    titleUppercase?: boolean;
    showSignatures?: boolean;
    signatoryLeftTitle?: string;
    signatoryLeftName?: string;
    signatoryRightTitle?: string;
    signatoryRightName?: string;
    summaryNoteText?: string;
    showSummaryNote?: boolean;
    zoomScale?: number;
    showUncompletedSummaryRow?: boolean;
    showUncompletedProjectsTable?: boolean;
    uncompletedRowCustomLabel?: string;
    uncompletedProjectsListCustomLabel?: string;
    uncompletedProjectsFontSizePt?: number;
    splitRow8ToNewPage?: boolean;
    projectOverrides?: Record<
      string,
      {
        projectName?: string;
        completionRate?: string;
        deadline?: string;
        isHidden?: boolean;
      }
    >;
    customProjects?: Array<{
      id: string;
      localityId: string;
      localityName: string;
      projectStt: number | string;
      projectName: string;
      completionRate: string;
      deadline: string;
      isCustom?: boolean;
      isHidden?: boolean;
    }>;
    showNq11Row?: boolean;
    nq11RowCustomLabel?: string;
    nq11Projects?: Array<{
      id: string;
      localityId: string;
      localityName: string;
      projectStt?: number | string;
      projectName: string;
      issueContent?: string;
      deadline?: string;
      isHidden?: boolean;
    }>;
    showRevRealizedRow?: boolean;
    revRealizedRowCustomLabel?: string;
    showRevBenchmarkRow?: boolean;
    revBenchmarkRowCustomLabel?: string;
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

export type DisbSchemaFingerprint =
  | 'DISB_V1'
  | 'DISB_PHAN_CAP_XA_V1'
  | 'DISB_PHAN_CAP_XA_V2'
  | 'DISB_TOTAL_LOCALITY_V2';

export interface DisbResolvedLayout {
  fingerprint: DisbSchemaFingerprint;
  /** Canonical profile role (A, B, C...) -> actual workbook column. */
  columns: Record<string,string>;
  headerRows: number[];
  dataRows: number[];
  summaryRow: number;
  citySummaryRow?: number;
  unplannedRow?: number;
  titleCell: string;
}

export interface DisbIdentityEqDef {
  eq: IdentityCheckResult['equation'];
  totalField: string;
  totalCol: string;
  compCols: Array<{ col: string; field: string }>;
}

export interface DisbSchemaProfile {
  fingerprint: DisbSchemaFingerprint;
  isPhanCapXa: boolean;
  hasInitialPlan: boolean;
  mappingVersion: string;
  rowStart: number;
  defaultRowEnd: number;
  summaryRow: number;
  hasCitySummary: boolean;
  hasUnplannedRow: boolean;
  planCol: string;
  disbCol: string;
  rateCol: string;
  noteCol: string;
  markerCol: string | null;
  colMap: Record<string, string>;
  componentCols: Array<{ field: string; col: string }>;
  eqDefs: DisbIdentityEqDef[];
}

export const DISB_SCHEMA_PROFILES: Record<DisbSchemaFingerprint, DisbSchemaProfile> = {
  DISB_V1: {
    fingerprint: 'DISB_V1',
    isPhanCapXa: false,
    hasInitialPlan: true,
    mappingVersion: 'DISB_ADAPTER_V2.2',
    rowStart: 13,
    defaultRowEnd: 126,
    summaryRow: 12,
    hasCitySummary: true,
    hasUnplannedRow: true,
    planCol: 'F',
    disbCol: 'I',
    rateCol: 'O',
    noteCol: 'Q',
    markerCol: 'P',
    colMap: {
      C: 'initial_total_plan',
      D: 'initial_city_component',
      E: 'initial_local_component',
      F: 'adjusted_total_plan',
      G: 'adjusted_city_component',
      H: 'adjusted_local_component',
      I: 'disbursed_total',
      J: 'disbursed_city_component',
      K: 'disbursed_local_component',
      L: 'disbursed_construction',
      M: 'disbursed_gpmb',
      N: 'disbursed_other',
      O: 'source_disbursed_rate',
    },
    componentCols: [
      { field: 'adjusted_city_component', col: 'G' },
      { field: 'disbursed_city_component', col: 'J' },
      { field: 'disbursed_gpmb', col: 'M' },
      { field: 'disbursed_other', col: 'N' },
    ],
    eqDefs: [
      {
        eq: 'F=G+H',
        totalField: 'adjusted_total_plan',
        totalCol: 'F',
        compCols: [
          { col: 'G', field: 'adjusted_city_component' },
          { col: 'H', field: 'adjusted_local_component' },
        ],
      },
      {
        eq: 'I=J+K',
        totalField: 'disbursed_total',
        totalCol: 'I',
        compCols: [
          { col: 'J', field: 'disbursed_city_component' },
          { col: 'K', field: 'disbursed_local_component' },
        ],
      },
      {
        eq: 'I=L+M+N',
        totalField: 'disbursed_total',
        totalCol: 'I',
        compCols: [
          { col: 'L', field: 'disbursed_construction' },
          { col: 'M', field: 'disbursed_gpmb' },
          { col: 'N', field: 'disbursed_other' },
        ],
      },
    ],
  },
  // Compact locality-only sheet: initial/adjusted/paid totals, two component
  // columns each, rate before/after adjustment, and official note. No city
  // summary row or L/M/N construction/GPMB breakdown exists in this schema.
  DISB_TOTAL_LOCALITY_V2: {
    fingerprint: 'DISB_TOTAL_LOCALITY_V2',
    isPhanCapXa: false,
    hasInitialPlan: true,
    mappingVersion: 'DISB_TOTAL_LOCALITY_HEADERS_V2',
    rowStart: 8,
    defaultRowEnd: 121,
    summaryRow: 0,
    hasCitySummary: false,
    hasUnplannedRow: false,
    planCol: 'F',
    disbCol: 'I',
    rateCol: 'M',
    noteCol: 'N',
    markerCol: null,
    colMap: {
      C: 'initial_total_plan',
      D: 'initial_city_component',
      E: 'initial_local_component',
      F: 'adjusted_total_plan',
      G: 'adjusted_city_component',
      H: 'adjusted_local_component',
      I: 'disbursed_total',
      J: 'disbursed_city_component',
      K: 'disbursed_local_component',
      M: 'source_disbursed_rate',
    },
    componentCols: [
      { field: 'adjusted_city_component', col: 'G' },
      { field: 'disbursed_city_component', col: 'J' },
    ],
    eqDefs: [
      {
        eq: 'C=D+E',
        totalField: 'initial_total_plan',
        totalCol: 'C',
        compCols: [{ col: 'D', field: 'initial_city_component' }, { col: 'E', field: 'initial_local_component' }],
      },
      {
        eq: 'F=G+H',
        totalField: 'adjusted_total_plan',
        totalCol: 'F',
        compCols: [{ col: 'G', field: 'adjusted_city_component' }, { col: 'H', field: 'adjusted_local_component' }],
      },
      {
        eq: 'I=J+K',
        totalField: 'disbursed_total',
        totalCol: 'I',
        compCols: [{ col: 'J', field: 'disbursed_city_component' }, { col: 'K', field: 'disbursed_local_component' }],
      },
    ],
  },
  DISB_PHAN_CAP_XA_V1: {
    fingerprint: 'DISB_PHAN_CAP_XA_V1',
    isPhanCapXa: true,
    hasInitialPlan: false,
    mappingVersion: 'DISB_PHAN_CAP_XA_V1',
    rowStart: 8,
    defaultRowEnd: 121,
    summaryRow: 7,
    hasCitySummary: false,
    hasUnplannedRow: false,
    planCol: 'C',
    disbCol: 'G',
    rateCol: 'K',
    noteCol: 'L',
    markerCol: null,
    colMap: {
      C: 'adjusted_total_plan',
      D: 'plan_land_use_fee',
      E: 'plan_targeted_support',
      F: 'plan_revenue_increase',
      G: 'disbursed_total',
      H: 'disbursed_land_use_fee',
      I: 'disbursed_targeted_support',
      J: 'disbursed_revenue_increase',
      K: 'source_disbursed_rate',
    },
    componentCols: [
      { field: 'plan_land_use_fee', col: 'D' },
      { field: 'plan_targeted_support', col: 'E' },
      { field: 'plan_revenue_increase', col: 'F' },
      { field: 'disbursed_land_use_fee', col: 'H' },
      { field: 'disbursed_targeted_support', col: 'I' },
      { field: 'disbursed_revenue_increase', col: 'J' },
    ],
    eqDefs: [
      {
        eq: 'C=D+E+F',
        totalField: 'adjusted_total_plan',
        totalCol: 'C',
        compCols: [
          { col: 'D', field: 'plan_land_use_fee' },
          { col: 'E', field: 'plan_targeted_support' },
          { col: 'F', field: 'plan_revenue_increase' },
        ],
      },
      {
        eq: 'G=H+I+J',
        totalField: 'disbursed_total',
        totalCol: 'G',
        compCols: [
          { col: 'H', field: 'disbursed_land_use_fee' },
          { col: 'I', field: 'disbursed_targeted_support' },
          { col: 'J', field: 'disbursed_revenue_increase' },
        ],
      },
    ],
  },
  DISB_PHAN_CAP_XA_V2: {
    fingerprint: 'DISB_PHAN_CAP_XA_V2',
    isPhanCapXa: true,
    hasInitialPlan: true,
    mappingVersion: 'DISB_PHAN_CAP_XA_V2',
    rowStart: 8,
    defaultRowEnd: 121,
    summaryRow: 7,
    hasCitySummary: false,
    hasUnplannedRow: false,
    planCol: 'F',
    disbCol: 'J',
    rateCol: 'N',
    noteCol: 'O',
    markerCol: null,
    colMap: {
      C: 'initial_total_plan',
      D: 'initial_land_use_fee',
      E: 'initial_targeted_support',
      F: 'adjusted_total_plan',
      G: 'plan_land_use_fee',
      H: 'plan_targeted_support',
      I: 'plan_revenue_increase',
      J: 'disbursed_total',
      K: 'disbursed_land_use_fee',
      L: 'disbursed_targeted_support',
      M: 'disbursed_revenue_increase',
      N: 'source_disbursed_rate',
    },
    componentCols: [
      { field: 'initial_land_use_fee', col: 'D' },
      { field: 'initial_targeted_support', col: 'E' },
      { field: 'plan_land_use_fee', col: 'G' },
      { field: 'plan_targeted_support', col: 'H' },
      { field: 'plan_revenue_increase', col: 'I' },
      { field: 'disbursed_land_use_fee', col: 'K' },
      { field: 'disbursed_targeted_support', col: 'L' },
      { field: 'disbursed_revenue_increase', col: 'M' },
    ],
    eqDefs: [
      {
        eq: 'C=D+E',
        totalField: 'initial_total_plan',
        totalCol: 'C',
        compCols: [
          { col: 'D', field: 'initial_land_use_fee' },
          { col: 'E', field: 'initial_targeted_support' },
        ],
      },
      {
        eq: 'F=G+H+I',
        totalField: 'adjusted_total_plan',
        totalCol: 'F',
        compCols: [
          { col: 'G', field: 'plan_land_use_fee' },
          { col: 'H', field: 'plan_targeted_support' },
          { col: 'I', field: 'plan_revenue_increase' },
        ],
      },
      {
        eq: 'J=K+L+M',
        totalField: 'disbursed_total',
        totalCol: 'J',
        compCols: [
          { col: 'K', field: 'disbursed_land_use_fee' },
          { col: 'L', field: 'disbursed_targeted_support' },
          { col: 'M', field: 'disbursed_revenue_increase' },
        ],
      },
    ],
  },
};

/** Returns schema metadata for a DISB workbook variant (defaults to DISB_V1). */
export function getDisbSchemaProfile(schemaFingerprint?: string): DisbSchemaProfile {
  if (schemaFingerprint === 'DISB_TOTAL_LOCALITY_V2') return DISB_SCHEMA_PROFILES.DISB_TOTAL_LOCALITY_V2;
  if (schemaFingerprint === 'DISB_PHAN_CAP_XA_V1') return DISB_SCHEMA_PROFILES.DISB_PHAN_CAP_XA_V1;
  if (schemaFingerprint === 'DISB_PHAN_CAP_XA_V2') return DISB_SCHEMA_PROFILES.DISB_PHAN_CAP_XA_V2;
  return DISB_SCHEMA_PROFILES.DISB_V1;
}

/** Formats a column range string (e.g., F8:F121 or F13:F126) for traces and footnotes. */
export function formatDisbRange(col: string, profile: DisbSchemaProfile, count = 114): string {
  const endRow = profile.rowStart + Math.max(count, 1) - 1;
  return `${col}${profile.rowStart}:${col}${endRow}`;
}

/** Keep field IDs and equation IDs stable, but expose actual source addresses. */
export function remapDisbProfile(layout:DisbResolvedLayout):DisbSchemaProfile {
  const base=getDisbSchemaProfile(layout.fingerprint);
  const col=(c:string)=>layout.columns[c]||c;
  return {
    ...base,
    rowStart:layout.dataRows[0]??base.rowStart,
    defaultRowEnd:layout.dataRows[layout.dataRows.length-1]??base.defaultRowEnd,
    summaryRow:layout.summaryRow,
    hasCitySummary:layout.citySummaryRow!==undefined,
    hasUnplannedRow:layout.unplannedRow!==undefined,
    planCol:col(base.planCol),disbCol:col(base.disbCol),rateCol:col(base.rateCol),
    noteCol:col(base.noteCol),markerCol:base.markerCol?layout.columns[base.markerCol]||null:null,
    colMap:Object.fromEntries(Object.entries(base.colMap).map(([c,field])=>[col(c),field])),
    componentCols:base.componentCols.map(c=>({...c,col:col(c.col)})),
    eqDefs:base.eqDefs.map(e=>({...e,totalCol:col(e.totalCol),compCols:e.compCols.map(c=>({...c,col:col(c.col)}))})),
  };
}
export function getDisbDatasetProfile(ds:Dataset):DisbSchemaProfile {
  return ds.disbLayout?remapDisbProfile(ds.disbLayout):getDisbSchemaProfile(ds.schemaFingerprint);
}
/** Use exact records, not an invented continuous range when rows are sparse. */
export function formatDisbDatasetRange(ds:Dataset,field:string):string {
  const refs=ds.records.map(r=>r.metrics[field]).filter((m):m is MetricCellValue=>!!m);
  if(!refs.length)return '(không có dòng nguồn)';
  const col=refs[0].sourceColumn;
  const rows=[...new Set(refs.map(m=>m.sourceRow))].sort((a,b)=>a-b);
  if(refs.some(m=>m.sourceColumn!==col))return refs.map(m=>m.provenance.cell).join(', ');
  const ranges:string[]=[];
  for(let i=0;i<rows.length;){let j=i;while(j+1<rows.length&&rows[j+1]===rows[j]+1)j++;
    ranges.push(col+rows[i]+(j===i?'':':'+col+rows[j]));i=j+1;}
  return ranges.join(', ');
}
