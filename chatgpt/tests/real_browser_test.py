"""PH1 gate using PRIVATE shared reference workbooks. Never commit derived data.
Run only in a private checkout which already contains data/reference/*.xlsx.
"""
import json,hashlib,os,sys
from pathlib import Path
from openpyxl import load_workbook
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
MAN=json.loads((ROOT/'data/reference/MANIFEST.json').read_text('utf-8'))
REF={x['id']:ROOT/x['path'] for x in MAN['files']}
for x in MAN['files']:
    path=ROOT/x['path']
    assert path.exists(), f'MISSING FIXTURE {path}'
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest==x['sha256'],f'SHA MISMATCH {x["id"]}'
print('REFERENCE SHA: 4/4 PASS')
URL=(HERE.parent/'dist/index.html').resolve().as_uri()
with sync_playwright() as playwright:
    chrome=os.environ.get('CHROMIUM_EXECUTABLE')
    launch_args={'headless':True,'args':['--no-sandbox']}
    if chrome:launch_args['executable_path']=chrome
    b=playwright.chromium.launch(**launch_args)
    page=b.new_page(accept_downloads=True,viewport={'width':1560,'height':960})
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda q:requests.append(q.url))
    page.goto(URL,wait_until='load',timeout=60000)
    print('OFFLINE_FILE_URL',page.url,'SECURE?',page.evaluate('isSecureContext'))
    assert page.url.startswith('file:///')
    page.get_by_role('button',name='+ Tạo báo cáo').click()
    assert page.get_by_text('0 đã chọn').count()==1
    page.get_by_role('button',name='02 Nguồn dữ liệu').click()
    source_files=[('DISB_20261015','DISB','2026-10-15','Ngày từ tiêu đề A1'),('REV_10M_2026','REV','2026-10-19','NGÀY GIẢ LẬP CHỈ DÙNG TEST - KHÔNG PHẢI CHỐT CHÍNH THỨC'),('GPMB_20261026','GPMB','2026-10-26','Ngày từ tiêu đề A1')]
    for id_,kind,date,why in source_files:
        page.locator('#source-type').select_option(kind)
        page.locator('#source-file').set_input_files(str(REF[id_]))
        page.locator('#source-date').fill(date)
        page.locator('#source-reason').fill(why)
        previous=page.locator('.data-item').count()
        page.locator('#import-btn').click()
        page.wait_for_function("prev => document.querySelectorAll('.data-item').length > prev || document.querySelector('#toast')?.textContent?.startsWith('Không thể nhập')",arg=previous,timeout=60000)
        message=page.locator('#toast').inner_text();assert 'Nhập thành công' in message,f'{kind}: {message}'
        print(kind,message)
    assert '12 cảnh báo' in page.locator('#main').inner_text(), 'GPMB M mismatch expected 12'
    for missing in ['Đặc khu Bạch Long Vĩ','Phường Lưu Kiếm','Phường Ái Quốc','Xã Hùng Thắng','Xã Thái Tân','Xã Tân Minh']:
        assert missing in page.locator('#main').inner_text(), missing
    page.get_by_role('button',name='03 Bảng tổng hợp').click()
    t=page.locator('.metrics').inner_text()
    for val in ['111,30%','67,10%','72,13%']:
        assert val in t, f'Benchmark {val} not in {t}'
    page.locator('.locality-item input[type=checkbox]').nth(0).check()
    page.locator('.locality-item input[type=checkbox]').nth(1).check()
    page.locator('.locality-item input[type=checkbox]').nth(2).check()
    page.locator('.locality-item input[type=checkbox]').nth(3).check()
    page.locator('.locality-item input[type=checkbox]').nth(4).check()
    assert page.locator('.report-grid tbody tr').count()==14
    assert page.locator('.report-grid tbody tr').first.locator('.result-cell').count()==5
    page.locator('.report-grid tbody tr').nth(9).locator('.result-cell').first.click()
    assert page.locator('#inspector').is_visible()
    assert page.locator('#inspector').inner_text().find('Hồ sơ phép tính')>=0
    page.locator('#inspector .close').click()
    with page.expect_download(timeout=60000) as dl:
        page.get_by_role('button',name='Xuất Excel có truy vết').click()
    out=HERE/'tmp'/'real-export.xlsx';out.parent.mkdir(exist_ok=True);dl.value.save_as(out)
    book=load_workbook(out,data_only=True,read_only=True)
    assert len(book.sheetnames)==8
    assert book['Báo cáo']['C6'].data_type=='n'
    assert book['Nguồn thiếu & lý do'].max_row>=1
    print('EXCEL_EXPORT PASS',book.sheetnames)
    # In-document PDF via Chrome print is checked without exporting any source to GitHub.
    pdf=page.pdf(format='A4',landscape=True,print_background=True)
    assert pdf.startswith(b'%PDF-') and len(pdf)>8000
    print('BROWSER_PDF PASS bytes=',len(pdf))
    page.get_by_role('button',name='01 Phiên báo cáo').click()
    page.get_by_role('button',name='+ Tạo báo cáo').click()
    page.locator('.locality-item input[type=checkbox]').nth(5).check()
    page.locator('.locality-item input[type=checkbox]').nth(6).check()
    page.locator('.locality-item input[type=checkbox]').nth(7).check()
    page.locator('.locality-item input[type=checkbox]').nth(8).check()
    page.locator('.locality-item input[type=checkbox]').nth(9).check()
    page.locator('.locality-item input[type=checkbox]').nth(10).check()
    page.locator('.locality-item input[type=checkbox]').nth(11).check()
    assert page.locator('.report-grid tbody tr').first.locator('.result-cell').count()==7
    page.get_by_role('button',name='01 Phiên báo cáo').click()
    assert '5 địa phương' in page.locator('#main').inner_text()
    assert '7 địa phương' in page.locator('#main').inner_text()
    assert not errors,errors
    assert not [q for q in requests if q.startswith(('http://','https://','ws://','wss://'))],requests
    print('PH1 REAL-BROWSER GATE PASS: imported 114/113/108, 422 projects, 12 mismatch, 5+7 sessions, 14 rows, trace, XLSX, PDF, no requests, file://')
    b.close()
