-- Move Audit Management base schema ownership from application startup to deterministic migrations.
-- Audit plans, engagements, findings, actions, evidence requests, and other business records are not created or changed.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_plan_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      audit_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      department TEXT NOT NULL,
      framework TEXT NOT NULL,
      auditor TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      risk_rating INTEGER NOT NULL,
      budget NUMERIC(12,2) NOT NULL DEFAULT 0,
      hours INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_engagements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      plan_item_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      objectives TEXT[] NOT NULL DEFAULT '{}',
      scope TEXT[] NOT NULL DEFAULT '{}',
      out_of_scope TEXT[] NOT NULL DEFAULT '{}',
      audit_criteria TEXT[] NOT NULL DEFAULT '{}',
      audit_framework TEXT NOT NULL,
      risk_areas TEXT[] NOT NULL DEFAULT '{}',
      testing_strategy TEXT NOT NULL,
      sampling_approach TEXT NOT NULL,
      lead_auditor TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_universe_entities (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      department TEXT NOT NULL,
      framework TEXT NOT NULL,
      criticality TEXT NOT NULL,
      readiness_score INTEGER NOT NULL DEFAULT 0,
      linked_reference TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_workpapers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      title TEXT NOT NULL,
      testing_procedures TEXT[] NOT NULL DEFAULT '{}',
      sampling_notes TEXT NOT NULL,
      evidence_collection TEXT[] NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL,
      observations TEXT[] NOT NULL DEFAULT '{}',
      attachments TEXT[] NOT NULL DEFAULT '{}',
      reviewer_signoff TEXT,
      version_tag TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_tests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      control_tested TEXT NOT NULL,
      control_owner TEXT NOT NULL,
      testing_result TEXT NOT NULL,
      evidence TEXT[] NOT NULL DEFAULT '{}',
      reviewer TEXT NOT NULL,
      review_date TIMESTAMPTZ,
      notes TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_findings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      finding_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      business_impact TEXT NOT NULL,
      owner TEXT NOT NULL,
      target_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      closure_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_recommendations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      owner TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      completion_percent INTEGER NOT NULL DEFAULT 0,
      evidence_of_closure TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_corrective_actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      action_title TEXT NOT NULL,
      owner TEXT NOT NULL,
      deadline TIMESTAMPTZ NOT NULL,
      dependencies TEXT[] NOT NULL DEFAULT '{}',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      verification TEXT NOT NULL,
      closure_status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_follow_ups (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      follow_up_type TEXT NOT NULL,
      scheduled_date TIMESTAMPTZ NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_evidence_requests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      request_title TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      evidence_reuse_count INTEGER NOT NULL DEFAULT 0,
      linked_evidence TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS audit_calendar_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TIMESTAMPTZ NOT NULL,
      related_audit_id TEXT,
      owner TEXT NOT NULL
    )
;

COMMIT;
