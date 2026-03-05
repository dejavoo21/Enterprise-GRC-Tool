import { KpiDefinition, CreateKpiDefinitionInput, KpiSnapshot, CreateKpiSnapshotInput } from '../types/models';
import { query } from '../db';

// ============================================
// KPI Definitions
// ============================================

function rowToKpiDefinition(row: any): KpiDefinition {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    category: row.category,
    targetDirection: row.target_direction,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getKpiDefinitions(): Promise<KpiDefinition[]> {
  try {
    const result = await query<any>(
      'SELECT * FROM kpi_definitions ORDER BY category, name'
    );
    return result.rows.map(rowToKpiDefinition);
  } catch (error) {
    console.error('Error fetching KPI definitions:', error);
    throw error;
  }
}

export async function getKpiDefinitionById(id: string): Promise<KpiDefinition | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM kpi_definitions WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? rowToKpiDefinition(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching KPI definition by ID:', error);
    throw error;
  }
}

export async function getKpiDefinitionByCode(code: string): Promise<KpiDefinition | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM kpi_definitions WHERE code = $1',
      [code]
    );
    return result.rows.length > 0 ? rowToKpiDefinition(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching KPI definition by code:', error);
    throw error;
  }
}

export async function createKpiDefinition(input: CreateKpiDefinitionInput): Promise<KpiDefinition> {
  try {
    const id = `KPI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO kpi_definitions (
        id, code, name, description, category, target_direction
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.description || null,
        input.category,
        input.targetDirection,
      ]
    );

    return rowToKpiDefinition(result.rows[0]);
  } catch (error) {
    console.error('Error creating KPI definition:', error);
    throw error;
  }
}

export async function updateKpiDefinition(
  id: string,
  input: Partial<CreateKpiDefinitionInput>
): Promise<KpiDefinition | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (input.code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      params.push(input.code);
      paramIndex++;
    }
    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(input.category);
      paramIndex++;
    }
    if (input.targetDirection !== undefined) {
      updates.push(`target_direction = $${paramIndex}`);
      params.push(input.targetDirection);
      paramIndex++;
    }

    if (updates.length === 0) return getKpiDefinitionById(id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE kpi_definitions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToKpiDefinition(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating KPI definition:', error);
    throw error;
  }
}

// ============================================
// KPI Snapshots
// ============================================

function rowToKpiSnapshot(row: any): KpiSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id || undefined,
    kpiId: row.kpi_id,
    periodStart: new Date(row.period_start).toISOString().split('T')[0],
    periodEnd: new Date(row.period_end).toISOString().split('T')[0],
    value: parseFloat(row.value),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export interface KpiSnapshotFilter {
  engagementId?: string;
  kpiId?: string;
  kpiCode?: string;
  periodStart?: string;
  periodEnd?: string;
}

export async function getKpiSnapshots(
  workspaceId: string,
  filters?: KpiSnapshotFilter
): Promise<KpiSnapshot[]> {
  try {
    let whereClause = 'ks.workspace_id = $1';
    const params: any[] = [workspaceId];
    let joinClause = '';

    if (filters?.engagementId) {
      whereClause += ' AND ks.engagement_id = $' + (params.length + 1);
      params.push(filters.engagementId);
    }
    if (filters?.kpiId) {
      whereClause += ' AND ks.kpi_id = $' + (params.length + 1);
      params.push(filters.kpiId);
    }
    if (filters?.kpiCode) {
      joinClause = ' INNER JOIN kpi_definitions kd ON ks.kpi_id = kd.id';
      whereClause += ' AND kd.code = $' + (params.length + 1);
      params.push(filters.kpiCode);
    }
    if (filters?.periodStart) {
      whereClause += ' AND ks.period_start >= $' + (params.length + 1);
      params.push(filters.periodStart);
    }
    if (filters?.periodEnd) {
      whereClause += ' AND ks.period_end <= $' + (params.length + 1);
      params.push(filters.periodEnd);
    }

    const result = await query<any>(
      `SELECT ks.* FROM kpi_snapshots ks${joinClause} WHERE ${whereClause} ORDER BY ks.period_start DESC`,
      params
    );

    return result.rows.map(rowToKpiSnapshot);
  } catch (error) {
    console.error('Error fetching KPI snapshots:', error);
    throw error;
  }
}

export async function getKpiSnapshotById(
  workspaceId: string,
  id: string
): Promise<KpiSnapshot | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM kpi_snapshots WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToKpiSnapshot(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching KPI snapshot by ID:', error);
    throw error;
  }
}

export async function createKpiSnapshot(
  workspaceId: string,
  input: CreateKpiSnapshotInput
): Promise<KpiSnapshot> {
  try {
    const id = `KPIS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO kpi_snapshots (
        id, workspace_id, engagement_id, kpi_id, period_start, period_end, value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.engagementId || null,
        input.kpiId,
        input.periodStart,
        input.periodEnd,
        input.value,
      ]
    );

    return rowToKpiSnapshot(result.rows[0]);
  } catch (error) {
    console.error('Error creating KPI snapshot:', error);
    throw error;
  }
}

export async function deleteKpiSnapshot(
  workspaceId: string,
  id: string
): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM kpi_snapshots WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting KPI snapshot:', error);
    throw error;
  }
}

// ============================================
// KPI Summary for Engagement
// ============================================

export interface KpiSummary {
  kpiId: string;
  kpiCode: string;
  kpiName: string;
  category: string;
  targetDirection: 'up' | 'down';
  latestValue: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  isImproving?: boolean;
}

export async function getKpiSummaryForEngagement(
  workspaceId: string,
  engagementId: string
): Promise<KpiSummary[]> {
  try {
    // Get latest 2 snapshots for each KPI for the engagement
    const result = await query<any>(
      `WITH ranked_snapshots AS (
        SELECT
          ks.*,
          kd.code as kpi_code,
          kd.name as kpi_name,
          kd.category,
          kd.target_direction,
          ROW_NUMBER() OVER (PARTITION BY ks.kpi_id ORDER BY ks.period_end DESC) as rn
        FROM kpi_snapshots ks
        JOIN kpi_definitions kd ON ks.kpi_id = kd.id
        WHERE ks.workspace_id = $1 AND ks.engagement_id = $2
      )
      SELECT * FROM ranked_snapshots WHERE rn <= 2 ORDER BY kpi_id, rn`,
      [workspaceId, engagementId]
    );

    // Group by KPI and calculate summaries
    const kpiMap = new Map<string, KpiSummary>();

    for (const row of result.rows) {
      const kpiId = row.kpi_id;
      if (!kpiMap.has(kpiId)) {
        kpiMap.set(kpiId, {
          kpiId,
          kpiCode: row.kpi_code,
          kpiName: row.kpi_name,
          category: row.category,
          targetDirection: row.target_direction,
          latestValue: parseFloat(row.value),
        });
      } else {
        const summary = kpiMap.get(kpiId)!;
        summary.previousValue = parseFloat(row.value);
        summary.change = summary.latestValue - summary.previousValue;
        summary.changePercent = summary.previousValue !== 0
          ? (summary.change / summary.previousValue) * 100
          : undefined;
        summary.isImproving = summary.targetDirection === 'up'
          ? summary.change > 0
          : summary.change < 0;
      }
    }

    return Array.from(kpiMap.values());
  } catch (error) {
    console.error('Error fetching KPI summary for engagement:', error);
    throw error;
  }
}
