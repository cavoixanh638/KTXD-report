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
  totalProjectsByLocalityId: Record<string, number>;
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

export function formatProjectDeadline(raw?: string | null): string {
  if (!raw || !raw.trim()) {
    return 'Hạn tháng 11/2026';
  }
  const s = raw.trim();

  // If already matches "Hạn tháng M/YYYY" or "Hạn tháng MM/YYYY"
  if (/^hạn\s+tháng\s+\d{1,2}\/\d{4}$/i.test(s)) {
    const match = s.match(/^hạn\s+tháng\s+(\d{1,2})\/(\d{4})$/i);
    if (match) {
      const month = parseInt(match[1], 10);
      return `Hạn tháng ${month}/${match[2]}`;
    }
    return s;
  }

  // If starts with "Hạn ", strip it and re-format
  if (/^hạn\s+/i.test(s)) {
    const rest = s.replace(/^hạn\s+/i, '').trim();
    return formatProjectDeadline(rest);
  }

  // If format DD/MM/YYYY or D/M/YYYY or with dots / dashes
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];
    return `Hạn tháng ${month}/${year}`;
  }

  // If format MM/YYYY or M/YYYY
  const myMatch = s.match(/^(\d{1,2})[\/\-\.](\d{4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10);
    const year = myMatch[2];
    return `Hạn tháng ${month}/${year}`;
  }

  // If format "tháng M/YYYY" or "tháng MM/YYYY" or "tháng M năm YYYY"
  const thMatch = s.match(/tháng\s*(\d{1,2})(?:[\/\-\.\s]|(?:\s*năm\s*))(\d{4})/i);
  if (thMatch) {
    const month = parseInt(thMatch[1], 10);
    const year = thMatch[2];
    return `Hạn tháng ${month}/${year}`;
  }

  // If mentions "Trong năm 2026" or "năm 2026" or just "2026" -> "Hạn tháng 11/2026"
  if (/trong\s*năm\s*2026|năm\s*2026|^2026$/i.test(s)) {
    return 'Hạn tháng 11/2026';
  }

  // If mentions "Trong năm YYYY" or "năm YYYY"
  const yrMatch = s.match(/(?:trong\s*năm\s*|năm\s*)(\d{4})/i);
  if (yrMatch) {
    return `Hạn tháng 11/${yrMatch[1]}`;
  }

  // If any other text, prepend "Hạn "
  return `Hạn ${s}`;
}

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
  const totalProjectsByLocalityId: Record<string, number> = {};

  for (const loc of selectedLocalities) {
    projectsByLocalityId[loc.id] = [];
    totalProjectsByLocalityId[loc.id] = 0;
  }

  if (gpmbDataset && gpmbDataset.records) {
    for (const rec of gpmbDataset.records) {
      if (!selectedLocalityIds.has(rec.localityId)) continue;
      if (!rec.projectName || !rec.projectName.trim()) continue;

      const projectId =
        rec.id || `${rec.localityId}_${rec.projectStt || rec.sourceRow}`;
      const ov = overrides[projectId];

      if (ov?.isHidden) continue;

      // Count this non-hidden project towards total projects for this locality
      totalProjectsByLocalityId[rec.localityId] =
        (totalProjectsByLocalityId[rec.localityId] || 0) + 1;

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

      // Deadline text (chi tiết đến tháng)
      const deadlineText = formatProjectDeadline(deadlineRaw);

      const proj: UncompletedProject = {
        id: projectId,
        localityId: rec.localityId,
        localityName: rec.localityName,
        projectStt: rec.projectStt ?? (projects.length + 1),
        projectName:
          ov?.projectName !== undefined ? ov.projectName : rec.projectName,
        completionRate:
          ov?.completionRate !== undefined ? ov.completionRate : rateText,
        deadline:
          ov?.deadline !== undefined
            ? formatProjectDeadline(ov.deadline)
            : deadlineText,
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
    if (ov?.isHidden) continue;

    totalProjectsByLocalityId[cp.localityId] =
      (totalProjectsByLocalityId[cp.localityId] || 0) + 1;

    const proj: UncompletedProject = {
      id: cp.id,
      localityId: cp.localityId,
      localityName: cp.localityName,
      projectStt: cp.projectStt,
      projectName:
        ov?.projectName !== undefined ? ov.projectName : cp.projectName,
      completionRate:
        ov?.completionRate !== undefined ? ov.completionRate : cp.completionRate,
      deadline:
        ov?.deadline !== undefined
          ? formatProjectDeadline(ov.deadline)
          : formatProjectDeadline(cp.deadline),
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

    const total = totalProjectsByLocalityId[loc.id] || 0;
    const locProjects = projectsByLocalityId[loc.id] || [];
    const uncompleted = locProjects.length;

    if (total === 0) {
      summaryTextByLocalityId[loc.id] = 'Không có nhiệm vụ GPMB';
      projectListTextByLocalityId[loc.id] = 'Không có nhiệm vụ GPMB';
      projectListHtmlByLocalityId[loc.id] =
        '<span class="text-muted" style="font-style:italic;">Không có nhiệm vụ GPMB</span>';
      continue;
    }

    if (uncompleted === 0) {
      // All projects completed: e.g. "Hoàn thành 4/4" or "Hoàn thành 1/1"
      summaryTextByLocalityId[loc.id] = `Hoàn thành ${total}/${total}`;
      projectListTextByLocalityId[loc.id] = '-';
      projectListHtmlByLocalityId[loc.id] = '<span class="text-muted">-</span>';
    } else {
      // e.g. "2/4 dự án"
      summaryTextByLocalityId[loc.id] = `${uncompleted}/${total} dự án`;

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
      const projFontPt = session.settings.uncompletedProjectsFontSizePt;
      const fontStyle = projFontPt ? ` style="font-size: ${projFontPt}pt;"` : '';
      projectListHtmlByLocalityId[loc.id] = `<div class="uncompleted-proj-cell-list"${fontStyle}>${htmlItems.join('')}</div>`;
    }
  }

  return {
    projects,
    projectsByLocalityId,
    totalProjectsByLocalityId,
    summaryTextByLocalityId,
    projectListTextByLocalityId,
    projectListHtmlByLocalityId,
    totalUncompletedCount: projects.length,
  };
}
