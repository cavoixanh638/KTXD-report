#!/usr/bin/env python3
"""Read-only verification of selected numeric acceptance fixtures for MASTER V2.2 (facts unchanged from V2).

Usage: python tools/verify_final_spec_baseline.py --disb file.xlsx --rev file.xlsx --gpmb file.xlsx
No workbook is edited. Only the four user-authorized reference XLSX files are committed to the Private repo; do not add others.
"""
import argparse
import hashlib
import json
from pathlib import Path
from openpyxl import load_workbook


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def number(x):
    return isinstance(x, (float,int)) and not isinstance(x,bool)

def sumn(s, col, start, end):
    return sum(s[f'{col}{r}'].value for r in range(start,end+1)
               if number(s[f'{col}{r}'].value))

def verify(args):
    wdisb=load_workbook(args.disb,data_only=True,read_only=False)
    wd=wdisb['Tổng hợp']
    f=sumn(wd,'F',13,126)
    i=sumn(wd,'I',13,126)
    wrev=load_workbook(args.rev,data_only=True,read_only=False)
    wr=wrev['10T-19.10']
    revc=sumn(wr,'C',11,123)
    revi=sumn(wr,'I',11,123)
    wgp=load_workbook(args.gpmb,data_only=True,read_only=False)
    wg=wgp['Tổng hợp theo địa bàn']
    rows=[r for r in range(3,wg.max_row+1) if type(wg[f'A{r}'].value) is int]
    d=sum(wg[f'D{r}'].value for r in rows if number(wg[f'D{r}'].value))
    gi=sum(wg[f'I{r}'].value for r in rows if number(wg[f'I{r}'].value))
    miss=[r for r in rows if wg[f'I{r}'].value is None]
    out={
        'source_sha256': {'DISB':sha(args.disb),'REV':sha(args.rev),'GPMB':sha(args.gpmb)},
        'acceptance_numeric': {
            'T01': {'localities':114,'planned_million':f,'disbursed_million':i,'rate_percent':i/f*100},
            'T03': {'localities':113,'budget_million':revc,'realized_million':revi,'rate_percent':revi/revc*100},
            'T04_T34': {'project_rows':len(rows),'declared_m2':d,'recorded_m2':gi,
                        'recorded_rate_percent':gi/d*100,'missing_i_rows':miss}
        }
    }
    assert len(rows)==422 and miss==[107,173,365]
    assert abs(f-15550923.159)<0.1 and abs(i-10434921.777)<0.1
    assert abs(revc-25651713)<1 and abs(revi-28550929.455)<0.1
    assert abs(d-55398165)<1 and abs(gi-39960463.6)<0.01
    return out

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for arg in ['disb','rev','gpmb']:p.add_argument('--'+arg,required=True)
    p.add_argument('--output')
    args=p.parse_args()
    x=verify(args)
    print(json.dumps(x,ensure_ascii=False,indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
