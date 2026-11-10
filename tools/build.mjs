import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'data', 'reference', 'MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const fileMap = {};
for (const entry of manifest.files) {
  fileMap[entry.id] = path.join(rootDir, entry.path);
}

const disbB64 = fs.readFileSync(fileMap['DISB_20261015']).toString('base64');
const revB64 = fs.readFileSync(fileMap['REV_10M_2026']).toString('base64');
const gpmbB64 = fs.readFileSync(fileMap['GPMB_20261026']).toString('base64');

const cssPath = path.join(rootDir, 'src', 'styles', 'main.css');
const cssContent = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, 'utf-8')
  : '';

const buildResult = await esbuild.build({
  entryPoints: [path.join(rootDir, 'src', 'app', 'main.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  write: false,
  minify: false,
});

const jsBundle = buildResult.outputFiles[0].text;

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none';" />
  <title>KTXH Offline Report — Báo cáo KTXH Xã/Phường/Đặc khu (MASTER V2.2)</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div id="app">Đang khởi tạo ứng dụng KTXH Offline...</div>
  <script>
    (function () {
      var bootErrs = [];
      window.__KTXH_BOOT_ERRORS__ = bootErrs;
      window.addEventListener('error', function (ev) {
        bootErrs.push('Error: ' + (ev.message || ev.error));
      });
      window.addEventListener('unhandledrejection', function (ev) {
        var r = ev.reason;
        bootErrs.push('PromiseRejection: ' + (r && (r.stack || r.message) ? (r.stack || r.message) : String(r)));
      });
      window.setTimeout(function () {
        var root = document.getElementById('app');
        if (!root || window.__KTXH_APP__ && root.querySelector('.studio-app-shell')) return;
        if (root.textContent && root.textContent.indexOf('Đang khởi tạo ứng dụng KTXH Offline') !== -1) {
          var errText = bootErrs.length ? bootErrs.join('\\n') : 'Trình duyệt mất quá 5 giây chưa render giao diện (có thể do cache cũ hoặc file đang đồng bộ chưa xong).';
          root.innerHTML = '<div style="max-width:720px;margin:32px auto;padding:24px;border:1px solid #fca5a5;border-radius:10px;background:#fef2f2;color:#7f1d1d;font-family:system-ui,sans-serif;">' +
            '<h3 style="margin:0 0 10px 0;">⚠️ Không thể khởi tạo màn hình ứng dụng</h3>' +
            '<pre id="ktxh-boot-err-pre" style="white-space:pre-wrap;background:#fff;padding:10px;border:1px solid #fecaca;border-radius:6px;font-size:12px;"></pre>' +
            '<button type="button" id="btn-boot-reset-cache" style="margin-top:12px;padding:8px 16px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🔄 Xóa cache cũ &amp; Khởi động lại</button>' +
            '</div>';
          var pre = document.getElementById('ktxh-boot-err-pre');
          if (pre) pre.textContent = errText;
          var btn = document.getElementById('btn-boot-reset-cache');
          if (btn) btn.addEventListener('click', function () {
            try { localStorage.removeItem('KTXH_OFFLINE_WORKSPACE_CACHE_V2_2'); localStorage.removeItem('KTXH_OFFLINE_SESSIONS_COMPACT_V2_2'); } catch (e) {}
            try { indexedDB.deleteDatabase('KTXH_OFFLINE_STUDIO_DB'); } catch (e) {}
            window.location.reload();
          });
        }
      }, 5000);
    })();
  </script>
  <script>
    window.__EMBEDDED_REFERENCE_FIXTURES__ = {
      DISB_B64: "${disbB64}",
      REV_B64: "${revB64}",
      GPMB_B64: "${gpmbB64}"
    };
  </script>
  <script>
${jsBundle}
  </script>
</body>
</html>
`;

const distDir = path.join(rootDir, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const outFile = path.join(distDir, 'index.html');
fs.writeFileSync(outFile, html, 'utf-8');
console.log(
  `Built standalone offline bundle: ${outFile} (${(
    fs.statSync(outFile).size / 1024
  ).toFixed(1)} KB)`
);
