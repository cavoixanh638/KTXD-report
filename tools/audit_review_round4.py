#!/usr/bin/env python3
"""Read-only source audit for R04; requires openpyxl and user-provided REV workbook.
Usage: python tools/audit_review_round4.py --rev path/to/revenue.xlsx
Never edits or uploads the source workbook.
"""
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from openpyxl import load_workbook
import argparse,json

def num(v):
    if isinstance(v, bool) or v is None or not isinstance(v,(int,float,Decimal)):
        raise ValueError('Expected a valid numeric source cell: '+repr(v))
    return Decimal(str(v))

def audit(path):
    b=load_workbook(path,data_only=True)
    f=load_workbook(path,data_only=False)
    w=b['10T-19.10']; wf=f['10T-19.10']
    rows=list(range(11,124))
    assert len(rows)==113 and all(isinstance(w[f'B{i}'].value,str) for i in rows)
    d={i:num(w[f'D{i}'].value) for i in rows};g={i:num(w[f'G{i}'].value) for i in rows};r={i:num(w[f'R{i}'].value) for i in rows}
    y=[i for i in rows if d[i]==0 and r[i]>0]
    p=[i for i in rows if g[i]==0 and r[i]>0]
    sy=sum(r.values());sd=sum(d.values());sg=sum(g.values());
    assert y==[15,26,42,57,114] and p==[15,26,28,42,57,114]
    assert sum(r[i] for i in y)==Decimal('269290') and sum(r[i] for i in p)==Decimal('304790')
    assert sd==Decimal('7182893') and sg==Decimal('4823476')
    assert abs(sy-Decimal('9777655.455'))<Decimal('0.000000001')
    assert wf['Y10'].value=='=R10/D10' and wf['AB10'].value=='=IFERROR(R10/G10,"")'
    result={'workbook_sha256':sha256(Path(path).read_bytes()).hexdigest(), 'rows':len(rows),
        'annual':{'zero_denominator_row_ids':y,'zero_denominator_actual_million':str(sum(r[i] for i in y)),
                  'actual_million':str(sy),'budget_million':str(sd),'true_percent':str(sy/sd*100),
                  'incorrect_excluding_zero_percent':str((sy-sum(r[i] for i in y))/sd*100)},
        'period':{'zero_denominator_row_ids':p,'zero_denominator_actual_million':str(sum(r[i] for i in p)),
                  'actual_million':str(sy),'plan_million':str(sg),'true_percent':str(sy/sg*100),
                  'incorrect_excluding_zero_percent':str((sy-sum(r[i] for i in p))/sg*100)},
        'source_total_cells':{'D10':str(w['D10'].value),'G10':str(w['G10'].value),'R10':str(w['R10'].value)},
        'result':'PASS_SOURCE_AUDIT_NOT_RUNTIME_TEST'}
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rev',required=True);p.add_argument('--output')
    a=p.parse_args();res=audit(a.rev)
    txt=json.dumps(res,ensure_ascii=False,indent=2)+'\n'
    print(txt)
    if a.output: Path(a.output).write_text(txt,encoding='utf-8')
