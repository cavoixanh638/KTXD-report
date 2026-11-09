#!/usr/bin/env python3
"""R06 read-only source coverage and GPMB raw-M audit; requires openpyxl.

Usage: python tools/audit_phase_scope.py [--root .] [--out docs/data_checks/REFERENCE_COVERAGE_20261109.json]
Do not re-save the source workbooks. The 114-locality catalog comes from this fixture's DISB B13:B126, not a universal legal catalog.
"""
import argparse, hashlib, json, unicodedata
from pathlib import Path
from openpyxl import load_workbook

def norm(s):
    return ' '.join(unicodedata.normalize('NFC', str(s).strip()).split())

def numeric(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)

def sha256(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(2**20), b''):
            h.update(block)
    return h.hexdigest()

def main(root):
    meta = json.loads((root/'data/reference/MANIFEST.json').read_text(encoding='utf-8'))
    mapping = {f['id']:f for f in meta['files']}
    def src(id):
        p = root/mapping[id]['path']
        assert p.exists(), p
        assert sha256(p) == mapping[id]['sha256'], (id, 'SHA MISMATCH')
        return p
    pdisb, prev, pgp = src('DISB_20261015'), src('REV_10M_2026'), src('GPMB_20261026')
    disb = load_workbook(pdisb, data_only=True)['Tổng hợp']
    rev = load_workbook(prev, data_only=True)['10T-19.10']
    gp = load_workbook(pgp, data_only=True)['Tổng hợp theo địa bàn']
    base = {norm(disb[f'B{r}'].value):r for r in range(13,127)}
    rev_map = {norm(rev[f'B{r}'].value):r for r in range(11,124)}
    gp_map = {}
    projects = []
    current = None
    for r in range(3,gp.max_row+1):
        A, B = gp[f'A{r}'].value, gp[f'B{r}'].value
        if A is None and isinstance(B,str) and norm(B).startswith(('Xã ','Phường ','Đặc khu ')):
            current=norm(B); gp_map[current]=r
        if type(A) is int and 1<=A<=422:
            projects.append((r,A,current))
    miss_rev=sorted(set(base)-set(rev_map))
    miss_gp=sorted(set(base)-set(gp_map))
    assert len(base)==114 and len(rev_map)==113 and len(gp_map)==108
    assert miss_rev == ['Đặc khu Bạch Long Vĩ']
    assert miss_gp == ['Phường Lưu Kiếm','Phường Ái Quốc','Xã Hùng Thắng','Xã Thái Tân','Xã Tân Minh','Đặc khu Bạch Long Vĩ'] or set(miss_gp) == set(['Phường Lưu Kiếm','Phường Ái Quốc','Xã Hùng Thắng','Xã Thái Tân','Xã Tân Minh','Đặc khu Bạch Long Vĩ'])
    mismatch=[];missing=[];uncomputable=[]
    for row,stt,loc in projects:
        d,i,m=[gp[f'{col}{row}'].value for col in 'DIM']
        if i is None: missing.append({'projectId':stt,'row':row,'locality':loc,'declaredArea_m2':d,'missingCells':[f'I{row}',f'M{row}']})
        if not numeric(d) or d<=0 or not numeric(i) or not numeric(m):
            uncomputable.append({'projectId':stt,'row':row,'locality':loc,'reason':'D_NOT_POSITIVE_OR_I_M_MISSING_OR_NONNUMERIC'})
            continue
        expected=100*i/d
        diff=m-expected
        if abs(diff)>0.1+1e-9:
            mismatch.append({'projectId':stt,'row':row,'locality':loc,'sourceCells':{'declared':f'D{row}','recorded':f'I{row}','reportedPercent':f'M{row}'},'sourceM_percent':m,'recalculatedPercent':expected,'differencePercentagePoints':diff})
    assert len(projects)==422 and len(mismatch)==12
    assert [x['row'] for x in missing]==[107,173,365]
    return {
      'document':'R06 audit fixture; no webapp runtime testing','sha256':{k:mapping[k]['sha256'] for k in ['DISB_20261015','REV_10M_2026','GPMB_20261026']},
      'baselinePopulation':{'source':'DISB_20261015','count':len(base),'location':'Tổng hợp!B13:B126','note':'Fixture population only; not a universal administrative list'},
      'coverage':{
        'DISB_20261015':{'present':len(base),'missingLocalities':[]},
        'REV_10M_2026':{'present':len(rev_map),'missingLocalities':[{'name':s,'status':'NO_LOCALITY_RECORD','reason':'Không có tên địa phương trong các dòng địa phương của sheet nhập','referencePopulation':114} for s in miss_rev]},
        'GPMB_20261026':{'present':len(gp_map),'missingLocalities':[{'name':s,'status':'NO_LOCALITY_RECORD','reason':'Không có dòng nhóm địa phương trong phụ lục GPMB','referencePopulation':114} for s in miss_gp]}},
      'missingProjectRows':missing,'gpmbReportedMCheck':{'policy':'abs(M - 100*I/D) > 0.1 percentage point; project rows only','count':len(mismatch),'mismatches':mismatch,'notComparedCount':len(uncomputable),'notCompared':uncomputable},
      'claimBoundaries':['Source absent != no project','MISSING != ZERO','Area ratio uses I/D; no average-project-ratio report','This audit does not constitute webapp runtime PASS']
    }

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='.');ap.add_argument('--out',default='docs/data_checks/REFERENCE_COVERAGE_20261109.json')
    opt=ap.parse_args();root=Path(opt.root)
    x=main(root)
    out=Path(opt.out)
    if not out.is_absolute():out=root/out
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'result':'PASS_SOURCE_AUDIT_ONLY','coverageCounts':{k:len(v['missingLocalities']) for k,v in x['coverage'].items()},'gpmbMismatches':x['gpmbReportedMCheck']['count'],'output':str(out)},ensure_ascii=False))
