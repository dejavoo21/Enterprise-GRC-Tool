import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RiskReportPack } from '../types/riskIntelligence.js';

test('isolated report archive and treatment evidence lifecycle', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname) && target.pathname.endsWith('_test'), 'Requires a disposable local test database');
  process.env.DATABASE_URL = target.toString();
  const { pool } = await import('../db.js');
  const { archiveReport, getReport, listReports, transitionReport } = await import('../repositories/riskReportArchiveRepo.js');
  const { changeTreatmentEvidence, listTreatmentEvidence } = await import('../repositories/treatmentEvidenceRepo.js');
  try {
    // A dedicated database is required. Refuse to reuse existing application tables.
    await pool.query(`CREATE TABLE workspaces(id TEXT PRIMARY KEY);
      CREATE TABLE risk_treatment_plans(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL);
      CREATE TABLE evidence(id UUID PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT,type TEXT,collected_at TIMESTAMPTZ,last_reviewed_at TIMESTAMPTZ);`);
    const migration = await readFile(path.resolve(__dirname, '../../sql/migrations/20260926-risk-report-evidence-workflows.sql'), 'utf8');
    await pool.query(migration);
    await pool.query(migration); // Migration is safe to run twice.
    await pool.query(`INSERT INTO workspaces VALUES('one'),('two');
      INSERT INTO risk_treatment_plans VALUES('plan-one','one'),('plan-two','two');
      INSERT INTO evidence VALUES('00000000-0000-4000-8000-000000000001','one','Test artifact','document',NOW(),NULL),('00000000-0000-4000-8000-000000000002','two','Other artifact','document',NOW(),NULL);`);
    const pack: RiskReportPack = { title: 'Test report', reportType: 'risk_committee_report', generatedAt: new Date().toISOString(), format: 'json', sections: [{heading:'Original',bullets:['Pinned data']}] };
    const id = await archiveReport('one','author','author@example.invalid',pack);
    assert.equal((await listReports('one',1)).total,1);
    assert.equal((await listReports('two',1)).total,0);
    await assert.rejects(getReport('two',id), /not found/);
    await assert.rejects(transitionReport('two',id,'author','a@example.invalid','submit',1,'Ready'), /not found/);
    await assert.rejects(pool.query(`UPDATE risk_report_snapshots SET pack='{}' WHERE id=$1`,[id]), /immutable/);
    await transitionReport('one',id,'author','author@example.invalid','submit',1,'Ready for review');
    await assert.rejects(transitionReport('one',id,'reviewer','reviewer@example.invalid','review',1,'Stale revision'), /changed/);
    await assert.rejects(transitionReport('one',id,'author','author@example.invalid','review',2,'Self review'), /preparer/);
    await transitionReport('one',id,'reviewer','reviewer@example.invalid','review',2,'Sources reviewed');
    await assert.rejects(transitionReport('one',id,'reviewer','reviewer@example.invalid','approve',3,'Self approval'), /different user/);
    const approved=await transitionReport('one',id,'approver','approver@example.invalid','approve',3,'Approved after review');
    assert.equal(approved.status,'approved');
    assert.equal(approved.events.length,4);
    assert.deepEqual(approved.pack,pack);
    const evidence='00000000-0000-4000-8000-000000000001';
    assert.equal((await changeTreatmentEvidence('one','plan-one',evidence,'author',true)).length,1);
    assert.equal((await changeTreatmentEvidence('one','plan-one',evidence,'author',true)).length,1);
    await assert.rejects(changeTreatmentEvidence('two','plan-one',evidence,'author',true), /not found/);
    await assert.rejects(changeTreatmentEvidence('one','plan-one','00000000-0000-4000-8000-000000000002','author',true), /not found/);
    assert.equal((await listTreatmentEvidence('two','plan-two')).length,0);
    assert.equal((await changeTreatmentEvidence('one','plan-one',evidence,'author',false)).length,0);
    assert.equal((await pool.query('SELECT * FROM risk_treatment_evidence_events')).rowCount,2);
    assert.equal((await pool.query('SELECT * FROM evidence')).rowCount,2);
  } finally { await pool.end(); }
});
