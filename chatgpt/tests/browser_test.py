from playwright.sync_api import sync_playwright
from pathlib import Path
from openpyxl import load_workbook
from time import sleep
HERE=Path(__file__).resolve().parent
html=(HERE.parent/'dist/index.html').read_text()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(accept_downloads=True,viewport={'width':1550,'height':980})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load',timeout=60000)
    assert page.get_by_text('Chưa có phiên. Bấm').count()==1
    page.get_by_role('button',name='+ Tạo báo cáo').click()
    assert page.get_by_text('0 đã chọn').count()==1
    page.get_by_role('button',name='02 Nguồn dữ liệu').click()
    for type_,filename,date,reason in [('DISB','disb.xlsx','2026-10-15','A1'),('REV','rev.xlsx','2026-10-19','Kiểm thử synthetic'),('GPMB','gpmb.xlsx','2026-10-26','A1')]:
        page.locator('#source-type').select_option(type_)
        page.locator('#source-file').set_input_files(HERE/'tmp'/filename)
        page.locator('#source-date').fill(date)
        page.locator('#source-reason').fill(reason)
        page.get_by_role('button',name='Kiểm tra và nhập nguồn').click()
        page.wait_for_timeout(600)
        print('IMPORT',type_,page.locator('#toast').inner_text()[:220])
        assert 'Nhập thành công' in page.locator('#toast').inner_text(),type_
    page.get_by_role('button',name='03 Bảng tổng hợp').click()
    page.locator('.locality-item input[type=checkbox]').nth(0).check()
    assert page.locator('.report-grid tbody tr').count()==14
    assert page.locator('.report-grid tbody tr').nth(1).locator('button').count()==1
    page.locator('.report-grid tbody tr').nth(1).locator('button').first.click()
    assert page.locator('#inspector').is_visible()
    assert page.get_by_text('Hồ sơ phép tính · PH1.1').count()==1
    page.locator('#inspector .close').click()
    page.screenshot(path=str(HERE/'tmp/screenshot.png'),full_page=True)
    with page.expect_download() as d:
        page.get_by_role('button',name='Xuất Excel có truy vết').click()
    download=d.value;path=HERE/'tmp/export.xlsx';download.save_as(path)
    wb=load_workbook(path,data_only=True,read_only=True)
    print('XLSX sheets',wb.sheetnames)
    assert len(wb.sheetnames)==8 and wb['Báo cáo']['C6'].data_type=='n'
    print('XLSX sample',wb['Báo cáo']['C6'].value)
    print('ERRORS',errors[:10]);assert not errors
    b.close()
print('browser synthetic import + trace + XLSX export PASS')
