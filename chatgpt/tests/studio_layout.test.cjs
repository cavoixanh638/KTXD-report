const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['decimal.js','sha256.js','xlsx-reader.js','core.js','studio-layout.js']){
 vm.runInThisContext(fs.readFileSync(path.join(root,'src',file),'utf8'),{filename:file});
}
const K=globalThis.KTXH;
function mock(locals=11,metricCount=14){
 const columns=Array.from({length:locals},(_,i)=>({id:'x'+i,name:'Xã '+(i+1)}));
 const rows=Array.from({length:metricCount},(_,i)=>({row:{label:'Chỉ tiêu số '+(i+1),originalRow:i+3,key:'m'+i},cells:columns.map((c,j)=>({value:String(i+j),quality:'COMPLETE',trace:{traceId:'trace-'+i+'-'+j,result:{displayedText:String(i+j)}}}))}));
 return {columns,rows,sources:[],coverage:[],issues:[]};
}
test('A4 auto chooses one of two directions without dropping any locality/metric cells',()=>{
 for(const n of [1,5,11,40,114]){
  const report=mock(n),layout=K.StudioLayout.paginate(report,{paperSize:'A4',orientation:'landscape',fontSize:14,tableMode:'auto'});
  const found=new Set();
  for(const p of layout.pages)for(const loc of p.localities)for(const met of p.metrics){const key=met+'/'+loc;assert(!found.has(key),'Duplicate cell '+key);found.add(key);}
  assert.equal(found.size,14*n);
 }
});
test('Manual transpose keeps exact source values and same inspector indexes',()=>{
 const r=mock(3,4),s={paperSize:'A4',orientation:'landscape',fontSize:14,tableMode:'vertical',title:'Báo cáo'};
 const html=K.StudioLayout.renderDocument(r,s,{name:'Mẫu'});
 assert.equal(html.pagination.direction,'vertical');
 assert(html.html.includes('data-row="3" data-col="2"'));
 assert(html.html.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
});
test('Manual horizontal and A3 portrait generate supported paper sizes',()=>{
 const r=mock(11),s={paperSize:'A3',orientation:'portrait',fontSize:13,tableMode:'horizontal'};
 const result=K.StudioLayout.renderDocument(r,s,{name:'Mẫu'});
 assert.equal(result.pagination.direction,'horizontal');
 assert.equal(result.pagination.spec.width,297);
 assert(result.html.includes('--paper-w:297mm'));
});
test('Very large printed report paginates without shrinking indefinitely',()=>{
 const r=mock(114,14),result=K.StudioLayout.renderDocument(r,{paperSize:'A4',orientation:'landscape',fontSize:14,tableMode:'auto',title:'Báo cáo'},{name:'Nhiều địa phương'});
 assert(result.totalPages>1);assert(result.pagination.pages.every(x=>x.metrics.length>0));
});
