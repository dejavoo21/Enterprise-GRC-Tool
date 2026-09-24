import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { legacyMethodology, scoreRisk } from '../services/riskMethodologyRules.js';

// Resolve the explicitly supplied local test URL before importing application repositories.
const url = process.env.TEST_DATABASE_URL;
test('PostgreSQL methodology migration and write guards', { skip: !url }, async () => {
  const address = new URL(url!);
  assert.match(address.hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
  assert.match(address.pathname, /test/i, 'Use a disposable local test database');
  const client = new pg.Client({ connectionString: url });
  const schema = `risk_test_${randomUUID().replaceAll('-', '')}`;
  let applicationPool: pg.Pool | undefined;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE workspaces(id TEXT PRIMARY KEY);
      INSERT INTO workspaces VALUES ('w'),('other');
      CREATE TABLE risks(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        inherent_likelihood INTEGER NOT NULL CHECK(inherent_likelihood BETWEEN 1 AND 5),
        inherent_impact INTEGER NOT NULL CHECK(inherent_impact BETWEEN 1 AND 5),
        residual_likelihood INTEGER NOT NULL CHECK(residual_likelihood BETWEEN 1 AND 5),
        residual_impact INTEGER NOT NULL CHECK(residual_impact BETWEEN 1 AND 5),title TEXT);
      CREATE TABLE risk_treatment_plans(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,risk_id TEXT REFERENCES risks(id),expected_residual_score NUMERIC,status TEXT);
      INSERT INTO risks VALUES ('legacy','w',5,5,4,4,'Legacy');`);
    for (const file of ['20260923-risk-methodologies.sql','20260923-risk-version-pinning.sql']) {
      await client.query(await readFile(resolve(__dirname, '../../sql/migrations', file), 'utf8'));
    }
    // Idempotent existing-shape application must not assign historical provenance.
    await client.query(await readFile(resolve(__dirname, '../../sql/migrations/20260923-risk-version-pinning.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, '../../sql/migrations/20260924-risk-tenant-rollout.sql'), 'utf8'));
    await client.query("UPDATE workspaces SET risk_methodology_mode='enforced' WHERE id='w'");
    // Import the real repository only after forcing its pool onto our isolated schema.
    const scoped = new URL(url!);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = scoped.toString();
    const database = await import('../db.js');
    applicationPool = database.pool;
    const methodologyRepo = await import('../repositories/riskMethodologyRepo.js');
    const insert = (id: string, likelihood = 4) => client.query(`INSERT INTO risks(id,workspace_id,inherent_likelihood,inherent_impact,residual_likelihood,residual_impact) VALUES ($1,'w',$2,4,2,2) RETURNING *`, [id,likelihood]);
    await assert.rejects(insert('no-policy'), /must be configured/);
    await client.query(`INSERT INTO risk_methodologies(id,workspace_id,version,status,config) VALUES ('v1','w',1,'Draft',$1),('v2','w',2,'Draft',$1)`, [JSON.stringify(legacyMethodology)]);
    await assert.rejects(methodologyRepo.activate('w','v1','tester',false), /Confirm activation/);
    await assert.rejects(methodologyRepo.activate('other','v1','tester',true), /draft in this workspace/);
    const active = await methodologyRepo.activate('w','v1','tester',true);
    assert.equal(active.historicalRisksPreserved,1);
    assert.equal(active.status,'Active');
    const created = (await insert('new')).rows[0];
    assert.equal(created.methodology_id, 'v1'); assert.equal(created.methodology_version, 1);
    assert.equal(created.inherent_score, 16); assert.equal(created.residual_score, 4);
    assert.equal(created.target_score, null);
    await assert.rejects(insert('invalid', 6), /Invalid likelihood/);
    await assert.rejects(client.query("UPDATE risk_methodologies SET status='Active' WHERE id='v2'"), /unique/);
    await methodologyRepo.activate('w','v2','tester',true);
    assert.equal((await insert('new-v2')).rows[0].methodology_id, 'v2');
    const updated = (await client.query("UPDATE risks SET residual_likelihood=3 WHERE id='new' RETURNING *")).rows[0];
    assert.equal(updated.methodology_id, 'v1'); assert.equal(updated.residual_score, 6);
    await assert.rejects(client.query("UPDATE risks SET methodology_id='v2',methodology_version=2 WHERE id='new'"), /pinned/);
    await assert.rejects(client.query("UPDATE risk_methodologies SET config='{}' WHERE id='v1'"), /immutable/);
    const old = (await client.query("UPDATE risks SET title='Still legacy' WHERE id='legacy' RETURNING *")).rows[0];
    assert.equal(old.methodology_id,null); assert.equal(old.inherent_score,null);
    await assert.rejects(client.query("INSERT INTO risk_treatment_plans VALUES ('bad','w','new',26,'draft',NULL)"), /Rating band/);
    await client.query("INSERT INTO risk_treatment_plans(id,workspace_id,risk_id,expected_residual_score,status) VALUES ('plan','w','new',5,'draft')");
    assert.equal((await client.query("UPDATE risk_treatment_plans SET status='completed' WHERE id='plan' RETURNING *")).rows[0].expected_residual_rating,'Low');
    assert.equal((await client.query("SELECT residual_score FROM risks WHERE id='new'")).rows[0].residual_score,6);
    await assert.rejects(client.query("INSERT INTO risk_treatment_plans(id,workspace_id,risk_id,expected_residual_score) VALUES ('cross','other','new',4)"), /workspace/);
    assert.equal(Number((await client.query("SELECT count(*) FROM risk_methodology_events WHERE action='activated'")).rows[0].count),2);

    const four = { ...legacyMethodology,
      likelihoodLevels: legacyMethodology.likelihoodLevels.slice(0,4), impactLevels: legacyMethodology.impactLevels.slice(0,4),
      ratingBands: [{label:'Elevated',minScore:1,maxScore:16,colour:'#112233',severityOrder:1}],
      appetiteMaxScore:8,treatmentRequiredFromScore:9,escalationRequiredFromScore:12 };
    const draft = await methodologyRepo.saveDraft('w','tester',four);
    await methodologyRepo.activate('w',draft.id,'tester',true);
    assert.equal((await insert('four')).rows[0].inherent_rating,'Elevated');
    await assert.rejects(insert('outside-four',5), /Invalid likelihood/);
    await client.query("INSERT INTO risk_treatment_plans(id,workspace_id,risk_id,expected_residual_score) VALUES ('four-plan','w','four',16)");
    await assert.rejects(client.query("UPDATE risk_treatment_plans SET expected_residual_score=17 WHERE id='four-plan'"), /Rating band/);
    // Existing v1 risk still accepts its original fifth axis after 4x4 activation.
    await client.query("UPDATE risks SET residual_likelihood=5 WHERE id='new'");
    assert.equal((await client.query("SELECT methodology_id FROM risks WHERE id='new'")).rows[0].methodology_id,'v1');
    const drafts = await Promise.all([methodologyRepo.saveDraft('w','tester',four),methodologyRepo.saveDraft('w','tester',four)]);
    await Promise.all([...drafts.map(row=>methodologyRepo.activate('w',row.id,'tester',true)),insert('concurrent-create')]);
    assert.equal(Number((await client.query("SELECT count(*) FROM risk_methodologies WHERE workspace_id='w' AND status='Active'")).rows[0].count),1);
    const concurrent=(await client.query("SELECT r.inherent_score,r.inherent_rating,m.config FROM risks r JOIN risk_methodologies m ON m.id=r.methodology_id AND m.version=r.methodology_version WHERE r.id='concurrent-create'")).rows[0];
    assert.equal(concurrent.inherent_rating,scoreRisk(concurrent.config,4,4).rating);
    assert.equal(concurrent.inherent_score,16);
    for (const config of [legacyMethodology,four]) {
      for (const l of config.likelihoodLevels) for (const i of config.impactLevels) {
        const expected=scoreRisk(config,l.value,i.value);
        const actual=(await client.query('SELECT laflo_axis_score($1,$2,$3) AS score,laflo_risk_rating($1,$2*$3) AS rating',[config,l.value,i.value])).rows[0];
        assert.equal(actual.score,expected.score); assert.equal(actual.rating,expected.rating);
      }
    }
    await client.query("INSERT INTO risk_methodologies(id,workspace_id,version,config) VALUES ('invalid-policy','w',99,'{}')");
    await assert.rejects(methodologyRepo.activate('w','invalid-policy','tester',true));
    const required=await methodologyRepo.saveDraft('w','tester',{...four,targetRequired:true});
    await methodologyRepo.activate('w',required.id,'tester',true);
    await assert.rejects(insert('missing-target'),/Target likelihood and impact required/);
    await assert.rejects(client.query("UPDATE risks SET target_likelihood=2 WHERE id='four'"),/Invalid impact/);
    const beforeFailure=(await client.query("SELECT id FROM risk_methodologies WHERE workspace_id='w' AND status='Active'")).rows[0].id;
    const rollbackDraft=await methodologyRepo.saveDraft('w','tester',four);
    await client.query("ALTER TABLE risk_methodology_events ADD CONSTRAINT reject_test_actor CHECK(actor_id <> 'rejected-audit')");
    await assert.rejects(methodologyRepo.activate('w',rollbackDraft.id,'rejected-audit',true),/reject_test_actor/);
    assert.equal((await client.query("SELECT id FROM risk_methodologies WHERE workspace_id='w' AND status='Active'")).rows[0].id,beforeFailure);
    assert.equal((await methodologyRepo.get('w',rollbackDraft.id))?.status,'Draft');
    assert.equal((await client.query("SELECT inherent_score FROM risks WHERE id='legacy'")).rows[0].inherent_score,null);
  } finally {
    await applicationPool?.end();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
