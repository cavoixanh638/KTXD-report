from pathlib import Path
from openpyxl import Workbook
HERE = Path(__file__).resolve().parent / 'tmp'
HERE.mkdir(exist_ok=True)
missing_gpmb=['Phường Lưu Kiếm','Phường Ái Quốc','Xã Hùng Thắng','Xã Thái Tân','Xã Tân Minh','Đặc khu Bạch Long Vĩ']
names=[f'Xã Thử Nghiệm {i:03}' for i in range(1,109)]+missing_gpmb
assert len(names)==114
b=Workbook(); ws=b.active;ws.title='DA trọng đểm NQ 174';ws.sheet_state='hidden'
for i in range(4):j=b.create_sheet('Hidden'+str(i));j.sheet_state='hidden'
w=b.create_sheet('Tổng hợp');w['A1']='Báo cáo giải ngân đến 15/10/2026';w['A2']='Đơn vị: triệu đồng'
for n,name in enumerate(names,start=13):w[f'B{n}']=name;w[f'F{n}']=1000+n;w[f'I{n}']=600+n;w[f'Q{n}']='Nguồn thực tế, không điều chỉnh'
for i in range(2):j=b.create_sheet('HiddenAfter'+str(i));j.sheet_state='hidden'
b.save(HERE/'disb.xlsx')
b=Workbook();w=b.active;w.title='10T-19.10';w['A3']='Thu 10 tháng';w['AC5']='triệu đồng'
for r,name in enumerate(names[:-1],start=11):
 for col,val in [('B',name),('C',1000),('D',0 if r==11 else 800),('E',200),('F',850),('G',0 if r==11 else 700),('H',150),('I',1100),('R',35),('W',1065)]:w[f'{col}{r}']=val
j=b.create_sheet('Sheet1');j.sheet_state='hidden';j=b.create_sheet('bc');j.sheet_state='veryHidden';j=b.create_sheet('TMS');j.sheet_state='veryHidden'
b.save(HERE/'rev.xlsx')
b=Workbook();w=b.active;w.title='Tổng hợp theo địa bàn';w['A1']='Tổng hợp dự án đến ngày 26/10/2026'
r=3;project=0
for i,name in enumerate(names[:108]):
 w[f'B{r}']=name;r+=1
 count=4 if i<98 else 3
 for j in range(count):
  project+=1;w[f'A{r}']=project;w[f'B{r}']='Dự án '+str(project);w[f'C{r}']='NS';w[f'D{r}']=10000;w[f'G{r}']=1000000000;w[f'I{r}']=None if project in (5,9,13) else 7200;w[f'M{r}']=None if project in (5,9,13) else (80 if project in range(20,32) else 72);r+=1
assert project==422 and r==533,(project,r)
b.save(HERE/'gpmb.xlsx')
print('synthetic files:',list(map(str,HERE.glob('*.xlsx'))))
