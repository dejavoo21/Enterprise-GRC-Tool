import { query } from '../db.js';

const LINK_TABLES = {
  risks: 'risks',
  controls: 'controls',
  evidence: 'evidence',
  vendors: 'vendors',
  assets: 'assets',
  policies: 'governance_documents',
  aiSystems: 'ai_inventory',
  aiIncidents: 'ai_incidents',
  regulatoryChanges: 'regulatory_change_logs',
  findings: 'audit_findings',
  bcmProcesses: 'bcm_bia_processes',
  bcmRecoveryPlans: 'bcm_recovery_plans',
  bcmCriticalServices: 'bcm_critical_services',
} as const;

export type WorkspaceLinkType = keyof typeof LINK_TABLES;
export type WorkspaceLinks = Partial<Record<WorkspaceLinkType, unknown>>;

export class WorkspaceLinkValidationError extends Error {
  constructor() {
    super('One or more linked records are unavailable');
    this.name = 'WorkspaceLinkValidationError';
  }
}

export async function assertWorkspaceLinks(workspaceId: string, links: WorkspaceLinks): Promise<void> {
  for (const [type, rawIds] of Object.entries(links) as Array<[WorkspaceLinkType, unknown]>) {
    if (rawIds === undefined || rawIds === null) continue;
    if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
      throw new WorkspaceLinkValidationError();
    }

    const ids = Array.from(new Set(rawIds.map((id) => (id as string).trim())));
    if (ids.length === 0) continue;

    const result = await query<{ id: string }>(
      `SELECT id FROM ${LINK_TABLES[type]} WHERE workspace_id = $1 AND id = ANY($2::text[])`,
      [workspaceId, ids],
    );
    if (result.rows.length !== ids.length) {
      throw new WorkspaceLinkValidationError();
    }
  }
}
