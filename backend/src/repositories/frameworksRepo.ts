import { Framework } from '../types/models';
import { query } from '../db';

export interface FrameworkFilter {
  isDefault?: boolean;
  isAiHealthcare?: boolean;
  isPrivacy?: boolean;
  category?: string;
}

function getFrameworkStatus(score: number): Framework['status'] {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Moderate';
  return 'Needs Attention';
}

// Map database row to Framework object
function rowToFramework(row: any): Framework {
  const applicableControls = Number(row.applicable_controls || 0);
  const implementedControls = Number(row.implemented_controls || 0);
  const complianceScore =
    typeof row.compliance_score === 'number'
      ? row.compliance_score
      : applicableControls > 0
        ? Math.round((implementedControls / applicableControls) * 100)
        : 0;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    isAiHealthcare: row.is_ai_healthcare,
    isPrivacy: row.is_privacy,
    isDefault: row.is_default,
    colorHex: row.color_hex,
    applicableControls,
    implementedControls,
    complianceScore,
    status: getFrameworkStatus(complianceScore),
    linkedRisks: Number(row.linked_risks || 0),
    linkedControls: Number(row.linked_controls || applicableControls || 0),
    linkedEvidence: Number(row.linked_evidence || 0),
    linkedAudits: Number(row.linked_audits || 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getFrameworks(filters?: FrameworkFilter, workspaceId?: string | null): Promise<Framework[]> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.isDefault !== undefined) {
      conditions.push(`is_default = $${params.length + 1}`);
      params.push(filters.isDefault);
    }
    if (filters?.isAiHealthcare !== undefined) {
      conditions.push(`is_ai_healthcare = $${params.length + 1}`);
      params.push(filters.isAiHealthcare);
    }
    if (filters?.isPrivacy !== undefined) {
      conditions.push(`is_privacy = $${params.length + 1}`);
      params.push(filters.isPrivacy);
    }
    if (filters?.category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(filters.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const workspaceParamIndex = params.length + 1;

    const result = await query<any>(
      `SELECT
        f.*,
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN cm.control_id END) AS applicable_controls,
        COUNT(DISTINCT CASE WHEN c.status = 'implemented' THEN cm.control_id END) AS implemented_controls,
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN c.id END) AS linked_controls,
        COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN r.id END) AS linked_risks,
        COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN e.id END) AS linked_evidence,
        COUNT(DISTINCT CASE WHEN ra.id IS NOT NULL THEN ra.id END) AS linked_audits,
        CASE
          WHEN COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN cm.control_id END) = 0 THEN 0
          ELSE ROUND(
            (
              COUNT(DISTINCT CASE WHEN c.status = 'implemented' THEN cm.control_id END)::numeric
              / COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN cm.control_id END)::numeric
            ) * 100
          )
        END AS compliance_score
      FROM frameworks f
      LEFT JOIN control_mappings cm
        ON cm.framework = f.code
      LEFT JOIN controls c
        ON c.id = cm.control_id
       AND ($${workspaceParamIndex}::text IS NULL OR c.workspace_id = $${workspaceParamIndex})
      LEFT JOIN risk_control_links rcl
        ON rcl.control_id = c.id
      LEFT JOIN risks r
        ON r.id = rcl.risk_id
       AND ($${workspaceParamIndex}::text IS NULL OR r.workspace_id = $${workspaceParamIndex})
      LEFT JOIN evidence e
        ON ($${workspaceParamIndex}::text IS NULL OR e.workspace_id = $${workspaceParamIndex})
       AND (e.control_id = c.id OR e.risk_id = r.id)
      LEFT JOIN readiness_areas ra
        ON ($${workspaceParamIndex}::text IS NULL OR ra.workspace_id = $${workspaceParamIndex})
       AND (ra.framework = f.code OR ra.framework = f.name)
      ${whereClause}
      GROUP BY f.id
      ORDER BY f.name ASC`,
      [...params, workspaceId ?? null]
    );

    return result.rows.map(rowToFramework);
  } catch (error) {
    console.error('Error fetching frameworks:', error);
    throw error;
  }
}

export async function getFrameworkByCode(code: string): Promise<Framework | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM frameworks WHERE code = $1',
      [code]
    );
    return result.rows.length > 0 ? rowToFramework(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching framework by code:', error);
    throw error;
  }
}

export async function getFrameworkById(id: string): Promise<Framework | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM frameworks WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? rowToFramework(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching framework by ID:', error);
    throw error;
  }
}
