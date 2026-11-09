#!/usr/bin/env python3
"""Verify the 4 exact original Excel files committed for offline KTXH AI work.

Run: python tools/verify_reference_files.py
Checks path existence, SHA-256, Git blob SHA-1 and ZIP/XLSX structure.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/reference/MANIFEST.json'

def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1((f'blob {len(data)}\0').encode('ascii') + data).hexdigest()

def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    rows = manifest['files']
    fail = 0
    for row in rows:
        path = ROOT / row['path']
        if not path.is_file():
            print('FAIL missing:', row['path']); fail += 1; continue
        blob = path.read_bytes()
        checks = {
            'bytes': len(blob) == row['size_bytes'],
            'sha256': hashlib.sha256(blob).hexdigest() == row['sha256'],
            'git_blob_sha1': git_blob_sha1(blob) == row['git_blob_sha1'],
            'xlsx_zip': zipfile.is_zipfile(path),
        }
        if checks['xlsx_zip']:
            with zipfile.ZipFile(path) as zf:
                checks['excel_workbook'] = 'xl/workbook.xml' in zf.namelist()
                checks['zip_integrity'] = zf.testzip() is None
        ok = all(checks.values())
        print(('PASS' if ok else 'FAIL'),row['id'],row['path'],checks)
        if not ok:fail += 1
    print(f'{len(rows)-fail}/{len(rows)} source workbooks PASS')
    return 0 if not fail and len(rows)==4 else 1

if __name__ == '__main__':sys.exit(main())
