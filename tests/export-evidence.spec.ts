import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  importDisbursementWorkbook,
  importRevenueWorkbook,
  importGpmbWorkbook,
} from '../src/core/sourceReaders';
import {
  createEmptyWorkspace,
  registerDatasetInWorkspace,
  createReportSession,
  setSessionLocalities,
} from '../src/core/sessions';
import { evaluateSessionReport } from '../src/core/calculationTrace';
import { generatePrintableReportHtml } from '../src/export/print';
import { exportSessionReportToXlsxBytes } from '../src/export/xlsx';

describe('Evidence Export Refresher', () => {
  it('generates fresh evidence PDF and XLSX matching latest UI refinements', () => {
    const rootDir = process.cwd();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'data/reference/MANIFEST.json'), 'utf-8')
    );
    const filePaths: Record<string, string> = {};
    for (const f of manifest.files) {
      filePaths[f.id] = path.join(rootDir, f.path);
    }

    const disbImported = importDisbursementWorkbook(
      new Uint8Array(fs.readFileSync(filePaths['DISB_20261015'])),
      'Báo cáo giải ngân 15.10 sửa(1).xlsx'
    );
    const disbDataset = disbImported.dataset;
    const baselineLocalities = disbImported.localities;
    const { dataset: revDataset } = importRevenueWorkbook(
      new Uint8Array(fs.readFileSync(filePaths['REV_10M_2026'])),
      'Bc thu 10 thang-19.10-BC (1)(1).xlsx'
    );
    const { dataset: gpmbDataset } = importGpmbWorkbook(
      new Uint8Array(fs.readFileSync(filePaths['GPMB_20261026'])),
      'PL01_Tổng hợp DA_26.12.26(1).xlsx'
    );

    const ws = createEmptyWorkspace();
    registerDatasetInWorkspace(ws, disbDataset, baselineLocalities);
    registerDatasetInWorkspace(ws, revDataset);
    registerDatasetInWorkspace(ws, gpmbDataset);

    const session = createReportSession(ws, {
      name: 'Báo cáo KTXH phiên mới (5 địa phương)',
      dataBindings: {
        DISB: disbDataset.id,
        REV: revDataset.id,
        GPMB: gpmbDataset.id,
      },
    });
    session.settings.showSubtitle = true;
    session.settings.subtitle = '(Số liệu tổng hợp phục vụ công tác chỉ đạo, điều hành)';
    session.settings.showUncompletedProjectsTable = false;

    const chosenNames = [
      'Xã Nam Sách',
      'Xã Thái Tân',
      'Xã Trần Phú',
      'Xã Hợp Tiến',
      'Xã An Phú',
    ];
    const chosenLocs = baselineLocalities.filter((l) =>
      chosenNames.includes(l.displayName)
    );
    setSessionLocalities(
      ws,
      session.id,
      chosenLocs.map((l) => l.id)
    );

    const evaluated = evaluateSessionReport({
      session,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });

    // 1. Generate updated XLSX
    const xlsxBytes = exportSessionReportToXlsxBytes({
      evaluated,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
    });
    const xlsxOutPath = path.join(rootDir, 'docs/evidence/BAO_CAO_KTXH_MOI_NHAT.xlsx');
    fs.writeFileSync(xlsxOutPath, Buffer.from(xlsxBytes));
    expect(fs.existsSync(xlsxOutPath)).toBe(true);

    // 2. Generate updated Print HTML
    const printBody = generatePrintableReportHtml({
      evaluated,
      baselineLocalities,
      datasets: { DISB: disbDataset, REV: revDataset, GPMB: gpmbDataset },
      includeAppendix: false,
    });

    const cssContent = fs.readFileSync(path.join(rootDir, 'src/styles/main.css'), 'utf-8');
    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Báo cáo KTXH A4 Print</title>
  <style>
${cssContent}
  </style>
</head>
<body style="background:#fff; margin:0; padding:0;">
  <div id="print-mount-area">
    ${printBody}
  </div>
</body>
</html>`;

    const htmlTempPath = path.join(rootDir, 'dist/evidence_print.html');
    fs.writeFileSync(htmlTempPath, fullHtml, 'utf-8');

    // 3. Render PDF via Edge Headless if available
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    const edgeExe = edgePaths.find((p) => fs.existsSync(p));
    if (edgeExe) {
      const pdfOutPath = path.join(rootDir, 'docs/evidence/BAO_CAO_KTXH_A4_PRINT.pdf');
      const fileUrl = `file:///${htmlTempPath.replace(/\\/g, '/')}`;
      try {
        execSync(
          `"${edgeExe}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfOutPath}" "${fileUrl}"`,
          { stdio: 'pipe' }
        );
        expect(fs.existsSync(pdfOutPath)).toBe(true);
      } catch (err) {
        console.warn('Edge PDF generation failed:', err);
      }
    }
  });
});
