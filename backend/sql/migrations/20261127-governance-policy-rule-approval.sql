ALTER TABLE governance_policy_rules
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE governance_policy_rules
  DROP CONSTRAINT IF EXISTS governance_policy_rules_status_check;

ALTER TABLE governance_policy_rules
  ADD CONSTRAINT governance_policy_rules_status_check
  CHECK (status IN ('draft', 'pending_review', 'active', 'rejected', 'archived'));

ALTER TABLE governance_policy_rules
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

ALTER TABLE governance_policy_rule_events
  DROP CONSTRAINT IF EXISTS governance_policy_rule_events_event_type_check;

ALTER TABLE governance_policy_rule_events
  ADD CONSTRAINT governance_policy_rule_events_event_type_check
  CHECK (event_type IN ('created', 'updated', 'submitted', 'activated', 'rejected', 'returned', 'archived'));

CREATE INDEX IF NOT EXISTS idx_governance_policy_rules_review_queue
  ON governance_policy_rules (workspace_id, status, updated_at DESC)
  WHERE status IN ('draft', 'pending_review', 'rejected');
