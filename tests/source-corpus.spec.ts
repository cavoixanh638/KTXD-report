import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {Decimal,sha256Hex} from '../src/core/decimal';
import {importDisbursementWorkbook,importRevenueWorkbook,importGpmbWorkbook} from '../src/core/sourceReaders';
import {sourceMappingProblem} from '../src/core/sourceValidation';
const root=process.cwd();
const base=JSON.parse(fs.readFileSync(path.join(root,'data/reference/MANIFEST.json'),'utf8'));
const corpus=JSON.parse(fs.readFileSync(path.join(root,'data/reference/SOURCE_CORPUS.json'),'utf8'));
describe('Original source corpus: independently reviewed field mapping and golden values',()=>{
  for(const s of corpus.samples)it(s.id,()=>{
    const entry=s.referenceId?base.files.find((f:any)=>f.id===s.referenceId):s;
    expect(entry).toBeDefined();
    const bytes=new Uint8Array(fs.readFileSync(path.join(root,entry.path)));
    expect(sha256Hex(bytes)).toBe(entry.sha256);
    const parser=s.type==='DISB'?importDisbursementWorkbook:s.type==='REV'?importRevenueWorkbook:importGpmbWorkbook;
    const {dataset}=parser(bytes,path.basename(entry.path),s.manualDate?{confirmedAsOfDate:s.manualDate,asOfConfirmationReason:'Corpus test cutoff'}:{});
    expect(dataset.sourceType).toBe(s.type);expect(dataset.sourceSheet).toBe(s.sheet);
    expect(dataset.unitCount).toBe(s.unitCount);expect(dataset.asOfDate).toBe(s.asOfDate);
    if(s.projectRowCount!==undefined)expect(dataset.projectRowCount).toBe(s.projectRowCount);
    expect(dataset.sourceValidation?.schemaSignature).toMatch(/^[a-f0-9]{64}$/);
    for(const [field,col] of Object.entries(s.expectedColumns)){
      expect(dataset.sourceValidation?.columns.find(c=>c.field===field)?.column).toBe(col);
      for(const r of dataset.records.filter(r=>r.metrics[field]))expect(r.metrics[field].sourceColumn).toBe(col);
    }
    for(const g of s.goldenSums){
      const values=dataset.records.filter(r=>r.localityName===g.locality).map(r=>r.metrics[g.field]?.normalizedDecimal).filter((v):v is string=>v!==null&&v!==undefined);
      expect(values.length).toBeGreaterThan(0);
      const total=values.reduce((sum,v)=>sum.plus(v),new Decimal(0));
      expect(total.minus(g.value).abs().lte('0.000001')).toBe(true);
    }
    if(s.referenceId)expect(sourceMappingProblem(dataset)).toBeUndefined();
  });
});
