import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const output = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  stdin: { contents: "export * from './src/lib/methodologyMatrix'; export * from './src/lib/riskScoreProfile'; export * from './src/lib/riskStatusFilter';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { buildMatrix, matrixScope, axisScore, scoreLabel, riskMovement, riskReduction, targetRiskScore, residualRating, matchesRiskStatus } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
test('risk reduction uses recorded scores and does not invent missing outcomes', () => {
  assert.equal(riskReduction({inherentScore:25,residualScore:16}),36);
  assert.equal(riskReduction({inherentScore:16,residualScore:20}),-25);
  assert.equal(riskReduction({inherentScore:25,residualScore:null}),null);
  assert.equal(riskReduction({inherentScore:0,residualScore:5}),null);
  assert.equal(riskReduction({inherentScore:9,residualScore:9}),0);
});
test('open KPI drill-down excludes only closed and cancelled risks', () => {
  for (const status of ['identified', 'assessed', 'treated', 'accepted', 'open']) assert.equal(matchesRiskStatus(status, 'open'), true);
  for (const status of ['closed', 'cancelled']) assert.equal(matchesRiskStatus(status, 'open'), false);
  assert.equal(matchesRiskStatus('assessed', 'identified'), false);
  assert.equal(matchesRiskStatus('identified', 'identified'), true);
});
const config = (rows, cols) => ({
  name: 'Test configuration', scoringMethod: 'multiplication',
  likelihoodLevels: Array.from({ length: rows }, (_, i) => ({ value: i + 1, label: `L${i + 1}` })),
  impactLevels: Array.from({ length: cols }, (_, i) => ({ value: i + 1, label: `I${i + 1}` })),
  ratingBands: [{ label: 'Configured rating', minScore: 1, maxScore: rows * cols, colour: '#123456' }],
});
test('dynamic dimensions and empty cells for 3x3, 4x4, 5x5 and custom', () => {
  for (const [rows, cols] of [[3, 3], [4, 4], [5, 5], [3, 7]]) {
    const grid = buildMatrix(config(rows, cols), [{ residualLikelihood: rows, residualImpact: cols }], 'residual');
    assert.equal(grid.length, rows); assert.equal(grid.flat().length, rows * cols);
    assert.equal(grid[0][cols - 1].count, 1);
    assert.equal(grid.flat().reduce((sum, cell) => sum + cell.count, 0), 1);
    assert.equal(grid[0][cols - 1].band.label, 'Configured rating');
  }
});
test('target matrices plot only explicit coordinates, not a target or forecast scalar', () => {
  const risks = [{targetScore:4,expectedResidualScore:4},{targetLikelihood:2,targetImpact:2},{targetLikelihood:9,targetImpact:9}];
  const cells = buildMatrix(config(3,3),risks,'target').flat();
  assert.equal(cells.reduce((sum,cell)=>sum+cell.count,0),1);
  assert.equal(cells.find(cell=>cell.likelihood.value===2&&cell.impact.value===2).count,1);
});
test('active matrix excludes legacy, foreign and incompatible version records', () => {
  const risks = [{ id: 'legacy' }, { id: 'same', methodologyId: 'a', methodologyVersion: 2 }, { id: 'old', methodologyId: 'a', methodologyVersion: 1 }, { id: 'other', methodologyId: 'b', methodologyVersion: 2 }];
  assert.deepEqual(matrixScope(risks, { id: 'a', version: 2 }).map(r => r.id), ['same']);
  assert.deepEqual(matrixScope(risks, null).map(r => r.id), ['legacy']);
});
test('missing or invalid coordinates are not inferred from scores', () => {
  for (const value of [null, undefined, NaN, '2', 0, 5]) assert.equal(axisScore(config(4, 4), value, 2), null);
  const grid = buildMatrix(config(4, 4), [{ residualScore: 16 }, { residualLikelihood: 5, residualImpact: 5 }], 'residual');
  assert.equal(grid.flat().reduce((sum, cell) => sum + cell.count, 0), 0);
});
test('score profile handles missing fields and never applies legacy axes to unknown versions', () => {
  assert.equal(scoreLabel({}, NaN), 'Not set');
  assert.equal(scoreLabel({}, null), 'Not set');
  assert.equal(riskMovement({}), 'Target not set');
  assert.equal(targetRiskScore({ methodologyId: 'missing', targetLikelihood: 2, targetImpact: 2 }), null);
  assert.equal(targetRiskScore({ methodology: { config: config(3, 7) }, targetLikelihood: 3, targetImpact: 7 }), 21);
  assert.equal(scoreLabel({ methodology: { config: config(4, 4) } }, 16), '16 - Configured rating');
  assert.equal(riskMovement({ targetLikelihood: 1, targetImpact: 1 }), 'Current residual risk not set');
});

test('persisted target and rating remain authoritative', () => {
  assert.equal(targetRiskScore({targetScore: null, targetLikelihood: 2, targetImpact: 2}), null);
  assert.equal(targetRiskScore({targetScore: 9, methodologyId: 'pinned'}), 9);
  assert.equal(residualRating({residualScore: 9, residualRating: 'Critical'}), 'Critical');
  assert.equal(residualRating({residualScore: 9, methodologyId: 'missing'}), 'Methodology unavailable');
});

test('candidate 3x3 and 4x4 bands colour every cell and scope historical counts', () => {
  for (const size of [3,4]) {
    const ranges=size===4?[[1,4],[5,8],[9,12],[13,16]]:[[1,3],[4,6],[7,9]];
    const labels=['Low','Medium','High','Critical'];
    const colours=['#047857','#ca8a04','#ea580c','#dc2626'];
    const policy={...config(size,size),ratingBands:ranges.map(([minScore,maxScore],i)=>({minScore,maxScore,label:labels[i],colour:colours[i]}))};
    const records=[{id:'current',methodologyId:'test',methodologyVersion:2,residualLikelihood:size,residualImpact:size},
      {id:'historical',methodologyId:'test',methodologyVersion:1,residualLikelihood:1,residualImpact:1}];
    const grid=buildMatrix(policy,matrixScope(records,{id:'test',version:2}),'residual');
    assert.equal(grid.flat().length,size*size);
    assert.equal(grid.flat().reduce((total,cell)=>total+cell.count,0),1);
    assert.ok(grid.flat().some(cell=>cell.count===0));
    for (const cell of grid.flat()) {
      const expected=ranges.findIndex(([min,max])=>cell.score>=min&&cell.score<=max);
      assert.equal(cell.score,cell.likelihood.value*cell.impact.value);
      assert.equal(cell.band.label,labels[expected]);
      assert.equal(cell.band.colour,colours[expected]);
      assert.equal(scoreLabel({methodology:{config:policy}},cell.score),`${cell.score} - ${labels[expected]}`);
    }
  }
});

// Render the public score profile, not just its calculation helpers.
test('rendered pinned profile discloses missing configuration without legacy inference', async () => {
  const { createRequire } = await import('node:module');
  const rendered = await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {RiskScoreProfile} from './src/components/RiskScoreProfile'; export const html=renderToStaticMarkup(React.createElement(RiskScoreProfile,{risk:{methodologyId:'unavailable',methodologyVersion:7,inherentScore:25,residualScore:20,targetScore:null}}));`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', rendered.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  assert.match(mod.exports.html, /Methodology v7 - configuration unavailable/);
  assert.match(mod.exports.html, /Methodology unavailable/);
  assert.match(mod.exports.html, /Target not set/);
  assert.doesNotMatch(mod.exports.html, /legacy rating bands|Methodology threshold indicators|>Critical</);
});
