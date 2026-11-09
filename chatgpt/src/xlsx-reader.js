/* Fixed-profile XLSX reader. Parses cached XML values only. Does not execute
   workbook formulas, macros, external links or any remote request. */
(function(root){
'use strict';
const K=root.KTXH=root.KTXH||{};
const kinds={DISB:{sheet:'Tổng hợp',rows:[13,126],cols:['B','C','F','G','H','I','J','K','L','M','N','O','P','Q'],period:'Đến 15/10/2026',date:'2026-10-15'},REV:{sheet:'10T-19.10',rows:[11,123],cols:['B','C','D','E','F','G','H','I','R','W'],period:'10 tháng đầu năm 2026',date:null},GPMB:{sheet:'Tổng hợp theo địa bàn',rows:[3,532],cols:['A','B','C','D','E','F','G','I','J','K','L','M','N'],period:'Đến 26/10/2026',date:'2026-10-26'}};
function tag(n,local){return Array.from(n.getElementsByTagName('*')).filter(x=>x.localName===local)}
function direct(n,local){return Array.from(n.children||[]).find(x=>x.localName===local)}
function xml(s){let d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror')) throw Error('XML workbook bị lỗi');return d}
function normName(n){return String(n||'').normalize('NFC').trim().replace(/\s+/g,' ')}
function localityId(n){return normName(n).toLocaleLowerCase('vi')}
function plain(n){return normName(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase()}
function raw(v,cell,fieldId,unit){
 const state = v.error?'FORMULA_ERROR':v.text==null||v.text===''?'MISSING':v.type==='n'&&K.isDecimal(v.text)?(K.Dec.of(v.text).isZero()?'ZERO':'VALUE'):(v.type==='n'?'INVALID':'VALUE');
 return {raw:v.text??null,state,unit,fieldId,sourceCell:cell,sourceFormula:v.formula||null,sourceType:v.type,cachedValue:v.text??null};
}
function fileSha256(buffer){return K.sha256(buffer);}
function normalizePath(p){let parts=[];for(const x of p.replace(/^\//,'').split('/')){if(x==='..')parts.pop();else if(x&&x!=='.')parts.push(x);}return parts.join('/')}
async function openBook(buffer){
 if(buffer.byteLength>35*1024*1024)throw Error('XLSX vượt giới hạn 35MB');
 const zip=await root.JSZip.loadAsync(buffer,{checkCRC32:true});
 if(Object.keys(zip.files).length>900)throw Error('XLSX quá nhiều thành phần');
 const w=zip.file('xl/workbook.xml'),r=zip.file('xl/_rels/workbook.xml.rels');if(!w||!r)throw Error('Không phải workbook XLSX hợp lệ');
 const [wb,re]=await Promise.all([w.async('string'),r.async('string')]);
 const book=xml(wb),rels=xml(re),link={};
 for(const z of tag(rels,'Relationship')){const target=z.getAttribute('Target')||'';link[z.getAttribute('Id')]=normalizePath(target.startsWith('/')||target.startsWith('xl/')?target:'xl/'+target);}
 const sheets=tag(book,'sheet').map((z,i)=>({name:z.getAttribute('name'),index:i,state:z.getAttribute('state')||'visible',file:link[z.getAttribute('r:id')||z.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')]}));
 let strings=[];
 if(zip.file('xl/sharedStrings.xml')){
   const s=xml(await zip.file('xl/sharedStrings.xml').async('string'));
   strings=tag(s,'si').map(si=>tag(si,'t').map(n=>n.textContent).join(''));
 }
 return {zip,sheets,strings};
}
async function sheetRows(book,sh){
 const part=book.zip.file(sh.file);if(!part)throw Error('Không có nội dung sheet '+sh.name+' ('+sh.file+')');
 const d=xml(await part.async('string')),result=new Map();
 for(const row of tag(d,'row')){
   const r=Number(row.getAttribute('r'));if(!Number.isInteger(r))continue;
   const c={};
   for(const el of Array.from(row.children).filter(x=>x.localName==='c')){
     const addr=el.getAttribute('r'),col=addr?.replace(/[0-9]/g,'');if(!col)continue;
     const t=el.getAttribute('t')||'n',v=direct(el,'v'),f=direct(el,'f'),inline=direct(el,'is');
     let text=v?.textContent??null;
     if(t==='s'&&text!=null)text=book.strings[Number(text)]??null;
     else if(t==='inlineStr'&&inline)text=tag(inline,'t').map(n=>n.textContent).join('');
     else if(t==='b'&&text!=null)text=text==='1'?'TRUE':'FALSE';
     c[col]={text,formula:f?.textContent||null,error:t==='e',type:(t==='n'||t===null)?'n':t};
   }
   result.set(r,c);
 }
 return result;
}
function sourceRefs(ds,rec,fields){return fields.map(field=>{
 const entry=rec?.fields?.[field];if(!entry)return null;
 return {datasetId:ds.id,fileName:ds.fileName,fileSha256:ds.hash,sheetName:ds.sheetName,sheetIndex:ds.sheetIndex,sheetVisibility:ds.visibility,address:entry.sourceCell,sourceFormula:entry.sourceFormula,sourceFormulaVerification:entry.sourceFormula?'UNVERIFIED':'NOT_APPLICABLE',cachedValue:entry.cachedValue,asOfDate:ds.asOfDate||'DATE_UNVERIFIED',mappingVersion:'PH1-v1'};
 }).filter(Boolean)}
async function importFile(file,type,confirmedDate,reason){
 if(!kinds[type])throw Error('Nguồn không hợp lệ');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate||'')||!Number.isFinite(Date.parse(confirmedDate+'T00:00:00Z')))throw Error('Phải xác nhận ngày chốt nguồn');
 if(type==='REV'&&!String(reason||'').trim())throw Error('Nguồn thu có ngày chốt mơ hồ; cần ghi lý do xác nhận');
 const buffer=await file.arrayBuffer(),hash=await fileSha256(buffer),book=await openBook(buffer),profile=kinds[type];
 const matches=book.sheets.filter(s=>s.name===profile.sheet&&s.state==='visible');
 if(matches.length!==1)throw Error(`Không tìm thấy sheet visible phù hợp (${profile.sheet}); không tự chọn sheet ẩn`);
 const sh=matches[0],rows=await sheetRows(book,sh);
 const prefix=/^(xã|phường|đặc khu)\s+/iu;
 const sample=type==='GPMB'?rows.get(3)?.B?.text:rows.get(profile.rows[0])?.B?.text;
 if(typeof sample!=='string'||!prefix.test(normName(sample)))throw Error('Fingerprint cấu trúc '+type+' không khớp ở tên địa phương đầu tiên');
 if(type==='DISB'&&!K.isDecimal(rows.get(13)?.F?.text))throw Error('Fingerprint DISB thiếu cột F tại dòng 13');
 if(type==='REV'&&!K.isDecimal(rows.get(11)?.C?.text))throw Error('Fingerprint REV thiếu cột C tại dòng 11');
 let records=[],locs=[],issues=[],current=null;
 const fieldUnits={B:'text',P:'text',Q:'text',N:'text',A:'count',C:'million',D:'million',E:'million',F:'million',G:'million',H:'million',I:'million',J:'million',K:'million',L:'million',M:'million',O:'percent-source',R:'million',W:'million'};
 if(type==='GPMB')Object.assign(fieldUnits,{C:'text',D:'m2',E:'count',F:'count',G:'VND',H:'text',I:'m2',J:'VND',K:'count',L:'count',M:'percent-source',N:'text'});
 const id=type+':'+hash.slice(0,16),colset=profile.cols;
 for(let rn=profile.rows[0];rn<=profile.rows[1];rn++){
   const cells=rows.get(rn)||{},b=normName(cells.B?.text||''),av=cells.A?.text;
   if(type==='GPMB'){
     if(prefix.test(b) && (av==null||av==='')){current=b;if(!locs.includes(b))locs.push(b);continue;}
     if(!/^\d+$/.test(String(av??'')))continue;
     if(!current)throw Error('Dòng dự án '+rn+' không thuộc địa phương nào');
   } else if(!prefix.test(b))continue;
   let name=type==='GPMB'?current:b,fields={};
   for(const col of colset){const cell=cells[col]||{text:null,type:'n'};fields[col]=raw(cell,col+rn,col,fieldUnits[col]||'text');}
   const record={id:id+'/'+rn,row:rn,locality:name,localityId:localityId(name),projectId:type==='GPMB'?String(av):null,projectName:type==='GPMB'?b:null,fields};
   records.push(record);
   if(!locs.includes(name))locs.push(name);
   if(type==='GPMB'){
      const D=K.numeric(fields.D),I=K.numeric(fields.I),M=K.numeric(fields.M),G=K.numeric(fields.G),J=K.numeric(fields.J),E=K.numeric(fields.E),nK=K.numeric(fields.K),F=K.numeric(fields.F),L=K.numeric(fields.L);
      if(D&&!I)issues.push({rule:'MISSING_GPMB_I',severity:'WARNING',locality:name,recordId:record.id,row:rn,sourceCell:'I'+rn,explanation:'Diện tích đã GPMB trống; vẫn giữ diện tích D trong mẫu số',declared:D.toString()});
      if(D&&D.cmp(0)>0&&I&&M){const pct=I.div(D,22).mul(100),delta=M.sub(pct);if(delta.abs().cmp('0.1')>0)issues.push({rule:'WARNING_M_RATIO_MISMATCH',severity:'WARNING',locality:name,recordId:record.id,projectId:String(av),row:rn,sourceCell:'M'+rn,sourceCells:['D'+rn,'I'+rn,'M'+rn],sourceM:M.toString(),recomputed:pct.toString(),delta:delta.toString(),explanation:'Cột M khác 100 × I/D hơn 0,1 điểm phần trăm; cần xác minh nguồn'});}
      for(const [key,v1,v2] of [['I_GT_D',I,D],['J_GT_G',J,G],['K_GT_E',nK,E],['L_GT_F',L,F]])if(v1&&v2&&v1.cmp(v2)>0)issues.push({rule:key,severity:'WARNING',locality:name,recordId:record.id,row:rn,sourceCell:(key.split('_')[0])+rn,explanation:'Chỉ tiêu ghi nhận vượt chỉ tiêu kế hoạch; không tự sửa dữ liệu'});
   }
 }
 if(type==='DISB'&&records.length!==114)throw Error('DISB profile cần 114 dòng địa phương, tìm được '+records.length);
 if(type==='REV'&&records.length!==113)throw Error('REV profile cần 113 dòng địa phương, tìm được '+records.length);
 if(type==='GPMB'&&(records.length!==422||locs.length!==108))throw Error('GPMB profile cần 422 dự án/108 địa bàn, thấy '+records.length+'/'+locs.length);
 return {id,type,hash,fileName:file.name,sheetName:sh.name,sheetIndex:sh.index,visibility:sh.state,periodLabel:profile.period,asOfDate:confirmedDate,asOfStatus:type==='REV'?'MANUAL_CONFIRMED':'DETECTED_CONFIRMED',confirmationReason:String(reason||'Người dùng xác nhận ngày trên tiêu đề'),confirmedAt:new Date().toISOString(),importedAt:new Date().toISOString(),fingerprint:profile.sheet+'|'+profile.rows.join('-')+'|'+profile.cols.join(''),localities:locs,records,issues};
}
Object.assign(K,{kinds,openBook,sheetRows,importFile,normName,localityId,plain,sourceRefs,isDecimal:function(s){return s!=null&&s!==''&&/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(String(s))},numeric:function(x){if(!x||!(x.state==='VALUE'||x.state==='ZERO')||!K.isDecimal(x.raw))return null;return K.Dec.of(x.raw)}});
})(typeof globalThis!=='undefined'?globalThis:this);
