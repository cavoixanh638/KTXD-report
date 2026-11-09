"""PH1 11-locality report gate on the original PRIVATE reference workbooks.

Creates an XLSX, a PDF, a screenshot, and JSON/Markdown summaries in a CI artifact.
NEVER copies or commits original reference workbooks. REV as-of date is a QA
placeholder and must not be represented as confirmed official data.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import unicodedata
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

from openpyxl import load_workbook
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAN = json.loads((ROOT / 'data/reference/MANIFEST.json').read_text(encoding='utf-8'))
FILES = {item['id']: ROOT / item['path'] for item in MAN['files']}
OUT = HERE / 'tmp' / 'template_11'
OUT.mkdir(parents=True, exist_ok=True)

for item in MAN['files']:
    source_path = ROOT / item['path']
    digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
    assert digest == item['sha256'], f'Original source SHA-256 failed: {item["id"]}'
print('SHA256_ORIGINAL_REFERENCE 4/4 PASS')


def nfc(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(text or ''))).strip()


def dec(value):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (float, int, Decimal)):
        return Decimal(str(value))
    if isinstance(value, str) and re.fullmatch(r'[+-]?[0-9]+(?:\.[0-9]+)?', value):
        return Decimal(value)
    return None


def percent(a, b):
    return (Decimal(100) * a / b) if a is not None and b is not None and b != 0 else None


book_ref = load_workbook(FILES['RESULT_REFERENCE'], read_only=True, data_only=True)
reference_names = [nfc(book_ref['Sheet1'].cell(row=2, column=c).value) for c in range(3, 14)]
book_ref.close()
assert len(reference_names) == 11 and len(set(reference_names)) == 11
localities = ['Xã ' + name for name in reference_names]
print('TEMPLATE_11=', json.dumps(reference_names, ensure_ascii=False))

rev_wb = load_workbook(FILES['REV_10M_2026'], read_only=True, data_only=True)
rev_sh = rev_wb['10T-19.10']
rev = {}
for i in range(11, 124):
    name = nfc(rev_sh[f'B{i}'].value)
    rev[name] = {c: dec(rev_sh[f'{c}{i}'].value) for c in ('C','D','E','F','G','H','I','R','W')}
    rev[name]['_row'] = i
assert len(rev) == 113
rev_wb.close()

disb_wb = load_workbook(FILES['DISB_20261015'], read_only=True, data_only=True)
disb_sh = disb_wb['Tổng hợp']
disb = {}
for i in range(13,127):
    name = nfc(disb_sh[f'B{i}'].value)
    disb[name] = {'F': dec(disb_sh[f'F{i}'].value), 'I': dec(disb_sh[f'I{i}'].value), '_row': i}
assert len(disb) == 114
mean = sum(x['F'] for x in disb.values()) / Decimal(114)
disb_rate = percent(sum(x['I'] for x in disb.values()), sum(x['F'] for x in disb.values()))
disb_wb.close()

gp_wb = load_workbook(FILES['GPMB_20261026'], read_only=True, data_only=True)
gp_sh = gp_wb['Tổng hợp theo địa bàn']
projects = defaultdict(list)
current = None
mismatch = []
missing_i = []
for i in range(3,533):
    a = gp_sh[f'A{i}'].value
    b = nfc(gp_sh[f'B{i}'].value)
    if (a is None or a == '') and re.match(r'^(Xã|Phường|Đặc khu)\s', b):
        current = b
        projects[current]  # retain groups even if no projects
    if current is None or not isinstance(a, (int, float)) or int(a) != a:
        continue
    row = {c: dec(gp_sh[f'{c}{i}'].value) for c in ('D','G','I','M')}
    row.update({'sourceRow': i, 'projectId': int(a), 'projectName': b})
    projects[current].append(row)
    if row['D'] is not None and row['I'] is None:
        missing_i.append({'locality': current, 'sourceRow': i, 'D': str(row['D'])})
    if row['D'] and row['I'] is not None and row['M'] is not None:
        delta = row['M'] - percent(row['I'], row['D'])
        if abs(delta) > Decimal('0.1'):
            mismatch.append({'locality': current, 'sourceRow': i, 'projectId': int(a), 'deltaPP': str(delta)})
assert len(projects) == 108
assert sum(map(len,projects.values())) == 422
assert len(mismatch) == 12 and len(missing_i) == 3
sum_d = sum((p['D'] for rows in projects.values() for p in rows if p['D'] is not None), Decimal(0))
sum_i = sum((p['I'] for rows in projects.values() for p in rows if p['I'] is not None), Decimal(0))
gp_rate = percent(sum_i, sum_d)
gp_wb.close()

assert set(localities).issubset(set(disb)), f'Localities absent from DISB: {set(localities) - set(disb)}'
missing_rev = sorted(set(disb)-set(rev))
missing_gp = sorted(set(disb)-set(projects))
assert missing_rev == ['Đặc khu Bạch Long Vĩ'], missing_rev
assert len(missing_gp) == 6, missing_gp
print('COVERAGE_CHECK DISB=114 REV=113 GPMB=108 PROJECTS=422 M_WARNING=12 I_MISSING=3 PASS')

# Independent, full-precision calculations for the 14 rows, performed from original Excel values.
expected = {}
for name in localities:
    dis, revenue, gp = disb[name], rev.get(name), projects.get(name)
    gsum = (lambda col: sum((p[col] for p in gp if p[col] is not None), Decimal(0))) if gp else None
    expected[name] = {
        3: revenue['C']/1000 if revenue and revenue['C'] is not None else None,
        4: percent(revenue['I'], revenue['C']) if revenue else None,
        5: percent(revenue['R'], revenue['D']) if revenue else None,
        6: percent(revenue['W'], revenue['E']) if revenue else None,
        7: dis['F']/1000 if dis['F'] is not None else None,
        8: percent(dis['F'], mean),
        9: disb_rate,
        10: percent(dis['I'], dis['F']),
        11: None,
        12: gsum('G')/Decimal(10**9) if gp else None,
        13: gsum('D') if gp else None,
        14: gp_rate,
        15: percent(gsum('I'),gsum('D')) if gp else None,
        16: None,
    }

result = {
    'test': 'REAL_REFERENCE_11_BROWSER_PH1',
    'source': {'workbook':'RESULT_REFERENCE','range':'Sheet1!C2:M2', 'names':reference_names},
    'localities':localities,
    'source_sha256':{i['id']:i['sha256'] for i in MAN['files']},
    'report_period':{'DISB':'2026-10-15','GPMB':'2026-10-26','REV':'TEST_DATE_2026-10-19_NOT_OFFICIALLY_CONFIRMED'},
    'quality':{'missing_REV':missing_rev,'missing_GPMB':missing_gp,'m_warning_12':mismatch,'missing_I_3':missing_i},
    'benchmarks':{'REV_113':str(percent(sum(v['I'] for v in rev.values()), sum(v['C'] for v in rev.values()))),'DISB_114':str(disb_rate),'GPMB_108_PARTIAL':str(gp_rate)},
    'status':'NOT_EXECUTED',
}

URL = (HERE.parent/'dist/index.html').resolve().as_uri()
with sync_playwright() as play:
    bopts = {'headless': True, 'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_EXECUTABLE'):
        bopts['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
    browser = play.chromium.launch(**bopts)
    page = browser.new_page(accept_downloads=True,viewport={'width':1880,'height':1100})
    errs, requests = [], []
    page.on('pageerror', lambda err: errs.append(str(err)))
    page.on('request', lambda req: requests.append(req.url))
    page.goto(URL,wait_until='load',timeout=60000)
    assert page.url.startswith('file:///'), page.url
    page.get_by_role('button',name='+ Tạo báo cáo').click()
    assert '0 đã chọn' in page.locator('#main').inner_text()
    page.get_by_role('button',name='02 Nguồn dữ liệu').click()
    sources=[('DISB_20261015','DISB','2026-10-15','Đối chiếu tiêu đề A1'),('REV_10M_2026','REV','2026-10-19','NGÀY GIẢ ĐỊNH CHO QA, CHƯA CÓ XÁC NHẬN NGÀY CHỐT CHÍNH THỨC'),('GPMB_20261026','GPMB','2026-10-26','Đối chiếu tiêu đề A1')]
    for fileid,typ,date,why in sources:
        page.locator('#source-type').select_option(typ)
        page.locator('#source-file').set_input_files(str(FILES[fileid]))
        page.locator('#source-date').fill(date)
        page.locator('#source-reason').fill(why)
        before=page.locator('.data-item').count()
        page.locator('#import-btn').click()
        page.wait_for_function("n => document.querySelectorAll('.data-item').length > n || document.querySelector('#toast')?.textContent?.startsWith('Không thể nhập')",arg=before,timeout=60000)
        feedback=page.locator('#toast').inner_text()
        print('SOURCE_IMPORT',typ,feedback)
        assert 'Nhập thành công' in feedback, feedback
    assert '12 cảnh báo' in page.locator('#main').inner_text(), 'App must flag 12 project M mismatches'
    page.get_by_role('button',name='03 Bảng tổng hợp').click()
    rendered_names=[nfc(x) for x in page.locator('.locality-item').all_text_contents()]
    for name in localities:
        matches=[i for i,item in enumerate(rendered_names) if item==name]
        assert len(matches)==1, f'{name}: expected 1 checkbox, got {matches}'
        page.locator('.locality-item').nth(matches[0]).locator('input').check()
        assert page.locator('.report-grid tbody tr').count()==14
    assert page.locator('.report-grid tbody tr').first.locator('button.result-cell').count()==11
    displayed=[]
    for ridx in range(14):
        tr=page.locator('.report-grid tbody tr').nth(ridx)
        vals=tr.locator('button.result-cell').evaluate_all('els=>els.map(x=>x.childNodes[0]?.textContent?.trim()||"")')
        assert len(vals)==11
        displayed.append(vals)
    page.screenshot(path=str(OUT/'browser_11_xa.png'),full_page=True)
    page.locator('.report-grid tbody tr').nth(12).locator('button.result-cell').first.click()
    assert page.locator('#inspector').is_visible()
    assert 'Hồ sơ phép tính' in page.locator('#inspector').inner_text()
    page.locator('#inspector .close').click()
    with page.expect_download(timeout=60000) as dl:
        page.get_by_role('button',name='Xuất Excel có truy vết').click()
    dl.value.save_as(OUT/'KTXH_PH1_11_xa.xlsx')
    workbook=load_workbook(OUT/'KTXH_PH1_11_xa.xlsx',read_only=True,data_only=True)
    assert len(workbook.sheetnames)==8, workbook.sheetnames
    assert [nfc(workbook['Báo cáo'].cell(4,c).value) for c in range(3,14)]==localities
    bad=[];table=[]
    for i,rowno in enumerate(range(3,17)):
        vals=[]
        for j,name in enumerate(localities):
            val=workbook['Báo cáo'].cell(i+5,j+3).value
            exp=expected[name][rowno]
            if exp is not None:
                # Percentage numeric in Excel is stored as fraction 0..1, not 0..100.
                actual=dec(val)
                if actual is None:bad.append((rowno,name,'EXPECTED_NUMERIC',str(exp),repr(val)))
                else:
                    actual=actual*100 if rowno in (4,5,6,8,9,10,14,15) else actual
                    if abs(actual-exp)>Decimal('0.000001'):
                        bad.append((rowno,name,'MISMATCH',str(exp),str(actual)))
            vals.append({'text':displayed[i][j], 'excel':val})
        table.append({'row':rowno,'metric':nfc(workbook['Báo cáo'].cell(i+5,2).value), 'values':vals})
    workbook.close()
    result['table']=table
    assert not bad, f'INDEPENDENT_CALC_MISMATCH count={len(bad)} examples={bad[:8]}'
    print('INDEPENDENT_DECIMAL_COMPARE PASS, 11 x 12 numeric cells (excluding text assessment rows)')
    # Save as PDF through Chrome print, still entirely offline.
    page.pdf(path=str(OUT/'KTXH_PH1_11_xa.pdf'),format='A3',landscape=True,print_background=True)
    assert (OUT/'KTXH_PH1_11_xa.pdf').stat().st_size>8000
    assert not errs, errs
    assert not [req for req in requests if req.startswith(('http:','https:','ws:','wss:'))], requests
    browser.close()

result['status']='PASS_REAL_WORKBOOK_BROWSER_QA__REV_ASOF_UNVERIFIED'
(OUT/'report_11_summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
# Markdown is easy to read directly in the GitHub Actions job output.
lines=[
    '# Chạy thử PH1 — 11 xã của file Kết quả Tổng hợp',
    '',
    'Trích trực tiếp 11 xã từ Sheet1!C2:M2, nạp 3 workbook gốc SHA PASS. Ngày chốt REV 19/10/2026 chỉ là giả định cho QA, CHƯA được xác nhận.',
    '',
    '| Dòng / Chỉ tiêu | ' + ' | '.join(reference_names) + ' |',
    '|' + '|'.join(['---']*(12)) + '|',
]
for row in table:
    def safe(s):return str(s).replace('|','/').replace('\n','; ')
    lines.append('| '+safe(str(row['row'])+' · '+row['metric'])+' | '+' | '.join(safe(v['text']) for v in row['values'])+' |')
lines += ['', '## Mốc tổng/tổng', '','REV 113: '+str(result['benchmarks']['REV_113'])+'%; DISB 114: '+str(result['benchmarks']['DISB_114'])+'%; GPMB 108 PARTIAL: '+str(result['benchmarks']['GPMB_108_PARTIAL'])+'%.','',f"Cảnh báo M nguồn: {len(mismatch)}; dự án thiếu I: {len(missing_i)}; nguồn thu thiếu {', '.join(missing_rev)}; GPMB thiếu {', '.join(missing_gp)}.",'',f"**Trạng thái:** {result['status']}"]
report_md='\n'.join(lines)+'\n'
(OUT/'REPORT_11.md').write_text(report_md,encoding='utf-8')
print('\n===== REAL PH1 RESULT TABLE START =====\n'+report_md+'\n===== REAL PH1 RESULT TABLE END =====')
print('RESULT_FILES=', sorted(p.name for p in OUT.iterdir()))
