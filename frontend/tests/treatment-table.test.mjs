import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const output = await build({entryPoints:[fileURLToPath(new URL('../src/lib/treatmentTable.ts', import.meta.url))],bundle:true,write:false,platform:'node',format:'esm'});
const {sortTreatmentPlans, treatmentPage} = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);

test('treatment dates sort missing values last without changing source records', () => {
  const plans = [
    {title:'Missing',progressPercent:0},
    {title:'Later',progressPercent:20,dueDate:'2026-12-01',updatedAt:'2026-12-01'},
    {title:'Earlier',progressPercent:90,dueDate:'2026-01-01',updatedAt:'2026-01-01'},
    {title:'Invalid',progressPercent:10,dueDate:'invalid',updatedAt:'invalid'},
  ];
  const before = structuredClone(plans);
  assert.deepEqual(sortTreatmentPlans(plans,'due').map(p=>p.title),['Earlier','Later','Missing','Invalid']);
  assert.deepEqual(sortTreatmentPlans(plans,'updated').map(p=>p.title),['Later','Earlier','Missing','Invalid']);
  assert.deepEqual(sortTreatmentPlans(plans,'progress').map(p=>p.progressPercent),[90,20,10,0]);
  assert.deepEqual(sortTreatmentPlans(plans,'title').map(p=>p.title),['Earlier','Invalid','Later','Missing']);
  assert.deepEqual(plans,before);
});

test('treatment pagination covers last page, reset and shrinking results', () => {
  const plans = Array.from({length:12},(_,id)=>({id}));
  const last = treatmentPage(plans,5,{key:'a',page:3},'a');
  assert.equal(last.pageCount,3);
  assert.deepEqual(last.visible.map(p=>p.id),[10,11]);
  assert.equal(last.visible.find(p=>p.id===0),undefined);
  assert.equal(treatmentPage(plans,5,{key:'a',page:3},'new-filter').page,1);
  assert.equal(treatmentPage(plans.slice(0,3),5,{key:'a',page:3},'a').page,1);
  assert.deepEqual(treatmentPage([],5,{key:'a',page:3},'a'),{page:1,pageCount:1,visible:[]});
  assert.equal(treatmentPage(plans,10,{key:'old-size',page:3},'new-size').visible.length,10);
});
