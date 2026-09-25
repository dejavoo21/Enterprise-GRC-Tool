import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
test('default KRIs remain unique on repeated and concurrent reads without replacing existing definitions', {skip: !url}, async () => {
  const address = new URL(url!);
  assert.match(address.hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
  assert.match(address.pathname, /test/i);
  const schema = `kri_seed_test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({connectionString:url});
  let pool: pg.Pool | undefined;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE risk_kri_definitions (
      id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, category TEXT, owner TEXT,
      measurement_unit TEXT, frequency TEXT, target_value NUMERIC, green_threshold NUMERIC,
      amber_threshold NUMERIC, red_threshold NUMERIC, source_module TEXT, auto_calculated BOOLEAN, status TEXT
    )`);
    address.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = address.toString();
    pool = (await import('../db.js')).pool;
    const {seedDefaultKris, createEmergingRisk, listEmergingRisks, getAuditSignal} = await import('../repositories/riskIntelligenceRepo.js');
    await client.query('CREATE TABLE readiness_areas (workspace_id TEXT, status TEXT, score INTEGER)');
    await client.query("INSERT INTO readiness_areas VALUES ('w','ready',100),('w','watch',40),('other','watch',10),('other','watch',20)");
    assert.deepEqual(await getAuditSignal('w'), {openItems:1, averageReadiness:70});
    assert.deepEqual(await getAuditSignal('other'), {openItems:2, averageReadiness:15});
    assert.deepEqual(await getAuditSignal('missing'), {openItems:0, averageReadiness:0});
    await client.query("INSERT INTO risk_kri_definitions(id,workspace_id,name,target_value) VALUES('existing','w','Expired Evidence',7)");
    await Promise.all(Array.from({length:4},()=>seedDefaultKris('w')));
    const before = (await client.query('SELECT * FROM risk_kri_definitions ORDER BY id')).rows;
    assert.ok(before.length > 1);
    assert.equal(new Set(before.map(row=>row.name)).size,before.length);
    assert.equal(before.find(row=>row.id==='existing')?.target_value,'7');
    await seedDefaultKris('w');
    assert.deepEqual((await client.query('SELECT * FROM risk_kri_definitions ORDER BY id')).rows,before);
    await seedDefaultKris('other');
    assert.equal((await client.query("SELECT count(*)::int AS count FROM risk_kri_definitions WHERE workspace_id='other'")).rows[0].count,before.length);
    await client.query(`CREATE TABLE emerging_risks (
      id TEXT PRIMARY KEY, workspace_id TEXT, title TEXT, category TEXT, description TEXT,
      likelihood INTEGER, impact INTEGER, monitoring_status TEXT, trigger_events TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const emerging = await createEmergingRisk('w', {
      title:'Disposable test', category:'Operational', description:'Array persistence regression',
      likelihood:2, impact:2, triggerEvents:['Synthetic signal', 'Second signal'],
    });
    assert.deepEqual(emerging.triggerEvents, ['Synthetic signal', 'Second signal']);
    const empty = await createEmergingRisk('w', {title:'Empty triggers', likelihood:1, impact:1});
    assert.deepEqual(empty.triggerEvents, []);
    assert.equal((await listEmergingRisks('w')).length, 2);
    assert.deepEqual(await listEmergingRisks('other'), []);
  } finally {
    await pool?.end();
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
