import type { Dataset, ReportSession, Workspace } from './types';

export const SOURCE_TYPES = ['DISB', 'REV', 'GPMB'] as const;
export type LatestSourceType = typeof SOURCE_TYPES[number];
export type LatestSourceMap = Partial<Record<LatestSourceType, Dataset>>;
export const REFERENCE_SHA: Record<LatestSourceType, string> = {
  DISB: '3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c',
  REV: 'b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f',
  GPMB: 'd393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f',
};
const REFERENCE_DATE = { DISB: '2026-10-15', REV: '2026-10-19', GPMB: '2026-10-26' };
export function isValidSourceDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Only a unique valid date in the report title, never a filename or a project deadline. */
export function dateFromReportTitle(title: string): string | undefined {
  const dates = [...title.matchAll(/(?:^|[^\d])(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g)]
    .map(m => m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'));
  const unique = [...new Set(dates)];
  return unique.length === 1 && isValidSourceDate(unique[0]) ? unique[0] : undefined;
}
export function isReferenceSource(ds: Dataset): boolean {
  return SOURCE_TYPES.some(t => ds.sourceType === t && ds.workbookSha256 === REFERENCE_SHA[t]);
}
export function hasTrustedSourceDate(ds: Dataset): boolean {
  if (!isValidSourceDate(ds.asOfDate) || ds.asOfStatus === 'REQUIRES_USER_CONFIRMATION') return false;
  if (ds.asOfStatus === 'MANUAL_CONFIRMED') return true;
  if (ds.asOfStatus !== 'DETECTED_CONFIRMED') return false;
  if (ds.sourceType === 'REV') {
    // REV semantic reader has always required an explicit cutoff or manual confirmation.
    return true;
  }
  if (ds.sourceType === 'MANUAL') return false;
  if (isReferenceSource(ds) && ds.asOfDate === REFERENCE_DATE[ds.sourceType]) return true;
  const evidence = ds.asOfDateEvidence || '';
  const verified = evidence.match(/^VERIFIED_TITLE_DATE:(\d{4}-\d{2}-\d{2})\b/);
  if (verified) return verified[1] === ds.asOfDate;
  // Legacy DISB/GPMB records sometimes marked filename/fallback dates confirmed.
  // Accept only the actual quoted A1 title, not explanatory text appended to it.
  const title = evidence.match(/!A1\s*\("([^"]*)"\)/)?.[1];
  return !!title && dateFromReportTitle(title) === ds.asOfDate;
}
export function disbScope(ds?: Dataset): 'TOTAL' | 'ALLOCATED' | 'UNKNOWN' {
  if (!ds) return 'TOTAL';
  if (ds.schemaFingerprint === 'DISB_V1' || ds.schemaFingerprint === 'DISB_TOTAL_LOCALITY_V2') return 'TOTAL';
  if (ds.schemaFingerprint === 'DISB_PHAN_CAP_XA_V1' || ds.schemaFingerprint === 'DISB_PHAN_CAP_XA_V2') return 'ALLOCATED';
  return 'UNKNOWN';
}
export function sourceEligibilityProblem(ds: Dataset): string | undefined {
  if (!ds.records?.length || !ds.unitCount) return 'Không có bản ghi địa phương';
  if (ds.sourceType === 'REV' && ds.mappingVersion === 'REV_ADAPTER_V2.2' && !isReferenceSource(ds)) return 'Cần nhập lại Excel (ánh xạ REV cũ)';
  if (ds.sourceType === 'DISB' && ds.schemaFingerprint === 'DISB_V1' && ds.unitCount === 109) return 'Cần nhập lại Excel (cấu trúc DISB cũ)';
  if (!hasTrustedSourceDate(ds)) return 'Ngày chốt chưa được xác nhận';
  const coreFields = ['adjusted_total_plan', 'disbursed_total', 'actual_total_revenue', 'annual_total_budget', 'actual_land_revenue', 'actual_nonland_revenue', 'gpmb_recorded_area', 'gpmb_declared_area'];
  if ((ds.issues || []).some(i => i.severity === 'BLOCKER' || (i.severity === 'ERROR' && (i.localityId === 'ALL' || coreFields.includes(i.fieldId))))) {
    return 'Có lỗi nghiêm trọng ở nguồn hoặc trường tính chính';
  }
  return undefined;
}
export interface LatestSourceChoice {
  type: LatestSourceType;
  dataset?: Dataset;
  skipped: Array<{dataset: Dataset; reason: string}>;
  sameDateVersions: number;
  referenceFallback: boolean;
}
export interface LatestSourcePlan {
  choices: LatestSourceChoice[];
  bindings: Partial<Record<LatestSourceType, string>>;
  complete: boolean;
}
function timestamp(value: string | undefined): number {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}
function fingerprint(ds: Dataset): string { return ds.workbookSha256 || ds.sourceHash || ds.id; }

/** Pure selector: independent per source; same DISB scope as active session.
 * No version is inferred from filename. For equal cutoffs use the first known
 * import time of distinct workbook content, not a repeat import of that content.
 */
export function chooseLatestSources(workspace: Workspace, session?: ReportSession): LatestSourcePlan {
  const activeDisb = workspace.datasets.find(d => d.id === session?.dataBindings?.DISB && d.sourceType === 'DISB');
  const requiredScope = disbScope(activeDisb);
  const bindings: LatestSourcePlan['bindings'] = {};
  const choices = SOURCE_TYPES.map((type): LatestSourceChoice => {
    const skipped: LatestSourceChoice['skipped'] = [];
    const all = workspace.datasets.filter(d => d.sourceType === type);
    const compatible = all.filter(d => {
      if (type === 'DISB' && (requiredScope === 'UNKNOWN' || disbScope(d) !== requiredScope)) {
        skipped.push({dataset: d, reason: 'Khác hoặc chưa rõ phạm vi giải ngân'});
        return false;
      }
      return true;
    });
    const real = compatible.filter(d => !isReferenceSource(d));
    const pool = real.length ? real : compatible;
    const byHash = new Map<string, Dataset[]>();
    for (const ds of pool) {
      const problem = sourceEligibilityProblem(ds);
      if (problem) { skipped.push({dataset: ds, reason: problem}); continue; }
      const key = fingerprint(ds);
      const group = byHash.get(key) || [];
      group.push(ds);
      byHash.set(key, group);
    }
    const unique: Array<{ds: Dataset; firstImport: number}> = [];
    for (const [hash, group] of byHash) {
      if (new Set(group.map(d => d.asOfDate)).size > 1) {
        for (const d of group) skipped.push({dataset:d,reason:'Cùng nội dung nhưng ngày chốt xác nhận mâu thuẫn; cần chọn thủ công'});
        continue;
      }
      // Use all registrations of the content, including equivalent session clones.
      const imports = workspace.datasets.filter(d => d.sourceType === type && fingerprint(d) === hash)
        .map(d => timestamp(d.importedAt)).filter(n => n > 0);
      const firstImport = imports.length ? Math.min(...imports) : 0;
      const ds = group.find(d => d.id === session?.dataBindings?.[type]) ||
        [...group].sort((a,b) => a.id.localeCompare(b.id))[0];
      unique.push({ds, firstImport});
    }
    unique.sort((a,b) => b.ds.asOfDate.localeCompare(a.ds.asOfDate) ||
      b.firstImport - a.firstImport || fingerprint(a.ds).localeCompare(fingerprint(b.ds)));
    const selected = unique[0]?.ds;
    if (selected) bindings[type] = selected.id;
    return {type, dataset:selected, skipped, sameDateVersions:selected ? unique.filter(x => x.ds.asOfDate === selected.asOfDate).length : 0, referenceFallback:!!selected && isReferenceSource(selected)};
  });
  return {choices, bindings, complete: SOURCE_TYPES.every(t => !!bindings[t])};
}
