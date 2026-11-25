import type { PoolClient } from 'pg';
import { query, generateId } from '../db.js';
import type { TreatmentControlInput } from '../types/treatmentControl.js';

export class InvalidTreatmentControl extends Error {}
export async function replaceTreatmentControls(client: PoolClient, workspaceId: string, treatmentId: string, links: TreatmentControlInput[], actor?: string) {
  const ids = links.map(link => link.controlId);
  const available = await client.query('SELECT id FROM controls WHERE workspace_id = $1 AND id = ANY($2::text[]) FOR KEY SHARE', [workspaceId, ids]);
  if (available.rows.length !== ids.length) throw new InvalidTreatmentControl('One or more controls do not exist in this workspace');
  await client.query('DELETE FROM risk_treatment_plan_controls WHERE workspace_id = $1 AND treatment_plan_id = $2 AND NOT (control_id = ANY($3::text[]))', [workspaceId, treatmentId, ids]);
  for (const link of links) await client.query(`INSERT INTO risk_treatment_plan_controls(id,workspace_id,treatment_plan_id,control_id,role,implementation_note,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(treatment_plan_id,control_id) DO UPDATE SET role=EXCLUDED.role, implementation_note=EXCLUDED.implementation_note, updated_at=NOW()`,
    [generateId('rtpc'), workspaceId, treatmentId, link.controlId, link.role, link.implementationNote || '', actor || null]);
}

export const CONTROL_LINKS_SELECT = `COALESCE((SELECT json_agg(json_build_object('controlId',c.id,'title',c.title,'domain',c.domain,'primaryFramework',c.primary_framework,'role',l.role,'implementationNote',l.implementation_note) ORDER BY l.created_at,c.id)
  FROM risk_treatment_plan_controls l JOIN controls c ON c.id=l.control_id AND c.workspace_id=l.workspace_id
  WHERE l.treatment_plan_id=p.id AND l.workspace_id=p.workspace_id), '[]'::json) AS linked_controls`;
