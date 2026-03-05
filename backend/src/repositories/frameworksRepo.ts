import { Framework } from '../types/models';
import { query } from '../db';

export interface FrameworkFilter {
  isDefault?: boolean;
  isAiHealthcare?: boolean;
  isPrivacy?: boolean;
  category?: string;
}

// Map database row to Framework object
function rowToFramework(row: any): Framework {
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
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getFrameworks(filters?: FrameworkFilter): Promise<Framework[]> {
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

    const result = await query<any>(
      `SELECT * FROM frameworks ${whereClause} ORDER BY name ASC`,
      params
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
