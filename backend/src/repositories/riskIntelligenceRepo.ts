import { generateId, query } from '../db.js';
import { readinessAreas, readinessItems } from '../store/index.js';
import type {
  EmergingRiskRecord,
  KriDefinition,
  LossEventRecord,
  NearMissRecord,
  RiskCapacityProfile,
  RiskForecast,
  RiskQuantificationWeightSet,
  RiskToleranceProfile,
  RiskTreatmentEffectiveness,
} from '../types/riskIntelligence.js';

type NumericRecordRow = Record<string, number | string | null | string[]>;

const DEFAULT_TOLERANCE_PROFILES = [
  { category: 'information_security', appetite: 40, tolerance: 10, capacity: 75 },
  { category: 'privacy', appetite: 38, tolerance: 10, capacity: 70 },
  { category: 'vendor', appetite: 42, tolerance: 8, capacity: 72 },
  { category: 'operational', appetite: 45, tolerance: 10, capacity: 78 },
  { category: 'compliance', appetite: 40, tolerance: 8, capacity: 68 },
  { category: 'strategic', appetite: 50, tolerance: 12, capacity: 82 },
  { category: 'ai_governance', appetite: 35, tolerance: 10, capacity: 65 },
] as const;

const DEFAULT_CAPACITY_PROFILES = [
  { capacityType: 'financial', capacityLimit: 80 },
  { capacityType: 'operational', capacityLimit: 78 },
  { capacityType: 'regulatory', capacityLimit: 68 },
  { capacityType: 'technology', capacityLimit: 74 },
  { capacityType: 'vendor', capacityLimit: 72 },
  { capacityType: 'cyber', capacityLimit: 75 },
  { capacityType: 'privacy', capacityLimit: 70 },
  { capacityType: 'ai_governance', capacityLimit: 65 },
] as const;

const DEFAULT_KRIS = [
  ['Critical Vulnerabilities', 'information_security', 'Security Operations', 'count', 'weekly', 'assets'],
  ['Open Audit Findings', 'compliance', 'Internal Audit', 'count', 'weekly', 'audit'],
  ['Expired Evidence', 'compliance', 'Control Assurance', 'count', 'daily', 'evidence'],
  ['Failed Logins', 'information_security', 'Identity Security', 'count', 'daily', 'auth'],
  ['Privileged Accounts', 'information_security', 'Identity Security', 'count', 'weekly', 'users'],
  ['Vendor SLA Breaches', 'vendor', 'Third-Party Risk', 'count', 'weekly', 'vendors'],
  ['Policy Exceptions', 'compliance', 'Governance Office', 'count', 'monthly', 'policy'],
  ['Third-Party Findings', 'vendor', 'Third-Party Risk', 'count', 'weekly', 'vendors'],
  ['Training Completion', 'operational', 'Awareness Program', 'percent', 'weekly', 'training'],
  ['Data Privacy Incidents', 'privacy', 'Privacy Office', 'count', 'weekly', 'privacy'],
] as const;

const DEFAULT_WEIGHTS = {
  likelihoodWeight: 0.13,
  impactWeight: 0.14,
  controlEffectivenessWeight: 0.12,
  evidenceConfidenceWeight: 0.1,
  kriWeight: 0.11,
  auditFindingsWeight: 0.08,
  vendorExposureWeight: 0.1,
  assetCriticalityWeight: 0.08,
  lossEventsWeight: 0.08,
  nearMissEventsWeight: 0.06,
};

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function mapTolerance(row: NumericRecordRow): RiskToleranceProfile {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    category: String(row.category),
    appetite: Number(row.appetite),
    threshold: Number(row.threshold),
    tolerance: Number(row.tolerance),
    capacity: Number(row.capacity),
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapCapacity(row: NumericRecordRow): RiskCapacityProfile {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    capacityType: row.capacity_type as RiskCapacityProfile['capacityType'],
    currentExposure: Number(row.current_exposure),
    capacityLimit: Number(row.capacity_limit),
    utilizationPercent: Number(row.utilization_percent),
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapKri(row: NumericRecordRow): KriDefinition {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category),
    owner: String(row.owner),
    measurementUnit: String(row.measurement_unit),
    frequency: row.frequency as KriDefinition['frequency'],
    currentValue: Number(row.current_value),
    targetValue: Number(row.target_value),
    greenThreshold: Number(row.green_threshold),
    amberThreshold: Number(row.amber_threshold),
    redThreshold: Number(row.red_threshold),
    status: row.status as KriDefinition['status'],
    sourceModule: String(row.source_module),
    autoCalculated: Boolean(row.auto_calculated),
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapLossEvent(row: NumericRecordRow): LossEventRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    eventId: String(row.event_id),
    eventType: row.event_type as LossEventRecord['eventType'],
    eventDate: toIso(row.event_date as string)!,
    rootCause: String(row.root_cause),
    impact: String(row.impact),
    actualLoss: Number(row.actual_loss),
    estimatedLoss: Number(row.estimated_loss),
    recoveryCost: Number(row.recovery_cost),
    businessImpact: String(row.business_impact),
    lessonsLearned: row.lessons_learned ? String(row.lessons_learned) : undefined,
    linkedRiskId: row.linked_risk_id ? String(row.linked_risk_id) : undefined,
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapNearMiss(row: NumericRecordRow): NearMissRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    nearMissType: row.near_miss_type as NearMissRecord['nearMissType'],
    description: String(row.description),
    severity: row.severity as NearMissRecord['severity'],
    rootCause: String(row.root_cause),
    potentialImpact: String(row.potential_impact),
    mitigation: String(row.mitigation),
    linkedRiskId: row.linked_risk_id ? String(row.linked_risk_id) : undefined,
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapForecast(row: NumericRecordRow): RiskForecast {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    scopeType: row.scope_type as RiskForecast['scopeType'],
    scopeKey: String(row.scope_key),
    scopeLabel: String(row.scope_label),
    riskId: row.risk_id ? String(row.risk_id) : undefined,
    currentScore: Number(row.current_score),
    predicted30DayScore: Number(row.predicted_30_day_score),
    predicted90DayScore: Number(row.predicted_90_day_score),
    predicted180DayScore: Number(row.predicted_180_day_score),
    forecastStatus: row.forecast_status as RiskForecast['forecastStatus'],
    trend: row.trend as RiskForecast['trend'],
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapEmergingRisk(row: NumericRecordRow): EmergingRiskRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    category: String(row.category),
    description: String(row.description),
    likelihood: Number(row.likelihood),
    impact: Number(row.impact),
    monitoringStatus: row.monitoring_status as EmergingRiskRecord['monitoringStatus'],
    triggerEvents: Array.isArray(row.trigger_events) ? (row.trigger_events as string[]) : [],
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapTreatment(row: NumericRecordRow): RiskTreatmentEffectiveness {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    riskId: String(row.risk_id),
    treatmentName: String(row.treatment_name),
    owner: String(row.owner),
    expectedRiskReduction: Number(row.expected_risk_reduction),
    actualRiskReduction: Number(row.actual_risk_reduction),
    treatmentEffectivenessPercent: Number(row.treatment_effectiveness_percent),
    status: row.status as RiskTreatmentEffectiveness['status'],
    dueDate: toIso(row.due_date as string),
    completedAt: toIso(row.completed_at as string),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

function mapWeights(row: NumericRecordRow): RiskQuantificationWeightSet {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    likelihoodWeight: Number(row.likelihood_weight),
    impactWeight: Number(row.impact_weight),
    controlEffectivenessWeight: Number(row.control_effectiveness_weight),
    evidenceConfidenceWeight: Number(row.evidence_confidence_weight),
    kriWeight: Number(row.kri_weight),
    auditFindingsWeight: Number(row.audit_findings_weight),
    vendorExposureWeight: Number(row.vendor_exposure_weight),
    assetCriticalityWeight: Number(row.asset_criticality_weight),
    lossEventsWeight: Number(row.loss_events_weight),
    nearMissEventsWeight: Number(row.near_miss_events_weight),
    createdAt: toIso(row.created_at as string)!,
    updatedAt: toIso(row.updated_at as string)!,
  };
}

export async function ensureRiskIntelligenceSchema(): Promise<void> {
  await query(`
    ALTER TABLE risks
      ADD COLUMN IF NOT EXISTS business_unit TEXT,
      ADD COLUMN IF NOT EXISTS framework_codes TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS target_likelihood INTEGER,
      ADD COLUMN IF NOT EXISTS target_impact INTEGER,
      ADD COLUMN IF NOT EXISTS treatment_status TEXT,
      ADD COLUMN IF NOT EXISTS treatment_due_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_dynamic_score NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_30 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_90 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_180 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_score_updated_at TIMESTAMPTZ
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS readiness_areas (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework TEXT NOT NULL,
      domain TEXT NOT NULL,
      score NUMERIC(8,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework, domain)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS readiness_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      area_id TEXT NOT NULL REFERENCES readiness_areas(id) ON DELETE CASCADE,
      control_id TEXT,
      risk_id TEXT,
      question TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date DATE,
      evidence_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_tolerance_profiles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      category TEXT NOT NULL,
      appetite NUMERIC(8,2) NOT NULL,
      threshold NUMERIC(8,2) NOT NULL,
      tolerance NUMERIC(8,2) NOT NULL,
      capacity NUMERIC(8,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, category)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_capacity_profiles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      capacity_type TEXT NOT NULL,
      current_exposure NUMERIC(8,2) NOT NULL DEFAULT 0,
      capacity_limit NUMERIC(8,2) NOT NULL,
      utilization_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, capacity_type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_kri_definitions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      owner TEXT NOT NULL,
      measurement_unit TEXT NOT NULL,
      frequency TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      green_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      amber_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      red_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'green',
      source_module TEXT NOT NULL,
      auto_calculated BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_loss_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TIMESTAMPTZ NOT NULL,
      root_cause TEXT NOT NULL,
      impact TEXT NOT NULL,
      actual_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
      estimated_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
      recovery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      business_impact TEXT NOT NULL,
      lessons_learned TEXT,
      linked_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_near_misses (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      near_miss_type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      potential_impact TEXT NOT NULL,
      mitigation TEXT NOT NULL,
      linked_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_quantification_weights (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL UNIQUE,
      likelihood_weight NUMERIC(8,4) NOT NULL,
      impact_weight NUMERIC(8,4) NOT NULL,
      control_effectiveness_weight NUMERIC(8,4) NOT NULL,
      evidence_confidence_weight NUMERIC(8,4) NOT NULL,
      kri_weight NUMERIC(8,4) NOT NULL,
      audit_findings_weight NUMERIC(8,4) NOT NULL,
      vendor_exposure_weight NUMERIC(8,4) NOT NULL,
      asset_criticality_weight NUMERIC(8,4) NOT NULL,
      loss_events_weight NUMERIC(8,4) NOT NULL,
      near_miss_events_weight NUMERIC(8,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_forecasts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      scope_label TEXT NOT NULL,
      risk_id TEXT,
      current_score NUMERIC(8,2) NOT NULL,
      predicted_30_day_score NUMERIC(8,2) NOT NULL,
      predicted_90_day_score NUMERIC(8,2) NOT NULL,
      predicted_180_day_score NUMERIC(8,2) NOT NULL,
      forecast_status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, scope_type, scope_key)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS emerging_risks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      likelihood INTEGER NOT NULL,
      impact INTEGER NOT NULL,
      monitoring_status TEXT NOT NULL,
      trigger_events TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_treatment_effectiveness (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      risk_id TEXT NOT NULL,
      treatment_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      expected_risk_reduction NUMERIC(8,2) NOT NULL DEFAULT 0,
      actual_risk_reduction NUMERIC(8,2) NOT NULL DEFAULT 0,
      treatment_effectiveness_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      due_date TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS risk_score_snapshots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      risk_id TEXT,
      category TEXT,
      business_unit TEXT,
      framework_code TEXT,
      score_type TEXT NOT NULL,
      score NUMERIC(8,2) NOT NULL,
      appetite_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_risk_tolerance_workspace ON risk_tolerance_profiles (workspace_id, category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_readiness_areas_workspace ON readiness_areas (workspace_id, framework, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_readiness_items_workspace ON readiness_items (workspace_id, area_id, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_capacity_workspace ON risk_capacity_profiles (workspace_id, capacity_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_kri_workspace ON risk_kri_definitions (workspace_id, category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_loss_events_workspace ON risk_loss_events (workspace_id, event_date DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_near_miss_workspace ON risk_near_misses (workspace_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_forecasts_workspace ON risk_forecasts (workspace_id, scope_type, scope_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_emerging_risks_workspace ON emerging_risks (workspace_id, category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_treatments_workspace ON risk_treatment_effectiveness (workspace_id, risk_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_snapshots_workspace ON risk_score_snapshots (workspace_id, created_at DESC)`);
}

export async function seedRiskIntelligenceDefaults(workspaceId: string): Promise<void> {
  const readinessCount = await query(`SELECT COUNT(*)::int AS count FROM readiness_areas WHERE workspace_id = $1`, [workspaceId]);
  if (Number(readinessCount.rows[0]?.count || 0) === 0) {
    const areaIdMap = new Map<string, string>();
    for (const area of readinessAreas) {
      const persistedId = generateId('rda');
      areaIdMap.set(area.id, persistedId);
      await query(
        `INSERT INTO readiness_areas (id, workspace_id, framework, domain, score, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (workspace_id, framework, domain) DO NOTHING`,
        [
          persistedId,
          workspaceId,
          area.framework,
          area.domain,
          area.score,
          area.status,
          area.createdAt,
          area.updatedAt,
        ],
      );
    }

    const areaRows = await query(
      `SELECT id, framework, domain FROM readiness_areas WHERE workspace_id = $1`,
      [workspaceId],
    );
    const persistedAreaByKey = new Map<string, string>();
    areaRows.rows.forEach((row) => {
      persistedAreaByKey.set(`${row.framework}::${row.domain}`, String(row.id));
    });

    for (let index = 0; index < readinessItems.length; index += 1) {
      const item = readinessItems[index];
      const sourceArea = readinessAreas.find((area) => area.id === item.areaId);
      if (!sourceArea) continue;
      const persistedAreaId = persistedAreaByKey.get(`${sourceArea.framework}::${sourceArea.domain}`);
      if (!persistedAreaId) continue;
      await query(
        `INSERT INTO readiness_items (
          id, workspace_id, area_id, control_id, risk_id, question, status, owner, due_date, evidence_id, created_at, updated_at
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          generateId(`rdi${index}`),
          workspaceId,
          persistedAreaId,
          item.controlId || null,
          item.riskId || null,
          item.question,
          item.status,
          item.owner,
          item.dueDate || null,
          item.evidenceId || null,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
  }

  for (const profile of DEFAULT_TOLERANCE_PROFILES) {
    await query(
      `INSERT INTO risk_tolerance_profiles (id, workspace_id, category, appetite, threshold, tolerance, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, category) DO NOTHING`,
      [
        generateId('rtol'),
        workspaceId,
        profile.category,
        profile.appetite,
        profile.appetite + profile.tolerance,
        profile.tolerance,
        profile.capacity,
      ],
    );
  }

  for (const profile of DEFAULT_CAPACITY_PROFILES) {
    await query(
      `INSERT INTO risk_capacity_profiles (id, workspace_id, capacity_type, current_exposure, capacity_limit, utilization_percent)
       VALUES ($1, $2, $3, 0, $4, 0)
       ON CONFLICT (workspace_id, capacity_type) DO NOTHING`,
      [generateId('rcap'), workspaceId, profile.capacityType, profile.capacityLimit],
    );
  }

  await query(
    `INSERT INTO risk_quantification_weights (
      id, workspace_id, likelihood_weight, impact_weight, control_effectiveness_weight,
      evidence_confidence_weight, kri_weight, audit_findings_weight, vendor_exposure_weight,
      asset_criticality_weight, loss_events_weight, near_miss_events_weight
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (workspace_id) DO NOTHING`,
    [
      generateId('rwt'),
      workspaceId,
      DEFAULT_WEIGHTS.likelihoodWeight,
      DEFAULT_WEIGHTS.impactWeight,
      DEFAULT_WEIGHTS.controlEffectivenessWeight,
      DEFAULT_WEIGHTS.evidenceConfidenceWeight,
      DEFAULT_WEIGHTS.kriWeight,
      DEFAULT_WEIGHTS.auditFindingsWeight,
      DEFAULT_WEIGHTS.vendorExposureWeight,
      DEFAULT_WEIGHTS.assetCriticalityWeight,
      DEFAULT_WEIGHTS.lossEventsWeight,
      DEFAULT_WEIGHTS.nearMissEventsWeight,
    ],
  );

  for (const [name, category, owner, unit, frequency, sourceModule] of DEFAULT_KRIS) {
    await query(
      `INSERT INTO risk_kri_definitions (
        id, workspace_id, name, category, owner, measurement_unit, frequency, target_value,
        green_threshold, amber_threshold, red_threshold, source_module, auto_calculated, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 1, 3, $8, TRUE, 'green')
      ON CONFLICT DO NOTHING`,
      [generateId('rkri'), workspaceId, name, category, owner, unit, frequency, sourceModule],
    );
  }

  await query(
    `INSERT INTO emerging_risks (id, workspace_id, title, category, description, likelihood, impact, monitoring_status, trigger_events)
     SELECT $1, $2, 'AI model drift', 'ai_governance', 'Emerging AI governance exposure across automated decisioning and model oversight.', 3, 4, 'monitoring', ARRAY['Model exceptions', 'Regulatory inquiries']
     WHERE NOT EXISTS (SELECT 1 FROM emerging_risks WHERE workspace_id = $2)`,
    [generateId('erisk'), workspaceId],
  );
}

export async function listToleranceProfiles(workspaceId: string): Promise<RiskToleranceProfile[]> {
  const result = await query(`SELECT * FROM risk_tolerance_profiles WHERE workspace_id = $1 ORDER BY category`, [workspaceId]);
  return result.rows.map((row) => mapTolerance(row as NumericRecordRow));
}

export async function upsertToleranceProfile(
  workspaceId: string,
  category: string,
  input: Pick<RiskToleranceProfile, 'appetite' | 'tolerance' | 'capacity'>,
): Promise<RiskToleranceProfile> {
  const result = await query(
    `INSERT INTO risk_tolerance_profiles (id, workspace_id, category, appetite, threshold, tolerance, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (workspace_id, category)
     DO UPDATE SET appetite = EXCLUDED.appetite, threshold = EXCLUDED.threshold, tolerance = EXCLUDED.tolerance, capacity = EXCLUDED.capacity, updated_at = NOW()
     RETURNING *`,
    [generateId('rtol'), workspaceId, category, input.appetite, input.appetite + input.tolerance, input.tolerance, input.capacity],
  );
  return mapTolerance(result.rows[0] as NumericRecordRow);
}

export async function listCapacityProfiles(workspaceId: string): Promise<RiskCapacityProfile[]> {
  const result = await query(`SELECT * FROM risk_capacity_profiles WHERE workspace_id = $1 ORDER BY capacity_type`, [workspaceId]);
  return result.rows.map((row) => mapCapacity(row as NumericRecordRow));
}

export async function upsertCapacityProfile(
  workspaceId: string,
  capacityType: RiskCapacityProfile['capacityType'],
  input: Pick<RiskCapacityProfile, 'currentExposure' | 'capacityLimit' | 'utilizationPercent'>,
): Promise<RiskCapacityProfile> {
  const result = await query(
    `INSERT INTO risk_capacity_profiles (id, workspace_id, capacity_type, current_exposure, capacity_limit, utilization_percent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, capacity_type)
     DO UPDATE SET current_exposure = EXCLUDED.current_exposure, capacity_limit = EXCLUDED.capacity_limit, utilization_percent = EXCLUDED.utilization_percent, updated_at = NOW()
     RETURNING *`,
    [generateId('rcap'), workspaceId, capacityType, input.currentExposure, input.capacityLimit, input.utilizationPercent],
  );
  return mapCapacity(result.rows[0] as NumericRecordRow);
}

export async function listKris(workspaceId: string): Promise<KriDefinition[]> {
  const result = await query(`SELECT * FROM risk_kri_definitions WHERE workspace_id = $1 ORDER BY category, name`, [workspaceId]);
  return result.rows.map((row) => mapKri(row as NumericRecordRow));
}

export async function createKri(workspaceId: string, input: Partial<KriDefinition>): Promise<KriDefinition> {
  const result = await query(
    `INSERT INTO risk_kri_definitions (
      id, workspace_id, name, description, category, owner, measurement_unit, frequency, current_value, target_value,
      green_threshold, amber_threshold, red_threshold, status, source_module, auto_calculated
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, 0), COALESCE($11, 0), COALESCE($12, 1), COALESCE($13, 3), COALESCE($14, 'green'), COALESCE($15, 'manual'), COALESCE($16, FALSE))
    RETURNING *`,
    [
      generateId('rkri'),
      workspaceId,
      input.name,
      input.description || null,
      input.category,
      input.owner,
      input.measurementUnit,
      input.frequency,
      input.currentValue ?? 0,
      input.targetValue ?? 0,
      input.greenThreshold ?? 0,
      input.amberThreshold ?? 1,
      input.redThreshold ?? 3,
      input.status ?? 'green',
      input.sourceModule ?? 'manual',
      input.autoCalculated ?? false,
    ],
  );
  return mapKri(result.rows[0] as NumericRecordRow);
}

export async function updateKri(workspaceId: string, id: string, input: Partial<KriDefinition>): Promise<KriDefinition | null> {
  const existing = await query(`SELECT * FROM risk_kri_definitions WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  if (!existing.rows[0]) return null;
  const current = existing.rows[0] as NumericRecordRow;
  const result = await query(
    `UPDATE risk_kri_definitions
     SET name = $3, description = $4, category = $5, owner = $6, measurement_unit = $7, frequency = $8,
         current_value = $9, target_value = $10, green_threshold = $11, amber_threshold = $12, red_threshold = $13,
         status = $14, source_module = $15, auto_calculated = $16, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.name ?? current.name,
      input.description ?? current.description,
      input.category ?? current.category,
      input.owner ?? current.owner,
      input.measurementUnit ?? current.measurement_unit,
      input.frequency ?? current.frequency,
      input.currentValue ?? current.current_value,
      input.targetValue ?? current.target_value,
      input.greenThreshold ?? current.green_threshold,
      input.amberThreshold ?? current.amber_threshold,
      input.redThreshold ?? current.red_threshold,
      input.status ?? current.status,
      input.sourceModule ?? current.source_module,
      input.autoCalculated ?? current.auto_calculated,
    ],
  );
  return mapKri(result.rows[0] as NumericRecordRow);
}

export async function listLossEvents(workspaceId: string): Promise<LossEventRecord[]> {
  const result = await query(`SELECT * FROM risk_loss_events WHERE workspace_id = $1 ORDER BY event_date DESC, created_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapLossEvent(row as NumericRecordRow));
}

export async function createLossEvent(workspaceId: string, input: Partial<LossEventRecord>): Promise<LossEventRecord> {
  const result = await query(
    `INSERT INTO risk_loss_events (
      id, workspace_id, event_id, event_type, event_date, root_cause, impact, actual_loss, estimated_loss, recovery_cost,
      business_impact, lessons_learned, linked_risk_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9, 0), COALESCE($10, 0), $11, $12, $13)
    RETURNING *`,
    [
      generateId('rloss'),
      workspaceId,
      input.eventId || `LE-${Date.now().toString(36).toUpperCase()}`,
      input.eventType,
      input.eventDate || new Date().toISOString(),
      input.rootCause,
      input.impact,
      input.actualLoss ?? 0,
      input.estimatedLoss ?? 0,
      input.recoveryCost ?? 0,
      input.businessImpact,
      input.lessonsLearned || null,
      input.linkedRiskId || null,
    ],
  );
  return mapLossEvent(result.rows[0] as NumericRecordRow);
}

export async function listNearMisses(workspaceId: string): Promise<NearMissRecord[]> {
  const result = await query(`SELECT * FROM risk_near_misses WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapNearMiss(row as NumericRecordRow));
}

export async function createNearMiss(workspaceId: string, input: Partial<NearMissRecord>): Promise<NearMissRecord> {
  const result = await query(
    `INSERT INTO risk_near_misses (
      id, workspace_id, near_miss_type, description, severity, root_cause, potential_impact, mitigation, linked_risk_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      generateId('rmiss'),
      workspaceId,
      input.nearMissType,
      input.description,
      input.severity,
      input.rootCause,
      input.potentialImpact,
      input.mitigation,
      input.linkedRiskId || null,
    ],
  );
  return mapNearMiss(result.rows[0] as NumericRecordRow);
}

export async function getWeightSet(workspaceId: string): Promise<RiskQuantificationWeightSet> {
  const result = await query(`SELECT * FROM risk_quantification_weights WHERE workspace_id = $1 LIMIT 1`, [workspaceId]);
  if (!result.rows[0]) {
    await seedRiskIntelligenceDefaults(workspaceId);
    return getWeightSet(workspaceId);
  }
  return mapWeights(result.rows[0] as NumericRecordRow);
}

export async function updateWeightSet(workspaceId: string, input: Partial<RiskQuantificationWeightSet>): Promise<RiskQuantificationWeightSet> {
  const current = await getWeightSet(workspaceId);
  const result = await query(
    `UPDATE risk_quantification_weights
     SET likelihood_weight = $2, impact_weight = $3, control_effectiveness_weight = $4, evidence_confidence_weight = $5,
         kri_weight = $6, audit_findings_weight = $7, vendor_exposure_weight = $8, asset_criticality_weight = $9,
         loss_events_weight = $10, near_miss_events_weight = $11, updated_at = NOW()
     WHERE workspace_id = $1
     RETURNING *`,
    [
      workspaceId,
      input.likelihoodWeight ?? current.likelihoodWeight,
      input.impactWeight ?? current.impactWeight,
      input.controlEffectivenessWeight ?? current.controlEffectivenessWeight,
      input.evidenceConfidenceWeight ?? current.evidenceConfidenceWeight,
      input.kriWeight ?? current.kriWeight,
      input.auditFindingsWeight ?? current.auditFindingsWeight,
      input.vendorExposureWeight ?? current.vendorExposureWeight,
      input.assetCriticalityWeight ?? current.assetCriticalityWeight,
      input.lossEventsWeight ?? current.lossEventsWeight,
      input.nearMissEventsWeight ?? current.nearMissEventsWeight,
    ],
  );
  return mapWeights(result.rows[0] as NumericRecordRow);
}

export async function listForecasts(workspaceId: string): Promise<RiskForecast[]> {
  const result = await query(`SELECT * FROM risk_forecasts WHERE workspace_id = $1 ORDER BY scope_type, scope_label`, [workspaceId]);
  return result.rows.map((row) => mapForecast(row as NumericRecordRow));
}

export async function upsertForecast(workspaceId: string, input: Omit<RiskForecast, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>): Promise<RiskForecast> {
  const result = await query(
    `INSERT INTO risk_forecasts (
      id, workspace_id, scope_type, scope_key, scope_label, risk_id, current_score, predicted_30_day_score,
      predicted_90_day_score, predicted_180_day_score, forecast_status, trend
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (workspace_id, scope_type, scope_key)
    DO UPDATE SET scope_label = EXCLUDED.scope_label, risk_id = EXCLUDED.risk_id, current_score = EXCLUDED.current_score,
      predicted_30_day_score = EXCLUDED.predicted_30_day_score, predicted_90_day_score = EXCLUDED.predicted_90_day_score,
      predicted_180_day_score = EXCLUDED.predicted_180_day_score, forecast_status = EXCLUDED.forecast_status,
      trend = EXCLUDED.trend, updated_at = NOW()
    RETURNING *`,
    [
      generateId('rfc'),
      workspaceId,
      input.scopeType,
      input.scopeKey,
      input.scopeLabel,
      input.riskId || null,
      input.currentScore,
      input.predicted30DayScore,
      input.predicted90DayScore,
      input.predicted180DayScore,
      input.forecastStatus,
      input.trend,
    ],
  );
  return mapForecast(result.rows[0] as NumericRecordRow);
}

export async function listEmergingRisks(workspaceId: string): Promise<EmergingRiskRecord[]> {
  const result = await query(`SELECT * FROM emerging_risks WHERE workspace_id = $1 ORDER BY updated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapEmergingRisk(row as NumericRecordRow));
}

export async function createEmergingRisk(workspaceId: string, input: Partial<EmergingRiskRecord>): Promise<EmergingRiskRecord> {
  const result = await query(
    `INSERT INTO emerging_risks (id, workspace_id, title, category, description, likelihood, impact, monitoring_status, trigger_events)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '{}'))
     RETURNING *`,
    [
      generateId('erisk'),
      workspaceId,
      input.title,
      input.category,
      input.description,
      input.likelihood,
      input.impact,
      input.monitoringStatus || 'monitoring',
      input.triggerEvents || [],
    ],
  );
  return mapEmergingRisk(result.rows[0] as NumericRecordRow);
}

export async function listTreatments(workspaceId: string): Promise<RiskTreatmentEffectiveness[]> {
  const result = await query(`SELECT * FROM risk_treatment_effectiveness WHERE workspace_id = $1 ORDER BY updated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapTreatment(row as NumericRecordRow));
}

export async function createTreatment(workspaceId: string, input: Partial<RiskTreatmentEffectiveness>): Promise<RiskTreatmentEffectiveness> {
  const expected = Number(input.expectedRiskReduction ?? 0);
  const actual = Number(input.actualRiskReduction ?? 0);
  const effectiveness = expected > 0 ? Number(((actual / expected) * 100).toFixed(2)) : 0;
  const result = await query(
    `INSERT INTO risk_treatment_effectiveness (
      id, workspace_id, risk_id, treatment_name, owner, expected_risk_reduction, actual_risk_reduction,
      treatment_effectiveness_percent, status, due_date, completed_at, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      generateId('rtrt'),
      workspaceId,
      input.riskId,
      input.treatmentName,
      input.owner,
      expected,
      actual,
      effectiveness,
      input.status || (effectiveness >= 90 ? 'completed' : effectiveness >= 60 ? 'in_progress' : 'underperforming'),
      input.dueDate || null,
      input.completedAt || null,
      input.notes || null,
    ],
  );
  return mapTreatment(result.rows[0] as NumericRecordRow);
}

export async function recordScoreSnapshot(input: {
  workspaceId: string;
  riskId?: string | null;
  category?: string | null;
  businessUnit?: string | null;
  frameworkCode?: string | null;
  scoreType: string;
  score: number;
  appetiteStatus?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO risk_score_snapshots (id, workspace_id, risk_id, category, business_unit, framework_code, score_type, score, appetite_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      generateId('rsnap'),
      input.workspaceId,
      input.riskId || null,
      input.category || null,
      input.businessUnit || null,
      input.frameworkCode || null,
      input.scoreType,
      input.score,
      input.appetiteStatus || null,
    ],
  );
}

export async function listRecentSnapshots(workspaceId: string, days = 365): Promise<Array<{
  riskId?: string | null;
  category?: string | null;
  businessUnit?: string | null;
  frameworkCode?: string | null;
  scoreType: string;
  score: number;
  appetiteStatus?: string | null;
  createdAt: string;
}>> {
  const result = await query(
    `SELECT risk_id, category, business_unit, framework_code, score_type, score, appetite_status, created_at
     FROM risk_score_snapshots
     WHERE workspace_id = $1 AND created_at >= NOW() - ($2::text || ' days')::interval
     ORDER BY created_at DESC`,
    [workspaceId, String(days)],
  );
  return result.rows.map((row) => ({
    riskId: row.risk_id ? String(row.risk_id) : undefined,
    category: row.category ? String(row.category) : undefined,
    businessUnit: row.business_unit ? String(row.business_unit) : undefined,
    frameworkCode: row.framework_code ? String(row.framework_code) : undefined,
    scoreType: String(row.score_type),
    score: Number(row.score),
    appetiteStatus: row.appetite_status ? String(row.appetite_status) : undefined,
    createdAt: toIso(row.created_at as string)!,
  }));
}

export async function listRiskDataRows(workspaceId: string): Promise<any[]> {
  const result = await query(
    `SELECT
       r.*,
       COALESCE(ARRAY_AGG(DISTINCT rc.control_id) FILTER (WHERE rc.control_id IS NOT NULL), ARRAY[]::text[]) AS control_ids,
       COUNT(DISTINCT CASE WHEN c.status <> 'implemented' THEN c.id END) AS failing_controls,
       COUNT(DISTINCT e.id) AS evidence_count,
       COUNT(DISTINCT CASE WHEN e.last_reviewed_at IS NULL OR e.last_reviewed_at < NOW() - INTERVAL '180 days' THEN e.id END) AS stale_evidence_count,
       COUNT(DISTINCT le.id) AS loss_event_count,
       COUNT(DISTINCT nm.id) AS near_miss_count
     FROM risks r
     LEFT JOIN risk_control_links rc ON rc.risk_id = r.id
     LEFT JOIN controls c ON c.id = rc.control_id AND c.workspace_id = r.workspace_id
     LEFT JOIN evidence e ON e.risk_id = r.id AND e.workspace_id = r.workspace_id
     LEFT JOIN risk_loss_events le ON le.linked_risk_id = r.id AND le.workspace_id = r.workspace_id
     LEFT JOIN risk_near_misses nm ON nm.linked_risk_id = r.id AND nm.workspace_id = r.workspace_id
     WHERE r.workspace_id = $1
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    [workspaceId],
  );
  return result.rows;
}

export async function listVendorSignalRows(workspaceId: string): Promise<any[]> {
  const result = await query(
    `SELECT id, name, category, owner, risk_level, status, next_review_date
     FROM vendors
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return result.rows;
}

export async function listAssetSignalRows(workspaceId: string): Promise<any[]> {
  const result = await query(
    `SELECT
       id,
       name,
       criticality,
       LEAST(
         CASE
           WHEN criticality = 'critical' THEN 85
           WHEN criticality = 'high' THEN 70
           WHEN criticality = 'medium' THEN 50
           ELSE 30
         END + (COALESCE(array_length(linked_risk_ids, 1), 0) * 5),
         100
       ) AS risk_score,
       COALESCE(linked_risk_ids, ARRAY[]::text[]) AS linked_risk_ids
     FROM assets
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return result.rows;
}

export async function getTrainingSignal(workspaceId: string): Promise<{ completionRate: number; overdueAssignments: number }> {
  const result = await query(
    `SELECT
       COALESCE(AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END), 0) AS completion_rate,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_assignments
     FROM training_assignments
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return {
    completionRate: Number(result.rows[0]?.completion_rate || 0),
    overdueAssignments: Number(result.rows[0]?.overdue_assignments || 0),
  };
}

export async function getAuditSignal(workspaceId: string): Promise<{ openItems: number; averageReadiness: number }> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'ready') AS open_items,
       COALESCE(AVG(score), 0) AS average_readiness
     FROM readiness_areas
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return {
    openItems: Number(result.rows[0]?.open_items || 0),
    averageReadiness: Number(result.rows[0]?.average_readiness || 0),
  };
}

export async function listReviewTaskSignal(workspaceId: string): Promise<{ openTreatmentPlans: number; overdue: number }> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'completed') AS open_count,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count
     FROM review_tasks
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return {
    openTreatmentPlans: Number(result.rows[0]?.open_count || 0),
    overdue: Number(result.rows[0]?.overdue_count || 0),
  };
}
