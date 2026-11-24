ALTER TABLE records_retention_rules
  DROP CONSTRAINT IF EXISTS records_retention_rules_record_type_check;

ALTER TABLE records_retention_rules
  ADD CONSTRAINT records_retention_rules_record_type_check
  CHECK (record_type IN ('governance_document', 'evidence', 'risk', 'supplier'));

ALTER TABLE governed_record_index
  DROP CONSTRAINT IF EXISTS governed_record_index_source_type_check;

ALTER TABLE governed_record_index
  ADD CONSTRAINT governed_record_index_source_type_check
  CHECK (source_type IN ('governance_document', 'evidence', 'risk', 'supplier'));
