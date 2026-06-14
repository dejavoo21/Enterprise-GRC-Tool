import { query } from '../db.js';

interface SeedWorkspace {
  id: string;
  name: string;
  displayName: string | null;
}

export async function resolveSeedWorkspace(): Promise<SeedWorkspace> {
  const explicitWorkspaceId = process.env.SEED_WORKSPACE_ID?.trim();

  if (explicitWorkspaceId) {
    const explicitResult = await query<SeedWorkspace>(
      `SELECT id, name, display_name AS "displayName"
       FROM workspaces
       WHERE id = $1
       LIMIT 1`,
      [explicitWorkspaceId],
    );

    if (explicitResult.rows.length === 0) {
      throw new Error(`SEED_WORKSPACE_ID "${explicitWorkspaceId}" was not found.`);
    }

    return explicitResult.rows[0];
  }

  const result = await query<SeedWorkspace>(
    `SELECT id, name, display_name AS "displayName"
     FROM workspaces
     WHERE COALESCE(status, 'active') <> 'archived'
     ORDER BY created_at ASC
     LIMIT 1`,
  );

  if (result.rows.length === 0) {
    throw new Error('No active workspace found. Complete organization setup before running seed scripts.');
  }

  return result.rows[0];
}
