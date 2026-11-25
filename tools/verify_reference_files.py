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
    required = {'DISB_20261015', 'REV_10M_2026', 'GPMB_20261026', 'RESULT_REFERENCE'}
    if not required.issubset({r['id'] for r in rows}) or len({r['id'] for r in rows}) != len(rows):
        print('FAIL missing/duplicate original fixture IDs'); fail += 1
    corpus = json.loads((ROOT / 'data/reference/SOURCE_CORPUS.json').read_text(encoding='utf-8'))
    ids, hashes, listed = set(), set(), set()
    refs = {r['id']: r for r in rows}
    for sample in corpus['samples']:
        entry = refs.get(sample.get('referenceId')) if sample.get('referenceId') else sample
        if not entry or sample['id'] in ids or not sample.get('expectedColumns') or not sample.get('goldenSums'):
            print('FAIL invalid corpus metadata:', sample.get('id')); fail += 1; continue
        ids.add(sample['id'])
        if entry['sha256'] in hashes:
            print('FAIL duplicate content in corpus:', sample['id']); fail += 1; continue
        hashes.add(entry['sha256'])
        if sample.get('referenceId'):
            continue
        p = (ROOT / entry['path']).resolve()
        folder = (ROOT / 'data/reference/corpus').resolve()
        if folder not in p.parents or not p.is_file():
            print('FAIL invalid corpus path:', entry['path']); fail += 1; continue
        listed.add(p)
        blob = p.read_bytes()
        ok = (len(blob) == entry['size_bytes'] and hashlib.sha256(blob).hexdigest() == entry['sha256'] and git_blob_sha1(blob) == entry['git_blob_sha1'])
        if p.suffix.lower() == '.xlsx':
            ok = ok and zipfile.is_zipfile(p)
            if ok:
                with zipfile.ZipFile(p) as zf:
                    ok = 'xl/workbook.xml' in zf.namelist() and zf.testzip() is None
        elif p.suffix.lower() != '.csv':
            ok = False
        print(('PASS' if ok else 'FAIL'), 'corpus', sample['id'])
        if not ok: fail += 1
    if not {'DISB_20261015','REV_10M_2026','GPMB_20261026'}.issubset(ids):
        print('FAIL original source corpus incomplete'); fail += 1
    folder = ROOT / 'data/reference/corpus'
    for p in folder.rglob('*'):
        if p.is_file() and p.suffix.lower() in {'.xlsx','.csv','.xls'} and p.resolve() not in listed:
            print('FAIL unregistered corpus workbook:', p.name); fail += 1
    print(f'Corpus: {len(ids)} registered source samples; original report template checked separately.')
    return 0 if not fail else 1

if __name__ == '__main__':sys.exit(main())
