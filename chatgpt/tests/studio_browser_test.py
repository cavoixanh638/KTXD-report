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
 assert page.locator('.workflow-task').count()==4
 assert page.locator('#studio-rail:visible').count()==0
 page.locator('[data-action="new"]').first.click()
 assert page.locator('.locality-item input:checked').count()==0
 page.locator('[data-action="sources"]').click()
 page.locator('#source-files').set_input_files([str(files[x]) for x in ['GPMB_20261026','REV_10M_2026','DISB_20261015']])
 page.wait_for_function("document.querySelectorAll('[data-pending-date]').length===3",timeout=90000)
 # Both explicit A1 dates must auto-fill date and evidence; REV is deliberately manual.
 assert page.locator('[data-pending-date="0"]').input_value()=='2026-10-26'
 assert 'A1' in page.locator('[data-pending-reason="0"]').input_value()
 assert page.locator('[data-pending-date="1"]').input_value()==''
 assert page.locator('[data-pending-reason="1"]').input_value()==''
 assert page.locator('[data-pending-date="2"]').input_value()=='2026-10-15'
 assert 'A1' in page.locator('[data-pending-reason="2"]').input_value()
 # Import valid sources first. Empty REV must not block DISB/GPMB, or erase progress.
 page.locator('[data-action="commit-sources"]').click()
 page.wait_for_function("document.querySelector('#toast')?.textContent?.includes('Đã nhập 2 nguồn hợp lệ')",timeout=120000)
 assert page.locator('[data-pending-date]').count()==1
 assert page.locator('[data-pending-date="0"]').input_value()==''
 assert page.locator('.source-review').last.locator('.source-item').count()==2
 # A date alone is not sufficient evidence and must be rejected with inline explanation.
 page.locator('[data-pending-date="0"]').fill('2026-10-19')
 page.locator('[data-pending-reason="0"]').fill('10/15/2026')
 page.locator('[data-action="commit-sources"]').click()
 assert 'không chỉ là một ngày' in page.locator('.source-review').first.inner_text()
 assert page.locator('.source-review').last.locator('.source-item').count()==2
 page.locator('[data-pending-reason="0"]').fill('QA only: ngày tạm chọn để thử, CHƯA CÓ chứng cứ xác nhận ngày chốt chính thức')
 page.locator('[data-action="commit-sources"]').click()
 page.wait_for_function("document.querySelector('#toast')?.textContent?.includes('Đã nhập 1 nguồn mới')",timeout=120000)
 assert page.locator('.source-review').last.locator('.source-item').count()==3
 # Re-select an already imported file: no re-confirmation or double creation.
 page.locator('#source-files').set_input_files(str(files['DISB_20261015']))
 page.wait_for_function("document.querySelector('.source-review .source-item')?.textContent?.includes('đã có trong hồ sơ')",timeout=90000)
 assert page.locator('[data-pending-date]').count()==0
 assert page.locator('[data-action="commit-sources"]').count()==0
 assert page.locator('.source-review').last.locator('.source-item').count()==3
 page.locator('[data-action="report"]').first.click()
 assert page.locator('.source-status.ok').count()==3
 assert page.locator('.workflow-task').count()==4
 assert page.locator('.locality-item').count()==114
 for name in ['Xã Hồng Châu','Xã Khúc Thừa Dụ','Xã Vĩnh Lại','Xã Chí Minh','Xã Đại Sơn']:
  row=page.locator('.locality-item').filter(has_text=name)
  assert row.count()==1,(name,row.count())
  row.locator('input').check()
 assert page.locator('.doc-cell').count()>=14*5
 page.locator('#locality-search').fill('hong')
 assert page.locator('#locality-search').input_value()=='hong'
 page.locator('#locality-search').fill('')
 assert page.locator('.paper-sheet').count()>=1
 page.locator('[data-action="settings"]').first.click()
 page.locator('[data-setting="tableMode"]').select_option('vertical')
 page.locator('[data-action="report"]').last.click()
 assert page.locator('.doc-table.vertical').count()>0
 page.locator('[data-action="settings"]').first.click()
 page.locator('[data-setting="tableMode"]').select_option('horizontal')
 page.locator('[data-action="report"]').last.click()
 assert page.locator('.doc-table.vertical').count()==0
 page.locator('.doc-cell').first.click()
 assert page.locator('#inspector').is_visible()
 assert 'Trace ID' in page.locator('#inspector').inner_text()
 page.locator('[data-action="close-inspect"]').first.click()
 page.screenshot(path=str(OUT/'studio_five_horizontal.png'),full_page=True)
 page.pdf(path=str(OUT/'studio_five_horizontal.pdf'),format='A4',landscape=True,print_background=True)
 assert (OUT/'studio_five_horizontal.pdf').stat().st_size>8000
 page.locator('[data-action="settings"]').first.click()
 page.locator('[data-setting="tableMode"]').select_option('vertical')
 page.locator('[data-action="save-default-design"]').first.click()
 assert 'Đã có mẫu mặc định' in page.locator('.settings-actions').inner_text()
 page.locator('[data-action="report"]').last.click()
 page.screenshot(path=str(OUT/'studio_five_vertical.png'),full_page=True)
 with page.expect_download(timeout=60000) as dl:
  page.locator('[data-action="xlsx"]').click()
 dl.value.save_as(OUT/'studio_five_vertical.xlsx')
 wb=load_workbook(OUT/'studio_five_vertical.xlsx',read_only=True,data_only=True)
 assert len(wb.sheetnames)==8,wb.sheetnames
 assert wb['Báo cáo']['A4'].value=='Địa phương'
 assert wb['Báo cáo']['B5'].data_type=='n'
 wb.close()
 page.locator('[data-action="sessions"]').click()
 page.locator('[data-action="copy-session"]').first.click()
 assert page.locator('.locality-item input:checked').count()==5
 page.locator('[data-action="sessions"]').click()
 assert page.locator('.session-card').count()==2
 page.locator('[data-action="new"]').first.click()
 assert page.locator('.locality-item input:checked').count()==0
 page.locator('[data-action="settings"]').first.click()
 assert page.locator('[data-setting="tableMode"]').input_value()=='vertical','New session must inherit saved design'
 page.locator('[data-action="report"]').last.click()
 page.screenshot(path=str(OUT/'studio_empty_new_session.png'),full_page=True)
 page.wait_for_function("document.querySelector('#studio-save')?.textContent?.includes('Đã tự lưu')",timeout=20000)
 page.reload(wait_until='load')
 page.wait_for_function("document.querySelectorAll('.studio-top').length>0")
 page.locator('[data-action="sessions"]').click()
 assert page.locator('.session-card').count()==3,'Autosaved workspace must preserve 3 sessions on reload'
 assert not errors,errors
 assert not external,external
 browser.close()
print('STUDIO_REAL_BROWSER PASS: file://, import 3 arbitrary-order sources, A4 transpose, numeric XLSX, trace, sessions')
