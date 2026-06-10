import { useEffect, useMemo, useState } from 'react';
import {
  ActivityFeed,
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import {
  createAiAssessmentRecord,
  createAiControlRecord,
  createAiIncidentRecord,
  createAiInventoryRecord,
  createAiModelRecord,
  createAiTrainingProgramRecord,
  createAiVendorRecord,
  fetchAiGovernanceState,
  generateAiGovernanceReport,
  updateAiComplianceProgramRecord,
  updateAiModelRecord,
} from '../lib/api';
import { theme } from '../theme';
import type {
  AiClassification,
  AiComplianceProgramRecord,
  AiGovernanceState,
  AiModelRecord,
} from '../types/aiGovernance';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function classificationVariant(classification: AiClassification) {
  if (classification === 'prohibited') return 'danger';
  if (classification === 'high_risk') return 'danger';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'warning';
  if (classification === 'general_purpose_ai') return 'primary';
  return 'default';
}

function criticalityVariant(level: string) {
  if (level === 'critical') return 'danger';
  if (level === 'high') return 'warning';
  if (level === 'medium') return 'primary';
  return 'default';
}

function statusVariant(status: string) {
  if (status === 'approved' || status === 'validated' || status === 'implemented' || status === 'compliant' || status === 'healthy' || status === 'resolved') return 'success';
  if (status === 'critical' || status === 'failed' || status === 'non_compliant' || status === 'attention_required' || status === 'reported') return 'danger';
  if (status === 'monitoring' || status === 'gap' || status === 'watch' || status === 'planned' || status === 'in_review' || status === 'investigating' || status === 'conditional' || status === 'pending') return 'warning';
  return 'default';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not scheduled';
}

export function AiGovernance() {
  const [state, setState] = useState<AiGovernanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      setState(await fetchAiGovernanceState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI governance state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  const metrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'AI Systems', value: 0, detail: 'Loading inventory', tone: 'default' as const },
        { label: 'High-Risk AI', value: 0, detail: 'Loading classification', tone: 'default' as const },
        { label: 'Compliance Score', value: '0%', detail: 'Loading framework posture', tone: 'default' as const },
        { label: 'Model Risk Score', value: 0, detail: 'Loading validation signals', tone: 'default' as const },
        { label: 'AI Maturity', value: 0, detail: 'Loading maturity baseline', tone: 'default' as const },
      ];
    }
    return [
      { label: 'AI Systems', value: state.summary.aiSystems, detail: `${state.summary.aiInventoryCoverage}% inventory coverage`, tone: 'primary' as const },
      { label: 'High-Risk AI', value: state.summary.highRiskAi, detail: `${state.summary.aiIncidents} incidents in oversight`, tone: state.summary.highRiskAi > 0 ? 'warning' as const : 'success' as const },
      { label: 'Compliance Score', value: `${state.summary.aiComplianceScore}%`, detail: `${state.compliancePrograms.filter((item) => item.score < item.targetScore).length} programs below target`, tone: state.summary.aiComplianceScore >= 80 ? 'success' as const : 'warning' as const },
      { label: 'Model Risk Score', value: state.summary.modelRiskScore, detail: `${state.models.filter((item) => item.validationStatus !== 'validated').length} models need validation`, tone: state.summary.modelRiskScore >= 45 ? 'warning' as const : 'success' as const },
      { label: 'AI Maturity', value: state.summary.aiMaturityScore, detail: `${state.summary.responsibleAiScore}% responsible AI score`, tone: state.summary.aiMaturityScore >= 80 ? 'success' as const : 'warning' as const },
    ];
  }, [state]);

  const handleAction = async (key: string, action: () => Promise<void>) => {
    try {
      setWorking(key);
      await action();
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setWorking(null);
    }
  };

  const addSampleSystem = async () => {
    await createAiInventoryRecord({
      systemName: `AI Due Diligence Copilot ${Date.now().toString().slice(-4)}`,
      owner: 'Head of Procurement Risk',
      businessUnit: 'Vendor Management',
      purpose: 'Support due diligence summarization and issue triage',
      description: 'Generative assistant for third-party review workflows.',
      modelType: 'Generative LLM',
      vendor: 'Anthropic',
      deploymentModel: 'external',
      deploymentDate: new Date().toISOString(),
      lifecycleStatus: 'validation',
      criticality: 'high',
      useCase: 'vendor due diligence assistant',
      dataType: 'third_party_security_responses',
      industry: 'financial_services',
      jurisdictions: ['EU', 'UK'],
      impact: 'high',
      inventoryCoveragePercent: 84,
    });
  };

  const addSampleAssessment = async () => {
    const system = state?.inventory[0];
    await createAiAssessmentRecord({
      systemId: system?.id || null,
      assessmentName: `Independent AI assessment ${new Date().toLocaleDateString('en-GB')}`,
      owner: 'Responsible AI Office',
      status: 'in_review',
      biasRisk: 34,
      fairnessRisk: 31,
      transparencyRisk: 45,
      privacyRisk: 42,
      securityRisk: 39,
      hallucinationRisk: 57,
      explainabilityRisk: 49,
      ethicalRisk: 36,
      safetyRisk: 24,
      regulatoryRisk: 52,
      operationalRisk: 41,
      vendorRisk: 44,
    });
  };

  const addSampleModel = async () => {
    const system = state?.inventory[0];
    await createAiModelRecord({
      systemId: system?.id || null,
      modelName: `AI Governance Model ${Date.now().toString().slice(-4)}`,
      version: '1.0.0',
      owner: 'AI Platform Team',
      purpose: 'Governance summarization and routing',
      validationStatus: 'pending',
      approvalStatus: 'pending',
      lifecycleStatus: 'validation',
      modelFamily: 'Foundation Model',
      accuracy: 78,
      precision: 74,
      recall: 72,
      drift: 14,
      biasScore: 27,
      robustnessScore: 71,
      explainabilityScore: 59,
    });
  };

  const approveTopModel = async () => {
    const model = state?.models[0];
    if (!model) return;
    await updateAiModelRecord(model.id, {
      ...model,
      validationStatus: 'validated',
      approvalStatus: 'approved',
      lifecycleStatus: 'production',
    } as Partial<AiModelRecord>);
  };

  const addSampleIncident = async () => {
    const system = state?.inventory[0];
    await createAiIncidentRecord({
      systemId: system?.id || null,
      title: `Prompt injection attempt ${Date.now().toString().slice(-4)}`,
      incidentType: 'prompt_injection',
      severity: 'high',
      status: 'open',
      owner: 'Security Operations',
      detectedAt: new Date().toISOString(),
      reportedExternally: false,
      summary: 'Malicious prompt sequence detected in staging usage telemetry.',
    });
  };

  const addSampleControl = async () => {
    await createAiControlRecord({
      controlName: `Human oversight checkpoint ${Date.now().toString().slice(-4)}`,
      category: 'human_oversight',
      description: 'Escalate high-impact AI outputs to named business reviewers.',
      owner: 'GRC Manager',
      status: 'planned',
      mappedFrameworks: ['EU AI Act', 'ISO42001', 'NIST AI RMF'],
      evidenceCoveragePercent: 61,
      automationLevel: 'hybrid',
    });
  };

  const addSampleVendor = async () => {
    await createAiVendorRecord({
      vendorName: `AI Platform Vendor ${Date.now().toString().slice(-4)}`,
      vendorCategory: 'ai_platform',
      services: ['Inference platform', 'Model observability'],
      riskRating: 'medium',
      complianceScore: 73,
      contractStatus: 'review',
      securityReviewStatus: 'in_progress',
      evidenceCoveragePercent: 66,
    });
  };

  const addSampleTraining = async () => {
    await createAiTrainingProgramRecord({
      programName: `Responsible AI refresher ${new Date().toLocaleDateString('en-GB')}`,
      focusArea: 'Responsible AI',
      completionRate: 0,
      overdueLearners: 0,
      certificationStatus: 'attention',
      status: 'planned',
    });
  };

  const nudgeEuAiActProgram = async () => {
    const program = state?.compliancePrograms.find((item) => item.frameworkCode === 'EU_AI_ACT');
    if (!program) return;
    await updateAiComplianceProgramRecord({
      ...(program as Partial<AiComplianceProgramRecord>),
      score: Math.min(program.score + 4, 100),
      gapCount: Math.max(program.gapCount - 1, 0),
      documentationCoveragePercent: Math.min(program.documentationCoveragePercent + 5, 100),
      status: program.score + 4 >= program.targetScore ? 'healthy' : 'watch',
    });
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="AI Governance Dashboard" description="Enterprise oversight for AI inventory, model risk, responsible AI, and regulatory compliance." />
        <PageSectionCard title="Loading AI governance state">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Loading AI inventory, model validations, control coverage, and compliance programs...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="AI Governance Dashboard" description="Enterprise oversight for AI inventory, model risk, responsible AI, and regulatory compliance." />
        <EmptyStatePanel
          eyebrow="AI Governance"
          title="Unable to load AI governance data"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadState()}>Retry</Button>}
        />
      </div>
    );
  }

  const stateData = state;

  return (
    <div style={pageStyle}>
      <PageHeader
        title="AI Governance Dashboard"
        description="Run AI inventory, model risk, responsible AI controls, EU AI Act readiness, ISO/IEC 42001 governance, and assurance oversight from one compact console."
        action={<Button variant="primary" onClick={() => void handleAction('report-board-ai', async () => { await generateAiGovernanceReport('board_ai_risk_pack'); })}>Generate Board AI Pack</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="outline" onClick={() => void handleAction('program-eu', nudgeEuAiActProgram)} disabled={Boolean(working)}>Close EU AI Act Gap</Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => void handleAction('system', addSampleSystem)} disabled={Boolean(working)}>Register AI System</Button>
        <Button variant="outline" onClick={() => void handleAction('assessment', addSampleAssessment)} disabled={Boolean(working)}>Run Risk Assessment</Button>
        <Button variant="outline" onClick={() => void handleAction('incident', addSampleIncident)} disabled={Boolean(working)}>Log AI Incident</Button>
        <Button variant="outline" onClick={() => void handleAction('report-eu', async () => { await generateAiGovernanceReport('eu_ai_act_report'); })} disabled={Boolean(working)}>EU AI Act Report</Button>
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}

      {stateData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(340px, 0.95fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="AI Governance Command Center"
              subtitle="Inventory coverage, assurance pressure, and model risk trend aligned to ISO/IEC 42001, EU AI Act, NIST AI RMF, and OECD AI Principles."
              action={<Badge variant={stateData.summary.aiComplianceScore >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.aiComplianceScore}% compliance</Badge>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Controls Coverage</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{stateData.summary.aiControlsCoverage}%</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Control evidence and policy mapping coverage</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Assurance Status</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{stateData.summary.aiAssuranceStatus}%</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Composite assurance across incidents, validation, and oversight</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Responsible AI Score</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{stateData.summary.responsibleAiScore}%</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Training, documentation, and oversight maturity</div>
                </Card>
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="AI Assurance Workbench"
              subtitle="Cross-functional assurance view spanning assessments, incidents, validations, compliance, and training."
              action={<Badge variant="default" size="sm">{stateData.assuranceHighlights.length} indicators</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.assuranceHighlights.map((item) => (
                  <Card key={item.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.label}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.detail}</div>
                      </div>
                      <Badge variant={item.value > 2 ? 'warning' : 'success'} size="sm">{item.value}</Badge>
                    </div>
                  </Card>
                ))}
                <div style={{ marginTop: theme.spacing[1], display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[1] }}>
                  {stateData.modelRiskTrend.map((point) => (
                    <div key={point.month} style={{ textAlign: 'center' }}>
                      <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{ width: 18, borderRadius: theme.borderRadius.sm, height: `${Math.max(point.score, 6)}%`, backgroundColor: point.score >= 50 ? theme.colors.semantic.warning : theme.colors.primary }} />
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{point.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            </PageSectionCard>
          </div>

          <DataTableShell
            title="Enterprise AI Inventory"
            subtitle="Inventory register for AI systems, ownership, classification, deployment, compliance posture, and assurance state."
            action={<Badge variant="default" size="sm">{stateData.inventory.length} systems</Badge>}
          >
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '19%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>AI System</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Owner</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Classification</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Risk</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Compliance</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Lifecycle</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Coverage</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Assurance</th>
                </tr>
              </thead>
              <tbody>
                {stateData.inventory.map((system) => (
                  <tr key={system.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                    <td style={{ padding: theme.spacing[3], verticalAlign: 'top' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{system.systemName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{system.businessUnit} · {system.vendor}</div>
                    </td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{system.owner}</td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={classificationVariant(system.classification)} size="sm">{system.classification.replace(/_/g, ' ')}</Badge></td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={criticalityVariant(system.riskRating)} size="sm">{system.riskRating}</Badge></td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(system.complianceStatus)} size="sm">{system.complianceStatus.replace(/_/g, ' ')}</Badge></td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{system.lifecycleStatus}</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{system.inventoryCoveragePercent}%</td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(system.assuranceStatus)} size="sm">{system.assuranceStatus.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Model Registry"
              subtitle="Model validation, approval, drift, bias, robustness, and explainability oversight."
              action={<Badge variant="default" size="sm">{stateData.models.length} models</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.models.map((model) => (
                  <Card key={model.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{model.modelName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{model.version} · {model.modelFamily} · {model.owner}</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={statusVariant(model.validationStatus)} size="sm">{model.validationStatus}</Badge>
                        <Badge variant={statusVariant(model.approvalStatus)} size="sm">{model.approvalStatus}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Accuracy: <strong style={{ color: theme.colors.text.main }}>{model.accuracy}%</strong></div>
                      <div>Drift: <strong style={{ color: theme.colors.text.main }}>{model.drift}%</strong></div>
                      <div>Bias: <strong style={{ color: theme.colors.text.main }}>{model.biasScore}%</strong></div>
                      <div>Explainability: <strong style={{ color: theme.colors.text.main }}>{model.explainabilityScore}%</strong></div>
                    </div>
                  </Card>
                ))}
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Button variant="outline" onClick={() => void handleAction('model', addSampleModel)} disabled={Boolean(working)}>Add Model</Button>
                  <Button variant="outline" onClick={() => void handleAction('approve-model', approveTopModel)} disabled={Boolean(working) || !stateData.models.length}>Approve Top Model</Button>
                </div>
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Risk Assessments"
              subtitle="Bias, fairness, transparency, privacy, security, hallucination, and regulatory risk scoring."
              action={<Badge variant="warning" size="sm">{stateData.assessments.filter((item) => item.overallRiskScore >= 40).length} elevated</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.assessments.map((assessment) => (
                  <Card key={assessment.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{assessment.assessmentName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{assessment.owner} · Due {formatDate(assessment.dueDate)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={criticalityVariant(assessment.overallRiskScore >= 60 ? 'critical' : assessment.overallRiskScore >= 40 ? 'high' : 'medium')} size="sm">{assessment.overallRiskScore}</Badge>
                        <Badge variant={statusVariant(assessment.status)} size="sm">{assessment.status}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Bias {assessment.biasRisk}</div>
                      <div>Privacy {assessment.privacyRisk}</div>
                      <div>Hallucination {assessment.hallucinationRisk}</div>
                      <div>Regulatory {assessment.regulatoryRisk}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="AI Control Framework"
              subtitle="Governance, data, privacy, security, transparency, oversight, and monitoring controls mapped to external frameworks."
              action={<Badge variant="default" size="sm">{stateData.controls.length} controls</Badge>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Control</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Category</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Frameworks</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Coverage</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Automation</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.controls.map((control) => (
                    <tr key={control.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{control.controlName}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{control.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(control.status)} size="sm">{control.status.replace(/_/g, ' ')}</Badge></td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{control.mappedFrameworks.join(', ')}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{control.evidenceCoveragePercent}%</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{control.automationLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: theme.spacing[3] }}>
                <Button variant="outline" onClick={() => void handleAction('control', addSampleControl)} disabled={Boolean(working)}>Add AI Control</Button>
              </div>
            </DataTableShell>

            <ActivityFeed
              title="AI Incident Management"
              subtitle="Bias events, model failures, hallucinations, prompt injection, leakage, privacy, and compliance violations."
              countLabel={`${stateData.incidents.length} incidents`}
            >
              {stateData.incidents.map((incident) => (
                <Card key={incident.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{incident.title}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{incident.owner} · {formatDate(incident.detectedAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Badge variant={criticalityVariant(incident.severity)} size="sm">{incident.severity}</Badge>
                      <Badge variant={statusVariant(incident.status)} size="sm">{incident.status}</Badge>
                    </div>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{incident.summary}</div>
                </Card>
              ))}
              <div style={{ marginTop: theme.spacing[1] }}>
                <Button variant="outline" onClick={() => void handleAction('incident', addSampleIncident)} disabled={Boolean(working)}>Raise Incident</Button>
              </div>
            </ActivityFeed>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="EU AI Act & ISO/IEC 42001"
              subtitle="Framework-specific readiness, score, target, documentation, and evidence coverage."
              action={<Badge variant="default" size="sm">{stateData.compliancePrograms.length} programs</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.compliancePrograms.map((program) => (
                  <Card key={program.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{program.frameworkName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{program.gapCount} gaps · target {program.targetScore}%</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={statusVariant(program.status)} size="sm">{program.status}</Badge>
                        <Badge variant={program.score >= program.targetScore ? 'success' : 'warning'} size="sm">{program.score}%</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Controls {program.controlCoveragePercent}%</div>
                      <div>Evidence {program.evidenceCoveragePercent}%</div>
                      <div>Docs {program.documentationCoveragePercent}%</div>
                      <div>Training {program.trainingCoveragePercent}%</div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="AI Vendor Governance & Training"
              subtitle="Third-party model governance, cloud AI services, and awareness programs supporting responsible AI operations."
              action={<Badge variant="default" size="sm">{stateData.vendors.length + stateData.trainingPrograms.length} records</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.vendors.slice(0, 3).map((vendor) => (
                  <Card key={vendor.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{vendor.vendorName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{vendor.vendorCategory.replace(/_/g, ' ')} · {vendor.services.join(', ')}</div>
                      </div>
                      <Badge variant={criticalityVariant(vendor.riskRating)} size="sm">{vendor.riskRating}</Badge>
                    </div>
                  </Card>
                ))}
                {stateData.trainingPrograms.slice(0, 3).map((program) => (
                  <Card key={program.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{program.programName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{program.focusArea} · {program.overdueLearners} overdue learners</div>
                      </div>
                      <Badge variant={statusVariant(program.certificationStatus)} size="sm">{program.completionRate}%</Badge>
                    </div>
                  </Card>
                ))}
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Button variant="outline" onClick={() => void handleAction('vendor', addSampleVendor)} disabled={Boolean(working)}>Add AI Vendor</Button>
                  <Button variant="outline" onClick={() => void handleAction('training', addSampleTraining)} disabled={Boolean(working)}>Assign Training</Button>
                </div>
              </div>
            </PageSectionCard>
          </div>

          <PageSectionCard
            title="AI Reporting Center"
            subtitle="Generate governance, risk, compliance, model risk, EU AI Act, ISO/IEC 42001, and board-level AI reporting packs."
            action={<Badge variant="default" size="sm">{stateData.reports.length} reports</Badge>}
          >
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', marginBottom: theme.spacing[3] }}>
              <Button variant="outline" onClick={() => void handleAction('report-ai-governance', async () => { await generateAiGovernanceReport('ai_governance_report'); })}>AI Governance Report</Button>
              <Button variant="outline" onClick={() => void handleAction('report-model-risk', async () => { await generateAiGovernanceReport('model_risk_report'); })}>Model Risk Report</Button>
              <Button variant="outline" onClick={() => void handleAction('report-iso', async () => { await generateAiGovernanceReport('iso42001_report'); })}>ISO 42001 Report</Button>
              <Button variant="outline" onClick={() => void handleAction('report-exec', async () => { await generateAiGovernanceReport('executive_ai_dashboard'); })}>Executive AI Dashboard</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
              {stateData.reports.map((report) => (
                <Card key={report.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{report.title}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{report.generatedBy} · {formatDate(report.generatedAt)}</div>
                    </div>
                    <Badge variant={statusVariant(report.status)} size="sm">{report.status}</Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                    {report.summary.slice(0, 3).map((line) => (
                      <div key={line} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{line}</div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </PageSectionCard>
        </>
      ) : (
        <EmptyStatePanel
          eyebrow="AI Governance"
          title="No AI governance program data available"
          description="Register the first AI system, launch an assessment, or generate a baseline report to start the enterprise AI governance program."
          actions={<Button variant="primary" onClick={() => void handleAction('system', addSampleSystem)}>Register First AI System</Button>}
        />
      )}
    </div>
  );
}

export default AiGovernance;
