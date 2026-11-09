/* KTXH Offline Document Studio, reusing PH1 calculation and provenance engine. */
(function(root){
'use strict';const K=root.KTXH=root.KTXH||{},L=K.StudioLayout,S=K.StudioStorage;
const $=q=>document.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let work=K.emptyWorkspace(),tab='report',report=null,pending=[],saveTimer=null,saveSeq=0,lastSaved='',saving=false,saveError='',backupDirty=false,selectedTrace=null,zoom='fit',localityQuery='',localityKind='',localityScroll=0;
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
 const s=current(),types=['DISB','REV','GPMB'];
 const sourceItems=types.map(type=>{
  const d=s?K.bound(work,s,type):work.datasets.filter(x=>x.type===type).at(-1);
  const label={DISB:'Giải ngân',REV:'Thu NSNN',GPMB:'GPMB'}[type];
  return '<span class="source-status '+(d?'ok':'missing')+'" title="'+(d?esc(d.fileName+' · '+viDate(d.asOfDate)):'Chưa có nguồn '+label)+'">'+
   '<span class="source-status-dot"></span>'+label+'</span>';
 }).join('');
 const activeName=s?esc(s.name):'Chưa chọn phiên';
 const options=work.sessions.map(x=>'<option value="'+esc(x.id)+'" '+(s?.id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('');
 $('#studio-header').innerHTML='<header class="studio-top compact-top"><div class="compact-brand"><strong>▦ KTXH <span>Report Studio</span></strong><small>Offline · dữ liệu trên thiết bị</small></div>'+
 '<div class="workflow-bar" role="group" aria-label="Quy trình lập báo cáo">'+
 '<div class="workflow-task session-task"><span class="step-number">1</span><div class="task-content"><span class="task-label">Phiên làm việc</span><div class="task-controls"><select id="session-switch" class="studio-session-select" aria-label="Chọn phiên làm việc"><option value="">Chọn phiên</option>'+options+'</select><button type="button" data-action="new" title="Tạo phiên mới">+</button><button type="button" data-action="sessions" title="Mở danh sách, nhân bản, đổi tên và sao lưu phiên" aria-label="Quản lý phiên">⋯</button></div></div></div>'+
 '<div class="workflow-task source-task"><span class="step-number">2</span><div class="task-content"><span class="task-label">Dữ liệu Excel</span><div class="task-controls source-controls"><div class="source-statuses">'+sourceItems+'</div><button type="button" data-action="sources" class="import-action">Nhập / cập nhật</button></div></div></div>'+
 '<div class="workflow-task locality-task"><span class="step-number">3</span><div class="task-content"><span class="task-label">Địa phương</span><div class="task-controls"><button type="button" data-action="show-localities" class="locality-count">'+(s?s.selected.length:'0')+' đã chọn · Chọn / sửa</button></div></div></div>'+
 '<div class="workflow-task export-task"><span class="step-number">4</span><div class="task-content"><span class="task-label">Xuất báo cáo</span><div class="task-controls"><button type="button" data-action="xlsx" '+(!s?'disabled':'')+'>Excel</button><button type="button" data-action="print" class="primary" '+(!s?'disabled':'')+'>In / PDF</button></div></div></div></div>'+
 '<div class="header-utilities"><button type="button" class="settings-icon" data-action="settings" title="Thiết lập mẫu bảng, chỉ tiêu, khổ giấy (ít dùng)" aria-label="Thiết lập mẫu báo cáo">⚙</button><span class="autosave-state" id="studio-save"></span><span class="backup-note" id="studio-backup"></span></div></header>';
 $('#studio-rail').innerHTML='';
 badge();
}
function localities(){
 const s=current();if(!s)return '<section class="panel"><h2>Địa phương</h2><p>Chọn hoặc tạo phiên để lập báo cáo.</p><button data-action="new">+ Phiên mới</button></section>';
 const all=K.availableLocalities(work),selected=new Set(s.selected);
 return '<section class="panel selectors"><div class="section-head"><h2>Chọn địa phương</h2><small>'+s.selected.length+' / '+all.length+' đã chọn</small></div>'+
 '<input id="locality-search" value="'+esc(localityQuery)+'" placeholder="Tìm xã, phường, đặc khu..." aria-label="Tìm địa phương không dấu">'+
 '<div class="actions compact"><select id="locality-type" aria-label="Loại địa phương"><option value="" '+(!localityKind?'selected':'')+'>Tất cả</option><option value="Xã " '+(localityKind==='Xã '?'selected':'')+'>Xã</option><option value="Phường " '+(localityKind==='Phường '?'selected':'')+'>Phường</option><option value="Đặc khu " '+(localityKind==='Đặc khu '?'selected':'')+'>Đặc khu</option></select><button type="button" data-action="select-visible">Chọn lọc</button><button type="button" data-action="clear-localities">Bỏ chọn</button></div>'+
 '<div class="locality-list" id="locality-list">'+all.map(loc=>{
 const type=loc.name.startsWith('Đặc khu')?'Đặc khu ':loc.name.split(' ')[0]+' ';
 const missing=['REV','GPMB'].filter(t=>{const d=K.bound(work,s,t);return d&&!d.localities.some(name=>K.localityId(name)===loc.id)});
 return '<label class="locality-item" data-search="'+esc(K.plain(loc.name))+'" data-type="'+esc(type)+'"><input type="checkbox" data-loc="'+esc(loc.id)+'" '+(selected.has(loc.id)?'checked':'')+'>'+esc(loc.name)+(missing.length?'<span title="Thiếu bản ghi '+missing.join(', ')+'" class="warning"> ⚠</span>':'')+'</label>';
 }).join('')+'</div><p class="locality-help">Danh sách chung cho xã, phường và đặc khu; dấu ⚠ chỉ nguồn thiếu bản ghi, không có nghĩa không phát sinh.</p></section>';
}
function filterLoc(){
 const query=K.plain(localityQuery),type=localityKind;
 document.querySelectorAll('.locality-item').forEach(el=>el.hidden=!(el.dataset.search.includes(query)&&(!type||el.dataset.type===type)));
 const list=$('#locality-list');if(list)list.scrollTop=localityScroll;
}
function tools(){
 const s=current();if(!s)return '';
 return '<div class="studio-tools compact-preview-bar"><div><strong>Xem trước báo cáo</strong><span class="preview-meta" id="layout-message"> · '+esc(s.settings.paperSize||'A4')+' '+(s.settings.orientation==='portrait'?'dọc':'ngang')+' · '+s.rows.filter(x=>x.visible).length+' chỉ tiêu</span></div>'+
 '<div class="preview-actions"><button type="button" data-action="toggle-localities">Ẩn / hiện bộ chọn</button><button type="button" data-action="settings">⚙ Thiết kế mẫu</button></div></div>';
}
function reportView(){
 const s=current();
 if(!s)return '<div class="studio-control-sheet start-panel"><h1>Lập báo cáo Kinh tế – Xã hội</h1><p>Một quy trình làm việc: chọn phiên → nhập Excel → chọn địa phương → xuất Excel hoặc PDF.</p><button class="primary" data-action="new">+ Tạo phiên đầu tiên</button></div>';
 normalizeSettings(s);report=K.buildReport(work,s);
 const {html,pagination,totalPages}=L.renderDocument(report,s.settings,s,esc);
 const factor=zoom==='fit'?.82:Number(zoom)/100;
 const missing=['DISB','REV','GPMB'].filter(type=>!K.bound(work,s,type));
 const helper=missing.length?'<div class="source-onboarding"><b>Chưa đủ dữ liệu nguồn</b> · cần thêm '+missing.join(', ')+'. <button data-action="sources">Nhập file Excel</button></div>':'';
 const info=totalPages+' trang · '+L.description(pagination.direction)+' · '+(pagination.requested==='auto'?'Bố cục tự động':'Bố cục đã chọn');
 return tools()+helper+'<div class="studio-body"><div class="studio-left">'+localities()+'</div><div class="studio-right"><div class="studio-note">'+esc(info)+'. Bấm một ô số để xem dữ liệu và phép tính.</div><div class="studio-zoom" style="zoom:'+factor+'"><div class="studio-pages" id="print-area">'+html+'</div></div></div></div>';
}
function sessionPage(){
 return '<div class="studio-control-sheet"><div class="subpage-back"><button data-action="report">← Trở về báo cáo</button></div><div class="page-header"><div><h1>Quản lý phiên báo cáo</h1><p>Phiên mới bắt đầu với 0 địa phương. Dữ liệu và tùy chỉnh lưu độc lập theo từng phiên.</p></div><button class="primary" data-action="new">+ Phiên mới</button></div><div class="cards">'+(work.sessions.map(s=>'<article class="session-card '+(work.active===s.id?'active':'')+'"><h3>'+esc(s.name)+'</h3><small>'+new Date(s.updatedAt).toLocaleString('vi-VN')+' · '+s.selected.length+' địa phương</small><div class="actions"><button data-action="open-session" data-id="'+esc(s.id)+'">Mở phiên</button><button data-action="rename-session" data-id="'+esc(s.id)+'">Đổi tên</button><button data-action="copy-session" data-id="'+esc(s.id)+'">Nhân bản</button><button data-action="close-session" data-id="'+esc(s.id)+'">Đóng</button><button class="danger" data-action="delete-session" data-id="'+esc(s.id)+'">Xóa</button></div></article>').join('')||'<p>Chưa có phiên nào.</p>')+'</div><h2>Bản sao lưu</h2><p>Lưu tệp .kxh.json để không phụ thuộc bộ nhớ trình duyệt. Dữ liệu không gửi lên mạng.</p><div class="actions"><button data-action="backup">Lưu toàn bộ hồ sơ</button><button data-action="backup-session">Lưu riêng phiên</button><label class="file-button">Mở bộ hồ sơ <input id="restore-file" type="file" accept=".json,.kxh.json" hidden></label></div></div>';
}
function viDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Chưa xác nhận';}
function sourcesPage(){
 const pendingItems=pending.map((p,i)=>{
  const existing=p.alreadyPresent;
  const status=p.error?'<span class="warning">'+esc(p.error)+'</span>':'<b>'+esc(p.type)+' · '+esc(p.sheet)+' · '+p.count+' địa phương'+(p.projects?' / '+p.projects+' dự án':'')+'</b>';
  const note=existing?'<p class="notice">Nguồn này đã có trong hồ sơ (cùng SHA-256). Không cần nhập lại hoặc xác nhận lại ngày.</p>':
    p.error?'':('<p class="help">'+(p.dateAutomatic?
      'Ngày chốt được nhận diện từ tiêu đề sheet. Bạn kiểm tra lại trước khi nhập.':
      'Chưa xác định chắc chắn ngày chốt từ tiêu đề sheet. Hãy nhập ngày đã được xác minh và giải thích căn cứ; không suy luận từ tên file.')+'</p>');
  const controls=p.error||existing?'':('<label>Ngày chốt dữ liệu <input data-pending-date="'+i+'" type="date" value="'+esc(p.date||'')+'"><small data-date-vi="'+i+'">Ngày/tháng/năm: '+esc(viDate(p.date))+'</small></label>'+
    '<label>Căn cứ xác nhận ngày <input data-pending-reason="'+i+'" placeholder="Nêu tiêu đề, văn bản hoặc xác nhận của người dùng" value="'+esc(p.reason||'')+'" style="min-width:290px"></label>'+
    (p.dateEvidence?'<p class="help">Chứng cứ trong file: '+esc(p.dateEvidence)+'</p>':'')+
    (p.type==='REV'?'<p class="notice">Nguồn thu có kỳ “10 tháng” nhưng ngày chốt chưa rõ; ngày 19/10 hoặc 31/10 không tự được xác nhận.</p>':''));
  return '<div class="source-item">'+esc(p.file.name)+'<p>'+status+'</p>'+note+controls+
    (p.validationError?'<p class="warning" role="alert">'+esc(p.validationError)+'</p>':'')+'</div>';
 }).join('');
 const newCount=pending.filter(x=>!x.error&&!x.alreadyPresent).length;
 return '<div class="studio-control-sheet"><div class="subpage-back"><button data-action="report">← Trở về báo cáo</button></div><h1>Nhập ba file nguồn Excel</h1><p>Chọn một hoặc cả ba tệp theo thứ tự bất kỳ. Ứng dụng tự nhận dạng bằng cấu trúc workbook và tự đưa căn cứ ngày chốt khi tiêu đề rõ ràng.</p><div class="studio-dropzone" id="studio-dropzone" data-action="select-files">Kéo thả 1–3 file Excel vào đây hoặc <b>bấm để chọn</b><input type="file" id="source-files" multiple accept=".xlsx" hidden></div><div class="source-review">'+pendingItems+'</div>'+
 (newCount?'<button class="primary" data-action="commit-sources">Nhập các nguồn hợp lệ ('+newCount+' tệp đang chọn)</button>':'')+
 '<h2>Những nguồn đang sử dụng</h2><div class="source-review">'+(work.datasets.map(d=>'<div class="source-item"><b>'+esc(d.type)+' · '+esc(d.fileName)+'</b><p>'+esc(d.sheetName)+' · '+d.localities.length+' địa phương · ngày chốt '+esc(d.asOfDate)+'</p><small>SHA-256: '+esc(d.hash)+'</small></div>').join('')||'<p>Chưa nhập nguồn.</p>')+'</div></div>';
}
function settingsPage(){
 const s=current();
 if(!s)return '<div class="studio-control-sheet"><button data-action="report">← Báo cáo</button><h1>Thiết lập mẫu</h1><p>Hãy tạo phiên trước.</p></div>';
 normalizeSettings(s);const st=s.settings;
 const select=(key,label,values)=>'<label>'+label+'<select data-setting="'+key+'">'+values.map(([val,name])=>'<option value="'+val+'" '+(st[key]===val?'selected':'')+'>'+name+'</option>').join('')+'</select></label>';
 return '<div class="studio-control-sheet studio-setting-panel"><div class="subpage-title"><button data-action="report">← Quay lại báo cáo</button><div><h1>Thiết lập mẫu báo cáo</h1><p>Thường chỉ cài một lần. Khi thấy phù hợp, chọn “Lưu làm mẫu mặc định” để mọi phiên mới kế thừa thiết kế.</p></div></div>'+
 '<div class="settings-actions"><button class="primary" data-action="save-default-design">Lưu làm mẫu mặc định</button><span>'+(work.studioDefaults?'Đã có mẫu mặc định cho các phiên tạo mới.':'Chưa lưu mẫu mặc định.')+'</span></div>'+
 '<section class="panel"><h2>Thông tin trình bày</h2><div class="field-grid"><label>Tiêu đề báo cáo<input data-setting="title" value="'+esc(st.title)+'"></label><label>Cơ quan ban hành<input data-setting="agency" value="'+esc(st.agency||'')+'"></label><label>Phụ đề<input data-setting="subtitle" value="'+esc(st.subtitle||'')+'"></label>'+
 select('tableMode','Cách bố trí địa phương',[['auto','Tự tối ưu trang'],['horizontal','Địa phương ngang'],['vertical','Địa phương dọc']])+
 select('paperSize','Khổ in',[['A4','A4'],['A3','A3']])+
 select('orientation','Chiều giấy',[['landscape','Ngang'],['portrait','Dọc']])+'</div></section>'+
 '<details class="advanced-options"><summary>Định dạng số, font và ngưỡng nhận xét (ít khi sửa)</summary><div class="advanced-content field-grid">'+
 select('moneyUnit','Đơn vị tiền',[['billion','Tỷ đồng'],['million','Triệu đồng']])+
 select('areaUnit','Diện tích',[['m2','m²'],['ha','ha']])+
 [['fontSize','Cỡ chữ (px)',10,18],['decimals','Chữ số thập phân',0,6],['threshold','Ngưỡng nhận xét (điểm %)',0,100]].map(([key,label,min,max])=>'<label>'+label+'<input type="number" min="'+min+'" max="'+max+'" data-setting="'+key+'" value="'+st[key]+'"></label>').join('')+
 '<label>Phóng to trên màn hình<select id="studio-zoom"><option value="fit" '+(zoom==='fit'?'selected':'')+'>Vừa trang</option>'+[100,125,150].map(x=>'<option value="'+x+'" '+(zoom==x?'selected':'')+'>'+x+'%</option>').join('')+'</select></label></div></details>'+
 '<details class="advanced-options"><summary>Ẩn/hiện, đổi tên, sắp xếp và nhân bản chỉ tiêu</summary><div class="advanced-content"><div class="row-options">'+s.rows.map((r,i)=>'<div class="row-option"><input type="checkbox" data-toggle-row="'+esc(r.key)+'" '+(r.visible?'checked':'')+'><input data-row-label="'+esc(r.key)+'" value="'+esc(r.label)+'"><button data-action="move-row" data-index="'+i+'" data-dir="-1" title="Lên">↑</button><button data-action="move-row" data-index="'+i+'" data-dir="1" title="Xuống">↓</button><button data-action="duplicate-row" data-index="'+i+'" title="Nhân bản">+</button></div>').join('')+'</div></div></details>'+
 '<details class="advanced-options"><summary>Kiểm tra chất lượng, nguồn thiếu và truy vết dữ liệu</summary><div class="advanced-content"><p>Các cảnh báo nguồn thiếu và sai khác GPMB không bị tắt khi thay đổi mẫu.</p><button data-action="quality">Xem bảng kiểm tra dữ liệu của phiên</button></div></details>'+
 '<div class="settings-bottom"><button class="primary" data-action="save-default-design">Lưu thiết kế làm mặc định</button><button data-action="report">Quay lại báo cáo</button></div></div>';
}
function qualityPage(){
 const s=current();if(!s)return '<div class="studio-control-sheet">Chưa tạo phiên.</div>';
 const cov=K.coverage(work,s,true),issues=['REV','DISB','GPMB'].flatMap(t=>(K.bound(work,s,t)?.issues||[]).filter(x=>s.selected.includes(K.localityId(x.locality))));
 return '<div class="studio-control-sheet"><div class="subpage-back"><button data-action="settings">← Trở về thiết lập mẫu</button></div><h1>Kiểm tra dữ liệu nguồn</h1><p>Cảnh báo chỉ phản ánh địa phương được chọn. Không có bản ghi không đồng nghĩa không phát sinh.</p><h2>Nguồn thiếu / từng địa phương ('+cov.length+')</h2><div class="table-wrap"><table><thead><tr><th>Địa phương</th><th>Nguồn</th><th>Trạng thái</th><th>Ô</th><th>Nguyên nhân</th></tr></thead><tbody>'+cov.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.sourceCell)+'</td><td>'+esc(x.reason)+'</td></tr>').join('')+'</tbody></table></div><h2>Các cảnh báo ('+issues.length+')</h2><div class="table-wrap"><table><tbody>'+issues.map(x=>'<tr><td>'+esc(x.locality)+'</td><td>'+esc(x.rule)+'</td><td>'+esc(x.sourceCell)+'</td><td>'+esc(x.explanation)+'</td></tr>').join('')+'</tbody></table></div></div>';
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
 navbar();
 $('#main').innerHTML=tab==='report'?reportView():tab==='sessions'?sessionPage():tab==='sources'?sourcesPage():tab==='settings'?settingsPage():tab==='quality'?qualityPage():reportView();
 badge();
 if(tab==='report'&&current()){
  const list=$('#locality-list');if(list)list.scrollTop=localityScroll;
  filterLoc();
 }
}
function fitPaper(){/* CSS zoom applies only on screen and not printed content. */}
// Only evidence stated in the selected visible sheet's A1 may prefill a day.
// A file name, period label, another sheet or the current date are not a day source.
function dateFromTitle(text){
 const found=new Set();
 for(const match of String(text||'').matchAll(/(?:^|[^\d])([0-3]?\d)[./-]([01]?\d)[./-]((?:19|20)\d{2})(?!\d)/g)){
  const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day){
   found.add(String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'));
  }
 }
 return found.size===1?[...found][0]:null;
}
function dateOnlyReason(text){return /^\s*\d{1,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,4}\s*$/.test(text||'');}
async function identifyFiles(files){
 pending=[];navigate('sources');
 for(const file of files){
  const entry={file,type:null,error:null,date:'',reason:'',dateAutomatic:false,dateEvidence:'',validationError:'',alreadyPresent:false,sheet:'',count:0,projects:0};
  try{
   if(!/\.xlsx$/i.test(file.name))throw Error('Chỉ hỗ trợ .xlsx');
   const bytes=await file.arrayBuffer(),book=await K.openBook(bytes),matches=[];
   for(const [type,profile] of Object.entries(K.kinds)){
    for(const sh of book.sheets.filter(x=>x.state==='visible'&&x.name===profile.sheet)){
     const rows=await K.sheetRows(book,sh);
     const first=type==='GPMB'?rows.get(3)?.B?.text:rows.get(profile.rows[0])?.B?.text;
     if(!/^(xã|phường|đặc khu)\s+/iu.test(K.normName(first)))continue;
     if(type==='DISB'&&!K.isDecimal(rows.get(13)?.F?.text))continue;
     if(type==='REV'&&!K.isDecimal(rows.get(11)?.C?.text))continue;
     matches.push({type,sheet:sh.name,rows});
    }
   }
   if(matches.length!==1)throw Error(matches.length?'Nhiều cấu trúc có thể khớp, cần xác minh thủ công':'Không nhận diện được profile nguồn; chưa nhập');
   const match=matches[0];entry.type=match.type;entry.sheet=match.sheet;
   entry.count={DISB:114,REV:113,GPMB:108}[entry.type];entry.projects=entry.type==='GPMB'?422:0;
   if(pending.some(x=>x.type===entry.type&&!x.error))throw Error('Có hai tệp cùng loại '+entry.type+'; chỉ được chọn một cho lượt nhập');
   const hash=await K.sha256(bytes);
   entry.alreadyPresent=work.datasets.some(ds=>ds.type===entry.type&&ds.hash===hash);
   if(!entry.alreadyPresent){
    const title=K.normName(match.rows.get(1)?.A?.text||'');
    const fromTitle=dateFromTitle(title);
    entry.dateEvidence=title?match.sheet+'!A1: '+title:'Không có ngày chốt rõ trong ô A1';
    // Only fixed profiles DISB/GPMB use their title's explicit, unique date.
    // REV "10 tháng" does not establish an as-of date, even if another date occurs.
    if(entry.type!=='REV'&&fromTitle&&fromTitle===K.kinds[entry.type].date){
     entry.date=fromTitle;
     entry.reason='Xác nhận theo '+entry.dateEvidence;
     entry.dateAutomatic=true;
    }
   }
  }catch(e){entry.error=e.message;}
  pending.push(entry);render();
 }
}
async function commitPending(){
 // Preserve edits before any asynchronous work, even when another file is invalid.
 const successful=new Set(),inserts=[],failures=[];
 for(const [i,item] of pending.entries()){
  if(item.error||item.alreadyPresent){if(item.alreadyPresent)successful.add(item);continue;}
  item.date=$('[data-pending-date="'+i+'"]')?.value||item.date||'';
  item.reason=$('[data-pending-reason="'+i+'"]')?.value?.trim()||'';
  item.validationError='';
  if(!item.date){
   item.validationError='Chưa có ngày chốt. Cần xác minh rồi nhập ngày, không tự lấy từ tên file.';
  }else if(!item.reason){
   item.validationError='Cần căn cứ xác nhận ngày chốt. Với nguồn thu, ghi rõ văn bản hoặc người xác nhận.';
  }else if(dateOnlyReason(item.reason)){
   item.validationError='Căn cứ phải là lời giải thích hoặc nguồn xác nhận, không chỉ là một ngày.';
  }
  if(item.validationError){failures.push(item.file.name);continue;}
  try{
   const ds=await K.importFile(item.file,item.type,item.date,item.reason);
   if(!work.datasets.some(x=>x.id===ds.id)&&!inserts.some(x=>x.id===ds.id))inserts.push(ds);
   successful.add(item);
  }catch(e){item.validationError=e.message;failures.push(item.file.name);}
 }
 for(const ds of inserts){
  work.datasets.push(ds);
  for(const s of work.sessions)if(!s.bindings[ds.type])s.bindings[ds.type]=ds.id;
  work.audit.push({action:'Nhập '+ds.type,hash:ds.hash,when:new Date().toISOString()});
 }
 pending=pending.filter(item=>!successful.has(item));
 if(inserts.length)mark();
 render();
 if(failures.length&&inserts.length){
  alertMessage('Đã nhập '+inserts.length+' nguồn hợp lệ; còn '+failures.length+' tệp cần xác minh ngày/căn cứ. Các nguồn đã nhập không bị mất.',true);
 }else if(failures.length){
  alertMessage('Chưa thể nhập '+failures.length+' tệp. Xem lỗi ngay dưới từng nguồn; dữ liệu đã nhập trước đó vẫn giữ nguyên.',true);
 }else{
  alertMessage('Đã nhập '+inserts.length+' nguồn mới. Các nguồn có cùng SHA-256 đã được bỏ qua.');
 }
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
 case 'sources':navigate('sources');break;
 case 'quality':navigate('quality');break;
 case 'show-localities':{document.body.classList.remove('studio-localities-hidden');navigate('report');const field=$('#locality-search');if(field)field.focus();break;}
 case 'toggle-localities':document.body.classList.toggle('studio-localities-hidden');break;
 case 'sessions':navigate('sessions');break;
 case 'settings':navigate('settings');break;
 case 'report':navigate('report');break;
 case 'new':{const v=K.newSession(work,'Báo cáo '+(work.sessions.length+1));if(work.studioDefaults){v.settings=JSON.parse(JSON.stringify(work.studioDefaults.settings));v.rows=JSON.parse(JSON.stringify(work.studioDefaults.rows));}normalizeSettings(v);work.sessions.push(v);work.active=v.id;document.body.classList.remove('studio-localities-hidden');mark();navigate('report');break;}
 case 'save-default-design':if(s){work.studioDefaults={settings:JSON.parse(JSON.stringify(s.settings)),rows:JSON.parse(JSON.stringify(s.rows)),savedAt:new Date().toISOString()};mark();render();alertMessage('Đã lưu thiết kế hiện tại làm mẫu mặc định cho các phiên mới.');}break;
 case 'open-session':work.active=b.dataset.id;mark();navigate('report');break;
 case 'rename-session':{const v=work.sessions.find(x=>x.id===b.dataset.id),name=prompt('Đổi tên phiên',v.name);if(name?.trim()){v.name=name.trim();changed(v,'Đổi tên phiên');}break;}
 case 'close-session':if(work.active===b.dataset.id){work.active=null;mark();navigate('sessions');}break;
 case 'copy-session':{const v=work.sessions.find(x=>x.id===b.dataset.id),copy=JSON.parse(JSON.stringify(v));copy.id=K.id();copy.name+=' (bản sao)';copy.revision=1;copy.audit=[];work.sessions.push(copy);work.active=copy.id;mark();navigate('report');break;}
 case 'delete-session':{const v=work.sessions.find(x=>x.id===b.dataset.id);if(confirm('Xóa phiên '+v.name+'? Không thể hoàn tác nếu chưa sao lưu.')){work.sessions=work.sessions.filter(x=>x.id!==v.id);if(work.active===v.id)work.active=null;mark();render();}break;}
 case 'toggle-rail':document.body.classList.toggle('studio-rail-compact');break;
 case 'toggle-wide':document.body.classList.toggle('studio-wide');break;
 case 'select-visible':{if(!s)return;localityScroll=$('#locality-list')?.scrollTop||0;document.querySelectorAll('.locality-item:not([hidden]) input').forEach(x=>{if(!s.selected.includes(x.dataset.loc))s.selected.push(x.dataset.loc);});changed(s,'Chọn địa phương trong bộ lọc');break;}
 case 'clear-localities':if(s&&confirm('Bỏ chọn tất cả địa phương?')){localityScroll=$('#locality-list')?.scrollTop||0;s.selected=[];changed(s,'Bỏ chọn danh sách');}break;
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
 if(el.dataset.pendingDate!==undefined){const t=$('[data-date-vi="'+el.dataset.pendingDate+'"]');if(t)t.textContent='Ngày/tháng/năm: '+viDate(el.value);return;}
 if(el.id==='restore-file'){restore(el.files?.[0]).catch(ex=>alertMessage(ex.message,true));return}
 if(el.id==='locality-type'){localityKind=el.value;localityScroll=0;filterLoc();return}
 if(el.id==='studio-zoom'){zoom=el.value;render();return}
 if(el.id==='studio-mode'&&s){s.settings.tableMode=el.value;changed(s,'Đổi chiều bảng');return}
 if(el.dataset.loc&&s){localityScroll=$('#locality-list')?.scrollTop||0;const id=el.dataset.loc;if(el.checked&&!s.selected.includes(id))s.selected.push(id);else if(!el.checked)s.selected=s.selected.filter(x=>x!==id);changed(s,'Chọn địa phương');return}
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
 document.addEventListener('input',e=>{if(e.target.id==='locality-search'){localityQuery=e.target.value;localityScroll=0;filterLoc();}});
 document.addEventListener('dragover',e=>{if(e.target.closest('#studio-dropzone')){e.preventDefault();e.target.closest('#studio-dropzone').classList.add('dragover');}});
 document.addEventListener('dragleave',e=>{e.target.closest('#studio-dropzone')?.classList.remove('dragover')});
 document.addEventListener('drop',e=>{const dz=e.target.closest('#studio-dropzone');if(dz){e.preventDefault();dz.classList.remove('dragover');identifyFiles(e.dataTransfer.files);}});
 $('#overlay').addEventListener('click',()=>{$('#inspector').hidden=true;$('#overlay').hidden=true});
 root.addEventListener('beforeunload',e=>{if(saveTimer||saveError||backupDirty){e.preventDefault();e.returnValue='';}});
 render();
}
document.addEventListener('DOMContentLoaded',start);
})(typeof globalThis!=='undefined'?globalThis:this);
