import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import { createBiaProcess } from '../services/bcmService.js';
import { createAiModel } from '../services/aiGovernanceService.js';
import {
  createAssuranceException,
  createRemediationTask,
  getContinuousAssuranceState,
  updateControlMonitor,
} from '../services/continuousAssurance/continuousAssurance.js';

const actor = { actorName: 'Owner A', actorUserId: 'owner-a', actorRole: 'owner' };

test('BCM rejects an entire write when any linked record is foreign or missing', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  pool.query = (async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(
      createBiaProcess('workspace-a', {
        processName: 'Workspace A process',
        linkedRiskIds: ['risk-b'],
        linkedControlIds: ['control-a'],
      }, actor),
      /linked records are unavailable/,
    );
    assert.equal(calls.length, 1, 'validation stops at the first unavailable target set');
    assert.match(calls[0].text, /FROM risks WHERE workspace_id = \$1/);
    assert.deepEqual(calls[0].values, ['workspace-a', ['risk-b']]);
    assert.equal(calls.some((call) => call.text.includes('INSERT INTO bcm_bia_processes')), false);
  } finally {
    pool.query = original;
  }
});

test('Continuous Assurance rejects foreign external and internal links before mutation', async () => {
  const original = pool.query.bind(pool);
  const queries: string[] = [];
  pool.query = (async (text: string) => {
    queries.push(text);
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    const before = await getContinuousAssuranceState('workspace-a-secondary');
    assert.equal(before.settings.defaultTestFrequency, 'Weekly');
    assert.equal(queries.some((text) => /INSERT INTO ccm_settings/i.test(text)), false, 'state reads do not persist default settings');
    await assert.rejects(
      createAssuranceException('workspace-a-secondary', 'owner', {
        type: 'Foreign risk link',
        source: 'Manual review',
        owner: 'Owner A',
        remediationAction: 'Investigate the foreign link',
        linkedRiskId: 'risk-b',
      }),
      /linked records are unavailable/,
    );
    await assert.rejects(
      createRemediationTask('workspace-a-secondary', 'owner', {
        title: 'Foreign assurance target',
        description: 'Must not be created',
        owner: 'Owner A',
        dueDate: '2026-12-01',
        status: 'open',
        priority: 'high',
        linkedObjectLabel: 'Foreign test',
        linkedObjectType: 'test',
        linkedObjectId: 'test-from-workspace-b',
        sourceType: 'failed_test',
        sourceId: 'test-from-workspace-b',
      }),
      /unavailable in this workspace/,
    );
    const after = await getContinuousAssuranceState('workspace-a-secondary');
    assert.equal(after.exceptions.length, before.exceptions.length);
    assert.equal(after.remediationTasks.length, before.remediationTasks.length);
  } finally {
    pool.query = original;
  }
});

test('Continuous Assurance updates cannot overwrite record identity or workspace', async () => {
  const original = pool.query.bind(pool);
  let queries = 0;
  pool.query = (async () => {
    queries += 1;
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(
      updateControlMonitor('workspace-a-identity', 'owner', 'monitor-a', {
        id: 'foreign-monitor-id',
        workspaceId: 'workspace-b',
        name: 'Unauthorized identity rewrite',
      }),
      /identity and linked control cannot be changed/,
    );
    assert.equal(queries, 0, 'identity tampering is rejected before repository access');
  } finally {
    pool.query = original;
  }
});

test('secondary AI records reject a system from another workspace before mutation', async () => {
  const original = pool.query.bind(pool);
  const calls: string[] = [];
  pool.query = (async (text: string) => {
    calls.push(text);
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(
      createAiModel('workspace-a', { systemId: 'ai-system-b', modelName: 'Foreign model' }, actor),
      /linked records are unavailable/,
    );
    assert.equal(calls.some((text) => text.includes('INSERT INTO ai_models')), false);
    assert.match(calls[0], /FROM ai_inventory WHERE workspace_id = \$1/);
  } finally {
    pool.query = original;
  }
});
