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
