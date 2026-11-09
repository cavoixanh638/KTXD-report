/* Browser XLSX writer: styled OOXML generated with the bundled JSZip.
   No SheetJS community style assumptions, no external dependencies/network. */
(function(root){
'use strict';const K=root.KTXH=root.KTXH||{},D=K.Dec;
function escapeXml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');}
function textCell(v,style=0){return {value:String(v??''),type:'s',style};}
function numericCell(v,unit,style=2){if(v===null||v===undefined)return textCell('Chưa có số liệu',4);return {value:unit==='percent'?D.of(v).div(100).toString():String(v),type:'n',style:unit==='percent'?3:style};}
function colName(n){let x='';for(n++;n;n=Math.floor((n-1)/26))x=String.fromCharCode(65+(n-1)%26)+x;return x;}
function safeText(v){const s=String(v??'');return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
function worksheetXml(rows,{colWidth=18,mergeTitle=false}={}){
 const maxCols=Math.max(1,...rows.map(x=>x.length)),all=[];
 for(let ri=0;ri<rows.length;ri++){
  const row=rows[ri],cells=[];
  for(let ci=0;ci<row.length;ci++){
   const c=row[ci];if(c==null)continue;
   const loc=colName(ci)+(ri+1),style=c.style||0;
   if(c.type==='n'&&/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(c.value))cells.push(`<c r="${loc}" s="${style}"><v>${escapeXml(c.value)}</v></c>`);
   else cells.push(`<c r="${loc}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(safeText(c.value))}</t></is></c>`);
  }
  all.push(`<row r="${ri+1}"${ri===0?' ht="28" customHeight="1"':''}>${cells.join('')}</row>`);
 }
 const widths=`<cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="44" customWidth="1"/>${maxCols>2?`<col min="3" max="${maxCols}" width="${colWidth}" customWidth="1"/>`:''}</cols>`;
 const merges=mergeTitle?`<mergeCells count="1"><mergeCell ref="A1:${colName(maxCols-1)}1"/></mergeCells>`:'';
 const print=`<pageMargins left="0.24" right="0.24" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/>`;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="19"/>${widths}<sheetData>${all.join('')}</sheetData>${merges}${print}</worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="165" formatCode="#,##0.00;[Red](#,##0.00);-"/><numFmt numFmtId="166" formatCode="0.00%"/></numFmts><fonts count="4"><font><sz val="12"/><name val="Times New Roman"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/><name val="Times New Roman"/></font><font><b/><color rgb="FF163B5C"/><sz val="12"/><name val="Times New Roman"/></font><font><color rgb="FFA33518"/><sz val="12"/><name val="Times New Roman"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173D61"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4EDF6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF0D5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function sheetData(work,s,report){
 const rows=[],rowCells={},log=[],exclude=[],include=[],formula=[],missing=[],warnings=[],sources=[];
 rows.push([textCell(s.settings.title,1)]);
 rows.push([textCell('Nguồn và kỳ chốt'),textCell(report.sources.map(d=>`${d.type}: ${d.asOfDate} (${d.localities.length} địa bàn)` ).join('; ')||'Chưa nhập đủ nguồn')]);
 rows.push([textCell('Mốc tham khảo'),textCell('DISB 114 địa phương; REV 113 địa phương (thiếu 1); GPMB 108 địa bàn (thiếu 6); GPMB theo SUM(I đã ghi nhận)/SUM(D), có dữ liệu thiếu')]);
 rows.push([textCell('STT',1),textCell('CHỈ TIÊU',1),...report.columns.map(x=>textCell(x.name,1))]);
 for(const r of report.rows){const cells=[numericCell(r.row.originalRow,'count',2),textCell(r.row.label,5)];
   for(let j=0;j<r.cells.length;j++){
     const item=r.cells[j],cell=item.value!==null?numericCell(item.value,item.unit):textCell(item.text||item.trace.result.displayedText,4),loc=colName(j+2)+(rows.length+1);
     cells.push(cell);rowCells[loc]=item.trace.traceId;
     const t=item.trace;
     log.push([t.traceId,r.row.metric,report.columns[j].name,loc,t.formula.readableExpression,t.result.exactDecimal??'',t.result.displayedText||'',t.result.canonicalUnit,t.quality.status,t.scope.type,t.scope.asOfDates.join('; '),t.population.includedCount,t.population.excludedCount,t.population.missingCount,t.steps.map(x=>x.operation+': '+(x.output??'null')).join('; '),t.sourceRefs.map(x=>`${x.sheetName}!${x.address}`).join('; ')]);
     t.exclusions.forEach(x=>exclude.push([t.traceId,x.recordId,x.affectedOperand,x.reasonCode,x.sourceCell||'',x.explanation]));
     t.population.includedRecordIds.forEach(x=>include.push([t.traceId,x]));
   }
   rows.push(cells);
 }
 for(const r of s.rows){if(formula.some(a=>a[0]===r.metric))continue;formula.push([r.metric,r.label,'PH1.1','Chi tiết tại Nhật ký phép tính',r.group]);}
 for(const x of report.coverage)missing.push([x.name,x.type,x.field,x.status,x.sourceCell,x.reason,x.asOfDate,x.impact]);
 for(const x of report.issues)warnings.push([x.locality,x.rule,x.severity,x.projectId||'',x.row,x.sourceCell,x.sourceM||'',x.recomputed||'',x.delta||'',x.explanation]);
 for(const ds of report.sources)sources.push([ds.type,ds.fileName,ds.hash,ds.sheetName,ds.sheetIndex,ds.visibility,ds.asOfDate,ds.asOfStatus,ds.confirmationReason,ds.periodLabel,ds.localities.length,ds.records.length]);
 const fromTable=(headers,data)=>[headers.map(x=>textCell(x,1)),...data.map(line=>line.map(x=>typeof x==='number'?numericCell(String(x),'count'):textCell(x)))];
 return [
 {name:'Báo cáo',rows,opts:{mergeTitle:true}},
 {name:'Danh mục công thức',rows:fromTable(['Mã','Tên chỉ tiêu','Phiên bản','Phương pháp','Nhóm'],formula)},
 {name:'Nhật ký phép tính',rows:fromTable(['Trace ID','Mã chỉ tiêu','Địa phương','Ô báo cáo','Công thức','Giá trị gốc','Giá trị hiển thị','Đơn vị','Chất lượng','Phạm vi','Ngày chốt','Số bản ghi tính','Số không tính','Số thiếu','Các bước','Ô nguồn'],log)},
 {name:'Bản ghi không tính',rows:fromTable(['Trace ID','Bản ghi','Toán hạng','Lý do','Ô nguồn','Diễn giải'],exclude)},
 {name:'Bản ghi được tính',rows:fromTable(['Trace ID','ID bản ghi được tính'],include)},
 {name:'Nguồn thiếu & lý do',rows:fromTable(['Địa phương','Nguồn','Chỉ tiêu','Trạng thái','Bằng chứng ô','Nguyên nhân','Ngày chốt','Tác động'],missing)},
 {name:'Cảnh báo',rows:fromTable(['Địa phương','Quy tắc','Mức','STT dự án','Dòng','Ô nguồn','M gốc','100×I/D','Chênh điểm %','Diễn giải'],warnings)},
 {name:'Nguồn & thời điểm',rows:fromTable(['Nguồn','Tên tệp','SHA-256','Sheet','Sheet index','Visibility','Ngày chốt','Trạng thái ngày','Lý do xác nhận','Kỳ','Địa phương có bản ghi','Số dòng'],sources)}
 ];
}
async function exportXlsx(work,s,report){
 if(!root.JSZip)throw Error('Chưa có thư viện ZIP');
 const sheets=sheetData(work,s,report),zip=new root.JSZip();
 let types=['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>','<Default Extension="xml" ContentType="application/xml"/>'];
 let nodes=[],rels=[];
 for(let i=0;i<sheets.length;i++){
   const n=i+1;zip.file(`xl/worksheets/sheet${n}.xml`,worksheetXml(sheets[i].rows,sheets[i].opts));
   types.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
   nodes.push(`<sheet name="${escapeXml(sheets[i].name)}" sheetId="${n}" r:id="rId${n}"/>`);
   rels.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
 }
 types.push('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>','<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>');
 zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${types.join('')}</Types>`);
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nodes.join('')}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',styles);
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
Object.assign(K,{exportXlsx,escapeXml});
})(typeof globalThis!=='undefined'?globalThis:this);
