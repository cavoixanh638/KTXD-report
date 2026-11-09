import { sha256Hex } from '../core/decimal';
import { Workspace } from '../core/types';

function computeWorkspaceChecksum(ws: Omit<Workspace, 'checksum'>): string {
  const canonicalPayload = JSON.stringify({
    formatVersion: ws.formatVersion,
    schemaVersion: ws.schemaVersion,
    name: ws.name,
    localities: ws.localities,
    datasets: ws.datasets,
    sessions: ws.sessions,
  });
  return sha256Hex(canonicalPayload);
}

export function exportWorkspaceBackupJson(workspace: Workspace): string {
  const copy: Workspace = JSON.parse(JSON.stringify(workspace));
  copy.unsavedChanges = false;
  delete copy.checksum;
  const checksum = computeWorkspaceChecksum(copy);
  copy.checksum = checksum;
  workspace.unsavedChanges = false;
  workspace.checksum = checksum;
  return JSON.stringify(copy, null, 2);
}

export function restoreWorkspaceFromBackupJson(
  jsonString: string,
  currentWorkspace?: Workspace,
  confirmedOverwrite = true
): Workspace {
  if (currentWorkspace && currentWorkspace.sessions.length > 0 && !confirmedOverwrite) {
    throw new Error(
      'CONFIRMATION_REQUIRED: Ghi đè bộ hồ sơ đang mở yêu cầu người dùng xác nhận.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('INVALID_BACKUP_JSON: Tệp sao lưu không phải JSON hợp lệ.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('INVALID_BACKUP_SCHEMA: Cấu trúc tệp sao lưu không hợp lệ.');
  }

  const candidate = parsed as Partial<Workspace>;
  if (
    candidate.formatVersion !== 2 ||
    !Array.isArray(candidate.localities) ||
    !Array.isArray(candidate.datasets) ||
    !Array.isArray(candidate.sessions) ||
    typeof candidate.checksum !== 'string'
  ) {
    throw new Error(
      'INVALID_BACKUP_SCHEMA: Phiên bản schema hoặc các trường bắt buộc (localities, datasets, sessions, checksum) không hợp lệ.'
    );
  }

  // Verify R06 rule: no session may use project average GPMB method
  for (const sess of candidate.sessions) {
    if (!sess.settings || sess.settings.gpmbDefaultMethod !== 'AREA_WEIGHTED') {
      throw new Error(
        'INVALID_BACKUP_POLICY: Tệp sao lưu chứa cấu hình GPMB không hợp lệ với chuẩn R06 (chỉ cho phép AREA_WEIGHTED).'
      );
    }
  }

  const providedChecksum = candidate.checksum;
  const copyWithoutChecksum = { ...candidate } as Omit<Workspace, 'checksum'> & {
    checksum?: string;
  };
  delete copyWithoutChecksum.checksum;

  const expectedChecksum = computeWorkspaceChecksum(copyWithoutChecksum as Omit<Workspace, 'checksum'>);
  if (providedChecksum !== expectedChecksum) {
    throw new Error(
      `BACKUP_CHECKSUM_MISMATCH: Mã kiểm tra toàn vẹn (checksum) không khớp (nhận ${providedChecksum.slice(
        0,
        12
      )}, kỳ vọng ${expectedChecksum.slice(0, 12)}). Từ chối khôi phục để bảo vệ dữ liệu.`
    );
  }

  const restored = candidate as Workspace;
  restored.unsavedChanges = false;
  return restored;
}
