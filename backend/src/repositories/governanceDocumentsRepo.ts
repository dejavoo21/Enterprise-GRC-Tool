import { GovernanceDocument, CreateGovernanceDocumentInput, CreateGovernancePolicyRuleInput, GovernancePolicyRule } from '../types/models';
import { generateId, query } from '../db';
import { assertPolicyCanBeAcknowledged } from '../services/policyWorkflowRules';

export interface GovernanceDocumentFilter {
  docType?: string;
  status?: string;
  dueForReviewOnly?: boolean;
  frameworkCode?: string;
}

function rowToPolicyRule(row: any): GovernancePolicyRule {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    name: row.name,
    description: row.description || undefined,
    scopeSummary: row.scope_summary,
    matchCriteria: row.match_criteria || [],
    excludeCriteria: row.exclude_criteria || [],
    severity: row.severity,
    responseMode: row.response_mode,
    plainLanguageSummary: row.plain_language_summary,
    status: row.status,
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getPolicyRules(workspaceId: string, documentId: string): Promise<GovernancePolicyRule[]> {
  const result = await query<any>(
    `SELECT r.* FROM governance_policy_rules r
     INNER JOIN governance_documents d ON d.id=r.document_id AND d.workspace_id=r.workspace_id
     WHERE r.workspace_id=$1 AND r.document_id=$2
     ORDER BY r.status ASC, r.updated_at DESC`,
    [workspaceId, documentId],
  );
  return result.rows.map(rowToPolicyRule);
}

export async function createPolicyRule(
  workspaceId: string,
  documentId: string,
  userId: string,
  input: CreateGovernancePolicyRuleInput,
): Promise<GovernancePolicyRule | null> {
  const id = generateId('prule');
  const eventId = generateId('prule_evt');
  const result = await query<any>(
    `WITH policy AS (
       SELECT id FROM governance_documents
       WHERE id=$1 AND workspace_id=$2 AND doc_type='policy' AND status IN ('draft','rejected')
     ), inserted AS (
       INSERT INTO governance_policy_rules
         (id,workspace_id,document_id,name,description,scope_summary,match_criteria,exclude_criteria,severity,response_mode,plain_language_summary,created_by)
       SELECT $3,$2,policy.id,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12 FROM policy
       RETURNING *
     ), event AS (
       INSERT INTO governance_policy_rule_events(id,workspace_id,rule_id,event_type,actor_user_id,snapshot)
       SELECT $13,$2,id,'created',$12,to_jsonb(inserted) FROM inserted
     ) SELECT * FROM inserted`,
    [documentId, workspaceId, id, input.name, input.description || null, input.scopeSummary,
      JSON.stringify(input.matchCriteria), JSON.stringify(input.excludeCriteria), input.severity,
      input.responseMode, input.plainLanguageSummary, userId, eventId],
  );
  return result.rows[0] ? rowToPolicyRule(result.rows[0]) : null;
}

export async function archivePolicyRule(workspaceId: string, documentId: string, ruleId: string, userId: string): Promise<GovernancePolicyRule | null> {
  const eventId = generateId('prule_evt');
  const result = await query<any>(
    `WITH updated AS (
       UPDATE governance_policy_rules r SET status='archived',updated_at=NOW()
       FROM governance_documents d
       WHERE r.id=$1 AND r.document_id=$2 AND r.workspace_id=$3
         AND d.id=r.document_id AND d.workspace_id=r.workspace_id AND d.doc_type='policy' AND d.status IN ('draft','rejected')
       RETURNING r.*
     ), event AS (
       INSERT INTO governance_policy_rule_events(id,workspace_id,rule_id,event_type,actor_user_id,snapshot)
       SELECT $4,$3,id,'archived',$5,to_jsonb(updated) FROM updated
     ) SELECT * FROM updated`,
    [ruleId, documentId, workspaceId, eventId, userId],
  );
  return result.rows[0] ? rowToPolicyRule(result.rows[0]) : null;
}

// Map database row to GovernanceDocument object
function rowToGovernanceDocument(row: any): GovernanceDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description || undefined,
    docType: row.doc_type,
    owner: row.owner,
    status: row.status,
    classification: row.classification || undefined,
    currentVersion: row.current_version || undefined,
    locationUrl: row.location_url || undefined,
    reviewFrequencyMonths: row.review_frequency_months || undefined,
    nextReviewDate: row.next_review_date ? new Date(row.next_review_date).toISOString().split('T')[0] : undefined,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : undefined,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
    effectiveDate: row.effective_date ? new Date(row.effective_date).toISOString().split('T')[0] : undefined,
    expiryDate: row.expiry_date ? new Date(row.expiry_date).toISOString().split('T')[0] : undefined,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : undefined,
    supersededById: row.superseded_by_id || undefined,
    attestationRequired: Boolean(row.attestation_required),
    fileName: row.file_name || undefined,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : undefined,
    mimeType: row.mime_type || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getGovernanceDocuments(
  workspaceId: string,
  filters?: GovernanceDocumentFilter
): Promise<GovernanceDocument[]> {
  try {
    let whereClause = 'gd.workspace_id = $1';
    const params: any[] = [workspaceId];
    let joinClause = '';

    if (filters?.docType) {
      whereClause += ' AND gd.doc_type = $' + (params.length + 1);
      params.push(filters.docType);
    }
    if (filters?.status) {
      whereClause += ' AND gd.status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.dueForReviewOnly) {
      // Documents due for review: next_review_date is in the past or within 30 days
      whereClause += ' AND gd.next_review_date IS NOT NULL AND gd.next_review_date <= CURRENT_DATE + INTERVAL \'30 days\'';
    }
    if (filters?.frameworkCode) {
      joinClause = ' INNER JOIN governance_document_frameworks gdf ON gd.id = gdf.document_id';
      whereClause += ' AND gdf.framework_code = $' + (params.length + 1);
      params.push(filters.frameworkCode);
    }

    const result = await query<any>(
      `SELECT DISTINCT gd.* FROM governance_documents gd${joinClause} WHERE ${whereClause} ORDER BY gd.created_at DESC`,
      params
    );

    return result.rows.map(rowToGovernanceDocument);
  } catch (error) {
    console.error('Error fetching governance documents:', error);
    throw error;
  }
}

export async function getGovernanceDocumentById(
  workspaceId: string,
  id: string
): Promise<GovernanceDocument | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM governance_documents WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToGovernanceDocument(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching governance document by ID:', error);
    throw error;
  }
}

export async function createGovernanceDocument(
  workspaceId: string,
  input: CreateGovernanceDocumentInput
): Promise<GovernanceDocument> {
  try {
    const id = `GOV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO governance_documents (
        id, workspace_id, title, description, doc_type, owner, status, classification,
        current_version, location_url, review_frequency_months, next_review_date,
        published_at, effective_date, expiry_date, archived_at, superseded_by_id,
        attestation_required, file_name, file_size_bytes, mime_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21
      )
      RETURNING *`,
      [
        id,
        workspaceId,
        input.title,
        input.description || null,
        input.docType,
        input.owner,
        input.status || 'draft',
        input.classification || null,
        input.currentVersion || null,
        input.locationUrl || null,
        input.reviewFrequencyMonths || null,
        input.nextReviewDate || null,
        input.publishedAt || null,
        input.effectiveDate || null,
        input.expiryDate || null,
        input.archivedAt || null,
        input.supersededById || null,
        input.attestationRequired || false,
        input.fileName || null,
        input.fileSizeBytes || null,
        input.mimeType || null,
      ]
    );

    return rowToGovernanceDocument(result.rows[0]);
  } catch (error) {
    console.error('Error creating governance document:', error);
    throw error;
  }
}

export async function updateGovernanceDocument(
  workspaceId: string,
  id: string,
  updates: Partial<CreateGovernanceDocumentInput & { lastReviewedAt?: string }>
): Promise<GovernanceDocument | null> {
  try {
    const updateFields: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(updates.description || null);
      paramIndex++;
    }
    if (updates.docType !== undefined) {
      updateFields.push(`doc_type = $${paramIndex}`);
      params.push(updates.docType);
      paramIndex++;
    }
    if (updates.owner !== undefined) {
      updateFields.push(`owner = $${paramIndex}`);
      params.push(updates.owner);
      paramIndex++;
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }
    if (updates.classification !== undefined) {
      updateFields.push(`classification = $${paramIndex}`);
      params.push(updates.classification || null);
      paramIndex++;
    }
    if (updates.currentVersion !== undefined) {
      updateFields.push(`current_version = $${paramIndex}`);
      params.push(updates.currentVersion || null);
      paramIndex++;
    }
    if (updates.locationUrl !== undefined) {
      updateFields.push(`location_url = $${paramIndex}`);
      params.push(updates.locationUrl || null);
      paramIndex++;
    }
    if (updates.reviewFrequencyMonths !== undefined) {
      updateFields.push(`review_frequency_months = $${paramIndex}`);
      params.push(updates.reviewFrequencyMonths || null);
      paramIndex++;
    }
    if (updates.nextReviewDate !== undefined) {
      updateFields.push(`next_review_date = $${paramIndex}`);
      params.push(updates.nextReviewDate || null);
      paramIndex++;
    }
    if (updates.lastReviewedAt !== undefined) {
      updateFields.push(`last_reviewed_at = $${paramIndex}`);
      params.push(updates.lastReviewedAt || null);
      paramIndex++;
    }
    if (updates.publishedAt !== undefined) {
      updateFields.push(`published_at = $${paramIndex}`);
      params.push(updates.publishedAt || null);
      paramIndex++;
    }
    if (updates.effectiveDate !== undefined) {
      updateFields.push(`effective_date = $${paramIndex}`);
      params.push(updates.effectiveDate || null);
      paramIndex++;
    }
    if (updates.expiryDate !== undefined) {
      updateFields.push(`expiry_date = $${paramIndex}`);
      params.push(updates.expiryDate || null);
      paramIndex++;
    }
    if (updates.archivedAt !== undefined) {
      updateFields.push(`archived_at = $${paramIndex}`);
      params.push(updates.archivedAt || null);
      paramIndex++;
    }
    if (updates.supersededById !== undefined) {
      updateFields.push(`superseded_by_id = $${paramIndex}`);
      params.push(updates.supersededById || null);
      paramIndex++;
    }
    if (updates.attestationRequired !== undefined) {
      updateFields.push(`attestation_required = $${paramIndex}`);
      params.push(updates.attestationRequired);
      paramIndex++;
    }
    if (updates.fileName !== undefined) {
      updateFields.push(`file_name = $${paramIndex}`);
      params.push(updates.fileName || null);
      paramIndex++;
    }
    if (updates.fileSizeBytes !== undefined) {
      updateFields.push(`file_size_bytes = $${paramIndex}`);
      params.push(updates.fileSizeBytes || null);
      paramIndex++;
    }
    if (updates.mimeType !== undefined) {
      updateFields.push(`mime_type = $${paramIndex}`);
      params.push(updates.mimeType || null);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return getGovernanceDocumentById(workspaceId, id);
    }

    updateFields.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE governance_documents SET ${updateFields.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToGovernanceDocument(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating governance document:', error);
    throw error;
  }
}

export async function deleteGovernanceDocument(
  workspaceId: string,
  id: string
): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM governance_documents WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting governance document:', error);
    throw error;
  }
}

export async function acknowledgeGovernanceDocument(workspaceId: string, documentId: string, userId: string) {
  const document = await getGovernanceDocumentById(workspaceId, documentId);
  if (!document) throw new Error('Governance document not found');
  assertPolicyCanBeAcknowledged(document.status);
  const version = document.currentVersion || 'unversioned';
  const statement = `Acknowledged ${document.title} version ${version}`;
  const result = await query<any>(
    `INSERT INTO governance_document_acknowledgements(id,workspace_id,document_id,document_version,user_id,acknowledgement_statement)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(workspace_id,document_id,document_version,user_id) DO NOTHING
     RETURNING *`,
    [generateId('gda'), workspaceId, documentId, version, userId, statement],
  );
  if (result.rows[0]) return { ...result.rows[0], alreadyAcknowledged: false };
  const existing = (await query<any>(
    `SELECT * FROM governance_document_acknowledgements WHERE workspace_id=$1 AND document_id=$2 AND document_version=$3 AND user_id=$4`,
    [workspaceId, documentId, version, userId],
  )).rows[0];
  return { ...existing, alreadyAcknowledged: true };
}

export async function getMyGovernanceDocumentAcknowledgement(workspaceId: string, documentId: string, userId: string) {
  const document = await getGovernanceDocumentById(workspaceId, documentId);
  if (!document) return null;
  const version = document.currentVersion || 'unversioned';
  return (await query<any>(
    `SELECT id,document_id,document_version,user_id,acknowledgement_statement,acknowledged_at
     FROM governance_document_acknowledgements WHERE workspace_id=$1 AND document_id=$2 AND document_version=$3 AND user_id=$4`,
    [workspaceId, documentId, version, userId],
  )).rows[0] || null;
}

// ============================================
// Document-Framework Relationship Functions
// ============================================

export async function getDocumentFrameworks(documentId: string): Promise<string[]> {
  try {
    const result = await query<{ framework_code: string }>(
      'SELECT framework_code FROM governance_document_frameworks WHERE document_id = $1 ORDER BY framework_code',
      [documentId]
    );
    return result.rows.map(row => row.framework_code);
  } catch (error) {
    console.error('Error fetching document frameworks:', error);
    throw error;
  }
}

export async function setDocumentFrameworks(
  documentId: string,
  frameworkCodes: string[]
): Promise<void> {
  try {
    // First, delete existing mappings
    await query(
      'DELETE FROM governance_document_frameworks WHERE document_id = $1',
      [documentId]
    );

    // Insert new mappings
    if (frameworkCodes.length > 0) {
      const values = frameworkCodes.map((code, idx) => {
        const id = `GDF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        return `('${id}', $1, $${idx + 2})`;
      }).join(', ');

      await query(
        `INSERT INTO governance_document_frameworks (id, document_id, framework_code) VALUES ${values}`,
        [documentId, ...frameworkCodes]
      );
    }
  } catch (error) {
    console.error('Error setting document frameworks:', error);
    throw error;
  }
}

export async function addFrameworkToDocument(
  documentId: string,
  frameworkCode: string
): Promise<void> {
  try {
    const id = `GDF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await query(
      `INSERT INTO governance_document_frameworks (id, document_id, framework_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, framework_code) DO NOTHING`,
      [id, documentId, frameworkCode]
    );
  } catch (error) {
    console.error('Error adding framework to document:', error);
    throw error;
  }
}

export async function removeFrameworkFromDocument(
  documentId: string,
  frameworkCode: string
): Promise<void> {
  try {
    await query(
      'DELETE FROM governance_document_frameworks WHERE document_id = $1 AND framework_code = $2',
      [documentId, frameworkCode]
    );
  } catch (error) {
    console.error('Error removing framework from document:', error);
    throw error;
  }
}
