import { Vendor } from '../types/models';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { assertSupplierCanOffboard, assertSupplierTransition, type SupplierStatus } from '../services/supplierContractRules.js';

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
  businessService?: string;
  criticality?: string;
  informationAccess?: string;
  businessLocations?: string[];
  onboardingStatus?: string;
  dueDiligenceStatus?: string;
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
    supplierRef: row.supplier_ref,
    businessService: row.business_service,
    criticality: row.criticality,
    informationAccess: row.information_access,
    businessLocations: row.business_locations || [],
    onboardingStatus: row.onboarding_status,
    dueDiligenceStatus: row.due_diligence_status,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at?.toISOString(),
    suspendedAt: row.suspended_at?.toISOString(),
    offboardedAt: row.offboarded_at?.toISOString(),
    archivedAt: row.archived_at?.toISOString(),
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
      next_review_date, has_dpa, regions, data_types_processed, supplier_ref,
      business_service, criticality, information_access, business_locations,
      onboarding_status, due_diligence_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      `SUP-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      input.businessService || null,
      input.criticality || 'medium',
      input.informationAccess || 'none',
      input.businessLocations || [],
      input.onboardingStatus || 'not_started',
      input.dueDiligenceStatus || 'not_started',
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
  const extended: Array<[keyof CreateVendorInput, string]> = [
    ['businessService', 'business_service'], ['criticality', 'criticality'],
    ['informationAccess', 'information_access'], ['businessLocations', 'business_locations'],
    ['onboardingStatus', 'onboarding_status'], ['dueDiligenceStatus', 'due_diligence_status'],
  ];
  for (const [key, column] of extended) {
    if (input[key] !== undefined) { fields.push(`${column} = $${paramCount}`); params.push(input[key]); paramCount++; }
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

export async function transitionVendor(workspaceId: string, id: string, nextStatus: SupplierStatus, actorId: string, reason?: string): Promise<Vendor | null> {
  const current = await getVendorById(workspaceId, id);
  if (!current) return null;
  assertSupplierTransition(current.status as SupplierStatus, nextStatus);
  if (nextStatus === 'offboarded') {
    const blockers = await query<{ active_contracts: string; open_actions: string }>(
      `SELECT
        (SELECT COUNT(*) FROM vendor_contracts WHERE workspace_id=$1 AND vendor_id=$2 AND status IN ('approved','active','renewal_due','under_review'))::text active_contracts,
        (SELECT COUNT(*) FROM risk_actions WHERE workspace_id=$1 AND source_type='Vendor' AND source_reference=$2 AND status NOT IN ('Completed','Cancelled','Deferred'))::text open_actions`,
      [workspaceId, id],
    );
    assertSupplierCanOffboard(Number(blockers.rows[0]?.active_contracts || 0), Number(blockers.rows[0]?.open_actions || 0));
  }
  const idHistory = uuidv4();
  const result = await query<any>(
    `WITH changed AS (
       UPDATE vendors SET status=$3,
         approval_status=CASE WHEN $3='active' THEN 'approved' ELSE approval_status END,
         approved_by=CASE WHEN $3='active' THEN $4::uuid ELSE approved_by END,
         approved_at=CASE WHEN $3='active' THEN NOW() ELSE approved_at END,
         suspended_at=CASE WHEN $3='suspended' THEN NOW() ELSE suspended_at END,
         offboarded_at=CASE WHEN $3='offboarded' THEN NOW() ELSE offboarded_at END,
         archived_at=CASE WHEN $3='archived' THEN NOW() ELSE archived_at END,
         updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *
     ), history AS (
       INSERT INTO supplier_lifecycle_history(id,workspace_id,supplier_id,previous_status,new_status,reason,changed_by)
       SELECT $5,workspace_id,id,$6,$3,$7,$4::uuid FROM changed
     ) SELECT * FROM changed`,
    [workspaceId, id, nextStatus, actorId, idHistory, current.status, reason || null],
  );
  return result.rows[0] ? rowToVendor(result.rows[0]) : null;
}

export async function getVendorHistory(workspaceId: string, id: string) {
  return (await query(`SELECT id,previous_status "previousStatus",new_status "newStatus",reason,changed_by "changedBy",changed_at "changedAt" FROM supplier_lifecycle_history WHERE workspace_id=$1 AND supplier_id=$2 ORDER BY changed_at DESC`, [workspaceId, id])).rows;
}
