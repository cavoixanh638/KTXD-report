#!/usr/bin/env python3
"""Reproducible audit for review R02. Does not modify the original Excel files.

Requires: pip install openpyxl
Usage: python tools/audit_review_round2.py --gpmb path/to/file.xlsx --disb path/to/file.xlsx --rev path/to/file.xlsx
"""
import argparse
import hashlib
import json
from pathlib import Path
from collections import Counter
from openpyxl import load_workbook


def checksum(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def num(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def audit(args):
    out = {'files': {}}
    for key in ['gpmb', 'disb', 'rev']:
        p = Path(getattr(args, key))
        out['files'][key] = {'name': p.name, 'sha256': checksum(p)}

    gp = load_workbook(args.gpmb, read_only=False, data_only=True)
    gpf = load_workbook(args.gpmb, read_only=False, data_only=False)
    sg, sf = gp['Tổng hợp theo địa bàn'], gpf['Tổng hợp theo địa bàn']
    project_rows = [r for r in range(1, sg.max_row + 1)
                    if isinstance(sg[f'A{r}'].value, int) and 1 <= sg[f'A{r}'].value <= 422]
    missing = [r for r in project_rows if num(sg[f'D{r}'].value) and sg[f'D{r}'].value > 0
               and sg[f'I{r}'].value is None]
    sumd = sum(sg[f'D{r}'].value for r in project_rows if num(sg[f'D{r}'].value))
    sumi = sum(sg[f'I{r}'].value for r in project_rows if num(sg[f'I{r}'].value))
    missing_area = sum(sg[f'D{r}'].value for r in missing)
    km_rows = [106,107,108,109]
    kmd = sum(sg[f'D{r}'].value or 0 for r in km_rows)
    kmi = sum(sg[f'I{r}'].value or 0 for r in km_rows)
    km_m = [sg[f'M{r}'].value for r in km_rows if num(sg[f'M{r}'].value)]
    out['gpmb'] = {
        'source_sheet': sg.title, 'total_project_rows': len(project_rows),
        'missing_progress_rows': missing, 'missing_progress_ids': [sg[f'A{r}'].value for r in missing],
        'missing_rows_detail': [{'row': r, 'stt': sg[f'A{r}'].value, 'D_m2': sg[f'D{r}'].value,
                                 'I': sg[f'I{r}'].value, 'J': sg[f'J{r}'].value,
                                 'K': sg[f'K{r}'].value, 'L': sg[f'L{r}'].value,
                                 'M': sg[f'M{r}'].value} for r in missing],
        'all_declared_area_m2': sumd, 'recorded_area_m2': sumi,
        'missing_project_declared_area_m2': missing_area,
        'recorded_ratio_percent': sumi / sumd * 100,
        'missing_area_share_percent': missing_area / sumd * 100,
        'king_mon': {'row': 105, 'rate_formula': sf['M105'].value,
                     'area_declared_m2': kmd, 'area_recorded_m2': kmi,
                     'recorded_ratio_percent': kmi/kmd*100,
                     'mean_of_available_project_ratios_percent': sum(km_m)/len(km_m),
                     'available_project_ratios_count': len(km_m), 'total_projects_count': len(km_rows)}
    }
    assert len(project_rows) == 422
    assert missing == [107, 173, 365], missing
    assert sumd == 55398165 and abs(sumi-39960463.6) < 1e-5
    assert missing_area == 11459
    assert abs(kmi/kmd*100-84.51347787420652)<1e-10

    disb = load_workbook(args.disb, read_only=False, data_only=True)
    sd = disb['Tổng hợp']
    disb_rows = range(13, 127)
    null_counts = {c: sum(sd[f'{c}{r}'].value is None for r in disb_rows) for c in 'GJMN'}
    any_null_rows = [r for r in disb_rows if any(sd[f'{c}{r}'].value is None for c in 'GJMN')]
    equations = {'F=G+H': ('F','G','H'), 'I=J+K': ('I','J','K'), 'I=L+M+N': ('I','L','M','N')}
    checks = {}
    for label, cols in equations.items():
        total_col, *term_cols = cols
        failures, with_missing, all_missing = [], [], []
        for r in disb_rows:
            total = sd[f'{total_col}{r}'].value
            terms = [sd[f'{c}{r}'].value for c in term_cols]
            if any(x is None for x in terms): with_missing.append(r)
            if all(x is None for x in terms): all_missing.append(r)
            if not num(total) or any((x is not None and not num(x)) for x in terms):
                failures.append({'row': r, 'reason': 'non_numeric_or_missing_total'})
            elif abs(total - sum(x for x in terms if num(x))) > 0.00001:
                failures.append({'row': r, 'reason': 'identity_mismatch'})
        checks[label] = {'failures': failures, 'rows_with_null_components': len(with_missing),
                         'rows_with_all_null_components': all_missing}
    out['disb'] = {'source_sheet': sd.title, 'locality_rows_count': len(list(disb_rows)),
                   'null_counts_by_column': null_counts, 'total_null_cells': sum(null_counts.values()),
                   'distinct_rows_with_any_null': len(any_null_rows),
                   'rows_with_no_null_in_these_columns': 114-len(any_null_rows),
                   'F_nonblank_count': sum(sd[f'F{r}'].value is not None for r in disb_rows),
                   'I_nonblank_count': sum(sd[f'I{r}'].value is not None for r in disb_rows),
                   'equations_using_zero_for_null_in_CHECK_ONLY': checks}
    assert null_counts == {'G':67, 'J':67, 'M':60, 'N':102}, null_counts
    assert sum(null_counts.values()) == 296
    assert len(any_null_rows) == 104
    assert all(not check['failures'] for check in checks.values())
    out['sheet_states'] = {
        k: [{'index': i, 'name': s.title, 'state': s.sheet_state}
            for i, s in enumerate(load_workbook(getattr(args, k), read_only=False, data_only=False).worksheets)]
        for k in ['gpmb', 'disb', 'rev']
    }
    assert [x['state'] for x in out['sheet_states']['disb']][:5] == ['hidden']*5
    assert [x['state'] for x in out['sheet_states']['rev']] == ['visible','hidden','veryHidden','veryHidden']
    out['assertions'] = {'source_counts_and_sheet_states': 'PASS', 'computation': 'PASS',
                         'note': 'A blank remains MISSING in source; treating it as additive identity for specific SUM crosschecks does not change raw state.'}
    return out

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--gpmb', required=True)
    parser.add_argument('--disb', required=True)
    parser.add_argument('--rev', required=True)
    parser.add_argument('--output')
    args = parser.parse_args()
    result = audit(args)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(rendered + '\n', encoding='utf-8')
    print(rendered)
