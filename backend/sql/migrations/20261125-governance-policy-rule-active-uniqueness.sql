ALTER TABLE governance_policy_rules
  DROP CONSTRAINT IF EXISTS governance_policy_rules_workspace_id_document_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_policy_rules_active_name
  ON governance_policy_rules (workspace_id, document_id, name)
  WHERE status = 'active';
