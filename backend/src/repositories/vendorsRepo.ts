import { Vendor } from '../types/models';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface VendorFilter {
  riskLevel?: string;
  status?: string;
  workspaceId?: string;
}

export interface CreateVendorInput {
  name: string;
  category: string;
  owner: string;
  riskLevel: string;
  status: string;
  nextReviewDate?: string;
  hasDPA?: boolean;
  regions?: string[];
  dataTypesProcessed?: string[];
  workspaceId?: string;
}

// Map database row to Vendor object
function rowToVendor(row: any): Vendor {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    category: row.category,
    owner: row.owner,
    riskLevel: row.risk_level,
    status: row.status,
    nextReviewDate: row.next_review_date ? row.next_review_date.toISOString() : undefined,
    hasDPA: row.has_dpa,
    regions: row.regions || [],
    dataTypesProcessed: row.data_types_processed || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getVendors(workspaceId: string, filter?: VendorFilter): Promise<Vendor[]> {
  let queryText = 'SELECT * FROM vendors WHERE workspace_id = $1';
  const params: any[] = [workspaceId];
  let paramCount = 2;

  if (filter?.riskLevel) {
    queryText += ` AND risk_level = $${paramCount}`;
    params.push(filter.riskLevel);
    paramCount++;
  }

  if (filter?.status) {
    queryText += ` AND status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query<any>(queryText, params);
  return result.rows.map(rowToVendor);
}

export async function getVendorById(workspaceId: string, id: string): Promise<Vendor | null> {
  const result = await query<any>(
    'SELECT * FROM vendors WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToVendor(result.rows[0]);
}

export async function createVendor(workspaceId: string, input: CreateVendorInput): Promise<Vendor> {
  const id = uuidv4();

  const result = await query<any>(
    `INSERT INTO vendors (
      id, workspace_id, name, category, owner, risk_level, status, 
      next_review_date, has_dpa, regions, data_types_processed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.name,
      input.category,
      input.owner,
      input.riskLevel,
      input.status,
      input.nextReviewDate || null,
      input.hasDPA || false,
      input.regions || [],
      input.dataTypesProcessed || [],
    ]
  );

  return rowToVendor(result.rows[0]);
}

export async function updateVendor(workspaceId: string, id: string, input: Partial<CreateVendorInput>): Promise<Vendor | null> {
  const fields: string[] = [];
  const params: any[] = [id, workspaceId];
  let paramCount = 3;

  if (input.name !== undefined) {
    fields.push(`name = $${paramCount}`);
    params.push(input.name);
    paramCount++;
  }
  if (input.category !== undefined) {
    fields.push(`category = $${paramCount}`);
    params.push(input.category);
    paramCount++;
  }
  if (input.owner !== undefined) {
    fields.push(`owner = $${paramCount}`);
    params.push(input.owner);
    paramCount++;
  }
  if (input.riskLevel !== undefined) {
    fields.push(`risk_level = $${paramCount}`);
    params.push(input.riskLevel);
    paramCount++;
  }
  if (input.status !== undefined) {
    fields.push(`status = $${paramCount}`);
    params.push(input.status);
    paramCount++;
  }
  if (input.nextReviewDate !== undefined) {
    fields.push(`next_review_date = $${paramCount}`);
    params.push(input.nextReviewDate || null);
    paramCount++;
  }
  if (input.hasDPA !== undefined) {
    fields.push(`has_dpa = $${paramCount}`);
    params.push(input.hasDPA);
    paramCount++;
  }
  if (input.regions !== undefined) {
    fields.push(`regions = $${paramCount}`);
    params.push(input.regions);
    paramCount++;
  }
  if (input.dataTypesProcessed !== undefined) {
    fields.push(`data_types_processed = $${paramCount}`);
    params.push(input.dataTypesProcessed);
    paramCount++;
  }

  if (fields.length === 0) return getVendorById(workspaceId, id);

  fields.push(`updated_at = NOW()`);

  const result = await query<any>(
    `UPDATE vendors SET ${fields.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToVendor(result.rows[0]);
}

export async function deleteVendor(workspaceId: string, id: string): Promise<boolean> {
  const result = await query('DELETE FROM vendors WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
  return result.rowCount ? result.rowCount > 0 : false;
}
