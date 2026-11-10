import { Dataset, Locality, ReportSession } from './types';

export interface UncompletedProject {
  id: string;
  localityId: string;
  localityName: string;
  projectStt: number | string;
  projectName: string;
  completionRate: string;
  deadline: string;
  isCustom?: boolean;
  isHidden?: boolean;
}

export interface ProjectOverride {
  projectName?: string;
  completionRate?: string;
  deadline?: string;
  isHidden?: boolean;
}

export interface UncompletedProjectsResult {
  projects: UncompletedProject[];
  projectsByLocalityId: Record<string, UncompletedProject[]>;
  summaryTextByLocalityId: Record<string, string>;
  projectListTextByLocalityId: Record<string, string>;
  projectListHtmlByLocalityId: Record<string, string>;
  totalUncompletedCount: number;
}

export const GPMB_NO_RECORD_COMMUNES = [
  'Phường Lưu Kiếm',
  'Phường Ái Quốc',
  'Xã Hùng Thắng',
  'Xã Thái Tân',
  'Xã Tân Minh',
  'Đặc khu Bạch Long Vĩ',
];

export function getUncompletedProjectsForSession(params: {
  session: ReportSession;
  gpmbDataset?: Dataset;
  baselineLocalities: Locality[];
}): UncompletedProjectsResult {
  const { session, gpmbDataset, baselineLocalities } = params;
  const selectedLocalityIds = new Set(session.selectedLocalityIds);
  const selectedLocalities = baselineLocalities.filter((l) =>
    selectedLocalityIds.has(l.id)
  );

  const overrides = session.settings.projectOverrides || {};
  const customProjects = session.settings.customProjects || [];

  const projects: UncompletedProject[] = [];
  const projectsByLocalityId: Record<string, UncompletedProject[]> = {};

  for (const loc of selectedLocalities) {
    projectsByLocalityId[loc.id] = [];
  }

  if (gpmbDataset && gpmbDataset.records) {
    for (const rec of gpmbDataset.records) {
      if (!selectedLocalityIds.has(rec.localityId)) continue;
      if (!rec.projectName || !rec.projectName.trim()) continue;

      const declaredRaw = rec.metrics['gpmb_declared_area']?.normalizedValue;
      const recordedRaw = rec.metrics['gpmb_recorded_area']?.normalizedValue;
      const rateRaw = rec.metrics['gpmb_source_reported_rate']?.normalizedValue;
      const deadlineRaw = rec.metrics['gpmb_deadline']?.normalizedValue;

      const dNum = declaredRaw ? parseFloat(declaredRaw) : 0;
      const iNum = recordedRaw ? parseFloat(recordedRaw) : 0;
      const mNum = rateRaw ? parseFloat(rateRaw) : null;

      // Uncompleted criterion:
      // If declared > 0, uncompleted if recorded < declared (or rate < 100 or missing I)
      let isUncompleted = false;
      if (dNum > 0) {
        if (
          iNum < dNum ||
          (mNum !== null && mNum < 100) ||
          recordedRaw === null ||
          recordedRaw === ''
        ) {
          isUncompleted = true;
        }
      } else if (mNum !== null && mNum < 100) {
        isUncompleted = true;
      }

      if (!isUncompleted) continue;

      // Rate text
      let rateText = '';
      if (mNum !== null) {
        rateText = `${mNum.toFixed(2).replace('.', ',')}%`;
      } else if (dNum > 0) {
        rateText = `${((100 * iNum) / dNum).toFixed(2).replace('.', ',')}%`;
      } else {
        rateText = '0,00%';
      }

      // Deadline text
      let deadlineText =
        deadlineRaw && deadlineRaw.trim() ? deadlineRaw.trim() : 'Trong năm 2026';

      const projectId =
        rec.id || `${rec.localityId}_${rec.projectStt || rec.sourceRow}`;
      const ov = overrides[projectId];

      if (ov?.isHidden) continue;

      const proj: UncompletedProject = {
        id: projectId,
        localityId: rec.localityId,
        localityName: rec.localityName,
        projectStt: rec.projectStt ?? (projects.length + 1),
        projectName:
          ov?.projectName !== undefined ? ov.projectName : rec.projectName,
        completionRate:
          ov?.completionRate !== undefined ? ov.completionRate : rateText,
        deadline: ov?.deadline !== undefined ? ov.deadline : deadlineText,
        isCustom: false,
      };

      projects.push(proj);
      if (projectsByLocalityId[rec.localityId]) {
        projectsByLocalityId[rec.localityId].push(proj);
      }
    }
  }

  // Include user's custom projects
  for (const cp of customProjects) {
    if (!selectedLocalityIds.has(cp.localityId)) continue;
    if (cp.isHidden) continue;
    const ov = overrides[cp.id];
    const proj: UncompletedProject = {
      id: cp.id,
      localityId: cp.localityId,
      localityName: cp.localityName,
      projectStt: cp.projectStt,
      projectName:
        ov?.projectName !== undefined ? ov.projectName : cp.projectName,
      completionRate:
        ov?.completionRate !== undefined ? ov.completionRate : cp.completionRate,
      deadline: ov?.deadline !== undefined ? ov.deadline : cp.deadline,
      isCustom: true,
    };
    projects.push(proj);
    if (projectsByLocalityId[cp.localityId]) {
      projectsByLocalityId[cp.localityId].push(proj);
    }
  }

  // Summary and project detail lists per locality
  const summaryTextByLocalityId: Record<string, string> = {};
  const projectListTextByLocalityId: Record<string, string> = {};
  const projectListHtmlByLocalityId: Record<string, string> = {};

  const escapeXml = (str: string) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  for (const loc of selectedLocalities) {
    // Check manual override for this locality
    const manualOv = session.overrides?.find(
      (o) =>
        o.indicatorId === 'GPMB_UNCOMPLETED_PROJECTS_COUNT' &&
        o.localityId === loc.id
    );
    if (manualOv && manualOv.overrideValue) {
      summaryTextByLocalityId[loc.id] = manualOv.overrideValue;
      projectListTextByLocalityId[loc.id] = manualOv.overrideValue;
      projectListHtmlByLocalityId[loc.id] = escapeXml(manualOv.overrideValue);
      continue;
    }

    if (
      GPMB_NO_RECORD_COMMUNES.includes(loc.displayName) ||
      GPMB_NO_RECORD_COMMUNES.includes(loc.canonicalNameNFC)
    ) {
      summaryTextByLocalityId[loc.id] = 'Không có nhiệm vụ GPMB';
      projectListTextByLocalityId[loc.id] = 'Không có nhiệm vụ GPMB';
      projectListHtmlByLocalityId[loc.id] =
        '<span class="text-muted" style="font-style:italic;">Không có nhiệm vụ GPMB</span>';
      continue;
    }

    const locProjects = projectsByLocalityId[loc.id] || [];
    if (locProjects.length === 0) {
      summaryTextByLocalityId[loc.id] = 'Đã hoàn thành';
      projectListTextByLocalityId[loc.id] = '-';
      projectListHtmlByLocalityId[loc.id] = '<span class="text-muted">-</span>';
    } else {
      summaryTextByLocalityId[loc.id] = `${locProjects.length} dự án`;

      // Text format for Excel / plain views:
      // Tên dự án - Tỷ lệ hoàn thành - Hạn hoàn thành
      const textLines = locProjects.map((p, idx) => {
        const prefix = locProjects.length > 1 ? `${idx + 1}. ` : '';
        return `${prefix}${p.projectName} - ${p.completionRate} - ${p.deadline}`;
      });
      projectListTextByLocalityId[loc.id] = textLines.join('\n');

      // HTML format for Web & Print:
      const htmlItems = locProjects.map((p, idx) => {
        const prefix =
          locProjects.length > 1
            ? `<span class="proj-idx" style="font-weight:600;">${idx + 1}.</span> `
            : '';
        return `<div class="uncompleted-proj-inline-item">
          <span class="proj-inline-text">${prefix}${escapeXml(
          p.projectName
        )} - <strong style="color:#0f172a;">${escapeXml(
          p.completionRate
        )}</strong> - ${escapeXml(p.deadline)}</span>
          <button type="button" class="btn-action-edit-proj inline-item-edit-btn no-print" data-project-id="${escapeXml(
            p.id
          )}" title="Sửa dự án này">✎</button>
        </div>`;
      });
      projectListHtmlByLocalityId[loc.id] = `<div class="uncompleted-proj-cell-list">${htmlItems.join('')}</div>`;
    }
  }

  return {
    projects,
    projectsByLocalityId,
    summaryTextByLocalityId,
    projectListTextByLocalityId,
    projectListHtmlByLocalityId,
    totalUncompletedCount: projects.length,
  };
}
