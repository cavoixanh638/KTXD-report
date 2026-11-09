/* Presentation-only A4/A3 pagination. Uses existing KTXH result/trace pairs. */
(function(root){
'use strict';
const K=root.KTXH=root.KTXH||{};
function clamp(n,low,high){return Math.max(low,Math.min(high,Number(n)||low));}
function spec(settings){
 const a3=settings.paperSize==='A3',portrait=settings.orientation==='portrait';
 const w=a3?420:297,h=a3?297:210;
 return {width:portrait?h:w,height:portrait?w:h,margin:10,portrait,a3};
}
function labelWidth(text,base=22){return clamp(base+Array.from(String(text||'')).length*.35,base,base+36);}
function availableColumns(widths,limit){
 let sum=0,n=0;
 for(const w of widths){if(n&&sum+w>limit)break;sum+=w;n++;}
 return Math.max(1,n);
}
function slices(length,count){
 const result=[];
 for(let i=0;i<length;i+=count)result.push(Array.from({length:Math.min(count,length-i)},(_,j)=>i+j));
 return result.length?result:[[]];
}
function description(direction){return direction==='vertical'?'Địa phương theo chiều dọc':'Địa phương theo chiều ngang';}
function candidate(report,settings,direction){
 const p=spec(settings),cols=report.columns,rows=report.rows;
 const font=clamp(settings.fontSize,10,18),line=Math.max(6.5,font*.51);
 const tableWidth=p.width-2*p.margin,tableHeight=p.height-2*p.margin-57;
 const rowLimit=Math.max(3,Math.floor((tableHeight-10)/line));
 const groups=[];
 if(direction==='horizontal'){
  const nameWidth=Math.min(83,Math.max(63,Math.max(0,...rows.map(x=>labelWidth(x.row.label,42)))*.85));
  const capacity=tableWidth-nameWidth-12;
  let start=0;
  while(start<cols.length){
   let used=0,end=start;
   while(end<cols.length){
    const x=clamp(labelWidth(cols[end].name,21),27,42);
    if(end>start&&used+x>capacity)break;
    used+=x;end++;
   }
   groups.push(Array.from({length:end-start},(_,i)=>start+i));start=end;
  }
  if(!groups.length)groups.push([]);
  const rowChunks=slices(rows.length,rowLimit);
  const pages=[];
  for(const g of groups)for(const rr of rowChunks)pages.push({direction,localities:g,metrics:rr});
  return {direction,pages,spec:p,colsPerPage:groups[0].length,rowsPerPage:rowLimit,cost:pages.length+groups.length*.05};
 }
 const nameWidth=Math.max(44,Math.min(65,Math.max(0,...cols.map(x=>labelWidth(x.name,32)))));
 const capacity=tableWidth-nameWidth;
 let start=0;
 while(start<rows.length){
  let used=0,end=start;
  while(end<rows.length){
   const x=clamp(labelWidth(rows[end].row.label,22),35,64);
   if(end>start&&used+x>capacity)break;
   used+=x;end++;
  }
  groups.push(Array.from({length:end-start},(_,i)=>start+i));start=end;
 }
 if(!groups.length)groups.push([]);
 const rowChunks=slices(cols.length,rowLimit),pages=[];
 for(const g of groups)for(const ll of rowChunks)pages.push({direction,localities:ll,metrics:g});
 return {direction,pages,spec:p,colsPerPage:groups[0].length,rowsPerPage:rowLimit,cost:pages.length+groups.length*.06};
}
function paginate(report,settings){
 const h=candidate(report,settings,'horizontal'),v=candidate(report,settings,'vertical');
 const pref=settings.tableMode||'auto';
 const choice=pref==='horizontal'?h:pref==='vertical'?v:(h.cost<=v.cost?h:v);
 return {...choice,requested:pref,reason:pref==='auto'?'Tự động chọn '+description(choice.direction).toLowerCase()+' theo số cột, chiều dài nhãn và số trang A4.':'Bố cục do người dùng chọn',alternatives:{horizontal:h.pages.length,vertical:v.pages.length}};
}
function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});
}
function cellMarkup(item,ri,ci,escape){
 const q=item.quality==='PARTIAL_AGGREGATE'?' partial':item.value===null?' unavailable':'';
 return '<td class="number"><button class="doc-cell'+q+'" type="button" data-action="inspect" data-row="'+ri+'" data-col="'+ci+'" title="Xem nguồn và phép tính" aria-label="Xem phép tính '+escape(item.trace.result.displayedText)+'">'+escape(item.trace.result.displayedText)+'</button></td>';
}
function pageTable(report,page,escape){
 if(!report.columns.length)return '<div class="no-selection"><b>Chưa chọn địa phương.</b><p>Chọn một hoặc nhiều đơn vị từ danh sách chung bên trái để tính số liệu theo ba nguồn Excel.</p></div>';
 const rows=report.rows,cols=report.columns;
 if(page.direction==='horizontal'){
  const head='<tr><th class="doc-index">STT</th><th class="doc-label">Chỉ tiêu</th>'+page.localities.map(i=>'<th>'+escape(cols[i].name)+'</th>').join('')+'</tr>';
  const body=page.metrics.map(i=>'<tr><td class="doc-index">'+escape(rows[i].row.originalRow)+'</td><th class="doc-label" scope="row"><button class="doc-edit" data-action="edit-row" data-row-key="'+escape(rows[i].row.key)+'" title="Đổi nhãn chỉ tiêu">'+escape(rows[i].row.label)+'</button></th>'+page.localities.map(j=>cellMarkup(rows[i].cells[j],i,j,escape)).join('')+'</tr>').join('');
  return '<table class="doc-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
 }
 const head='<tr><th class="doc-label">Địa phương</th>'+page.metrics.map(i=>'<th>'+escape(rows[i].row.label)+'</th>').join('')+'</tr>';
 const body=page.localities.map(j=>'<tr><th class="doc-label" scope="row">'+escape(cols[j].name)+'</th>'+page.metrics.map(i=>cellMarkup(rows[i].cells[j],i,j,escape)).join('')+'</tr>').join('');
 return '<table class="doc-table vertical"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
}
function reportFootnotes(report,escape){
 const ds=report.sources.map(d=>d.type+': '+d.asOfDate+' ('+d.localities.length+' địa phương)').join('; ')||'Chưa nhập nguồn';
 return '<p><b>Phương pháp:</b> Tỷ lệ tổng hợp = tổng tử/tổng mẫu; GPMB = diện tích I đã ghi nhận / diện tích D; nguồn thiếu không được thay bằng 0.</p>'+
 '<p><b>Nguồn & kỳ chốt:</b> '+escape(ds)+'. Mốc 113/108 là tham khảo khi thiếu bản ghi; số liệu GPMB có thể PARTIAL.</p>';
}
function documentHeader(settings,escape,appendix){
 const agency=escape(settings.agency||'CƠ QUAN LẬP BÁO CÁO');
 const subtitle=escape(settings.subtitle||'');
 const headline=appendix||settings.title||'BÁO CÁO CHỈ TIÊU KINH TẾ - XÃ HỘI';
 return '<div class="doc-head"><div class="doc-authority">'+agency+'</div><div class="doc-national"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><span>Độc lập - Tự do - Hạnh phúc</span></div></div>'+
 '<div class="doc-heading"><button type="button" data-action="edit-title" class="doc-edit-title" title="Sửa tiêu đề">'+escape(headline)+'</button>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</div>';
}
function renderDocument(report,settings,session,escape=escapeHtml){
 const pagination=paginate(report,settings),pages=[...pagination.pages];
 const notices=[...(report.coverage||[]).map(x=>x.name+' · '+x.type+' · '+x.status+' · '+x.sourceCell+' — '+x.reason),
  ...(report.issues||[]).map(x=>x.locality+' · '+x.rule+' · '+(x.sourceCell||'')+' — '+x.explanation)];
 const perAppendix=14,extra=[];
 for(let i=0;i<notices.length;i+=perAppendix)extra.push(notices.slice(i,i+perAppendix));
 const total=pages.length+extra.length;
 const dim='--paper-w:'+pagination.spec.width+'mm;--paper-h:'+pagination.spec.height+'mm;--doc-font:'+clamp(settings.fontSize,10,18)+'px;';
 let result=pages.map((page,i)=>{
  return '<section class="paper-sheet" style="'+dim+'" aria-label="Trang '+(i+1)+' trên '+total+'"><div class="paper-content">'+
   documentHeader(settings,escape)+
   '<div class="doc-caption">'+escape(session.name)+' · '+report.columns.length+' địa phương · '+description(page.direction)+'</div>'+
   pageTable(report,page,escape)+
   '<div class="doc-notes">'+reportFootnotes(report,escape)+'</div>'+
   '<div class="doc-page-number">'+(i+1)+' / '+total+'</div></div></section>';
 }).join('');
 result+=extra.map((items,index)=>{
  const number=pages.length+index+1;
  return '<section class="paper-sheet" style="'+dim+'" aria-label="Phụ lục trang '+number+'"><div class="paper-content">'+
  documentHeader(settings,escape,'PHỤ LỤC KIỂM TRA DỮ LIỆU')+'<div class="doc-caption">Danh sách địa phương, nguồn và cảnh báo trong phạm vi phiên</div>'+
  '<ol class="doc-appendix">'+items.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ol>'+
  '<div class="doc-notes">'+reportFootnotes(report,escape)+'</div><div class="doc-page-number">'+number+' / '+total+'</div></div></section>';
 }).join('');
 return {html:result,pagination,appendixPages:extra.length,totalPages:total};
}
Object.assign(K,{StudioLayout:{spec,candidate,paginate,renderDocument,description}});
})(typeof globalThis!=='undefined'?globalThis:this);
