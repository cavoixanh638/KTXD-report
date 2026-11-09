#!/usr/bin/env python3
"""Replicate review R01 observations from the four approved XLSX sources committed to this Private repo.

Dependencies: openpyxl.
Usage:
 python tools/audit_review_round1.py --disb '/path/Báo cáo giải ngân 15.10 sửa(1).xlsx' --gpmb '/path/PL01_Tổng hợp DA_26.12.26(1).xlsx'

This script computes independent counts, does not modify files, and does not assert
that inconsistencies are necessarily reporting errors.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from openpyxl import load_workbook


def canonical_name(s):
    return " ".join(unicodedata.normalize("NFC", str(s)).split())


def search_key(s):
    s = unicodedata.normalize("NFD", canonical_name(s).casefold())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d")


def number(v):
    return float(v) if type(v) in (float, int) else None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def analyze_disb(path):
    w = load_workbook(path, data_only=True)
    s = w['Tổng hợp']
    # Verified sheet data rows 13..126 inclusive = 114 localities
    data = [(row, s[f'B{row}'].value) for row in range(13, 127)]
    assert len(data) == 114 and all(isinstance(s[f'A{row}'].value, (int, str)) and name for row,name in data)
    notes = [row for row, _ in data if s[f'Q{row}'].value not in (None, '')]
    selected_p = [row for row, _ in data if s[f'P{row}'].value not in (None, '')]
    trailing = [(row, str(name)) for row, name in data if str(name) != str(name).strip()]
    collisions = defaultdict(list)
    for row, name in data:
        collisions[search_key(name)].append((row, canonical_name(name)))
    collisions = {k:v for k,v in collisions.items() if len(v)>1}
    out = {
      'source_sha256':sha256(path), 'localities':len(data),
      'notes_Q_localities':len(notes), 'notes_Q_rows':notes,
      'marker_P_localities':len(selected_p), 'marker_P_names':[canonical_name(s[f'B{r}'].value) for r in selected_p],
      'trailing_space_rows':trailing,
      'unaccented_name_collisions':collisions,
      'Q7_note_present':bool(s['Q7'].value),
      'Q12_note_present':bool(s['Q12'].value),
      'O18_rate_percent':round(s['O18'].value*100,4),
      'Q18_adjusted_percent_tokens':re.findall(r'\d+(?:[,.]\d+)?\s*%', str(s['Q18'].value)),
      'Q96_adjusted_percent_tokens':re.findall(r'\d+(?:[,.]\d+)?\s*%', str(s['Q96'].value)),
      'Q7_naive_percent_matches':re.findall(r'\d+(?:[,.]\d+)?\s*%', str(s['Q7'].value))
    }
    return out


def analyze_gpmb(path, tolerance_pp=0.1):
    w=load_workbook(path,data_only=True)
    s=w['Tổng hợp theo địa bàn']
    flags=defaultdict(list)
    project_rows=0
    small_diffs=0
    for row in range(3,s.max_row+1):
        if type(s[f'A{row}'].value) is not int: continue
        project_rows+=1
        v={c:number(s[f'{c}{row}'].value) for c in ['D','E','F','G','I','J','K','L','M']}
        for num,denom in [('I','D'),('J','G'),('K','E'),('L','F')]:
            if v[num] is not None and v[denom] is not None and v[num]>v[denom]:
                flags[f'{num}>{denom}'].append(row)
        if v['D'] is not None and v['D']>0 and v['I'] is not None and v['M'] is not None:
            delta=abs(v['M']-100*v['I']/v['D'])
            if delta>tolerance_pp: flags[f'M_vs_I_D_delta_gt_{tolerance_pp}pp'].append(row)
            elif delta>1e-8: small_diffs+=1
        if v['D'] is None or v['I'] is None:flags['missing_D_or_I'].append(row)
    types=[k for k in flags if k!='missing_D_or_I']
    critical_rows=set().union(*(set(flags[k]) for k in types))
    all_rows=set().union(*(set(v) for v in flags.values()))
    return {
      'source_sha256':sha256(path), 'project_rows':project_rows,
      'tolerance_delta_pp': tolerance_pp,
      'flags_by_rule':{k:len(v) for k,v in flags.items()},
      'warning_events_excluding_missing':sum(len(flags[k]) for k in types),
      'distinct_project_rows_excluding_missing':len(critical_rows),
      'events_including_missing':sum(map(len,flags.values())),
      'distinct_project_rows_including_missing':len(all_rows),
      'small_diffs_gt_1e_8_to_tolerance':small_diffs,
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--disb',type=Path,required=True)
    parser.add_argument('--gpmb',type=Path,required=True)
    parser.add_argument('--tolerance-pp',type=float,default=0.1)
    args=parser.parse_args()
    print(json.dumps({'disbursement':analyze_disb(args.disb),
                      'gpmb':analyze_gpmb(args.gpmb,args.tolerance_pp)},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
