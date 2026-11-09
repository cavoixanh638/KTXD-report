"""Document Studio end-to-end smoke with immutable original workbooks.
REV as-of date is a QA assumption, never an officially verified fact.
"""
from __future__ import annotations
import hashlib,json,os
from pathlib import Path
from openpyxl import load_workbook
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
manifest=json.loads((ROOT/'data/reference/MANIFEST.json').read_text(encoding='utf-8'))
files={d['id']:ROOT/d['path'] for d in manifest['files']}
for d in manifest['files']:
 assert hashlib.sha256(files[d['id']].read_bytes()).hexdigest()==d['sha256']
OUT=HERE/'tmp'/'studio'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(accept_downloads=True,viewport={'width':1760,'height':1080})
 errors=[];external=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:','ws:','wss:')) else None)
 page.goto((HERE.parent/'dist/index.html').resolve().as_uri(),wait_until='load')
 assert page.url.startswith('file://')
 page.locator('[data-action="new"]').first.click()
 assert page.locator('.locality-item input:checked').count()==0
 page.locator('[data-action="nav"][data-tab="sources"]').click()
 page.locator('#source-files').set_input_files([str(files[x]) for x in ['GPMB_20261026','REV_10M_2026','DISB_20261015']])
 page.wait_for_function("document.querySelectorAll('.source-review .source-item').length===3",timeout=90000)
 assert page.locator('[data-pending-date]').count()==3
 entries=page.locator('[data-pending-date]').count()
 dates=['2026-10-26','2026-10-19','2026-10-15']
 for i in range(entries):
  page.locator(f'[data-pending-date="{i}"]').fill(dates[i])
  page.locator(f'[data-pending-reason="{i}"]').fill('QA: kiểm tra giao diện và nguồn; REV chưa xác minh ngày chốt chính thức' if i==1 else 'Xác nhận từ tiêu đề A1')
 page.locator('[data-action="commit-sources"]').click()
 page.wait_for_function("document.querySelectorAll('.source-review .source-item').length===3 && document.querySelector('#toast')?.textContent?.includes('Nhập 3')",timeout=120000)
 page.locator('[data-action="nav"][data-tab="report"]').click()
 assert page.locator('.locality-item').count()==114
 for name in ['Xã Hồng Châu','Xã Khúc Thừa Dụ','Xã Vĩnh Lại','Xã Chí Minh','Xã Đại Sơn']:
  row=page.locator('.locality-item').filter(has_text=name)
  assert row.count()==1,(name,row.count())
  row.locator('input').check()
 assert page.locator('.doc-cell').count()>=14*5
 assert page.locator('.paper-sheet').count()>=1
 page.locator('#studio-mode').select_option('vertical')
 assert page.locator('.doc-table.vertical').count()>0
 page.locator('#studio-mode').select_option('horizontal')
 assert page.locator('.doc-table.vertical').count()==0
 page.locator('.doc-cell').first.click()
 assert page.locator('#inspector').is_visible()
 assert 'Trace ID' in page.locator('#inspector').inner_text()
 page.locator('[data-action="close-inspect"]').first.click()
 page.screenshot(path=str(OUT/'studio_five_horizontal.png'),full_page=True)
 page.pdf(path=str(OUT/'studio_five_horizontal.pdf'),format='A4',landscape=True,print_background=True)
 assert (OUT/'studio_five_horizontal.pdf').stat().st_size>8000
 page.locator('#studio-mode').select_option('vertical')
 page.screenshot(path=str(OUT/'studio_five_vertical.png'),full_page=True)
 with page.expect_download(timeout=60000) as dl:
  page.get_by_role('button',name='Xuất Excel').click()
 dl.value.save_as(OUT/'studio_five_vertical.xlsx')
 wb=load_workbook(OUT/'studio_five_vertical.xlsx',read_only=True,data_only=True)
 assert len(wb.sheetnames)==8,wb.sheetnames
 assert wb['Báo cáo']['A4'].value=='Địa phương'
 assert wb['Báo cáo']['B5'].data_type=='n'
 wb.close()
 page.locator('[data-action="nav"][data-tab="sessions"]').click()
 page.locator('[data-action="copy-session"]').first.click()
 assert page.locator('.locality-item input:checked').count()==5
 page.locator('[data-action="nav"][data-tab="sessions"]').click()
 assert page.locator('.session-card').count()==2
 page.locator('[data-action="new"]').first.click()
 assert page.locator('.locality-item input:checked').count()==0
 page.screenshot(path=str(OUT/'studio_empty_new_session.png'),full_page=True)
 page.wait_for_function("document.querySelector('#studio-save')?.textContent?.includes('Đã tự lưu')",timeout=20000)
 page.reload(wait_until='load')
 page.wait_for_function("document.querySelectorAll('.studio-top').length>0")
 page.locator('[data-action="nav"][data-tab="sessions"]').click()
 assert page.locator('.session-card').count()==3,'Autosaved workspace must preserve 3 sessions on reload'
 assert not errors,errors
 assert not external,external
 browser.close()
print('STUDIO_REAL_BROWSER PASS: file://, import 3 arbitrary-order sources, A4 transpose, numeric XLSX, trace, sessions')
