CREATE UNIQUE INDEX IF NOT EXISTS uq_controls_id_workspace ON controls(id, workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_treatment_id_workspace ON risk_treatment_plans(id, workspace_id);

CREATE TABLE IF NOT EXISTS risk_treatment_plan_controls (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, treatment_plan_id TEXT NOT NULL, control_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Preventive','Detective','Corrective','Compensating','Recovery','Other')),
    implementation_note TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (treatment_plan_id, control_id),
    FOREIGN KEY(treatment_plan_id, workspace_id) REFERENCES risk_treatment_plans(id, workspace_id) ON DELETE CASCADE,
    FOREIGN KEY(control_id, workspace_id) REFERENCES controls(id, workspace_id) ON DELETE RESTRICT
  );
