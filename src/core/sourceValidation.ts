import type { Dataset, SourceRecord, SourceValidation, SourceValidationCheck, SourceMappingColumn, Workspace, DisbResolvedLayout, DisbSchemaFingerprint } from './types';
import { getDisbSchemaProfile } from './types';
import type { ParsedWorkbookSheet } from './sourceReaders';
import { Decimal, sha256Hex } from './decimal';

export const REFERENCE_SHA = {
  DISB: '3ba33b3efd579499500d956c2580a170e84dd38b8d700fdfaaf9a361ea7cb38c',
  REV: 'b41227d1444c581e6f3b65d761fad8918b65aedfbd8114443e6dee9d4938356f',
  GPMB: 'd393c3c1f3f9c99c95cc3d0035eab3386ff3cab8e63e623eaa9c925103ef9e0f',
};
export function isOriginalReferenceLayout(ds: Dataset): boolean {
  return ds.sourceType === 'DISB' ? ds.workbookSha256 === REFERENCE_SHA.DISB && ds.sourceSheet === 'Tổng hợp' && ds.sheetIndex === 5 && ds.schemaFingerprint === 'DISB_V1'
    : ds.sourceType === 'REV' ? ds.workbookSha256 === REFERENCE_SHA.REV && ds.sourceSheet === '10T-19.10' && ds.sheetIndex === 0 && ds.schemaFingerprint === 'REV_V1'
    : ds.sourceType === 'GPMB' && ds.workbookSha256 === REFERENCE_SHA.GPMB && ds.sourceSheet === 'Tổng hợp theo địa bàn' && ds.sheetIndex === 0 && ds.schemaFingerprint === 'GPMB_V1';
}
export function normalizedHeader(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/²/g,'2').toLowerCase().replace(/\s+/g,' ').trim();
}
function colNumber(col: string): number {return [...col].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);}
function rowCells(sheet: ParsedWorkbookSheet, row: number) {
  return [...sheet.cells.values()].filter(c=>c.row===row && c.value!==null && String(c.value).trim()!=='').sort((a,b)=>colNumber(a.col)-colNumber(b.col));
}
function h(sheet: ParsedWorkbookSheet, col: string, row: number): string {return normalizedHeader(sheet.cells.get(col+row)?.value);}
function fail(message: string): never {throw new Error('BLOCKER_MAPPING_REQUIRED: '+message);}
const stt=/^(stt|so thu tu)$/;
const locality=/^(chu dau tu|don vi|dia phuong|xa phuong|xa\/phuong)(\b|$)/;
const plan=/^ke hoach von/;
const adjusted=/^ke hoach von.*(?:dieu chinh|bo sung)/;
const actual=/^giai ngan/;
const total=/^tong so$/;
const city=/^du an khoi (tp|thanh pho)$/;
const allocated=/^phan cap (cho )?cap xa$/;
const rate=/^ty le/;
const note=/^ghi chu(?:\s*\([^)]*\))?$/;
const land=/^(nguon )?thu tien su dung dat/;
const support=/^bo sung co muc tieu/;
const increase=/^nguon tang thu/;
const isLocality=(s:string)=>/^(xa|phuong|dac khu)\s+\S/.test(s);
type HeaderCell=ReturnType<typeof rowCells>[number];
function exactlyOne(rows:HeaderCell[],rx:RegExp,label:string):HeaderCell {
  const matches=rows.filter(c=>rx.test(normalizedHeader(c.value)));
  if(matches.length!==1)fail(label+' phải có đúng một cột (tìm thấy '+matches.map(c=>c.address).join(', ')+').');
  return matches[0];
}

/** Resolve existing DISB business scopes by unique top-level group anchors
 * and unique child roles within those groups. Never match a numeric value.
 * Unrecognized/ambiguous layouts are rejected, not guessed. */
export function resolveDisbLayout(sheet:ParsedWorkbookSheet):DisbResolvedLayout|null {
  const candidates:DisbResolvedLayout[]=[];
  let error:Error|undefined;
  for(let r=2;r<=Math.min(20,sheet.maxRow-1);r++){
    const top=rowCells(sheet,r);
    const heads=top.filter(c=>plan.test(normalizedHeader(c.value)));
    const paid=top.filter(c=>actual.test(normalizedHeader(c.value)));
    if(!heads.length||!paid.length)continue;
    // Avoid mistaking a narrative header or data row for a DISB table.
    if(!top.some(c=>stt.test(normalizedHeader(c.value)))||!top.some(c=>locality.test(normalizedHeader(c.value))))continue;
    try{
      const sttCell=exactlyOne(top,stt,'STT'),locCell=exactlyOne(top,locality,'Địa phương/chủ đầu tư');
      const initial=heads.filter(c=>!adjusted.test(normalizedHeader(c.value)));
      const revised=heads.filter(c=>adjusted.test(normalizedHeader(c.value)));
      if(initial.length!==1||revised.length>1||paid.length!==1)fail('Nhóm kế hoạch/giải ngân không duy nhất.');
      const pay=paid[0],rateCells=top.filter(c=>rate.test(normalizedHeader(c.value)));
      const notes=exactlyOne(top,note,'Ghi chú');
      if(rateCells.length<1||rateCells.length>2)fail('Không xác định duy nhất nhóm tỷ lệ giải ngân.');
      const ordered=[initial[0],...revised,pay,...rateCells,notes];
      if(ordered.some((c,i)=>i>0&&colNumber(c.col)<=colNumber(ordered[i-1].col)))fail('Thứ tự nhóm tiêu đề giải ngân chưa được hỗ trợ.');
      if(Math.max(colNumber(sttCell.col),colNumber(locCell.col))>=colNumber(initial[0].col))fail('Cột định danh nằm trong nhóm số liệu.');
      const m:Record<string,string>={A:sttCell.col,B:locCell.col};
      const within=(anchor:HeaderCell,rows:number[])=>{
        const ix=ordered.findIndex(c=>c.col===anchor.col);
        const lo=colNumber(anchor.col),hi=ix+1<ordered.length?colNumber(ordered[ix+1].col):16385;
        return rows.flatMap(rr=>rowCells(sheet,rr).filter(c=>colNumber(c.col)>=lo&&colNumber(c.col)<hi));
      };
      const assign=(role:string,c:HeaderCell)=>{if(Object.values(m).includes(c.col))fail('Cột '+c.col+' bị gán hai vai trò.');m[role]=c.col;};
      const child=(role:string,anchor:HeaderCell,rr:number,rx:RegExp,label:string)=>assign(role,exactlyOne(within(anchor,[rr]),rx,label));
      const firstChildren=within(initial[0],[r+1,r+2]);
      const totalScope=firstChildren.some(c=>city.test(normalizedHeader(c.value)))&&firstChildren.some(c=>allocated.test(normalizedHeader(c.value)));
      const localScope=firstChildren.some(c=>land.test(normalizedHeader(c.value)))&&firstChildren.some(c=>support.test(normalizedHeader(c.value)));
      if(totalScope===localScope)fail('Không phân biệt được tổng vốn và vốn phân cấp cấp xã.');
      const scopeChildren=within(pay,[r+1,r+2]);
      if(totalScope&&scopeChildren.some(c=>land.test(normalizedHeader(c.value))))fail('Nhóm nguồn vốn không cùng phạm vi.');
      if(localScope&&scopeChildren.some(c=>city.test(normalizedHeader(c.value))||allocated.test(normalizedHeader(c.value))))fail('Nhóm giải ngân không cùng phạm vi vốn phân cấp.');
      let fp:DisbSchemaFingerprint;
      const planTotal=(roles:string[],anchor:HeaderCell,scope:'total'|'allocated',withIncrease=false)=>{
        child(roles[0],anchor,r+1,total,'Tổng số của '+anchor.address);
        child(roles[1],anchor,scope==='total'?r+1:r+2,scope==='total'?city:land,'Thành phần thứ nhất của '+anchor.address);
        child(roles[2],anchor,scope==='total'?r+1:r+2,scope==='total'?allocated:support,'Thành phần thứ hai của '+anchor.address);
        if(withIncrease)child(roles[3],anchor,r+2,increase,'Nguồn tăng thu của '+anchor.address);
      };
      let headerRows:number[], summaryRow=0, citySummaryRow:number|undefined, unplannedRow:number|undefined;
      if(totalScope){
        if(revised.length!==1)fail('Tổng vốn cần phân biệt kế hoạch ban đầu và sau điều chỉnh.');
        planTotal(['C','D','E'],initial[0],'total');
        planTotal(['F','G','H'],revised[0],'total');
        if(rateCells.length===2){
          fp='DISB_TOTAL_LOCALITY_V2';
          planTotal(['I','J','K'],pay,'total');
          assign('L',exactlyOne(rateCells,/^ty le.*(?:dau nam|giao dau)/,'Tỷ lệ vốn đầu năm'));
          assign('M',exactlyOne(rateCells,/^ty le.*sau.*dieu chinh/,'Tỷ lệ vốn sau điều chỉnh'));
          assign('N',notes);headerRows=[r,r+1];
        }else{
          fp='DISB_V1';
          child('I',pay,r+1,total,'Tổng số giải ngân');
          child('J',pay,r+2,city,'Giải ngân khối TP');
          child('K',pay,r+2,allocated,'Giải ngân cấp xã');
          child('L',pay,r+2,/^giai ngan xay lap/,'Giải ngân xây lắp');
          child('M',pay,r+2,/^giai ngan.*(?:boi thuong|gpmb)/,'Giải ngân GPMB');
          child('N',pay,r+2,/^giai ngan.*nhiem vu khac/,'Giải ngân khác');
          assign('O',rateCells[0]);assign('Q',notes);
          const markers=within(rateCells[0],[r+1,r+2]).filter(c=>/^chu tich di\b/.test(normalizedHeader(c.value)));
          if(markers.length>1)fail('Trùng cột đánh dấu kiểm tra.');
          if(markers[0])assign('P',markers[0]);
          headerRows=[r,r+1,r+2];
          citySummaryRow=r+4;summaryRow=r+9;unplannedRow=r+142;
          if(!/^tong/.test(h(sheet,m.B,citySummaryRow))||!/dia phuong/.test(h(sheet,m.B,summaryRow)))fail('Dòng tổng thành phố/khối địa phương không đúng phạm vi mẫu.');
        }
      }else{
        if(rateCells.length!==1)fail('Mẫu vốn phân cấp chỉ có một tỷ lệ sau điều chỉnh.');
        if(revised.length===1){
          fp='DISB_PHAN_CAP_XA_V2';
          if(!/dau nam/.test(normalizedHeader(initial[0].value)))fail('Không xác minh được nhóm vốn đầu năm.');
          planTotal(['C','D','E'],initial[0],'allocated');
          planTotal(['F','G','H','I'],revised[0],'allocated',true);
          planTotal(['J','K','L','M'],pay,'allocated',true);
          assign('N',rateCells[0]);assign('O',notes);
        }else{
          fp='DISB_PHAN_CAP_XA_V1';
          planTotal(['C','D','E','F'],initial[0],'allocated',true);
          planTotal(['G','H','I','J'],pay,'allocated',true);
          assign('K',rateCells[0]);assign('L',notes);
        }
        headerRows=[r,r+1,r+2];summaryRow=r+4;
        if(!/^tong/.test(h(sheet,m.B,summaryRow)))fail('Không xác minh được dòng tổng vốn phân cấp.');
      }
      const profile=getDisbSchemaProfile(fp);
      if(Object.keys(profile.colMap).some(k=>!m[k]))fail('Thiếu cột bắt buộc của '+fp+'.');
      const dataRows=[...sheet.cells.values()].filter(c=>c.col===m.B&&isLocality(normalizedHeader(c.value))).map(c=>c.row).sort((a,b)=>a-b);
      if(!dataRows.length||dataRows.some(row=>row<=Math.max(...headerRows)||row<=summaryRow))fail('Không xác minh được dòng địa phương dưới tiêu đề/tổng.');
      if(fp==='DISB_V1'&&dataRows.some(row=>row<r+10||row>r+123))fail('Dòng địa phương nằm ngoài khối tổng hợp cũ; cần xác minh phạm vi.');
      if(fp==='DISB_V1'){
        // Do not assume a row at a fixed offset is an out-of-plan total if
        // it is absent or not explicitly named as such.
        if(!/ngoai.*ke hoach|khong.*ke hoach/.test(h(sheet,m.B,unplannedRow!)))unplannedRow=undefined;
      }
      const titles=[...sheet.cells.values()].filter(c=>c.row<r&&c.cellType!=='n'&&/giai ngan/.test(normalizedHeader(c.value))&&/ke hoach von|bao cao tinh hinh giai ngan/.test(normalizedHeader(c.value)));
      if(titles.length>1)fail('Có nhiều tiêu đề báo cáo giải ngân.');
      const titleCell=titles[0]?.address||'A1';
      candidates.push({fingerprint:fp,columns:m,headerRows,dataRows,summaryRow,citySummaryRow,unplannedRow,titleCell});
    }catch(e){error=e as Error;}
  }
  if(candidates.length>1)fail('Có nhiều bảng giải ngân cùng sheet; không tự chọn.');
  if(candidates.length===1)return candidates[0];
  if(error)throw error;
  return null;
}
export function validateDisbHeaders(sheet:ParsedWorkbookSheet,fp:string):number[]{
  const layout=resolveDisbLayout(sheet);
  if(!layout||layout.fingerprint!==fp)fail('Cấu trúc giải ngân không xác minh được.');
  return layout.headerRows;
}

const areaDeclared=/^(?:tong )?(?:dt|dien tich) (?:phai )?gpmb(?:\s*\([^)]*\))?$/;
const areaRecorded=/^(?:tong )?(?:dt|dien tich) da (?:thu hoi|gpmb)(?:\s*\([^)]*\))?$/;
const allocatedBudget=/^(?:so tien (?:duoc )?phan bo(?: cho gpmb)?|tien phan bo(?: cho gpmb)?|kinh phi phan bo(?: gpmb)?)(?:\s*\([^)]*\))?$/;
const paidBudget=/^(?:so tien da chi gpmb(?: theo qd)?|da chi gpmb|tien da chi(?: gpmb)?|kinh phi da chi(?: gpmb)?)(?:\s*\([^)]*\))?$/;
const declaredOrgs=/^(?:so luong |so )?to chuc bi thu hoi(?: dat)?$/;
const declaredHouseholds=/^(?:so luong |so )?ho dan bi thu hoi(?: dat)?$/;
const doneOrgs=/^so (?:luong )?to chuc(?: da gpmb)?$/;
const doneHouseholds=/^so (?:luong )?ho dan(?: da gpmb)?$/;
const gpmbRate=/^ty le gpmb(?:\s*[%]|\s*\(%\))?$/;
const deadline=/^(han hoan thanh|thoi han|tien do hoan thanh)(?:\s*\([^)]*\))?$/;

export const GROUPED_GPMB_ROLES: Record<string,RegExp> = {
  A:stt, B:/^ten du an$/, C:/^nguon ngan sach$|^nguon von$/, D:areaDeclared,
  E:declaredOrgs,F:declaredHouseholds,G:allocatedBudget,H:deadline,I:areaRecorded,
  J:paidBudget,K:doneOrgs,L:doneHouseholds,M:gpmbRate,
};
export function resolveGroupedGpmbHeaders(sheet:ParsedWorkbookSheet): {row:number;columns:Record<string,string>} | null {
  const candidates:Array<{row:number;columns:Record<string,string>}>=[];
  for(let r=1;r<=Math.min(12,sheet.maxRow);r++){
    const cells=rowCells(sheet,r);
    const roles=Object.entries(GROUPED_GPMB_ROLES).map(([role,rx])=>[role,cells.filter(c=>rx.test(normalizedHeader(c.value))).map(c=>c.col)] as const);
    if(!roles.some(([k,v])=>k==='B'&&v.length)||!roles.some(([k,v])=>(k==='D'||k==='I')&&v.length))continue;
    // Avoid mistaking a flat schema for a grouped report.
    if(cells.some(c=>/^(phuong\s*\/?\s*xa|xa\s*\/?\s*phuong|dia ban|dia phuong)$/.test(normalizedHeader(c.value))))continue;
    const bad=roles.filter(([,cols])=>cols.length!==1);
    if(bad.length)fail('Tiêu đề GPMB phân nhóm thiếu hoặc trùng vai trò: '+bad.map(([role,cols])=>role+': '+(cols.join('/')||'thiếu')).join('; '));
    const columns=Object.fromEntries(roles.map(([role,cols])=>[role,cols[0]]));
    if(new Set(Object.values(columns)).size!==Object.keys(columns).length)fail('Một cột GPMB có nhiều vai trò.');
    candidates.push({row:r,columns});
  }
  if(candidates.length>1)fail('Có nhiều dòng tiêu đề GPMB phân nhóm; không tự chọn.');
  return candidates[0]??null;
}

export type FlatGpmbMap = Partial<Record<'sttCol'|'projectCol'|'localityCol'|'capitalTypeCol'|'declaredAreaCol'|'recordedAreaCol'|'allocatedBudgetCol'|'paidAmountCol'|'declaredOrgsCol'|'declaredHouseholdsCol'|'doneOrgsCol'|'doneHouseholdsCol'|'rateCol'|'deadlineCol',string>>;
const flatRoles: Record<keyof FlatGpmbMap,RegExp> = {
  sttCol:stt, projectCol:/^(ten )?du an$/, localityCol:/^(phuong\s*\/?\s*xa|xa\s*\/?\s*phuong|dia ban|dia phuong)$/,
  capitalTypeCol:/^nguon (von|ngan sach)$/, declaredAreaCol:areaDeclared, recordedAreaCol:areaRecorded,
  allocatedBudgetCol:allocatedBudget,paidAmountCol:paidBudget,declaredOrgsCol:declaredOrgs,declaredHouseholdsCol:declaredHouseholds,
  doneOrgsCol:doneOrgs,doneHouseholdsCol:doneHouseholds,rateCol:gpmbRate,deadlineCol:deadline
};
/** Header matching must yield a unique column for every required role. No
 * last-match-wins, no partial schema, no project deadlines as cutoff dates. */
export function resolveFlatGpmbHeaders(sheet:ParsedWorkbookSheet): {row:number;columns:FlatGpmbMap} | null {
  const candidates:Array<{row:number;columns:FlatGpmbMap}>=[];
  for(let r=1;r<=Math.min(12,sheet.maxRow);r++){
    const cells=rowCells(sheet,r);
    const roleMatches=Object.entries(flatRoles).map(([key,rx])=>[key,cells.filter(c=>rx.test(normalizedHeader(c.value))).map(c=>c.col)] as const);
    if(!roleMatches.some(([k,c])=>k==='localityCol'&&c.length))continue;
    if(!roleMatches.some(([k,c])=>(k==='declaredAreaCol'||k==='recordedAreaCol')&&c.length))continue;
    const duplicate=roleMatches.filter(([,c])=>c.length>1);
    if(duplicate.length)fail('Cột GPMB bảng phẳng trùng vai trò: '+duplicate.map(([k,c])=>k+' '+c.join('/')).join('; '));
    const map=Object.fromEntries(roleMatches.filter(([,c])=>c.length===1).map(([k,c])=>[k,c[0]])) as FlatGpmbMap;
    const required:Array<keyof FlatGpmbMap>=['projectCol','localityCol','declaredAreaCol','recordedAreaCol','allocatedBudgetCol','paidAmountCol'];
    const missing=required.filter(k=>!map[k]);
    if(missing.length)fail('Thiếu cột bắt buộc GPMB bảng phẳng: '+missing.join(', '));
    candidates.push({row:r,columns:map});
  }
  if(candidates.length>1)fail('Có nhiều dòng tiêu đề GPMB bảng phẳng hợp lệ; không tự chọn.');
  return candidates[0]??null;
}

const FIELD_LABELS:Record<string,string>={
  annual_total_budget:'Dự toán tổng thu',annual_land_budget:'Dự toán tiền đất',annual_nonland_budget:'Dự toán trừ tiền đất',
  period_total_plan:'Kế hoạch thu kỳ',period_land_plan:'Kế hoạch thu tiền đất kỳ',period_nonland_plan:'Kế hoạch thu trừ tiền đất kỳ',
  actual_total_revenue:'Thu NSNN thực hiện',actual_land_revenue:'Thu tiền sử dụng đất',actual_nonland_revenue:'Thu trừ tiền sử dụng đất',
  initial_total_plan:'Kế hoạch vốn đầu năm',adjusted_total_plan:'Kế hoạch vốn sau điều chỉnh',disbursed_total:'Đã giải ngân',source_disbursed_rate:'Tỷ lệ giải ngân nguồn',
  gpmb_declared_area:'Diện tích phải GPMB',gpmb_recorded_area:'Diện tích đã GPMB',gpmb_allocated_budget:'Kinh phí phân bổ GPMB',gpmb_paid_amount:'Kinh phí đã chi GPMB',gpmb_source_reported_rate:'Tỷ lệ GPMB nguồn',
};
export function sourceFieldLabel(field:string):string{return FIELD_LABELS[field]||field;}
const CORE:Record<string,string[]> = {
  DISB:['adjusted_total_plan','disbursed_total'],REV:['annual_total_budget','annual_land_budget','annual_nonland_budget','period_total_plan','period_land_plan','period_nonland_plan','actual_total_revenue','actual_land_revenue','actual_nonland_revenue'],
  GPMB:['gpmb_declared_area','gpmb_recorded_area','gpmb_allocated_budget','gpmb_paid_amount'],
};
function unitCheck(ds:Dataset,sheet:ParsedWorkbookSheet,rows:number[],columns:SourceMappingColumn[]):SourceValidationCheck {
  const headerText=[...sheet.cells.values()].filter(c=>c.row<=Math.max(...rows)&&c.value!==null&&c.cellType!=='n').map(c=>normalizedHeader(c.value));
  const declarations=headerText.filter(x=>/^(?:don vi(?: tinh)?|dvt)\s*:/.test(x));
  const moneyUnits=(s:string)=>[...new Set([...s.matchAll(/\b(?:(trieu|ty|nghin|ngan)\s+)?(?:dong|vnd)\b/g)].map(m=>m[1]==='trieu'?'million_vnd':m[1]==='ty'?'billion':m[1]?'thousand':'vnd'))];
  let missing:string[]=[];
  if(ds.sourceType==='REV'||ds.sourceType==='DISB'){
    const globalUnits=declarations.flatMap(moneyUnits);
    if(globalUnits.some(u=>u!=='million_vnd'))fail('Đơn vị tiền không phải triệu đồng theo mẫu: '+declarations.join('; ')+'. Cần xác minh/quy đổi trước khi nạp.');
    const core=columns.filter(c=>CORE[ds.sourceType]?.includes(c.field)||c.unit==='million_vnd');
    for(const c of core){
      const header=normalizedHeader(c.header);
      const units=[...new Set([...header.matchAll(/\([^)]*\b(?:dong|vnd)\b[^)]*\)/g)].flatMap(m=>moneyUnits(m[0])).concat(moneyUnits([...header.matchAll(/\b(?:trieu|ty|nghin|ngan)\s+(?:dong|vnd)\b/g)].map(m=>m[0]).join(' '))))];
      if(units.some(u=>u!=='million_vnd'))fail('Đơn vị của '+c.column+' ('+c.header+') không khớp triệu đồng.');
      if(!units.length&&!globalUnits.includes('million_vnd'))missing.push(c.column);
    }
  }else if(ds.sourceType==='GPMB'){
    if(declarations.some(d=>/\bha\b|hecta|km2/.test(d))||declarations.flatMap(moneyUnits).some(u=>u!=='vnd'))fail('Đơn vị chung GPMB xung đột với m²/đồng của cấu trúc chuẩn.');
    for(const c of columns.filter(x=>CORE.GPMB.includes(x.field))){
      const key=normalizedHeader(c.header);
      if(c.unit==='m2'){
        if(/\bha\b|hecta|km2/.test(key))fail('Đơn vị diện tích '+c.column+' không phải m².');
        if(!/\bm2\b|met vuong/.test(key))missing.push(c.column);
      }else{
        const u=moneyUnits(key);
        if(u.some(unit=>unit!=='vnd'))fail('Đơn vị kinh phí '+c.column+' không phải đồng.');
        if(!u.length)missing.push(c.column);
      }
    }
  }
  return {code:'UNITS',label:'Đơn vị tính',checked:columns.filter(c=>CORE[ds.sourceType]?.includes(c.field)).length,failed:missing.length,severity:missing.length?'REVIEW':'INFO',detail:missing.length?'Chưa có bằng chứng đơn vị rõ tại cột '+missing.join(', ')+'. Đối chiếu Excel gốc: '+(ds.sourceType==='GPMB'?'m² và đồng':'triệu đồng')+'.':'Đơn vị tiền/diện tích khớp cấu trúc nguồn được hỗ trợ.'};
}
function val(rec:SourceRecord,field:string):Decimal|undefined{
  const c=rec.metrics[field];if(!c||!['VALUE','ZERO'].includes(c.state)||c.normalizedDecimal===null)return undefined;
  try{const d=new Decimal(c.normalizedDecimal);return d.isFinite()?d:undefined;}catch{return undefined;}
}
function checkResult(code:string,label:string,n:number,bad:number,examples:string[],review=true):SourceValidationCheck{
  // A single source typo should remain visible, not imply an entire column is wrong.
  // Widespread contradictions or all comparisons in a tiny sample require review.
  const needs=review&&bad>0&&((n<=3&&bad===n)||(bad>=3&&bad*2>=n));
  return {code,label,checked:n,failed:bad,severity:needs?'REVIEW':bad?'WARNING':'INFO',detail:n?(bad?bad+'/'+n+' phép đối chiếu không khớp; cần phân biệt lỗi nguồn và lỗi ánh xạ.':'Khớp '+n+'/'+n+' phép đối chiếu.'):'Không đủ số liệu để đối chiếu; không suy diễn.',examples:examples.slice(0,6)};
}
function checkRelation(ds:Dataset,code:string,label:string,totalField:string,parts:string[],isRatio=false,ratioScale=1):SourceValidationCheck{
  let n=0,bad=0;const ex:string[]=[];
  for(const rec of ds.records){
    const total=val(rec,totalField),vs=parts.map(p=>val(rec,p));
    if(total===undefined||vs.some(v=>v===undefined))continue;
    let expected:Decimal;
    if(isRatio){if(vs[1]!.isZero())continue;expected=vs[0]!.div(vs[1]!).times(ratioScale);}
    else expected=vs.reduce<Decimal>((sum,v)=>sum.plus(v!),new Decimal(0));
    n++;
    const tolerance=isRatio?(ratioScale===100?'0.1':'0.001'):'0.01';
    if(total.minus(expected).abs().gt(tolerance)){bad++;ex.push(rec.localityName+' · '+rec.metrics[totalField].provenance.cell+': '+total.toString()+' ≠ '+expected.toSignificantDigits(8).toString());}
  }
  return checkResult(code,label,n,bad,ex);
}
function checkTotals(ds:Dataset,fields:string[]):SourceValidationCheck{
  let n=0,bad=0;const ex:string[]=[];
  const summary=ds.summaryRecord;
  if(summary)for(const field of fields){
    const total=val(summary,field),values=ds.records.map(r=>val(r,field));
    if(total===undefined||values.some(v=>v===undefined))continue;
    n++;const sum=values.reduce<Decimal>((s,v)=>s.plus(v!),new Decimal(0));
    if(total.minus(sum).abs().gt('0.01')){bad++;ex.push(sourceFieldLabel(field)+' '+summary.metrics[field].provenance.cell+' ≠ tổng dòng chi tiết');}
  }
  return checkResult('TOTAL_ROWS','Tổng theo phạm vi địa phương',n,bad,ex);
}
function coreValueCheck(ds:Dataset):SourceValidationCheck{
  let checked=0,failed=0;const examples:string[]=[];
  for(const field of CORE[ds.sourceType]||[]){
    const values=ds.records.map(r=>r.metrics[field]);
    if(!values.some(v=>v&&['VALUE','ZERO'].includes(v.state))){
      failed++;examples.push(sourceFieldLabel(field)+': không có giá trị số');
    }
    checked++;
    const invalid=values.filter(v=>v&&['INVALID','FORMULA_ERROR'].includes(v.state));
    if(invalid.length){failed++;examples.push(sourceFieldLabel(field)+': '+invalid.length+' ô lỗi số/công thức');}
  }
  return {code:'CORE_VALUES',label:'Kiểu dữ liệu các trường chính',checked,failed,severity:failed?'REVIEW':'INFO',detail:failed?'Một số trường không có số liệu hợp lệ hoặc chứa lỗi; không chuyển lỗi thành 0.':'Các trường chính có giá trị số đọc được; ô thiếu được giữ nguyên.',examples};
}
function normalizedStructure(s:string):string{
  return normalizedHeader(s).replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g,'<date>').replace(/\b20\d{2}\b/g,'<year>').replace(/\b\d{1,2}\s+thang\b/g,'<month> thang');
}
export function attachSourceValidation(ds:Dataset,sheet:ParsedWorkbookSheet,headerRows:number[],groupTotals:SourceRecord[]=[]):void{
  if(!ds.records.length||!ds.unitCount)fail('Không có dữ liệu địa phương/dự án hợp lệ.');
  const byField=new Map<string,SourceMappingColumn>();
  for(const rec of ds.records)for(const [field,m] of Object.entries(rec.metrics)){
    if(!m.sourceColumn||!/[A-Z]+/.test(m.sourceColumn))continue;
    const old=byField.get(field);
    if(old&&old.column!==m.sourceColumn)fail('Một trường có nhiều ánh xạ trong cùng bảng: '+field);
    if(!old)byField.set(field,{field,column:m.sourceColumn,header:headerRows.map(r=>String(sheet.cells.get(m.sourceColumn+r)?.value??'').trim()).filter(Boolean).join(' / '),unit:m.unit});
  }
  const cols=[...byField.values()].sort((a,b)=>colNumber(a.column)-colNumber(b.column));
  const core=CORE[ds.sourceType]||[];
  if(core.some(field=>!byField.has(field)))fail('Thiếu trường bắt buộc: '+core.filter(field=>!byField.has(field)).map(sourceFieldLabel).join(', '));
  if(new Set(cols.map(c=>c.column)).size!==cols.length)fail('Một cột được gán đồng thời cho nhiều chỉ tiêu.');
  const meaningful=[...sheet.cells.values()].filter(c=>c.value!==null&&String(c.value).trim()!=='');
  const headerCells=headerRows.flatMap(r=>rowCells(sheet,r));
  const checks:SourceValidationCheck[]=[{code:'MAPPING',label:'Ánh xạ cột',checked:cols.length,failed:0,severity:'INFO',detail:'Vai trò cột được xác minh theo tiêu đề và nhóm; số cột chỉ là metadata.'},unitCheck(ds,sheet,headerRows,cols),coreValueCheck(ds)];
  if(ds.sourceType==='REV'){
    for(const [prefix,total,land,nonland] of [['ANNUAL','annual_total_budget','annual_land_budget','annual_nonland_budget'],['PERIOD','period_total_plan','period_land_plan','period_nonland_plan'],['ACTUAL','actual_total_revenue','actual_land_revenue','actual_nonland_revenue']]) checks.push(checkRelation(ds,'REV_'+prefix,'Cân đối '+sourceFieldLabel(total),total,[land,nonland]));
    for(const period of ['y','p'])for(const part of ['total','land','nonland']){
      const den=(period==='y'?'annual_'+part+'_budget':'period_'+part+'_plan');
      checks.push(checkRelation(ds,'REV_RATE_'+part+'_'+period,'Tỷ lệ thu '+part+' '+(period==='y'?'so dự toán':'so kế hoạch kỳ'),'source_rate_'+part+'_'+period,['actual_'+part+'_revenue',den],true));
    }
    const rateCount=cols.filter(c=>c.field.startsWith('source_rate_')).length;
    if(rateCount!==6)checks.push({code:'REV_RATE_MAPPING',label:'Nhóm tỷ lệ nguồn',checked:6,failed:6-rateCount,severity:'WARNING',detail:'Không xác minh đủ 6 tỷ lệ nguồn theo tiêu đề nhóm dự toán/kế hoạch kỳ. Không suy đoán; tỷ lệ báo cáo vẫn tính từ số tiền gốc.'});
    checks.push(checkTotals(ds,core));
  }else if(ds.sourceType==='DISB'){
    for(const eq of new Set((ds.identityChecks||[]).map(i=>i.equation))){
      const rows=(ds.identityChecks||[]).filter(i=>i.equation===eq),bad=rows.filter(i=>i.status==='FAIL');
      checks.push(checkResult('DISB_IDENTITY_'+eq,'Cân đối '+eq,rows.length,bad.length,bad.map(i=>i.localityName+' dòng '+i.row)));
    }
    checks.push(checkRelation(ds,'DISB_RATE','Tỷ lệ giải ngân ghi nguồn','source_disbursed_rate',['disbursed_total','adjusted_total_plan'],true));
    if(ds.records.some(r=>r.metrics.source_disbursed_rate_initial))checks.push(checkRelation(ds,'DISB_RATE_INITIAL','Tỷ lệ giải ngân so vốn đầu năm','source_disbursed_rate_initial',['disbursed_total','initial_total_plan'],true));
    checks.push(checkTotals(ds,core));
  }else if(ds.sourceType==='GPMB'){
    checks.push(checkRelation(ds,'GPMB_RATE','Tỷ lệ GPMB ghi nguồn','gpmb_source_reported_rate',['gpmb_recorded_area','gpmb_declared_area'],true,100));
    let n=0,bad=0;const examples:string[]=[];
    const groups=new Map<string,SourceRecord[]>();
    for(const rec of ds.records){const rows=groups.get(rec.localityId)||[];rows.push(rec);groups.set(rec.localityId,rows);}
    for(const total of groupTotals){
      const rows=groups.get(total.localityId)||[];if(!rows.length)continue;
      for(const field of CORE.GPMB){
        const expected=val(total,field),values=rows.map(r=>val(r,field));
        if(expected===undefined||values.some(v=>v===undefined))continue;
        n++;const sum=values.reduce<Decimal>((s,v)=>s.plus(v!),new Decimal(0));
        if(sum.minus(expected).abs().gt('0.01')){bad++;examples.push(total.localityName+' '+total.metrics[field].provenance.cell+' khác tổng dự án');}
      }
    }
    checks.push(checkResult('GPMB_GROUP_TOTAL','Tổng địa bàn so với tổng dự án',n,bad,examples));
  }
  const original=isOriginalReferenceLayout(ds);
  const status=!original&&checks.some(c=>c.severity==='REVIEW')?'NEEDS_REVIEW':'VERIFIED';
  ds.sourceValidation={
    version:'SCHEMA_GUARD_V1',workbookSha256:ds.workbookSha256,sheet:ds.sourceSheet,
    schemaSignature:sha256Hex(JSON.stringify({profile:ds.schemaFingerprint,headers:headerCells.map(c=>[c.col,c.row-headerRows[0],normalizedStructure(String(c.value))]),map:cols.map(c=>[c.field,c.column,c.unit]),disbRoles:ds.disbLayout?.columns})),
    headerRows,columnCount:new Set(meaningful.map(c=>c.col)).size,headerColumnCount:new Set(headerCells.map(c=>c.col)).size,
    columns:cols,status,checks,checkedAt:new Date().toISOString(),
    ...(original?{reviewReason:'Workbook tham chiếu byte-identical, kiểm thử nghiệp vụ đã xác minh; giữ cảnh báo nguồn gốc.'}:{}),
  };
}
export function sourceMappingProblem(ds:Dataset):string|undefined{
  const v=ds.sourceValidation;
  if(!v)return isOriginalReferenceLayout(ds)?undefined:'Cần nhập lại file Excel gốc để xác minh cấu trúc và đơn vị.';
  if(v.version!=='SCHEMA_GUARD_V1'||v.workbookSha256!==ds.workbookSha256||v.sheet!==ds.sourceSheet||!v.schemaSignature)return 'Thông tin xác minh cấu trúc không khớp file; cần nhập lại.';
  if(v.status!=='VERIFIED')return 'Nguồn cần đối chiếu, chưa được xác minh để sử dụng.';
  if(ds.disbLayout&&ds.disbLayout.fingerprint!==ds.schemaFingerprint)return 'Phạm vi giải ngân không khớp cấu trúc đã xác minh.';
  return undefined;
}
function scope(ds:Dataset):string{return ds.sourceType==='DISB'?(ds.schemaFingerprint.startsWith('DISB_PHAN_CAP_XA')?'ALLOCATED':'TOTAL'):ds.sourceType;}
function numericRows(ds:Dataset,field:string):Map<string,number>{
  const values=new Map<string,number>(),duplicate=new Set<string>(),seen=new Set<string>();
  for(const r of ds.records){
    if(!r.localityId)continue;
    if(ds.sourceType==='GPMB'&&!r.projectName?.trim())continue;
    const key=ds.sourceType==='GPMB'?r.localityId+'\0'+r.projectName!.normalize('NFC').trim().toLowerCase():r.localityId;
    if(seen.has(key)){duplicate.add(key);continue;}
    seen.add(key);
    const n=val(r,field)?.toNumber();
    if(n!==undefined&&Number.isFinite(n))values.set(key,n);
  }
  for(const key of duplicate)values.delete(key);return values;
}
function ranks(a:number[]):number[]{
  const idx=a.map((v,i)=>({v,i})).sort((x,y)=>x.v-y.v),result=Array(a.length).fill(0);
  for(let i=0;i<idx.length;){let j=i+1;while(j<idx.length&&idx[j].v===idx[i].v)j++;for(let k=i;k<j;k++)result[idx[k].i]=(i+j+1)/2;i=j;}return result;
}
export function spearman(a:number[],b:number[]):number|undefined{
  if(a.length!==b.length||a.length<2)return undefined;
  const x=ranks(a),y=ranks(b),mean=(a.length+1)/2;
  let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){const dx=x[i]-mean,dy=y[i]-mean;xy+=dx*dy;xx+=dx*dx;yy+=dy*dy;}
  return xx>0&&yy>0?xy/Math.sqrt(xx*yy):undefined;
}
const HISTORY_FIELDS:Record<string,{stable:string[];cumulative:string[]}>={
  REV:{stable:['annual_total_budget','annual_land_budget','annual_nonland_budget'],cumulative:['actual_total_revenue','actual_land_revenue','actual_nonland_revenue']},
  DISB:{stable:['initial_total_plan','adjusted_total_plan'],cumulative:['disbursed_total']},
  GPMB:{stable:['gpmb_declared_area','gpmb_allocated_budget'],cumulative:['gpmb_recorded_area','gpmb_paid_amount']},
};
/** Compare same-year, same-scope and verified preceding content only.
 * Never apply a fixed percentage-change threshold or auto-remap from history. */
export function assessSourceHistory(ds:Dataset,workspace:Workspace):void{
  const v=ds.sourceValidation;if(!v)return;
  // Recompute only history checks when the cutoff is explicitly corrected.
  v.checks=v.checks.filter(c=>!c.code.startsWith('HISTORY_')&&c.code!=='STRUCTURE_CHANGE');
  delete v.historicalDatasetId;delete v.historicalDate;delete v.previousColumnCount;delete v.changedColumns;
  if(!ds.asOfDate||ds.asOfStatus==='REQUIRES_USER_CONFIRMATION')return;
  const baseline=workspace.datasets.filter(d=>d.sourceType===ds.sourceType&&scope(d)===scope(ds)&&d.workbookSha256!==ds.workbookSha256&&d.asOfStatus!=='REQUIRES_USER_CONFIRMATION'&&d.asOfDate?.slice(0,4)===ds.asOfDate.slice(0,4)&&d.asOfDate<ds.asOfDate&&!sourceMappingProblem(d)).sort((a,b)=>b.asOfDate.localeCompare(a.asOfDate)||a.id.localeCompare(b.id))[0];
  if(!baseline)return;
  v.historicalDatasetId=baseline.id;v.historicalDate=baseline.asOfDate;
  v.previousColumnCount=baseline.sourceValidation?.columnCount;
  const priorCols=new Map((baseline.sourceValidation?.columns||Object.entries(baseline.records[0]?.metrics||{}).map(([field,m])=>({field,column:m.sourceColumn}))).map(c=>[c.field,c.column]));
  v.changedColumns=v.columns.flatMap(c=>{const old=priorCols.get(c.field);return old&&old!==c.column?[{field:c.field,before:old,after:c.column}]:[];});
  const oldSignature=baseline.sourceValidation?.schemaSignature;
  const changed=(oldSignature&&oldSignature!==v.schemaSignature)||v.changedColumns.length>0||v.previousColumnCount!==undefined&&v.previousColumnCount!==v.columnCount;
  if(changed)v.checks.push({code:'STRUCTURE_CHANGE',label:'Thay đổi cấu trúc so với nguồn đã xác minh',checked:v.columns.length,failed:v.changedColumns.length,severity:'INFO',detail:'Số cột có nội dung: '+(v.previousColumnCount??'chưa lưu')+' → '+v.columnCount+'. Cột dịch chuyển đã được xác minh lại bằng tiêu đề; không kết luận sai chỉ từ số cột.'});
  const fields=HISTORY_FIELDS[ds.sourceType];if(!fields)return;
  for(const [kind,list] of [['stable',fields.stable],['cumulative',fields.cumulative]] as const)for(const field of list){
    const before=numericRows(baseline,field),after=numericRows(ds,field),keys=[...after.keys()].filter(k=>before.has(k));
    if(keys.length<6)continue;
    const a=keys.map(k=>before.get(k)!),b=keys.map(k=>after.get(k)!);
    const changedCount=a.filter((x,i)=>x!==b[i]).length,decreased=a.filter((x,i)=>b[i]<x).length,rho=spearman(a,b);
    const rankAnomaly=keys.length>=12&&rho!==undefined&&rho<0.35;
    const widespread=kind==='stable'?changedCount>keys.length/2:decreased>keys.length/2;
    const severe=rankAnomaly&&widespread;
    // Stable anchor fields may reveal a unit error even if every rank is
    // preserved. This is an exact scale-factor pattern, not a period-change %.
    if(kind==='stable'&&keys.length>=12){
      const nonzero=a.map((x,i)=>({x,y:b[i]})).filter(p=>p.x!==0&&p.y!==0&&Math.sign(p.x)===Math.sign(p.y));
      if(nonzero.length>=12){
        const factors=[0.000001,0.001,0.01,100,1000,1000000];
        const matches=factors.map(factor=>({factor,count:nonzero.filter(p=>Math.abs(p.y-p.x*factor)<=Math.max(0.000001,Math.abs(p.x*factor)*1e-8)).length})).sort((x,y)=>y.count-x.count);
        if(matches[0].count>=12&&matches[0].count*2>nonzero.length)v.checks.push({code:'HISTORY_SCALE_'+field,label:'Lịch sử: dấu hiệu sai đơn vị '+sourceFieldLabel(field),checked:nonzero.length,failed:matches[0].count,severity:'REVIEW',detail:matches[0].count+' đối tượng cùng thay đổi gần đúng hệ số '+matches[0].factor+' so với nguồn '+baseline.asOfDate+'. Cần kiểm tra đơn vị; không tự quy đổi hoặc kết luận sai.'});
      }
    }
    if(rankAnomaly||widespread)v.checks.push({code:'HISTORY_'+field,label:'Lịch sử: '+sourceFieldLabel(field),checked:keys.length,failed:kind==='stable'?changedCount:decreased,severity:severe?'REVIEW':'WARNING',detail:'So với '+baseline.asOfDate+': '+changedCount+' thay đổi, '+decreased+' giảm trên '+keys.length+' đối tượng khớp; Spearman '+(rho===undefined?'không xác định':rho.toFixed(2))+'. Chỉ là dấu hiệu bổ trợ, có thể do nghiệp vụ/điều chỉnh; không dùng % chênh lệch giữa hai kỳ.'});
  }
  if(v.checks.some(c=>c.code.startsWith('HISTORY_')&&c.severity==='REVIEW')&&!isOriginalReferenceLayout(ds)){v.status='NEEDS_REVIEW';delete v.reviewedAt;delete v.reviewReason;}
}
export function confirmSourceValidation(ds:Dataset,reason:string):void{
  const v=ds.sourceValidation;
  if(!v||v.workbookSha256!==ds.workbookSha256||v.sheet!==ds.sourceSheet)throw new Error('Chưa có xác minh cấu trúc để duyệt.');
  if(!reason.trim())throw new Error('Cần lý do xác nhận nguồn.');
  v.status='VERIFIED';v.reviewedAt=new Date().toISOString();v.reviewReason=reason.trim();
}
