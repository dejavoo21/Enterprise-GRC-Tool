import { GovernanceDocument, CreateGovernanceDocumentInput } from '../types/models';
import { query } from '../db';

export interface GovernanceDocumentFilter {
  docType?: string;
  status?: string;
  dueForReviewOnly?: boolean;
  frameworkCode?: string;
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
