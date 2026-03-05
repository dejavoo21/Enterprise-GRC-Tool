import { Asset } from '../types/models';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface AssetFilter {
  type?: string;
  criticality?: string;
  status?: string;
  workspaceId?: string;
}

export interface CreateAssetInput {
  name: string;
  description?: string;
  type: string;
  owner: string;
  businessUnit?: string;
  criticality: string;
  dataClassification?: string;
  status: string;
  linkedVendorId?: string | null;
  workspaceId?: string;
}

// Map database row to Asset object
function rowToAsset(row: any): Asset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    type: row.type,
    owner: row.owner,
    businessUnit: row.business_unit,
    criticality: row.criticality,
    dataClassification: row.data_classification,
    status: row.status,
    linkedVendorId: row.linked_vendor_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getAssets(workspaceId: string, filter?: AssetFilter): Promise<Asset[]> {
  let queryText = 'SELECT * FROM assets WHERE workspace_id = $1';
  const params: any[] = [workspaceId];
  let paramCount = 2;

  if (filter?.type) {
    queryText += ` AND type = $${paramCount}`;
    params.push(filter.type);
    paramCount++;
  }

  if (filter?.criticality) {
    queryText += ` AND criticality = $${paramCount}`;
    params.push(filter.criticality);
    paramCount++;
  }

  if (filter?.status) {
    queryText += ` AND status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query<any>(queryText, params);
  return result.rows.map(rowToAsset);
}

export async function getAssetById(workspaceId: string, id: string): Promise<Asset | null> {
  const result = await query<any>(
    'SELECT * FROM assets WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function createAsset(workspaceId: string, input: CreateAssetInput): Promise<Asset> {
  const id = uuidv4();

  const result = await query<any>(
    `INSERT INTO assets (
      id, workspace_id, name, description, type, owner, business_unit, 
      criticality, data_classification, status, linked_vendor_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.name,
      input.description || null,
      input.type,
      input.owner,
      input.businessUnit || null,
      input.criticality,
      input.dataClassification || null,
      input.status,
      input.linkedVendorId || null,
    ]
  );

  return rowToAsset(result.rows[0]);
}

export async function updateAsset(workspaceId: string, id: string, input: Partial<CreateAssetInput>): Promise<Asset | null> {
  const fields: string[] = [];
  const params: any[] = [id, workspaceId];
  let paramCount = 3;

  if (input.name !== undefined) {
    fields.push(`name = $${paramCount}`);
    params.push(input.name);
    paramCount++;
  }
  if (input.description !== undefined) {
    fields.push(`description = $${paramCount}`);
    params.push(input.description || null);
    paramCount++;
  }
  if (input.type !== undefined) {
    fields.push(`type = $${paramCount}`);
    params.push(input.type);
    paramCount++;
  }
  if (input.owner !== undefined) {
    fields.push(`owner = $${paramCount}`);
    params.push(input.owner);
    paramCount++;
  }
  if (input.businessUnit !== undefined) {
    fields.push(`business_unit = $${paramCount}`);
    params.push(input.businessUnit || null);
    paramCount++;
  }
  if (input.criticality !== undefined) {
    fields.push(`criticality = $${paramCount}`);
    params.push(input.criticality);
    paramCount++;
  }
  if (input.dataClassification !== undefined) {
    fields.push(`data_classification = $${paramCount}`);
    params.push(input.dataClassification || null);
    paramCount++;
  }
  if (input.status !== undefined) {
    fields.push(`status = $${paramCount}`);
    params.push(input.status);
    paramCount++;
  }
  if (input.linkedVendorId !== undefined) {
    fields.push(`linked_vendor_id = $${paramCount}`);
    params.push(input.linkedVendorId || null);
    paramCount++;
  }

  if (fields.length === 0) return getAssetById(workspaceId, id);

  fields.push(`updated_at = NOW()`);

  const result = await query<any>(
    `UPDATE assets SET ${fields.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function deleteAsset(workspaceId: string, id: string): Promise<boolean> {
  const result = await query('DELETE FROM assets WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
  return result.rowCount ? result.rowCount > 0 : false;
}
