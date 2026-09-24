import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import express from 'express';
import type { Server } from 'node:http';
import { legacyMethodology, validateMethodology, scoreBand, scoreRisk } from '../services/riskMethodologyRules.js';

const url = process.env.TEST_DATABASE_URL;
test('real risk/treatment repositories and methodology route on disposable core schema', { skip: !url }, async () => {
  const address = new URL(url!);
  assert.match(address.hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
  assert.match(address.pathname, /test/i);
  const schema = `risk_repository_test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({connectionString: url, connectionTimeoutMillis: 5000});
  let pool: pg.Pool | undefined;
  let server: Server | undefined;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await client.query("CREATE TABLE workspaces(id TEXT PRIMARY KEY); INSERT INTO workspaces VALUES ('w'),('other')");
    await client.query(await readFile(resolve(__dirname,'../../sql/schema-core-grc.sql'),'utf8'));
    // These columns are currently installed by the intelligence schema bootstrap.
    await client.query('ALTER TABLE risks ADD COLUMN treatment_status TEXT, ADD COLUMN treatment_due_date TIMESTAMPTZ');
    await client.query(`INSERT INTO risks (id,workspace_id,title,owner,category,status,inherent_likelihood,inherent_impact,residual_likelihood,residual_impact)
      VALUES ('historical-unclassified','w','Historical unclassified risk','Owner','operational','identified',3,3,2,2)`);
    for (const name of ['20260920-risk-cia-impact.sql','20260920-risk-treatment-lifecycle.sql','20260923-risk-methodologies.sql']) {
      await client.query(await readFile(resolve(__dirname,'../../sql/migrations',name),'utf8'));
    }
    address.searchParams.set('options',`-c search_path=${schema}`);
    assert.deepEqual((await client.query("SELECT cia_impacts FROM risks WHERE id='historical-unclassified'")).rows[0].cia_impacts, [], 'migration must not invent historical CIA classifications');
    process.env.DATABASE_URL = address.toString();
    pool = (await import('../db.js')).pool;
    const treatments = await import('../repositories/riskTreatmentRepo.js');
    const risks = await import('../repositories/risksRepo.js');
    const methodologies = await import('../repositories/riskMethodologyRepo.js');
    await treatments.ensureRiskTreatmentSchema();
    await client.query(await readFile(resolve(__dirname,'../../sql/migrations/20260923-risk-version-pinning.sql'),'utf8'));
    await client.query(await readFile(resolve(__dirname,'../../sql/migrations/20260924-risk-tenant-rollout.sql'),'utf8'));
    const input = {title:'Repository test',owner:'Test owner',category:'operational',inherentLikelihood:4,inherentImpact:4,residualLikelihood:3,residualImpact:3,ciaImpacts:['Integrity' as const]};
    const legacy = await risks.createRisk('other',input);
    assert.equal(legacy.methodologyId,null);
    assert.equal(legacy.legacyCompatibility,true);
    assert.equal(legacy.residualScore,9);
    assert.equal(legacy.treatmentRequired,null);
    const { legacyRiskSeedQuery } = await import('../services/legacyRiskSeed.js');
    await legacyRiskSeedQuery('UPDATE risks SET title=\'Overwritten fixture\',residual_likelihood=1 WHERE id=$1 AND workspace_id=$2', [legacy.id, 'other']);
    assert.deepEqual(await risks.getRiskById('other',legacy.id),legacy, 'Startup seed preserves existing legacy scores and narrative');
    await methodologies.setWorkspaceMode('w','tester','enforced');
    await assert.rejects(risks.createRisk('w',input),/must be configured/);
    const draft = await methodologies.saveDraft('w','tester',legacyMethodology);
    await assert.rejects(risks.createRisk('w',input),/must be configured/);
    await methodologies.saveDraft('other','tester',legacyMethodology);
    assert.equal((await risks.createRisk('other',input)).methodologyId,null);

    // Test route permissions with an explicit test identity, not production authentication.
    const router: express.Router = require('../routes/riskMethodologies.js').default;
    const app = express();
    app.use(express.json());
    app.use((req,_res,next)=>{
      if (req.headers['x-test-role']) req.authUser={userId:'tester',email:'tester@example.invalid',workspaceId:'w',role:req.headers['x-test-role'] === 'owner' ? 'owner' : 'viewer'};
      next();
    });
    app.use('/methodologies',router);
    server = await new Promise<Server>(resolveServer=>{ const instance=app.listen(0,'127.0.0.1',()=>resolveServer(instance)); });
    const info=server.address(); assert.ok(info && typeof info !== 'string');
    const endpoint=`http://127.0.0.1:${info.port}/methodologies/${draft.id}/activate`;
    const activate=(headers: Record<string,string>={})=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({confirmPreserveExisting:true})});
    assert.equal((await activate()).status,401);
    assert.equal((await activate({'x-test-role':'viewer'})).status,403);
    assert.equal((await activate({'x-test-role':'owner','x-workspace-id':'other'})).status,403);
    delete process.env.RISK_METHODOLOGY_ACTIVATION_ENABLED;
    assert.equal((await activate({'x-test-role':'owner'})).status,409);
    process.env.RISK_METHODOLOGY_ACTIVATION_ENABLED='true'; // Test process only.
    assert.equal((await activate({'x-test-role':'owner'})).status,200);
    delete process.env.RISK_METHODOLOGY_ACTIVATION_ENABLED;

    const risk=await risks.createRisk('w',{...input,targetLikelihood:1,targetImpact:2});
    assert.equal(risk.methodologyId,draft.id); assert.equal(risk.inherentScore,16);
    assert.equal(risk.residualScore,9); assert.equal(risk.targetScore,2);
    assert.equal(risk.treatmentRequired,false);
    assert.equal((await methodologies.workspaceState('other')).legacyCompatibility,true);
    assert.equal((await risks.createRisk('other',input)).methodologyId,null);
    await methodologies.setWorkspaceMode('other','tester','enforced');
    await assert.rejects(risks.createRisk('other',input),/must be configured/);
    await assert.rejects(risks.updateRisk('other',legacy.id,{residualImpact:4}),/explicit migration workflow/);
    assert.equal((await risks.updateRisk('other',legacy.id,{title:'Non-scoring edit'}))?.residualScore,9);
    await methodologies.setWorkspaceMode('other','tester','legacy');
    assert.equal(Number((await client.query("SELECT count(*) FROM risk_methodology_mode_events WHERE workspace_id='other'")).rows[0].count),2);
    assert.equal((await risks.updateRisk('other',legacy.id,{residualImpact:4}))?.residualScore,12);
    assert.equal((await risks.getRiskById('w',risk.id))?.methodology?.version,draft.version);
    assert.equal(await risks.getRiskById('other',risk.id),null);
    const update=await risks.updateRisk('w',risk.id,{targetLikelihood:null,targetImpact:null,residualImpact:4});
    assert.equal(update?.targetScore,null); assert.equal(update?.residualRating,'High');
    await assert.rejects(risks.updateRisk('w',risk.id,{residualImpact:6}),/Invalid impact/);

    const planInput={riskId:risk.id,title:'Treatment',description:'Test',owner:'Owner',dueDate:'2099-01-01',strategy:'mitigate' as const,status:'planned' as const,progressPercent:0,priority:'high' as const,approvalStatus:'not_required' as const,expectedResidualScore:4};
    const plan=await treatments.create('w',planInput);
    assert.equal(plan.expectedResidualRating,'Low');
    await treatments.update('w',plan.id,{status:'completed',progressPercent:100});
    assert.equal((await risks.getRiskById('w',risk.id))?.residualScore,12);
    await client.query('ALTER TABLE risk_treatment_plans DISABLE TRIGGER treatment_methodology_guard');
    await assert.rejects(treatments.create('w',planInput),/migration is required/);
    await assert.rejects(treatments.update('w',plan.id,{notes:'must not write'}),/migration is required/);
    await client.query('ALTER TABLE risk_treatment_plans ENABLE TRIGGER treatment_methodology_guard');

    // Test-only policies: never seed or approve these for a customer workspace.
    const workspace = 'disposable-methodology-validation';
    await client.query('INSERT INTO workspaces VALUES ($1)', [workspace]);
    const baseline = await risks.getRiskById('w', risk.id);
    let historical: Awaited<ReturnType<typeof risks.createRisk>> | undefined;
    for (const size of [4, 3]) {
      const ranges = size === 4 ? [[1,4],[5,8],[9,12],[13,16]] : [[1,3],[4,6],[7,9]];
      const config = validateMethodology({ ...legacyMethodology,
        name: `Disposable validation ${size}x${size} - NOT APPROVED`,
        likelihoodLevels: legacyMethodology.likelihoodLevels.slice(0,size),
        impactLevels: legacyMethodology.impactLevels.slice(0,size),
        ratingBands: ranges.map(([minScore,maxScore],index) => ({ ...legacyMethodology.ratingBands[index],minScore,maxScore })),
        appetiteMaxScore: size === 4 ? 8 : 6,
        treatmentRequiredFromScore: size === 4 ? 9 : 7,
        escalationRequiredFromScore: size === 4 ? 13 : 9,
      });
      const policy = await methodologies.saveDraft(workspace,'synthetic-validation-actor',config);
      await assert.rejects(methodologies.activate(workspace,policy.id,'synthetic-validation-actor',false), /Confirm activation/);
      await methodologies.activate(workspace,policy.id,'synthetic-validation-actor',true);
      assert.equal(await methodologies.get('other',policy.id),null);
      assert.ok((await methodologies.list('other')).every(row => row.id !== policy.id));
      if (historical) {
        const current=await risks.getRiskById(workspace,historical.id);
        assert.equal(current?.methodology?.status,'Retired');
        assert.deepEqual(current,{...historical,methodology:{...historical.methodology,status:'Retired'}});
      }
      for (let value=1; value<=size*size; value++) {
        const expected = ranges.findIndex(([min,max]) => value>=min && value<=max);
        assert.equal(scoreBand(config,value).label,config.ratingBands[expected].label);
        const sql = await client.query('SELECT laflo_risk_rating($1,$2) AS rating',[config,value]);
        assert.equal(sql.rows[0].rating,scoreBand(config,value).label);
      }
      for (const value of [0,size*size+1,1.5]) assert.throws(()=>scoreBand(config,value));
      for (let l=1;l<=size;l++) for (let i=1;i<=size;i++) {
        const created=await risks.createRisk(workspace,{...input,title:`Disposable ${size}x${size} ${l}/${i}`,
          inherentLikelihood:l,inherentImpact:i,residualLikelihood:l,residualImpact:i});
        const expected=scoreRisk(config,l,i);
        assert.equal(created.methodologyId,policy.id);
        assert.equal(created.methodologyVersion,policy.version);
        assert.equal(created.inherentScore,l*i);
        assert.equal(created.residualScore,expected.score);
        assert.equal(created.residualRating,expected.rating);
        assert.equal(created.targetScore,null);
        assert.equal(created.methodologyOutsideAppetite,expected.outsideAppetite);
        assert.equal(created.treatmentRequired,l*i>=config.treatmentRequiredFromScore);
        assert.equal(created.escalationRequired,l*i>=config.escalationRequiredFromScore);
        assert.equal(expected.outsideAppetite,l*i>config.appetiteMaxScore);
      }
      const selected=await risks.createRisk(workspace,{...input,inherentLikelihood:size,inherentImpact:size,
        residualLikelihood:size,residualImpact:size,targetLikelihood:1,targetImpact:2});
      assert.equal(selected.targetScore,2);
      const renamed=await risks.updateRisk(workspace,selected.id,{title:'Renamed validation risk'});
      assert.equal(renamed?.residualScore,size*size);
      assert.equal(renamed?.methodologyId,policy.id);
      await assert.rejects(risks.createRisk(workspace,{...input,inherentLikelihood:size+1}),/Invalid likelihood/);
      await assert.rejects(risks.updateRisk(workspace,selected.id,{residualImpact:size+1}),/Invalid impact/);
      const forecast=await treatments.create(workspace,{...planInput,riskId:selected.id,expectedResidualScore:size*size});
      assert.equal(forecast.expectedResidualRating,scoreBand(config,size*size).label);
      await assert.rejects(treatments.update(workspace,forecast.id,{expectedResidualScore:size*size+1}));
      await treatments.update(workspace,forecast.id,{status:'completed',progressPercent:100});
      const after=await risks.getRiskById(workspace,selected.id);
      assert.equal(after?.residualScore,size*size);
      assert.equal(after?.targetScore,2);
      assert.equal(await risks.getRiskById('other',selected.id),null);
      if (historical) {
        const pinned=await risks.updateRisk(workspace,historical.id,{residualLikelihood:4,residualImpact:3});
        assert.equal(pinned?.residualScore,12);
        assert.equal(pinned?.residualRating,'High');
        assert.equal(pinned?.methodologyId,historical.methodologyId);
      }
      historical=after!;
    }
    assert.deepEqual(await risks.getRiskById('w',risk.id),baseline);
    assert.equal(Number((await client.query("SELECT count(*) FROM risk_methodology_events WHERE workspace_id=$1 AND action='activated'",[workspace])).rows[0].count),2);
  } finally {
    if (server) await new Promise<void>((resolveClose,reject)=>server!.close(error=>error?reject(error):resolveClose()));
    await pool?.end();
    await client.query('ROLLBACK');
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
