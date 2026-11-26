BEGIN;

CREATE TABLE IF NOT EXISTS ccm_assurance_notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'failed_test','drift_alert','connector_failure','missing_evidence','expired_evidence',
    'review_assignment','approval_request','risk_escalation'
  )),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  detail TEXT NOT NULL CHECK (length(trim(detail)) BETWEEN 3 AND 2000),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','archived','snoozed')),
  route_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  assigned_to TEXT,
  snoozed_until TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, notification_type, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ccm_assurance_notifications_workspace_status
  ON ccm_assurance_notifications(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ccm_assurance_notification_preferences (
  workspace_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel = 'in_app'),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'failed_test','drift_alert','connector_failure','missing_evidence','expired_evidence',
    'review_assignment','approval_request','risk_escalation'
  )),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, channel, notification_type)
);

COMMIT;
