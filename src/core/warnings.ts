import { Dataset, QualityIssue } from './types';

export interface WarningSummaryStats {
  totalWarningEventsExcludingMissing: number;
  distinctProjectRowsExcludingMissing: number;
  totalEventsIncludingMissing: number;
  distinctProjectRowsIncludingMissing: number;
  countsByRule: Record<string, number>;
  disbNullCountsByCol: { G: number; J: number; M: number; N: number; totalCells: number; distinctRows: number };
  disbNoteCount: number;
  disbMarkerPCount: number;
  issues: QualityIssue[];
}

export function summarizeDatasetWarnings(datasets: {
  DISB?: Dataset;
  REV?: Dataset;
  GPMB?: Dataset;
}): WarningSummaryStats {
  const allIssues: QualityIssue[] = [];
  if (datasets.DISB) allIssues.push(...datasets.DISB.issues);
  if (datasets.REV) allIssues.push(...datasets.REV.issues);
  if (datasets.GPMB) allIssues.push(...datasets.GPMB.issues);

  const countsByRule: Record<string, number> = {};
  const gpmbRowsExclMissing = new Set<number>();
  const gpmbRowsInclMissing = new Set<number>();
  let gpmbEventsExclMissing = 0;
  let gpmbEventsInclMissing = 0;

  for (const iss of allIssues) {
    countsByRule[iss.ruleId] = (countsByRule[iss.ruleId] || 0) + 1;
    if (iss.sourceType === 'GPMB') {
      gpmbEventsInclMissing++;
      gpmbRowsInclMissing.add(iss.sourceRow);
      if (iss.ruleId !== 'GPMB_MISSING_PROGRESS') {
        gpmbEventsExclMissing++;
        gpmbRowsExclMissing.add(iss.sourceRow);
      }
    }
  }

  const disbNullCounts = { G: 0, J: 0, M: 0, N: 0, totalCells: 0, distinctRows: 0 };
  let disbNoteCount = 0;
  let disbMarkerPCount = 0;

  if (datasets.DISB) {
    for (const rec of datasets.DISB.records) {
      if (rec.officialNote) disbNoteCount++;
      if (rec.inspectionMarker) disbMarkerPCount++;
      const gMiss = rec.metrics['adjusted_city_component']?.state === 'MISSING';
      const jMiss = rec.metrics['disbursed_city_component']?.state === 'MISSING';
      const mMiss = rec.metrics['disbursed_gpmb']?.state === 'MISSING';
      const nMiss = rec.metrics['disbursed_other']?.state === 'MISSING';
      if (gMiss) disbNullCounts.G++;
      if (jMiss) disbNullCounts.J++;
      if (mMiss) disbNullCounts.M++;
      if (nMiss) disbNullCounts.N++;
      if (gMiss || jMiss || mMiss || nMiss) {
        disbNullCounts.distinctRows++;
      }
    }
    disbNullCounts.totalCells =
      disbNullCounts.G + disbNullCounts.J + disbNullCounts.M + disbNullCounts.N;
  }

  return {
    totalWarningEventsExcludingMissing: gpmbEventsExclMissing,
    distinctProjectRowsExcludingMissing: gpmbRowsExclMissing.size,
    totalEventsIncludingMissing: gpmbEventsInclMissing,
    distinctProjectRowsIncludingMissing: gpmbRowsInclMissing.size,
    countsByRule,
    disbNullCountsByCol: disbNullCounts,
    disbNoteCount,
    disbMarkerPCount,
    issues: allIssues,
  };
}

export function filterWarningsForSession(
  allIssues: QualityIssue[],
  selectedLocalityIds: string[],
  severityFilter: 'ALL' | 'BLOCKER' | 'ERROR' | 'WARNING' | 'INFO' = 'ALL',
  ruleFilter = 'ALL'
): QualityIssue[] {
  const selectedSet = new Set(selectedLocalityIds);
  return allIssues.filter((iss) => {
    if (iss.localityId !== 'ALL' && !selectedSet.has(iss.localityId)) {
      return false;
    }
    if (severityFilter !== 'ALL' && iss.severity !== severityFilter) {
      return false;
    }
    if (ruleFilter !== 'ALL' && iss.ruleId !== ruleFilter) {
      return false;
    }
    return true;
  });
}
