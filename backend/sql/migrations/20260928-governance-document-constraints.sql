BEGIN;

ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_doc_type_check;
ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_status_check;
ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_classification_check;

ALTER TABLE governance_documents
  ADD CONSTRAINT governance_documents_doc_type_check CHECK (doc_type IN (
    'policy', 'standard', 'procedure', 'guideline', 'manual', 'other',
    'framework_document', 'risk_document', 'control_document', 'evidence_document',
    'audit_document', 'training_material', 'incident_document', 'vendor_document',
    'compliance_register', 'management_review_document', 'custom'
  ));

ALTER TABLE governance_documents
  ADD CONSTRAINT governance_documents_status_check CHECK (status IN (
    'draft', 'in_review', 'under_review', 'approved', 'published', 'active',
    'expired', 'superseded', 'archived', 'retired', 'rejected', 'pending_attestation'
  ));

ALTER TABLE governance_documents
  ADD CONSTRAINT governance_documents_classification_check CHECK (
    classification IS NULL OR classification IN ('public', 'internal', 'confidential', 'restricted')
  );

COMMIT;
