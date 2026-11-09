/* PH1 shared calculation engine. Raw source records are immutable; all UI and
   export values derive from the same (value, trace) pairs. */
(function(root){
'use strict';
const K=root.KTXH=root.KTXH||{},D=K.Dec;
const TEMPLATE=[
 {key:'r03',originalRow:3,label:'Dự toán thu NSNN năm',metric:'REV_BUDGET_Y',group:'Thu ngân sách'},
 {key:'r04',originalRow:4,label:'Tỷ lệ thu NSNN so với dự toán',metric:'REV_RATE_Y',group:'Thu ngân sách'},
 {key:'r05',originalRow:5,label:'Trong đó: tỷ lệ thu tiền sử dụng đất',metric:'REV_LAND_RATE_Y',group:'Thu ngân sách'},
 {key:'r06',originalRow:6,label:'Tỷ lệ thu không gồm tiền đất',metric:'REV_NONLAND_RATE_Y',group:'Thu ngân sách'},
 {key:'r07',originalRow:7,label:'Kế hoạch vốn đầu tư công sau điều chỉnh',metric:'DISB_PLAN',group:'Đầu tư công'},
 {key:'r08',originalRow:8,label:'So với mức vốn giao bình quân 114 địa phương',metric:'DISB_PLAN_VS_MEAN',group:'Đầu tư công'},
 {key:'r09',originalRow:9,label:'Tỷ lệ giải ngân chung của 114 địa phương',metric:'DISB_RATE_REFERENCE',group:'Đầu tư công'},
 {key:'r10',originalRow:10,label:'Tỷ lệ giải ngân của địa phương',metric:'DISB_RATE',group:'Đầu tư công'},
 {key:'r11',originalRow:11,label:'Nhận xét tỷ lệ giải ngân',metric:'DISB_ASSESS',group:'Đầu tư công'},
 {key:'r12',originalRow:12,label:'Kinh phí phân bổ GPMB',metric:'GPMB_BUDGET',group:'Giải phóng mặt bằng'},
 {key:'r13',originalRow:13,label:'Diện tích phải GPMB',metric:'GPMB_AREA_PLAN',group:'Giải phóng mặt bằng'},
 {key:'r14',originalRow:14,label:'Tỷ lệ GPMB của danh mục 108 địa bàn có dữ liệu',metric:'GPMB_RATE_REFERENCE',group:'Giải phóng mặt bằng'},
 {key:'r15',originalRow:15,label:'Tỷ lệ GPMB địa phương theo diện tích',metric:'GPMB_AREA_RATE',group:'Giải phóng mặt bằng'},
 {key:'r16',originalRow:16,label:'Đánh giá GPMB',metric:'GPMB_ASSESS',group:'Giải phóng mặt bằng'}
];
const METRIC_SOURCE={REV_BUDGET_Y:'REV',REV_RATE_Y:'REV',REV_LAND_RATE_Y:'REV',REV_NONLAND_RATE_Y:'REV',DISB_PLAN:'DISB',DISB_PLAN_VS_MEAN:'DISB',DISB_RATE_REFERENCE:'DISB',DISB_RATE:'DISB',DISB_ASSESS:'DISB',GPMB_BUDGET:'GPMB',GPMB_AREA_PLAN:'GPMB',GPMB_RATE_REFERENCE:'GPMB',GPMB_AREA_RATE:'GPMB',GPMB_ASSESS:'GPMB'};
function id(){return (root.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2)));}
function defaultSettings(){return {title:'KẾT QUẢ TỔNG HỢP CHỈ TIÊU KINH TẾ - XÃ HỘI',moneyUnit:'billion',areaUnit:'m2',decimals:2,areaDecimals:0,fontSize:14,columnWidth:158,headingColor:'#183b61',highColor:'#d97706',lowerColor:'#b91c1c',paperSize:'A4',orientation:'landscape',threshold:0.1,words:{higher:'Cao hơn',lower:'Thấp hơn',equal:'Tương đương'},showWarnings:true};}
function newSession(work,name='Báo cáo mới'){
 const s={id:id(),name,description:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:1,selected:[],rows:TEMPLATE.map(r=>({...r,visible:true})),settings:defaultSettings(),bindings:{},audit:[]};
 for(const type of ['DISB','REV','GPMB']){const a=work.datasets.filter(d=>d.type===type);if(a.length)s.bindings[type]=a[a.length-1].id;}
 return s;
}
function emptyWorkspace(){return {version:1,name:'Hồ sơ KTXH',datasets:[],sessions:[],active:null,audit:[],lastBackupAt:null};}
function bound(work,s,type){return work.datasets.find(d=>d.id===s.bindings[type])||null;}
function availableLocalities(work){const disb=work.datasets.filter(d=>d.type==='DISB').at(-1);return disb?disb.localities.map(name=>({id:K.localityId(name),name})):[];}
function datasetRecords(ds,locality){if(!ds)return[];return ds.records.filter(r=>r.localityId===K.localityId(locality));}
function coverage(work,s,onlySelected=false){
 const disb=bound(work,s,'DISB')||work.datasets.filter(d=>d.type==='DISB').at(-1),base=disb?.localities||[];
 let subset=onlySelected?base.filter(x=>s.selected.includes(K.localityId(x))):base;
 const entries=[];
 for(const type of ['REV','GPMB']){
   const ds=bound(work,s,type)||work.datasets.filter(d=>d.type===type).at(-1);if(!ds)continue;
   const present=new Set(ds.localities.map(x=>K.localityId(x)));
   for(const name of subset)if(!present.has(K.localityId(name)))entries.push({name,type,field:'Toàn bộ địa phương',status:'NO_LOCALITY_RECORD',sourceCell:'Không có hàng địa phương',reason:'Không có bản ghi trong sheet của nguồn; không suy luận không có phát sinh',asOfDate:ds.asOfDate,impact:'Không thể tính chỉ tiêu của nguồn này'});
   if(type==='GPMB')for(const rec of ds.records)if((!onlySelected||s.selected.includes(rec.localityId))&&K.numeric(rec.fields.D)&&!K.numeric(rec.fields.I))entries.push({name:rec.locality,type,field:'I - Diện tích đã GPMB',status:'FIELD_MISSING',sourceCell:'I'+rec.row,reason:'Dự án có D nhưng I trống; tổng diện tích là partial, không tự coi I = 0 đã xác nhận',asOfDate:ds.asOfDate,impact:'Giữ D trong mẫu số; I chỉ cộng các giá trị đã ghi nhận'});
 }
 return entries;
}
function num(ds,rec,field){return K.numeric(rec?.fields?.[field]);}
function provenance(ds,r,cols){return ds&&r?K.sourceRefs(ds,r,cols):[];}
function calcId(s,ds,row,loc){const x=(s.id+'|'+s.revision+'|'+(ds?.id||'none')+'|'+row.key+'|'+K.localityId(loc));let h=2166136261;for(let i=0;i<x.length;i++){h^=x.charCodeAt(i);h=Math.imul(h,16777619);}return 'ct-'+(h>>>0).toString(16);}
function baseTrace(s,row,loc,ds){return {traceId:calcId(s,ds,row,loc),indicatorId:row.metric,resultKind:'CALCULATED',result:{exactDecimal:null,displayedText:'',canonicalUnit:'',displayUnit:'',state:'MISSING'},formula:{formulaId:row.metric,formulaVersion:'PH1.1',readableExpression:'',expressionTree:{},method:'',roundingPolicy:'ROUND_HALF_UP ở bước trình bày',tolerancePolicy:'Không làm tròn số gốc'},scope:{type:loc==='__ALL__'?'LOCALITIES_AVAILABLE_N':'SELECTED_UNITS',sourceDatasetIds:ds?[ds.id]:[],selectedLocalityIds:loc==='__ALL__'?(ds?.localities||[]).map(K.localityId):[K.localityId(loc)],expectedCount:114,matchingPolicyId:'NFC_CASEFOLD_TYPE_V1',asOfDates:ds?[ds.asOfDate]:[]},operands:[],population:{eligibleCount:0,includedCount:0,excludedCount:0,missingCount:0,includedRecordIds:[],excludedRecordIds:[]},coverageDetails:[],exclusions:[],zeroDenominatorContributors:[],steps:[],quality:{status:'COMPLETE',warningIds:[]},sourceRefs:[],createdAt:new Date().toISOString(),engineVersion:'PH1.1',datasetHashes:ds?[ds.hash]:[]};}
function resultObj(s,row,loc,ds,method){let t=baseTrace(s,row,loc,ds);t.formula.readableExpression=method;return {value:null,unit:'',quality:'INSUFFICIENT_COMPONENTS',state:'MISSING',text:null,trace:t};}
function put(o,value,unit,quality='COMPLETE',state){o.value=value?.toString()??null;o.unit=unit;o.quality=quality;o.state=state||(value?(value.isZero()?'ZERO':'VALUE'):'MISSING');o.trace.result.exactDecimal=o.value;o.trace.result.canonicalUnit=unit;o.trace.result.displayUnit=unit;o.trace.result.state=o.state;o.trace.quality.status=quality;return o;}
function missing(o,reason,state='MISSING',quality='INSUFFICIENT_COMPONENTS'){
 o.state=state;o.quality=quality;o.trace.result.state=state;o.trace.quality.status=quality;o.trace.steps.push({operation:'BLOCKED',inputs:[],output:null,reason});return o;
}
function addSource(o,ds,rec,cols){o.trace.sourceRefs.push(...provenance(ds,rec,cols));for(const col of cols){const x=rec?.fields?.[col];if(x)o.trace.operands.push({role:col,fieldId:col,exactValue:K.numeric(x)?.toString()??null,unit:x.unit,state:x.state,sources:provenance(ds,rec,[col])});}}
function groupedSum(ds,recs,field,allowPartials=true){
 let sum=D.of(0),included=[],exclusions=[],missing=[],sources=[];
 for(const r of recs){const v=num(ds,r,field);sources.push(...provenance(ds,r,[field]));if(v){sum=sum.add(v);included.push(r.id);}else{missing.push(r.id);exclusions.push({recordId:r.id,affectedOperand:field,reasonCode:r.fields[field]?.state==='FORMULA_ERROR'?'FORMULA_ERROR':'MISSING_INPUT',explanation:'Không có giá trị số hợp lệ ở '+field,sourceCell:field+r.row});}}
 return {value:included.length?sum:null,included,exclusions,missing,sources,quality:missing.length&&allowPartials?'PARTIAL_AGGREGATE':missing.length?'INSUFFICIENT_COMPONENTS':'COMPLETE'};
}
function ratio(ds,recs,numerator,denominator,{recordedArea=false,expectedCount=114}={}){
 let top=D.of(0),bottom=D.of(0),included=[],exclusions=[],zero=[],missing=[],sources=[];
 for(const rec of recs){let n=num(ds,rec,numerator),d=num(ds,rec,denominator);sources.push(...provenance(ds,rec,[numerator,denominator]));
   if(!d||!n){
     const which=!d?denominator:numerator;missing.push(rec.id);exclusions.push({recordId:rec.id,affectedOperand:which,reasonCode:rec.fields[which]?.state==='FORMULA_ERROR'?'FORMULA_ERROR':'MISSING_INPUT',explanation:'Thiếu số hạng '+which,sourceCell:which+rec.row,operandOnly:!!(recordedArea&&d)});
     // GPMB: do not drop valid denominator for projects with missing I.
     if(recordedArea&&d){bottom=bottom.add(d);included.push(rec.id);}
     continue;
   }
   top=top.add(n);bottom=bottom.add(d);included.push(rec.id);
   if(d.isZero()&&n.cmp(0)>0)zero.push({recordId:rec.id,numeratorFieldId:numerator,denominatorFieldId:denominator,numeratorExactDecimal:n.toString(),denominatorExactDecimal:'0',numeratorSource:provenance(ds,rec,[numerator])[0],denominatorSource:provenance(ds,rec,[denominator])[0]});
 }
 const partial=missing.length>0,valid=!bottom.isZero()&&included.length>0;
 return {value:valid?top.div(bottom,24).mul(100):null,top,bottom,included,exclusions,zero,missing,sources,quality:!included.length?'INSUFFICIENT_COMPONENTS':!valid?'DENOMINATOR_ZERO':partial?'PARTIAL_AGGREGATE':'COMPLETE',expectedCount};
}
function attachRatio(o,a,ds,numerator,denominator,method){
 o.trace.formula.readableExpression=method||('SUM('+numerator+') / SUM('+denominator+') × 100');o.trace.formula.method='RATIO_OF_SUMS';
 o.trace.operands.push({role:'numerator',fieldId:numerator,exactValue:a.top.toString(),unit:ds?.type==='GPMB'?'m2':'million',state:'VALUE',sources:a.sources.filter(x=>x.address.startsWith(numerator))},{role:'denominator',fieldId:denominator,exactValue:a.bottom.toString(),unit:ds?.type==='GPMB'?'m2':'million',state:'VALUE',sources:a.sources.filter(x=>x.address.startsWith(denominator))});
 Object.assign(o.trace.population,{eligibleCount:a.included.length+a.exclusions.filter(x=>!x.operandOnly).length,includedCount:a.included.length,excludedCount:a.exclusions.filter(x=>!x.operandOnly).length,missingCount:a.missing.length,includedRecordIds:a.included,excludedRecordIds:a.exclusions.filter(x=>!x.operandOnly).map(x=>x.recordId)});
 o.trace.sourceRefs=a.sources;o.trace.exclusions=a.exclusions;o.trace.zeroDenominatorContributors=a.zero;
 o.trace.steps.push({operation:'SUM_NUMERATOR',inputs:[numerator],output:a.top.toString(),reason:'Cộng tử số gốc không làm tròn'},{operation:'SUM_DENOMINATOR',inputs:[denominator],output:a.bottom.toString(),reason:'Cộng mẫu số gốc, gồm cả dòng mẫu số 0 hợp lệ'},{operation:'DIVIDE_PERCENT',inputs:[a.top.toString(),a.bottom.toString()],output:a.value?.toString()||null,reason:a.value?'100 × tổng tử / tổng mẫu':'Tổng mẫu bằng 0 hoặc không có dữ liệu hợp lệ'});
 put(o,a.value,'percent',a.quality,a.quality==='DENOMINATOR_ZERO'?'ZERO':'MISSING');
 if(a.value)o.state='VALUE',o.trace.result.state='VALUE';
 if(a.quality==='PARTIAL_AGGREGATE')o.trace.quality.missingDeclaredAmount=a.exclusions.filter(x=>x.affectedOperand===numerator).reduce((t,e)=>{const r=ds.records.find(z=>z.id===e.recordId);return t.add(num(ds,r,denominator)||0)},D.of(0)).toString();
 return o;
}
function sourceCalc(o,ds,records,col,divisor,unit){
 if(!records.length){o.trace.coverageDetails=[{localityId:o.trace.scope.selectedLocalityIds[0],localityName:'',sourceDatasetId:ds.id,fieldId:col,status:'NO_LOCALITY_RECORD',reason:'Không có hàng địa phương trong nguồn',asOfDate:ds.asOfDate}];return missing(o,'Không có bản ghi địa phương trong nguồn','OUT_OF_SCOPE');}
 let rec=records[0];addSource(o,ds,rec,[col]);let val=num(ds,rec,col);
 if(!val)return missing(o,'Ô '+col+rec.row+' thiếu hoặc lỗi nguồn',rec.fields[col]?.state==='FORMULA_ERROR'?'FORMULA_ERROR':'MISSING');
 o.trace.population.eligibleCount=1;o.trace.population.includedCount=1;o.trace.population.includedRecordIds=[rec.id];
 o.trace.formula.readableExpression=`${col}${rec.row} / ${divisor}`;o.trace.formula.method='UNIT_CONVERSION';
 let end=val.div(divisor);o.trace.steps.push({operation:'SOURCE_VALUE',inputs:[val.toString()],output:val.toString(),inputUnit:rec.fields[col].unit,reason:'Đọc nguyên bản từ ô '+col+rec.row},{operation:'UNIT_CONVERSION',inputs:[val.toString(),String(divisor)],output:end.toString(),inputUnit:rec.fields[col].unit,outputUnit:unit,reason:'Quy đổi đơn vị; không làm tròn trước khi tính'});
 return put(o,end,unit);
}
function groupedCalc(o,ds,recs,field,divisor,unit){
 if(!recs.length)return missing(o,'Không có địa phương trong nguồn','OUT_OF_SCOPE');
 let a=groupedSum(ds,recs,field);o.trace.formula.readableExpression=`SUM(${field} dự án đã ghi nhận) / ${divisor}`;o.trace.formula.method='SUM_AND_UNIT_CONVERSION';
 o.trace.population={eligibleCount:recs.length,includedCount:a.included.length,excludedCount:a.exclusions.length,missingCount:a.missing.length,includedRecordIds:a.included,excludedRecordIds:a.exclusions.map(x=>x.recordId)};
 o.trace.sourceRefs=a.sources;o.trace.exclusions=a.exclusions;
 o.trace.steps=[{operation:'SUM',inputs:a.included,output:a.value?.toString()||null,reason:'Cộng số hợp lệ, không biến missing thành 0'},{operation:'UNIT_CONVERSION',inputs:[a.value?.toString()||'null',String(divisor)],output:a.value?.div(divisor).toString()||null,reason:'Đổi đơn vị sau khi tổng'}];
 if(!a.value)return missing(o,'Không có số hợp lệ');
 return put(o,a.value.div(divisor),unit,a.quality);
}
function benchmark(ds,type){if(!ds)return null;const r=type==='GPMB'?ratio(ds,ds.records,'I','D',{recordedArea:true,expectedCount:114}):type==='DISB'?ratio(ds,ds.records,'I','F',{expectedCount:114}):ratio(ds,ds.records,'I','C',{expectedCount:114});return r;}
function benchmarkRevenueLand(ds,plan=false){return ds?ratio(ds,ds.records,'R',plan?'G':'D',{expectedCount:114}):null;}
function compareCalc(o,localBench,allBench,session,sourceType){
 const tr=o.trace;tr.formula.readableExpression='Tỷ lệ địa phương − mốc nguồn (điểm phần trăm)';tr.formula.method='COMPARISON';
 if(!localBench.value||!allBench.value||localBench.quality!=='COMPLETE'||allBench.quality!=='COMPLETE'){
   o.text='Chưa đủ cơ sở đánh giá';tr.steps.push({operation:'POLICY_GATE',inputs:[],output:null,reason:'Tỷ lệ thiếu/partial/mẫu số 0 hoặc chưa có mốc đầy đủ'});tr.quality.status='INSUFFICIENT_COMPONENTS';return o;
 }
 const delta=localBench.value.sub(allBench.value),thr=D.of(session.settings.threshold),ab=delta.abs();let name=ab.cmp(thr)<=0?session.settings.words.equal:delta.cmp(0)>0?session.settings.words.higher:session.settings.words.lower;
 o.text=name+(ab.cmp(thr)<=0?'':' '+ab.fixed(session.settings.decimals)+' điểm %');tr.operands=[{role:'local',fieldId:'LOCAL_RATE',exactValue:localBench.value.toString(),unit:'percent',state:'VALUE',sources:[]},{role:'benchmark',fieldId:'BENCH_RATE',exactValue:allBench.value.toString(),unit:'percent',state:'VALUE',sources:[]}];tr.steps.push({operation:'SUBTRACT_PP',inputs:[localBench.value.toString(),allBench.value.toString()],output:delta.toString(),reason:'So sánh theo điểm phần trăm, ngưỡng '+thr.toString()});tr.result.exactDecimal=delta.toString();tr.result.displayedText=o.text;tr.result.state='VALUE';tr.result.canonicalUnit='percentage-point';tr.quality.status='COMPLETE';o.state='VALUE';o.quality='COMPLETE';return o;
}
function calculate(work,s,row,locality){
 const ds=bound(work,s,METRIC_SOURCE[row.metric]),o=resultObj(s,row,locality,ds,''),metric=row.metric;
 if(!ds)return missing(o,'Chưa nhập nguồn '+METRIC_SOURCE[metric],'OUT_OF_SCOPE');
 const recs=datasetRecords(ds,locality),all=ds.records;
 function rate(n,d,global=false,recordedArea=false){const a=ratio(ds,global?all:recs,n,d,{recordedArea});if(!global&&!recs.length)return missing(o,'Không có bản ghi địa phương trong nguồn','OUT_OF_SCOPE');attachRatio(o,a,ds,n,d,recordedArea?'100 × SUM(I dự án đã ghi nhận)/SUM(D mọi dự án có D)':'100 × SUM('+n+') / SUM('+d+')');if(global){o.trace.scope.type=ds.type==='GPMB'?'PROJECT_PORTFOLIO_CITY':'LOCALITIES_AVAILABLE_N';o.trace.scope.selectedLocalityIds=ds.localities.map(K.localityId);o.trace.scope.expectedCount=114;}return o;}
 switch(metric){
 case 'REV_BUDGET_Y':return sourceCalc(o,ds,recs,'C',s.settings.moneyUnit==='billion'?'1000':'1',s.settings.moneyUnit==='billion'?'billion':'million');
 case 'REV_RATE_Y':return rate('I','C');
 case 'REV_LAND_RATE_Y':return rate('R','D');
 case 'REV_NONLAND_RATE_Y':return rate('W','E');
 case 'DISB_PLAN':return sourceCalc(o,ds,recs,'F',s.settings.moneyUnit==='billion'?'1000':'1',s.settings.moneyUnit==='billion'?'billion':'million');
 case 'DISB_PLAN_VS_MEAN':{
   const local=num(ds,recs[0],'F'),usable=all.map(r=>num(ds,r,'F')).filter(Boolean);
   if(!local||usable.length!==114)return missing(o,'Chưa có đủ 114 kế hoạch vốn hợp lệ để tính mức bình quân');
   const total=D.sum(usable),mean=total.div('114'),pct=local.div(mean).mul('100');
   o.trace.formula.readableExpression='F địa phương / (SUM(F 114 địa phương)/114) × 100';o.trace.formula.method='COMPARE_ABSOLUTE_MEAN';
   o.trace.population={eligibleCount:all.length,includedCount:usable.length,excludedCount:0,missingCount:0,includedRecordIds:all.map(r=>r.id),excludedRecordIds:[]};
   o.trace.sourceRefs=all.flatMap(r=>provenance(ds,r,['F']));o.trace.operands=[{role:'local_plan',fieldId:'F',exactValue:local.toString(),unit:'million',state:'VALUE',sources:provenance(ds,recs[0],['F'])},{role:'all_plans',fieldId:'F',exactValue:total.toString(),unit:'million',state:'VALUE',sources:o.trace.sourceRefs},{role:'mean',fieldId:'F/114',exactValue:mean.toString(),unit:'million',state:'VALUE',sources:o.trace.sourceRefs}];
   o.trace.steps=[{operation:'SUM',inputs:all.map(r=>r.id),output:total.toString(),reason:'Tổng vốn 114 địa phương'},{operation:'DIVIDE_COUNT',inputs:[total.toString(),'114'],output:mean.toString(),reason:'Mức vốn bình quân tuyệt đối, không phải bình quân tỷ lệ'},{operation:'COMPARE_PERCENT',inputs:[local.toString(),mean.toString()],output:pct.toString(),reason:'Kế hoạch vốn địa phương so với mức vốn bình quân'}];return put(o,pct,'percent');}
 case 'DISB_RATE_REFERENCE':return rate('I','F',true);
 case 'DISB_RATE':return rate('I','F');
 case 'DISB_ASSESS':{let local=ratio(ds,recs,'I','F'),allRate=benchmark(ds,'DISB');
   o.trace.sourceRefs=[...local.sources,...allRate.sources];o.trace.population.includedRecordIds=[...new Set([...local.included,...allRate.included])];o.trace.population.includedCount=o.trace.population.includedRecordIds.length;o.trace.population.eligibleCount=all.length;o.trace.exclusions=local.exclusions.concat(allRate.exclusions);
   return compareCalc(o,local,allRate,s,'DISB');}
 case 'GPMB_BUDGET':return groupedCalc(o,ds,recs,'G',s.settings.moneyUnit==='billion'?'1000000000':'1000000',s.settings.moneyUnit==='billion'?'billion':'million');
 case 'GPMB_AREA_PLAN':return groupedCalc(o,ds,recs,'D',s.settings.areaUnit==='ha'?'10000':'1',s.settings.areaUnit);
 case 'GPMB_RATE_REFERENCE':return rate('I','D',true,true);
 case 'GPMB_AREA_RATE':return rate('I','D',false,true);
 case 'GPMB_ASSESS':{let local=ratio(ds,recs,'I','D',{recordedArea:true}),allRate=benchmark(ds,'GPMB');o.trace.sourceRefs=local.sources.concat(allRate.sources);o.trace.population.includedRecordIds=[...new Set(local.included.concat(allRate.included))];o.trace.population.includedCount=o.trace.population.includedRecordIds.length;o.trace.population.eligibleCount=all.length;o.trace.exclusions=local.exclusions.concat(allRate.exclusions);return compareCalc(o,local,allRate,s,'GPMB');}
 default:throw Error('Chỉ tiêu không được PH1 hỗ trợ: '+metric);
 }
}
function format(value,unit,settings){if(value===null||value===undefined)return 'Chưa có số liệu';const dec=D.of(value),digits=unit==='m2'?settings.areaDecimals:settings.decimals;
 let s=dec.fixed(digits),pair=s.split('.');pair[0]=pair[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');s=pair.join(',');
 return s+(unit==='percent'?'%':unit==='billion'?' tỷ đồng':unit==='million'?' triệu đồng':unit==='m2'?' m²':unit==='ha'?' ha':'');}
function display(o,settings){if(o.text!==null){o.trace.result.displayedText=o.text;return o.text;}if(o.value!=null){let s=format(o.value,o.unit,settings);o.trace.result.displayedText=s;return s;}let reason=o.quality==='DENOMINATOR_ZERO'?'Không có cơ sở tính tỷ lệ':o.state==='FORMULA_ERROR'?'Lỗi công thức nguồn':o.state==='OUT_OF_SCOPE'?'Không có bản ghi nguồn':'Chưa có số liệu';if(o.quality==='DENOMINATOR_ZERO'){const n=o.trace.operands.find(z=>z.role==='numerator');if(n&&D.of(n.exactValue||'0').cmp(0)>0)reason='Phát sinh ngoài dự toán/kế hoạch';}o.trace.result.displayedText=reason;return reason;}
function buildReport(work,s){const columns=s.selected.map(id=>availableLocalities(work).find(x=>x.id===id)||({id,name:id})),rows=s.rows.filter(x=>x.visible);return {columns,rows:rows.map(row=>({row,cells:columns.map(c=>{const val=calculate(work,s,row,c.name);display(val,s.settings);return val;})})),sources:['REV','DISB','GPMB'].map(type=>bound(work,s,type)).filter(Boolean),coverage:coverage(work,s,true),issues:['REV','DISB','GPMB'].flatMap(type=>(bound(work,s,type)?.issues||[]).filter(i=>s.selected.includes(K.localityId(i.locality))))};}
function updateSession(s,description){s.revision++;s.updatedAt=new Date().toISOString();s.audit.push({when:s.updatedAt,action:description,revision:s.revision});}
function makeBackup(work){const clean=JSON.parse(JSON.stringify(work));delete clean.lastBackupAt;return {kind:'KTXH_OFFLINE_WORKSPACE',formatVersion:1,engineVersion:'PH1.1',createdAt:new Date().toISOString(),payload:clean};}
async function signedBackup(work){const copy=makeBackup(work),encoded=new TextEncoder().encode(JSON.stringify(copy));const checksum=await K.sha256(encoded);return {...copy,checksum};}
async function verifiedBackup(data){const {checksum,...copy}=data;if(copy.kind!=='KTXH_OFFLINE_WORKSPACE'||copy.formatVersion!==1||!copy.payload||!Array.isArray(copy.payload.sessions)||!Array.isArray(copy.payload.datasets))throw Error('Tệp không đúng định dạng backup PH1');const a=await K.sha256(new TextEncoder().encode(JSON.stringify(copy)));if(a!==checksum)throw Error('Checksum backup sai: tệp đã thay đổi');for(const s of copy.payload.sessions)if(!Array.isArray(s.selected)||!Array.isArray(s.rows)||!s.bindings)throw Error('Phiên trong bản sao lưu không hợp lệ');return copy.payload;}
Object.assign(K,{TEMPLATE,METRIC_SOURCE,id,newSession,emptyWorkspace,bound,availableLocalities,datasetRecords,coverage,ratio,groupedSum,benchmark,benchmarkRevenueLand,calculate,format,display,buildReport,updateSession,signedBackup,verifiedBackup});
})(typeof globalThis!=='undefined'?globalThis:this);
