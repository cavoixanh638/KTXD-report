/* KTXH Offline Document Studio, reusing PH1 calculation and provenance engine. */
(function(root){
'use strict';const K=root.KTXH=root.KTXH||{},L=K.StudioLayout,S=K.StudioStorage;
const $=q=>document.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let work=K.emptyWorkspace(),tab='report',report=null,pending=[],saveTimer=null,saveSeq=0,lastSaved='',saving=false,saveError='',backupDirty=false,selectedTrace=null,zoom='fit';
function current(){return work.sessions.find(x=>x.id===work.active)||null}
function alertMessage(message,isError=false){const el=$('#toast');el.textContent=message;el.className='toast '+(isError?'error':'success');el.hidden=false;clearTimeout(alertMessage.timer);alertMessage.timer=setTimeout(()=>el.hidden=true,5500);}
function download(blob,filename){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function mark(){backupDirty=true;saveSeq++;saving=false;saveError='';clearTimeout(saveTimer);saveTimer=setTimeout(persist,3800);badge();}
async function persist(){
 saveTimer=null;const seq=saveSeq,snapshot=JSON.parse(JSON.stringify(work));saving=true;badge();
 try{await S.write(snapshot);if(saveSeq===seq){saving=false;lastSaved=new Date().toLocaleTimeString('vi-VN');saveError='';}}
 catch(e){try{S.fallbackWrite(snapshot);if(saveSeq===seq){lastSaved=new Date().toLocaleTimeString('vi-VN');saveError='';saving=false;}}
 catch(x){saveError=x.message||'Không thể tự lưu';saving=false;}}
 badge();if(saveSeq!==seq&&!saveTimer)mark();
}
function badge(){
 const t=$('#studio-save');if(t)t.textContent=saveError?'Không thể lưu: '+saveError:saving?'Đang lưu...':saveTimer&&saveSeq?'Có thay đổi chưa lưu':lastSaved?'Đã tự lưu lúc '+lastSaved:'Chưa lưu';
 const b=$('#studio-backup');if(b)b.textContent=backupDirty?'Chưa sao lưu ra tệp':'Đã tạo bản sao lưu';
}
function changed(session,reason){if(session)K.updateSession(session,reason);mark();render();}
function normalizeSettings(s){if(!s)return;Object.assign(s.settings,{tableMode:s.settings.tableMode||'auto',agency:s.settings.agency||'',subtitle:s.settings.subtitle||''});}
function navigate(next){tab=next;render();}
function navbar(){
 const s=current();const items=[['report','▦','Báo cáo tổng hợp'],['sessions','▤','Quản lý phiên'],['sources','▣','Dữ liệu nguồn'],['localities','☷','Danh mục địa phương'],['settings','⚙','Chỉ tiêu & tùy chỉnh'],['quality','◉','Kiểm tra & truy vết'],['export','⇩','Xuất & in báo cáo']];
 const sessionOptions=work.sessions.map(x=>'<option value="'+esc(x.id)+'" '+(s?.id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('');
 $('#studio-header').innerHTML='<div class="studio-top"><div class="brand">▦ Báo cáo Kinh tế – Xã hội <small>OFFLINE</small><em>A4 Report Studio</em></div><div class="top-group"><select class="studio-session-select" id="session-switch" aria-label="Phiên đang mở"><option value="">Chọn phiên báo cáo</option>'+sessionOptions+'</select><button data-action="new">+ Phiên mới</button><button data-action="sessions">Quản lý phiên</button></div><div class="top-group"><span class="autosave-state" id="studio-save"></span><span id="studio-backup" class="backup-note"></span></div><div class="top-group"><button data-action="xlsx">Xuất Excel</button><button data-action="print">In / PDF</button><button class="primary" data-action="backup">Sao lưu hồ sơ</button></div></div>';
 $('#studio-rail').innerHTML='<nav><button data-action="toggle-rail" title="Thu gọn thanh điều hướng"><span class="rail-icon">☰</span><span class="rail-label">Thu gọn</span></button>'+items.map(([id,ico,label])=>'<button class="'+(tab===id?'selected':'')+'" data-action="nav" data-tab="'+id+'" title="'+label+'"><span class="rail-icon">'+ico+'</span><span class="rail-label">'+label+'</span></button>').join('')+'</nav>';badge();
}
function localities(){
 const s=current();if(!s)return '<section class="panel"><button data-action="new">+ Tạo phiên</button></section>';
 const all=K.availableLocalities(work),selected=new Set(s.selected);
 return '<section class="panel selectors"><div class="section-head"><h2>Danh sách địa phương ('+all.length+')</h2><small>Đã chọn: '+s.selected.length+'</small></div>'+
 '<input id="locality-search" placeholder="Tìm không dấu hoặc có dấu..." aria-label="Tìm địa phương">'+
 '<div class="actions compact"><select id="locality-type"><option value="">Tất cả</option><option value="Xã ">Xã</option><option value="Phường ">Phường</option><option value="Đặc khu ">Đặc khu</option></select><button data-action="select-visible">Chọn lọc</button><button data-action="clear-localities">Bỏ chọn</button></div>'+
 '<div class="locality-list" id="locality-list">'+all.map(loc=>{
 const type=loc.name.startsWith('Đặc khu')?'Đặc khu ':loc.name.split(' ')[0]+' ';
 const missing=['REV','GPMB'].filter(t=>{const d=K.bound(work,s,t);return d&&!d.localities.some(name=>K.localityId(name)===loc.id)});
 return '<label class="locality-item" data-search="'+esc(K.plain(loc.name))+'" data-type="'+esc(type)+'"><input type="checkbox" data-loc="'+esc(loc.id)+'" '+(selected.has(loc.id)?'checked':'')+'>'+esc(loc.name)+(missing.length?'<span title="Thiếu bản ghi '+missing.join(', ')+'" class="warning"> ⚠</span>':'')+'</label>';
 }).join('')+'</div></section>';
}
function filterLoc(){
 const query=K.plain($('#locality-search')?.value||''),type=$('#locality-type')?.value||'';
 document.querySelectorAll('.locality-item').forEach(el=>el.hidden=!(el.dataset.search.includes(query)&&(!type||el.dataset.type===type)));
}
function tools(){
 const s=current();if(!s)return '';
 const selected=s.settings.tableMode||'auto';
 const mode='<select id="studio-mode" aria-label="Hướng trình bày"><option value="auto" '+(selected==='auto'?'selected':'')+'>Tự động tối ưu A4</option><option value="horizontal" '+(selected==='horizontal'?'selected':'')+'>Địa phương ngang</option><option value="vertical" '+(selected==='vertical'?'selected':'')+'>Địa phương dọc</option></select>';
 return '<div class="studio-tools"><label>Bố cục '+mode+'</label><label>Khổ giấy <select data-setting="paperSize"><option '+(s.settings.paperSize==='A4'?'selected':'')+'>A4</option><option '+(s.settings.paperSize==='A3'?'selected':'')+'>A3</option></select></label>'+
 '<label>Hướng giấy <select data-setting="orientation"><option value="landscape" '+(s.settings.orientation==='landscape'?'selected':'')+'>Ngang</option><option value="portrait" '+(s.settings.orientation==='portrait'?'selected':'')+'>Dọc</option></select></label>'+
 '<label>Phóng to <select id="studio-zoom"><option value="fit" '+(zoom==='fit'?'selected':'')+'>Vừa trang</option>'+[100,125,150].map(v=>'<option value="'+v+'" '+(zoom==v?'selected':'')+'>'+v+'%</option>').join('')+'</select></label>'+
 '<button data-action="edit-title">Sửa tiêu đề</button><button data-action="settings">Tùy chỉnh</button><button data-action="toggle-wide">Xem rộng</button><button data-action="print">Xem trước / In</button><span class="description" id="layout-message"></span></div>';
}
function reportView(){
 const s=current();
 if(!s)return '<div class="studio-control-sheet"><h1>Báo cáo Kinh tế – Xã hội</h1><p>Tạo phiên mới, nhập ba nguồn, chọn địa phương để lập báo cáo.</p><button class="primary" data-action="new">+ Tạo phiên báo cáo</button></div>';
 normalizeSettings(s);report=K.buildReport(work,s);
 const {html,pagination,totalPages}=L.renderDocument(report,s.settings,s,esc);
 const factor=zoom==='fit'?.82:Number(zoom)/100;
 const info='Đã chọn '+L.description(pagination.direction).toLowerCase()+' · '+totalPages+' trang · '+(pagination.requested==='auto'?'Tự động':'Thủ công');
 return tools()+'<div class="studio-body"><div class="studio-left">'+localities()+'<div class="studio-view-hint">Một danh sách chung cho xã, phường và đặc khu. Chọn nhiều địa phương theo nhu cầu.</div></div><div class="studio-right"><div class="studio-note">'+esc(info)+'. Xem trước được phân trang trước khi in; bấm vào số để xem nguồn và công thức.</div><div class="studio-zoom" style="zoom:'+factor+'"><div class="studio-pages" id="print-area">'+html+'</div></div></div></div>';
}
function sessionPage(){
 return '<div class="studio-control-sheet"><div class="page-header"><div><h1>Quản lý phiên báo cáo</h1><p>Phiên mới bắt đầu với 0 địa phương. Dữ liệu và tùy chỉnh lưu độc lập theo từng phiên.</p></div><button class="primary" data-action="new">+ Phiên mới</button></div><div class="cards">'+(work.sessions.map(s=>'<article class="session-card '+(work.active===s.id?'active':'')+'"><h3>'+esc(s.name)+'</h3><small>'+new Date(s.updatedAt).toLocaleString('vi-VN')+' · '+s.selected.length+' địa phương</small><div class="actions"><button data-action="open-session" data-id="'+esc(s.id)+'">Mở phiên</button><button data-action="rename-session" data-id="'+esc(s.id)+'">Đổi tên</button><button data-action="copy-session" data-id="'+esc(s.id)+'">Nhân bản</button><button data-action="close-session" data-id="'+esc(s.id)+'">Đóng</button><button class="danger" data-action="delete-session" data-id="'+esc(s.id)+'">Xóa</button></div></article>').join('')||'<p>Chưa có phiên nào.</p>')+'</div><h2>Bản sao lưu</h2><p>Lưu tệp .kxh.json để không phụ thuộc bộ nhớ trình duyệt. Dữ liệu không gửi lên mạng.</p><div class="actions"><button data-action="backup">Lưu toàn bộ hồ sơ</button><button data-action="backup-session">Lưu riêng phiên</button><label class="file-button">Mở bộ hồ sơ <input id="restore-file" type="file" accept=".json,.kxh.json" hidden></label></div></div>';
}
function sourcesPage(){
 const pendingItems=pending.map((p,i)=>{
 const status=p.error?'<span class="warning">'+esc(p.error)+'</span>':'<b>'+esc(p.type)+' · '+esc(p.sheet)+' · '+p.count+' địa phương'+(p.projects?' / '+p.projects+' dự án':'')+'</b>';
 return '<div class="source-item">'+esc(p.file.name)+'<p>'+status+'</p>'+(p.error?'':'<label>Ngày chốt đã xác minh <input data-pending-date="'+i+'" type="date" value="'+esc(p.date||'')+'"></label><label>Căn cứ xác nhận ngày <input data-pending-reason="'+i+'" placeholder="Xác nhận từ tiêu đề hoặc chứng cứ" value="'+esc(p.reason||'')+'"></label>')+'</div>';
 }).join('');
 return '<div class="studio-control-sheet"><h1>Nhập ba file nguồn Excel</h1><p>Thả một hoặc cả ba tệp theo thứ tự bất kỳ. Ứng dụng tự nhận dạng qua cấu trúc workbook, không dựa vào tên tệp.</p><div class="studio-dropzone" id="studio-dropzone" data-action="select-files">Kéo thả 1–3 file Excel vào đây hoặc <b>bấm để chọn</b><input type="file" id="source-files" multiple accept=".xlsx" hidden></div><div class="source-review">'+pendingItems+'</div>'+(pending.some(x=>!x.error)?'<button class="primary" data-action="commit-sources">Xác nhận và nhập các nguồn hợp lệ</button>':'')+
 '<h2>Những nguồn đang sử dụng</h2><div class="source-review">'+(work.datasets.map(d=>'<div class="source-item"><b>'+esc(d.type)+' · '+esc(d.fileName)+'</b><p>'+esc(d.sheetName)+' · '+d.localities.length+' địa phương · ngày chốt '+esc(d.asOfDate)+'</p><small>SHA-256: '+esc(d.hash)+'</small></div>').join('')||'<p>Chưa nhập nguồn.</p>')+'</div></div>';
}
function settingsPage(){
 const s=current();if(!s)return '<div class="studio-control-sheet">Chưa tạo phiên.</div>';
 const st=s.settings;
 return '<div class="studio-control-sheet studio-setting-panel"><h1>Chỉnh sửa báo cáo</h1><p>Chỉ thay đổi tên hiển thị, không tác động công thức hoặc các nguồn.</p><section class="panel"><label>Tiêu đề báo cáo <input data-setting="title" value="'+esc(st.title)+'"></label><label>Tên đơn vị <input data-setting="agency" value="'+esc(st.agency||'')+'"></label><label>Phụ đề <input data-setting="subtitle" value="'+esc(st.subtitle||'')+'"></label><div class="field-grid">'+
 [['moneyUnit','Đơn vị tiền',[['billion','Tỷ đồng'],['million','Triệu đồng']]],['areaUnit','Diện tích',[['m2','m²'],['ha','ha']]],['paperSize','Khổ giấy',[['A4','A4'],['A3','A3']]],['orientation','Hướng giấy',[['landscape','Ngang'],['portrait','Dọc']]]].map(([key,label,values])=>'<label>'+label+'<select data-setting="'+key+'">'+values.map(([val,name])=>'<option value="'+val+'" '+(st[key]===val?'selected':'')+'>'+name+'</option>').join('')+'</select></label>').join('')+
 [['fontSize','Cỡ chữ (px)',10,18],['decimals','Chữ số thập phân',0,6],['threshold','Ngưỡng nhận xét (điểm %)',0,100]].map(([key,label,min,max])=>'<label>'+label+'<input type="number" min="'+min+'" max="'+max+'" data-setting="'+key+'" value="'+st[key]+'"></label>').join('')+'</div><h3>Danh mục 14 dòng chuẩn (sắp xếp, ẩn/hiện, đổi tên)</h3><div class="row-options">'+s.rows.map((r,i)=>'<div class="row-option"><input type="checkbox" data-toggle-row="'+esc(r.key)+'" '+(r.visible?'checked':'')+'><input data-row-label="'+esc(r.key)+'" value="'+esc(r.label)+'"><button data-action="move-row" data-index="'+i+'" data-dir="-1">↑</button><button data-action="move-row" data-index="'+i+'" data-dir="1">↓</button><button data-action="duplicate-row" data-index="'+i+'">+</button></div>').join('')+'</div><button data-action="report" class="primary">Trở lại báo cáo</button></section></div>';
}
function qualityPage(){
 const s=current();if(!s)return '<div class="studio-control-sheet">Chưa tạo phiên.</div>';
 const cov=K.coverage(work,s,true),issues=['REV','DISB','GPMB'].flatMap(t=>(K.bound(work,s,t)?.issues||[]).filter(x=>s.selected.includes(K.localityId(x.locality))));
 return '<div class="studio-control-sheet"><h1>Kiểm tra dữ liệu nguồn</h1><p>Cảnh báo chỉ phản ánh địa phương được chọn. Không có bản ghi không đồng nghĩa không phát sinh.</p><h2>Nguồn thiếu / từng địa phương ('+cov.length+')</h2><div class="table-wrap"><table><thead><tr><th>Địa phương</th><th>Nguồn</th><th>Trạng thái</th><th>Ô</th><th>Nguyên nhân</th></tr></thead><tbody>'+cov.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.sourceCell)+'</td><td>'+esc(x.reason)+'</td></tr>').join('')+'</tbody></table></div><h2>Các cảnh báo ('+issues.length+')</h2><div class="table-wrap"><table><tbody>'+issues.map(x=>'<tr><td>'+esc(x.locality)+'</td><td>'+esc(x.rule)+'</td><td>'+esc(x.sourceCell)+'</td><td>'+esc(x.explanation)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function inspector(ri,ci){
 if(!report)return;const o=report.rows[ri]?.cells[ci];if(!o)return;selectedTrace=o.trace;
 const t=o.trace,loc=report.columns[ci],item=report.rows[ri];
 const lines=[['Địa phương',loc.name],['Chỉ tiêu',item.row.label],['Kết quả',t.result.displayedText],['Giá trị chưa làm tròn',t.result.exactDecimal??'Không có'],['Công thức',t.formula.readableExpression],['Trạng thái',t.quality.status],['Trace ID',t.traceId],['Ngày chốt',t.scope.asOfDates.join('; ')],['Bản ghi được tính',t.population.includedCount],['Bản ghi bị loại',t.population.excludedCount],['Thành phần thiếu',t.population.missingCount]];
 const detail=(arr,f)=>arr?.length?'<details><summary>'+arr.length+' bản ghi – nhấp để xem</summary><div class="detail-list">'+arr.map(x=>'<div>'+f(x)+'</div>').join('')+'</div></details>':'<p>Không có</p>';
 $('#inspector').innerHTML='<div class="inspector-head"><h2>Truy vết phép tính</h2><button data-action="close-inspect">×</button></div><div class="inspect-scroll"><div class="inspector-summary">'+lines.map(([k,v])=>'<div><b>'+esc(k)+'</b><span>'+esc(v)+'</span></div>').join('')+'</div><h3>Toán hạng</h3>'+detail(t.operands,x=>esc(x.role)+' = '+esc(x.exactValue??x.state)+' · '+esc(x.sources.map(r=>r.sheetName+'!'+r.address).join(', ')))+'<h3>Các bước tính</h3>'+detail(t.steps,x=>esc(x.operation+' : '+x.inputs.join(' + ')+' → '+x.output))+'<h3>Bản ghi được tính</h3>'+detail(t.population.includedRecordIds,x=>esc(x))+'<h3>Không tính và lý do</h3>'+detail(t.exclusions,x=>esc(x.recordId+' · '+x.reasonCode+' · '+x.explanation))+'<h3>Đóng góp mẫu số 0 vẫn được tính</h3>'+detail(t.zeroDenominatorContributors,x=>esc(x.recordId+' : '+x.numeratorExactDecimal+' / 0'))+'<h3>Nguồn / ngày / SHA</h3>'+detail(t.sourceRefs,x=>esc(x.fileName+' · '+x.sheetName+'!'+x.address+' · '+x.fileSha256+' · '+x.asOfDate))+'<div class="actions"><button data-action="copy-trace">Sao chép trace</button><button data-action="close-inspect">Đóng</button></div></div>';
 $('#inspector').hidden=false;$('#overlay').hidden=false;
}
function render(){
 navbar();const main=$('#main');main.innerHTML=tab==='report'?reportView():tab==='sessions'?sessionPage():tab==='sources'?sourcesPage():tab==='settings'?settingsPage():tab==='quality'?qualityPage():tab==='localities'?'<div class="studio-control-sheet"><h1>Chọn địa phương</h1>'+localities()+'</div>':tab==='export'?'<div class="studio-control-sheet"><h1>Xuất và in báo cáo</h1><p>Trang báo cáo WYSIWYG là nguồn xuất PDF. Dữ liệu Excel gồm cả nhật ký tính và phụ lục truy vết.</p><button data-action="xlsx">Xuất Excel</button> <button data-action="print">In / Save PDF</button> <button data-action="backup">Sao lưu toàn bộ</button></div>':'';
 badge();if(tab==='report'&&current())fitPaper();
}
function fitPaper(){/* CSS zoom applies only on screen and not printed content. */}
async function identifyFiles(files){
 pending=[];navigate('sources');
 for(const file of files){const entry={file,type:null,error:null,date:'',reason:'',sheet:'',count:0,projects:0};
 try{
  if(!/\.xlsx$/i.test(file.name))throw Error('Chỉ hỗ trợ .xlsx');
  const book=await K.openBook(await file.arrayBuffer()),matches=[];
  for(const [type,profile] of Object.entries(K.kinds)){
   for(const sh of book.sheets.filter(x=>x.state==='visible'&&x.name===profile.sheet)){
    const rows=await K.sheetRows(book,sh);
    const first=type==='GPMB'?rows.get(3)?.B?.text:rows.get(profile.rows[0])?.B?.text;
    if(!/^(xã|phường|đặc khu)\s+/iu.test(K.normName(first)))continue;
    if(type==='DISB'&&!K.isDecimal(rows.get(13)?.F?.text))continue;
    if(type==='REV'&&!K.isDecimal(rows.get(11)?.C?.text))continue;
    matches.push({type,sheet:sh.name});
   }
  }
  if(matches.length!==1)throw Error(matches.length?'Nhiều cấu trúc có thể khớp, cần xác minh thủ công':'Không nhận diện được profile nguồn; chưa nhập');
  entry.type=matches[0].type;entry.sheet=matches[0].sheet;entry.date=K.kinds[entry.type].date||'';
  entry.count={DISB:114,REV:113,GPMB:108}[entry.type];entry.projects=entry.type==='GPMB'?422:0;
  if(pending.some(x=>x.type===entry.type&&!x.error))throw Error('Có hai tệp cùng loại '+entry.type+'; chỉ được chọn một cho lượt nhập');
 }catch(e){entry.error=e.message;}
 pending.push(entry);render();
 }
}
async function commitPending(){
 const elements=pending.filter(x=>!x.error);
 const seen=new Set();
 const inserts=[];
 for(const item of elements){
  const index=pending.indexOf(item),date=$('[data-pending-date="'+index+'"]')?.value||'',reason=$('[data-pending-reason="'+index+'"]')?.value||'';
  if(!date)throw Error('Chưa xác nhận ngày chốt cho '+item.file.name);
  if(!reason.trim())throw Error('Phải ghi căn cứ xác nhận ngày chốt cho '+item.file.name);
  if(seen.has(item.type))throw Error('Hai file cùng một loại trong lượt nhập');seen.add(item.type);
  const ds=await K.importFile(item.file,item.type,date,reason);if(!work.datasets.some(x=>x.id===ds.id))inserts.push(ds);
 }
 for(const ds of inserts){
  work.datasets.push(ds);
  for(const s of work.sessions)if(!s.bindings[ds.type])s.bindings[ds.type]=ds.id;
  work.audit.push({action:'Nhập '+ds.type,hash:ds.hash,when:new Date().toISOString()});
 }
 pending=[];mark();render();alertMessage('Nhập '+inserts.length+' bộ dữ liệu đã nhận dạng và xác nhận nguồn.');
}
async function backup(single=false){
 const s=current();if(single&&!s)throw Error('Chưa chọn phiên');
 const payload=single?{...work,active:s.id,sessions:[JSON.parse(JSON.stringify(s))],datasets:work.datasets.filter(d=>Object.values(s.bindings).includes(d.id))}:work;
 const data=await K.signedBackup(payload);download(new Blob([JSON.stringify(data)],{type:'application/json'}),'KTXH_'+(single?'phien':'workspace')+'_'+new Date().toISOString().slice(0,10)+'.kxh.json');
 backupDirty=false;badge();alertMessage('Đã tạo bản sao lưu SHA-256. Hãy giữ tệp an toàn.');
}
async function restore(file){
 if(!file)return;if(file.size>35e6)throw Error('Tệp sao lưu vượt 35MB');
 const restored=await K.verifiedBackup(JSON.parse(await file.text()));
 const replace=confirm('Bản sao lưu hợp lệ. OK: thay toàn bộ hồ sơ. Cancel: nhập thêm phiên, giữ các phiên hiện có.');
 if(replace)work=restored;
 else{
  for(const ds of restored.datasets)if(!work.datasets.some(x=>x.id===ds.id))work.datasets.push(ds);
  for(const s of restored.sessions){const v=JSON.parse(JSON.stringify(s));if(work.sessions.some(x=>x.id===v.id)){v.id=K.id();v.name+=' (khôi phục)';}work.sessions.push(v);}
 }
 mark();navigate('sessions');alertMessage('Đã kiểm tra checksum và khôi phục '+restored.sessions.length+' phiên.');
}
async function actions(event){
 const b=event.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action,s=current();
 try{
 switch(action){
 case 'nav':navigate(b.dataset.tab);break;
 case 'sessions':navigate('sessions');break;
 case 'settings':navigate('settings');break;
 case 'report':navigate('report');break;
 case 'new':{const v=K.newSession(work,'Báo cáo '+(work.sessions.length+1));normalizeSettings(v);work.sessions.push(v);work.active=v.id;mark();navigate('report');break;}
 case 'open-session':work.active=b.dataset.id;mark();navigate('report');break;
 case 'rename-session':{const v=work.sessions.find(x=>x.id===b.dataset.id),name=prompt('Đổi tên phiên',v.name);if(name?.trim()){v.name=name.trim();changed(v,'Đổi tên phiên');}break;}
 case 'close-session':if(work.active===b.dataset.id){work.active=null;mark();navigate('sessions');}break;
 case 'copy-session':{const v=work.sessions.find(x=>x.id===b.dataset.id),copy=JSON.parse(JSON.stringify(v));copy.id=K.id();copy.name+=' (bản sao)';copy.revision=1;copy.audit=[];work.sessions.push(copy);work.active=copy.id;mark();navigate('report');break;}
 case 'delete-session':{const v=work.sessions.find(x=>x.id===b.dataset.id);if(confirm('Xóa phiên '+v.name+'? Không thể hoàn tác nếu chưa sao lưu.')){work.sessions=work.sessions.filter(x=>x.id!==v.id);if(work.active===v.id)work.active=null;mark();render();}break;}
 case 'toggle-rail':document.body.classList.toggle('studio-rail-compact');break;
 case 'toggle-wide':document.body.classList.toggle('studio-wide');break;
 case 'select-visible':{if(!s)return;document.querySelectorAll('.locality-item:not([hidden]) input').forEach(x=>{if(!s.selected.includes(x.dataset.loc))s.selected.push(x.dataset.loc);});changed(s,'Chọn địa phương trong bộ lọc');break;}
 case 'clear-localities':if(s&&confirm('Bỏ chọn tất cả địa phương?')){s.selected=[];changed(s,'Bỏ chọn danh sách');}break;
 case 'inspect':inspector(Number(b.dataset.row),Number(b.dataset.col));break;
 case 'close-inspect':$('#inspector').hidden=true;$('#overlay').hidden=true;break;
 case 'edit-title':if(s){const name=prompt('Tiêu đề báo cáo',s.settings.title);if(name?.trim()){s.settings.title=name.trim();changed(s,'Đổi tiêu đề');}}break;
 case 'edit-row':if(s){const row=s.rows.find(x=>x.key===b.dataset.rowKey),name=prompt('Tên chỉ tiêu hiển thị',row?.label||'');if(row&&name?.trim()){row.label=name.trim();changed(s,'Đổi nhãn chỉ tiêu');}}break;
 case 'move-row':if(s){const i=Number(b.dataset.index),j=i+Number(b.dataset.dir);if(j>=0&&j<s.rows.length){[s.rows[i],s.rows[j]]=[s.rows[j],s.rows[i]];changed(s,'Sắp xếp chỉ tiêu');}}break;
 case 'duplicate-row':if(s){const i=Number(b.dataset.index),r=s.rows[i];s.rows.splice(i+1,0,{...r,key:r.key+'-copy-'+K.id().slice(-6),label:r.label+' (bản sao)'});changed(s,'Nhân bản chỉ tiêu');}break;
 case 'copy-trace':if(selectedTrace){await navigator.clipboard.writeText(JSON.stringify(selectedTrace,null,2));alertMessage('Đã sao chép trace');}break;
 case 'select-files':$('#source-files')?.click();break;
 case 'commit-sources':await commitPending();break;
 case 'backup':await backup();break;
 case 'backup-session':await backup(true);break;
 case 'print':if(!s)return;{let style=$('#studio-print-sheet');if(!style){style=document.createElement('style');style.id='studio-print-sheet';document.head.append(style);}style.textContent='@page { size: '+s.settings.paperSize+' '+s.settings.orientation+'; margin: 0; }';root.print();}break;
 case 'xlsx':if(!s)return;{const r=K.buildReport(work,s),data=await K.exportXlsx(work,s,r);download(data,'KTXH_'+new Date().toISOString().slice(0,10)+'.xlsx');alertMessage('Đã xuất Excel cùng nguồn, công thức và truy vết.');}break;
 }
 }catch(e){alertMessage(e.message,true);}
}
function fieldChanged(e){
 const el=e.target,s=current();
 if(el.id==='session-switch'){work.active=el.value||null;mark();navigate('report');return}
 if(el.id==='source-files'){identifyFiles(el.files||[]);return}
 if(el.id==='restore-file'){restore(el.files?.[0]).catch(ex=>alertMessage(ex.message,true));return}
 if(el.id==='locality-type'){filterLoc();return}
 if(el.id==='studio-zoom'){zoom=el.value;render();return}
 if(el.id==='studio-mode'&&s){s.settings.tableMode=el.value;changed(s,'Đổi chiều bảng');return}
 if(el.dataset.loc&&s){const id=el.dataset.loc;if(el.checked&&!s.selected.includes(id))s.selected.push(id);else if(!el.checked)s.selected=s.selected.filter(x=>x!==id);changed(s,'Chọn địa phương');return}
 if(el.dataset.setting&&s){
  const k=el.dataset.setting;if(['decimals','fontSize','threshold','areaDecimals','columnWidth'].includes(k)){const n=Number(el.value);if(!Number.isFinite(n))return;s.settings[k]=n;}else s.settings[k]=el.value;
  changed(s,'Chỉnh định dạng '+k);return;
 }
 if(el.dataset.rowLabel&&s){const r=s.rows.find(x=>x.key===el.dataset.rowLabel);if(r&&el.value.trim()){r.label=el.value.trim();changed(s,'Đổi nhãn');}return}
 if(el.dataset.toggleRow&&s){const r=s.rows.find(x=>x.key===el.dataset.toggleRow);if(r){r.visible=el.checked;changed(s,'Ẩn hiện chỉ tiêu');}}
}
async function start(){
 try{work=await S.read()||S.fallbackRead()||K.emptyWorkspace();if(!Array.isArray(work.sessions)||!Array.isArray(work.datasets))work=K.emptyWorkspace();}
 catch{work=S.fallbackRead()||K.emptyWorkspace();}
 const host=$('#main');if(!host)return;
 const header=document.createElement('div');header.id='studio-header';document.body.prepend(header);
 const rail=document.createElement('aside');rail.id='studio-rail';rail.className='studio-rail';
 const wrap=document.createElement('div');wrap.className='studio-wrap';const main=document.createElement('div');main.className='studio-main';
 host.parentNode.insertBefore(wrap,host);main.append(host);wrap.append(rail,main);
 host.className='app-main';
 document.addEventListener('click',actions);
 document.addEventListener('change',fieldChanged);
 document.addEventListener('input',e=>{if(e.target.id==='locality-search')filterLoc();});
 document.addEventListener('dragover',e=>{if(e.target.closest('#studio-dropzone')){e.preventDefault();e.target.closest('#studio-dropzone').classList.add('dragover');}});
 document.addEventListener('dragleave',e=>{e.target.closest('#studio-dropzone')?.classList.remove('dragover')});
 document.addEventListener('drop',e=>{const dz=e.target.closest('#studio-dropzone');if(dz){e.preventDefault();dz.classList.remove('dragover');identifyFiles(e.dataTransfer.files);}});
 $('#overlay').addEventListener('click',()=>{$('#inspector').hidden=true;$('#overlay').hidden=true});
 root.addEventListener('beforeunload',e=>{if(saveTimer||saveError||backupDirty){e.preventDefault();e.returnValue='';}});
 render();
}
document.addEventListener('DOMContentLoaded',start);
})(typeof globalThis!=='undefined'?globalThis:this);
