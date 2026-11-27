import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActivityFeed,
  AiGovernanceEntryModal,
  type AiEntryKind,
  Badge,
  Button,
  Card,
  ControlGovernanceSummary,
  DataTableShell,
  EmptyStatePanel,
  Modal,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { RelationshipExplorer } from '../components/RelationshipExplorer';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  createAiAssessmentRecord,
  createAiControlRecord,
  createAiIncidentRecord,
  createAiInventoryRecord,
  createAiModelRecord,
  createAiTrainingProgramRecord,
  createAiVendorRecord,
  decideAiAssessmentRecord,
  decideAiInventoryRecord,
  decideAiModelRecord,
  fetchAiModelHistory,
  fetchAiGovernanceState,
  generateAiGovernanceReport,
  submitAiModelRecord,
  transitionAiAssessmentRecord,
  transitionAiControlRecord,
  transitionAiIncidentRecord,
  updateAiComplianceProgramRecord,
  updateAiInventoryRecord,
  updateAiModelRecord,
} from '../lib/api';
import { theme } from '../theme';
import type {
  AiCiaImpact,
  AiClassification,
  AiGovernanceState,
  AiModelEvent,
  AiModelRecord,
  AiRiskAssessmentRecord,
  AiIncidentRecord,
  AiControlRecord,
  AiComplianceProgramRecord,
  AiSystemRecord,
  AiSystemLifecycleStatus,
  AiTrainingProgramRecord,
  AiVendorRecord,
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
  if (classification === 'to_be_determined' || classification === 'not_classified') return 'warning';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'warning';
  if (classification === 'general_purpose_ai') return 'primary';
  return 'default';
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatClassificationLabel(classification: AiClassification) {
  switch (classification) {
    case 'general_purpose_ai':
      return 'General Purpose AI';
    case 'foundation_model':
      return 'Foundation Model';
    case 'generative_ai':
      return 'Generative AI';
    case 'high_risk':
      return 'High Risk';
    case 'limited_risk':
      return 'Limited Risk';
    case 'minimal_risk':
      return 'Minimal Risk';
    case 'not_classified':
      return 'Not Classified';
    case 'to_be_determined':
      return 'To Be Determined';
    default:
      return formatLabel(classification);
  }
}

function formatLifecycleStatusLabel(status: AiSystemLifecycleStatus) {
  switch (status) {
    case 'intake':
      return 'Proposed';
    case 'validation':
      return 'Under Review';
    case 'production':
    case 'monitoring':
      return 'Active';
    default:
      return formatLabel(status);
  }
}

function formatAssessmentStatusLabel(status: string) {
  switch (status) {
    case 'in_review':
      return 'Under Review';
    default:
      return formatLabel(status);
  }
}

function formatCiaImpacts(ciaImpacts: AiCiaImpact[]) {
  return ciaImpacts.length ? ciaImpacts.join(', ') : 'Not set';
}

function formatPercentScore(value: number | null) {
  return value === null ? 'Not assessed' : `${value}%`;
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
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [state, setState] = useState<AiGovernanceState | null>(null);
  const [stateWorkspaceId, setStateWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const actionLock = useRef(false);
  const actionSequence = useRef(0);
  const stateRequestSequence = useRef(0);
  const modelHistoryRequestSequence = useRef(0);
  const currentWorkspaceIdRef = useRef(currentWorkspace.id);
  const stateWorkspaceIdRef = useRef('');
  currentWorkspaceIdRef.current = currentWorkspace.id;
  const [inventorySearch, setInventorySearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'all' | AiClassification>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | AiSystemLifecycleStatus>('all');
  const [ciaFilter, setCiaFilter] = useState<'all' | AiCiaImpact>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [entryKind, setEntryKind] = useState<AiEntryKind | null>(null);
  const [modelHistory, setModelHistory] = useState<Record<string, AiModelEvent[]>>({});
  const [selectedSystem, setSelectedSystem] = useState<AiSystemRecord | null>(null);
  const [rejectedModel, setRejectedModel] = useState<AiModelRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [complianceProgram, setComplianceProgram] = useState<AiComplianceProgramRecord | null>(null);

  const loadState = useCallback(async () => {
    const sequence = ++stateRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const nextState = await fetchAiGovernanceState();
      if (sequence !== stateRequestSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return;
      setState(nextState);
      stateWorkspaceIdRef.current = requestedWorkspaceId;
      setStateWorkspaceId(requestedWorkspaceId);
    } catch (err) {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        if (stateWorkspaceIdRef.current !== requestedWorkspaceId) setState(null);
        stateWorkspaceIdRef.current = requestedWorkspaceId;
        setStateWorkspaceId(requestedWorkspaceId);
        setError(err instanceof Error ? err.message : 'Unable to load AI governance state');
      }
    } finally {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const sequenceRef = stateRequestSequence;
    actionSequence.current++;
    actionLock.current = false;
    setWorking(null);
    modelHistoryRequestSequence.current++;
    setEntryKind(null);
    setModelHistory({});
    setSelectedSystem(null);
    setRejectedModel(null);
    setRejectionReason('');
    setComplianceProgram(null);
    void loadState();
    return () => { sequenceRef.current++; };
  }, [currentWorkspace.id, loadState]);

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
      { label: 'AI Systems', value: state.summary.aiSystems, detail: state.summary.aiInventoryCoverage === null ? 'Inventory coverage not recorded' : `${state.summary.aiInventoryCoverage}% recorded inventory coverage`, tone: 'primary' as const },
      { label: 'High-Risk AI', value: state.summary.highRiskAi, detail: `${state.summary.aiIncidents} incidents in oversight`, tone: state.summary.highRiskAi > 0 ? 'warning' as const : 'success' as const },
      { label: 'Compliance Score', value: formatPercentScore(state.summary.aiComplianceScore), detail: state.summary.aiComplianceScore === null ? 'No compliance programs assessed' : `${state.compliancePrograms.filter((item) => item.score < item.targetScore).length} programs below target`, tone: state.summary.aiComplianceScore !== null && state.summary.aiComplianceScore >= 80 ? 'success' as const : 'warning' as const },
      { label: 'Model Risk Score', value: formatPercentScore(state.summary.modelRiskScore), detail: state.summary.modelRiskScore === null ? 'No models assessed' : `${state.models.filter((item) => item.validationStatus !== 'validated').length} models need validation`, tone: state.summary.modelRiskScore !== null && state.summary.modelRiskScore >= 45 ? 'warning' as const : 'success' as const },
      { label: 'AI Maturity', value: formatPercentScore(state.summary.aiMaturityScore), detail: state.summary.responsibleAiScore === null ? 'Responsible AI evidence not assessed' : `${state.summary.responsibleAiScore}% responsible AI score`, tone: state.summary.aiMaturityScore !== null && state.summary.aiMaturityScore >= 80 ? 'success' as const : 'warning' as const },
    ];
  }, [state]);

  const filteredInventory = useMemo(() => {
    if (!state?.inventory) return [];
    const search = inventorySearch.trim().toLowerCase();
    return state.inventory.filter((system) => {
      const matchesSearch =
        !search ||
        [
          system.systemName,
          system.owner,
          system.businessUnit,
          system.vendor,
          system.useCase,
          system.dataType,
          system.industry,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      const matchesClassification = classificationFilter === 'all' || system.classification === classificationFilter;
      const matchesLifecycle = lifecycleFilter === 'all' || system.lifecycleStatus === lifecycleFilter;
      const matchesCia = ciaFilter === 'all' || system.ciaImpacts.includes(ciaFilter);
      const matchesProvider = providerFilter === 'all' || system.vendor === providerFilter;
      return matchesSearch && matchesClassification && matchesLifecycle && matchesCia && matchesProvider;
    });
  }, [classificationFilter, ciaFilter, inventorySearch, lifecycleFilter, providerFilter, state?.inventory]);

  const handleAction = async (key: string, action: () => Promise<void>) => {
    if (actionLock.current) return false;
    const operation = ++actionSequence.current;
    actionLock.current = true;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(key);
      await action();
      if (operation !== actionSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return false;
      await loadState();
      return operation === actionSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current;
    } catch (err) {
      if (operation === actionSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setError(err instanceof Error ? err.message : 'Action failed');
      }
      return false;
    } finally {
      if (operation === actionSequence.current) {
        actionLock.current = false;
        setWorking(null);
      }
    }
  };

  const createEntry = async (kind: AiEntryKind, payload: Record<string, unknown>) => {
    const saved = await handleAction(`create-${kind}`, async () => {
      if (kind === 'system') await createAiInventoryRecord(payload as Partial<AiSystemRecord>);
      else if (kind === 'assessment') await createAiAssessmentRecord(payload as Partial<AiRiskAssessmentRecord>);
      else if (kind === 'incident') await createAiIncidentRecord(payload as Partial<AiIncidentRecord>);
      else if (kind === 'model') await createAiModelRecord(payload as Partial<AiModelRecord>);
      else if (kind === 'control') await createAiControlRecord(payload as Partial<AiControlRecord>);
      else if (kind === 'vendor') await createAiVendorRecord(payload as Partial<AiVendorRecord>);
      else await createAiTrainingProgramRecord(payload as Partial<AiTrainingProgramRecord>);
    });
    if (!saved) throw new Error('The AI governance record was not saved. Review the recorded error and try again.');
  };

  const transitionModel = async (model: AiModelRecord, action: 'submit'|'approved'|'rejected') => {
    return handleAction(`model-${model.id}-${action}`, async () => {
      if (action === 'submit') await submitAiModelRecord(model.id);
      else await decideAiModelRecord(model.id, action, action === 'rejected' ? rejectionReason.trim() : undefined);
    });
  };

  const rejectModel = async () => {
    if (working || actionLock.current || !rejectedModel || rejectionReason.trim().length < 3) return;
    const rejected = await transitionModel(rejectedModel, 'rejected');
    if (!rejected) return;
    setRejectedModel(null);
    setRejectionReason('');
  };

  const openModelRejection = (model: AiModelRecord) => {
    if (working || actionLock.current) return;
    setRejectedModel(model);
    setRejectionReason('');
  };

  const closeModelRejection = () => {
    if (working || actionLock.current) return;
    setRejectedModel(null);
    setRejectionReason('');
  };

  const transitionSystem = async (system: AiSystemRecord, action: 'submit'|'approved'|'rejected') => {
    await handleAction(`system-${system.id}-${action}`, async () => {
      if (action === 'submit') await updateAiInventoryRecord(system.id, { lifecycleStatus: 'under_review' });
      else await decideAiInventoryRecord(system.id, action);
    });
  };

  const transitionAssessment = async (assessment: AiRiskAssessmentRecord, action: 'start'|'submit'|'approved'|'rejected'|'reassess') => {
    await handleAction(`assessment-${assessment.id}-${action}`, async () => {
      if (action === 'approved' || action === 'rejected') await decideAiAssessmentRecord(assessment.id, action);
      else await transitionAiAssessmentRecord(assessment.id, action === 'start' ? 'in_progress' : action === 'submit' ? 'under_review' : 'reassessment_required');
    });
  };

  const transitionControl = async (control: AiControlRecord, status: AiControlRecord['status']) => {
    await handleAction(`control-${control.id}-${status}`, async () => { await transitionAiControlRecord(control.id, status); });
  };

  const transitionIncident = async (incident: AiIncidentRecord, status: AiIncidentRecord['status']) => {
    await handleAction(`incident-${incident.id}-${status}`, async () => { await transitionAiIncidentRecord(incident.id, status); });
  };

  const recordModelValidation = async (model: AiModelRecord, validationStatus: 'validated'|'conditional') => {
    await handleAction(`model-${model.id}-${validationStatus}`, async () => {
      await updateAiModelRecord(model.id, { validationStatus });
    });
  };

  const toggleModelHistory = async (id: string) => {
    if (modelHistory[id]) {
      modelHistoryRequestSequence.current++;
      setModelHistory((current) => { const next = { ...current }; delete next[id]; return next; });
      return;
    }
    const sequence = ++modelHistoryRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    await handleAction(`model-${id}-history`, async () => {
      const history = await fetchAiModelHistory(id);
      if (sequence === modelHistoryRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setModelHistory((current) => ({ ...current, [id]: history }));
      }
    });
  };

  const openComplianceProgram = (program?: AiComplianceProgramRecord) => {
    if (working || actionLock.current) return;
    setComplianceProgram(program || {
      id: '', workspaceId: currentWorkspace.id, frameworkCode: 'EU_AI_ACT', frameworkName: 'EU AI Act',
      score: 0, targetScore: 100, gapCount: 0, controlCoveragePercent: 0, evidenceCoveragePercent: 0,
      documentationCoveragePercent: 0, trainingCoveragePercent: 0, status: 'watch', createdAt: '', updatedAt: '',
    });
  };

  const saveComplianceProgram = async (payload: Partial<AiComplianceProgramRecord>) => {
    const saved = await handleAction(`compliance-${payload.frameworkCode}`, async () => { await updateAiComplianceProgramRecord(payload); });
    if (saved) setComplianceProgram(null);
  };

  if (loading || stateWorkspaceId !== currentWorkspace.id) {
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

  if (error && (!state || stateWorkspaceId !== currentWorkspace.id)) {
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

  const stateData = stateWorkspaceId === currentWorkspace.id ? state! : null;
  if (!stateData) return null;
  const selectedAssessments = selectedSystem ? stateData.assessments.filter((item) => item.systemId === selectedSystem.id) : [];
  const selectedIncidents = selectedSystem ? stateData.incidents.filter((item) => item.systemId === selectedSystem.id || selectedSystem.linkedIncidentIds.includes(item.id)) : [];
  const selectedProviders = selectedSystem ? stateData.vendors.filter((item) => selectedSystem.linkedVendorIds.includes(item.id) || item.vendorName === selectedSystem.vendor) : [];
  const clearInventoryFilters = () => { setInventorySearch(''); setClassificationFilter('all'); setLifecycleFilter('all'); setCiaFilter('all'); setProviderFilter('all'); };
  const inventoryFiltered = Boolean(inventorySearch || classificationFilter !== 'all' || lifecycleFilter !== 'all' || ciaFilter !== 'all' || providerFilter !== 'all');

  return (
    <div style={pageStyle}>
      <PageHeader
        title="AI Governance Dashboard"
        description="Run AI inventory, model risk, responsible AI controls, EU AI Act readiness, ISO/IEC 42001 governance, and assurance oversight from one compact console."
        action={<Button variant="primary" disabled={Boolean(working)} onClick={() => void handleAction('report-board-ai', async () => { await generateAiGovernanceReport('board_ai_risk_pack'); })}>{working === 'report-board-ai' ? 'Generating...' : 'Generate Board AI Pack'}</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="outline" onClick={() => openComplianceProgram(stateData.compliancePrograms.find(program => program.frameworkCode === 'EU_AI_ACT'))} disabled={Boolean(working)}>Review EU AI Act Readiness</Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => setEntryKind('system')} disabled={Boolean(working)}>Register AI System</Button>
        <Button variant="outline" onClick={() => setEntryKind('assessment')} disabled={Boolean(working) || !stateData.inventory.length}>Run Risk Assessment</Button>
        <Button variant="outline" onClick={() => setEntryKind('incident')} disabled={Boolean(working) || !stateData.inventory.length}>Log AI Incident</Button>
        <Button variant="outline" onClick={() => void handleAction('report-eu', async () => { await generateAiGovernanceReport('eu_ai_act_report'); })} disabled={Boolean(working)}>EU AI Act Report</Button>
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}

      {stateData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="AI Governance Command Center"
              subtitle="Recorded inventory, assurance and model-risk context aligned to ISO/IEC 42001, EU AI Act, NIST AI RMF, and OECD AI Principles."
              action={<Badge variant={stateData.summary.aiComplianceScore !== null && stateData.summary.aiComplianceScore >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.aiComplianceScore === null ? 'Compliance not assessed' : `${stateData.summary.aiComplianceScore}% compliance`}</Badge>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Controls Coverage</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercentScore(stateData.summary.aiControlsCoverage)}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Control evidence and policy mapping coverage</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Assurance Status</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercentScore(stateData.summary.aiAssuranceStatus)}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Share of coverage-assessed systems recorded as assured</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Responsible AI Score</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercentScore(stateData.summary.responsibleAiScore)}</div>
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
                {stateData.modelRiskTrend.length ? <div style={{ marginTop: theme.spacing[1], display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[1] }}>
                  {stateData.modelRiskTrend.map((point) => (
                    <div key={point.month} style={{ textAlign: 'center' }}>
                      <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{ width: 18, borderRadius: theme.borderRadius.sm, height: `${Math.max(point.score, 6)}%`, backgroundColor: point.score >= 50 ? theme.colors.semantic.warning : theme.colors.primary }} />
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{point.month}</div>
                    </div>
                  ))}
                </div> : <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>No dated model-risk trend has been recorded. Current assessments are not converted into synthetic history.</div>}
              </div>
            </PageSectionCard>
          </div>

          <DataTableShell
            title="Enterprise AI Inventory"
            subtitle="Inventory register for AI systems, ownership, classification, CIA impact, deployment, compliance posture, assurance state, and linkage readiness."
            action={<Badge variant="default" size="sm">{filteredInventory.length} of {stateData.inventory.length} systems</Badge>}
          >
            <div style={{ marginBottom: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing[2] }}>
              <input
                value={inventorySearch}
                onChange={(event) => setInventorySearch(event.target.value)}
                placeholder="Search AI systems, owners, vendors, or use cases"
                style={{
                  width: '100%',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
              <select
                value={classificationFilter}
                onChange={(event) => setClassificationFilter(event.target.value as typeof classificationFilter)}
                style={{
                  width: '100%',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="all">All classifications</option>
                {Array.from(new Set(stateData.inventory.map((system) => system.classification))).map((classification) => (
                  <option key={classification} value={classification}>{formatClassificationLabel(classification)}</option>
                ))}
              </select>
              <select
                value={lifecycleFilter}
                onChange={(event) => setLifecycleFilter(event.target.value as typeof lifecycleFilter)}
                style={{
                  width: '100%',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="all">All lifecycle states</option>
                {Array.from(new Set(stateData.inventory.map((system) => system.lifecycleStatus))).map((status) => (
                  <option key={status} value={status}>{formatLifecycleStatusLabel(status)}</option>
                ))}
              </select>
              <select
                value={ciaFilter}
                onChange={(event) => setCiaFilter(event.target.value as typeof ciaFilter)}
                style={{
                  width: '100%',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="all">All CIA impacts</option>
                {(['Confidentiality', 'Integrity', 'Availability'] as AiCiaImpact[]).map((impact) => (
                  <option key={impact} value={impact}>{impact}</option>
                ))}
              </select>
              <select
                aria-label="Filter AI inventory by provider"
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                style={{
                  width: '100%',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="all">All recorded providers</option>
                {Array.from(new Set(stateData.inventory.map((system) => system.vendor).filter(Boolean))).sort().map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
              {inventoryFiltered ? <Button variant="outline" onClick={clearInventoryFilters}>Clear inventory filters</Button> : null}
            </div>
            <div style={{ marginBottom: theme.spacing[3], padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
              This register reports configured inventory and manually governed records only. It does not claim live AI app usage, sensitive-data movement, endpoint telemetry, automated blocking, or provider activity without an approved integration.
            </div>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
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
                {filteredInventory.map((system) => (
                  <tr key={system.id} tabIndex={0} onClick={() => setSelectedSystem(system)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSystem(system); } }} style={{ borderTop: `1px solid ${theme.colors.borderLight}`, cursor: 'pointer' }}>
                    <td style={{ padding: theme.spacing[3], verticalAlign: 'top' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{system.systemName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{system.businessUnit} · {system.vendor}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>CIA: {formatCiaImpacts(system.ciaImpacts)}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Links: {system.linkedRiskIds.length} risks · {system.linkedControlIds.length} controls · {system.linkedEvidenceIds.length} evidence</div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[1], flexWrap: 'wrap' }}>
                        {['proposed', 'intake', 'pilot'].includes(system.lifecycleStatus) ? <Button variant="outline" onClick={() => void transitionSystem(system, 'submit')} disabled={Boolean(working)}>Submit for review</Button> : null}
                        {['under_review', 'validation'].includes(system.lifecycleStatus) ? <><Button variant="primary" onClick={() => void transitionSystem(system, 'approved')} disabled={Boolean(working)}>Approve</Button><Button variant="outline" onClick={() => void transitionSystem(system, 'rejected')} disabled={Boolean(working)}>Reject</Button></> : null}
                      </div>
                    </td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{system.owner}</td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={classificationVariant(system.classification)} size="sm">{formatClassificationLabel(system.classification)}</Badge></td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={criticalityVariant(system.riskRating)} size="sm">{system.riskRating}</Badge></td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(system.complianceStatus)} size="sm">{formatLabel(system.complianceStatus)}</Badge></td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{formatLifecycleStatusLabel(system.lifecycleStatus)}</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{system.inventoryCoverageRecorded ? `${system.inventoryCoveragePercent}%` : 'Not recorded'}</td>
                    <td style={{ padding: theme.spacing[3] }}>{system.inventoryCoverageRecorded ? <Badge variant={statusVariant(system.assuranceStatus)} size="sm">{formatLabel(system.assuranceStatus)}</Badge> : 'Not assessed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>

          {selectedSystem ? (
            <PageSectionCard title={selectedSystem.systemName} subtitle="Selected AI system and its persisted data-protection, risk and assurance context." action={<Button variant="ghost" onClick={() => setSelectedSystem(null)}>Close</Button>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: theme.spacing[4] }}>
                <div style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start' }}>
                  <div><strong>Owner</strong><div>{selectedSystem.owner}</div></div>
                  <div><strong>Lifecycle</strong><div>{formatLifecycleStatusLabel(selectedSystem.lifecycleStatus)}</div></div>
                  <div><strong>Classification</strong><div>{formatClassificationLabel(selectedSystem.classification)}</div></div>
                  <div><strong>Recorded provider</strong><div>{selectedSystem.vendor || 'No provider recorded'}</div></div>
                  <div><strong>Data type</strong><div>{selectedSystem.dataType || 'No data type recorded'}</div></div>
                  <div><strong>CIA impact</strong><div>{formatCiaImpacts(selectedSystem.ciaImpacts)}</div></div>
                </div>
                <div style={{ display: 'grid', gap: theme.spacing[3], alignContent: 'start' }}>
                  <strong>Related governed records</strong>
                  <div>{selectedAssessments.length} risk assessment{selectedAssessments.length === 1 ? '' : 's'} · {selectedIncidents.length} AI incident{selectedIncidents.length === 1 ? '' : 's'} · {selectedProviders.length} provider assessment{selectedProviders.length === 1 ? '' : 's'}</div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    {selectedSystem.linkedRiskIds.map((id) => <Button key={id} size="sm" variant="outline" onClick={() => navigate(`/risks?search=${encodeURIComponent(id)}`)}>Risk {id}</Button>)}
                    {selectedSystem.linkedControlIds.map((id) => <Button key={id} size="sm" variant="outline" onClick={() => navigate(`/controls?search=${encodeURIComponent(id)}`)}>Control {id}</Button>)}
                    {selectedSystem.linkedEvidenceIds.map((id) => <Button key={id} size="sm" variant="outline" onClick={() => navigate(`/evidence?search=${encodeURIComponent(id)}`)}>Evidence {id}</Button>)}
                    {!selectedSystem.linkedRiskIds.length && !selectedSystem.linkedControlIds.length && !selectedSystem.linkedEvidenceIds.length ? <span style={{ color: theme.colors.text.secondary }}>No canonical risk, control or evidence links recorded.</span> : null}
                  </div>
                  {selectedAssessments.map((assessment) => <Card key={assessment.id} style={{ padding: theme.spacing[2], backgroundColor: theme.colors.surfaceHover }}><strong>{assessment.assessmentName}</strong><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{formatAssessmentStatusLabel(assessment.status)} · Privacy risk {assessment.privacyRisk} · Security risk {assessment.securityRisk}</div></Card>)}
                  {selectedIncidents.map((incident) => <Card key={incident.id} style={{ padding: theme.spacing[2], backgroundColor: theme.colors.surfaceHover }}><strong>{incident.title}</strong><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{formatLabel(incident.status)} · {formatLabel(incident.severity)} · {formatDate(incident.detectedAt)}</div></Card>)}
                </div>
                <div><strong>RACI and SoA context</strong><div style={{ marginTop: theme.spacing[3] }}><ControlGovernanceSummary controlIds={selectedSystem.linkedControlIds} /></div></div>
              </div>
              <div style={{ marginTop: theme.spacing[4] }}>
                <RelationshipExplorer entityType="ai_system" entityId={selectedSystem.id} onNavigate={(key) => navigate(`/${key}`)} />
              </div>
            </PageSectionCard>
          ) : null}

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
                        <Badge variant={statusVariant(model.validationStatus)} size="sm">{formatLabel(model.validationStatus)}</Badge>
                        <Badge variant={statusVariant(model.approvalStatus)} size="sm">{formatLabel(model.approvalStatus)}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Accuracy: <strong style={{ color: theme.colors.text.main }}>{model.accuracy}%</strong></div>
                      <div>Drift: <strong style={{ color: theme.colors.text.main }}>{model.drift}%</strong></div>
                      <div>Bias: <strong style={{ color: theme.colors.text.main }}>{model.biasScore}%</strong></div>
                      <div>Explainability: <strong style={{ color: theme.colors.text.main }}>{model.explainabilityScore}%</strong></div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Button variant="outline" onClick={() => void toggleModelHistory(model.id)} disabled={Boolean(working)}>{modelHistory[model.id] ? 'Hide history' : 'View history'}</Button>
                      {model.validationStatus === 'pending' ? <><Button variant="outline" onClick={() => void recordModelValidation(model, 'validated')} disabled={Boolean(working)}>Record validated</Button><Button variant="outline" onClick={() => void recordModelValidation(model, 'conditional')} disabled={Boolean(working)}>Record conditional</Button></> : null}
                      {(model.approvalStatus === 'pending' || model.approvalStatus === 'rejected') ? <Button variant="outline" onClick={() => void transitionModel(model, 'submit')} disabled={Boolean(working) || (model.validationStatus !== 'validated' && model.validationStatus !== 'conditional')}>Submit for review</Button> : null}
                      {model.approvalStatus === 'in_review' ? <><Button variant="primary" onClick={() => void transitionModel(model, 'approved')} disabled={Boolean(working)}>Approve</Button><Button variant="outline" onClick={() => openModelRejection(model)} disabled={Boolean(working)}>Reject</Button></> : null}
                    </div>
                    {modelHistory[model.id] ? <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{modelHistory[model.id].length ? modelHistory[model.id].map((event) => <div key={event.id}><strong>{event.eventType.replaceAll('_', ' ')}</strong> · {new Date(event.createdAt).toLocaleString('en-GB')}{event.notes ? ` · ${event.notes}` : ''}</div>) : <div>No lifecycle events recorded.</div>}</div> : null}
                  </Card>
                ))}
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Button variant="outline" onClick={() => setEntryKind('model')} disabled={Boolean(working) || !stateData.inventory.length}>Add Model</Button>
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
                        <Badge variant={statusVariant(assessment.status)} size="sm">{formatAssessmentStatusLabel(assessment.status)}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Bias {assessment.biasRisk}</div>
                      <div>Privacy {assessment.privacyRisk}</div>
                      <div>Hallucination {assessment.hallucinationRisk}</div>
                      <div>Regulatory {assessment.regulatoryRisk}</div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      {['draft', 'not_started', 'awaiting_information', 'rejected', 'reassessment_required'].includes(assessment.status) ? <Button variant="outline" onClick={() => void transitionAssessment(assessment, 'start')} disabled={Boolean(working)}>Start assessment</Button> : null}
                      {['in_progress', 'remediation_required'].includes(assessment.status) ? <Button variant="outline" onClick={() => void transitionAssessment(assessment, 'submit')} disabled={Boolean(working)}>Submit for review</Button> : null}
                      {['under_review', 'in_review'].includes(assessment.status) ? <><Button variant="primary" onClick={() => void transitionAssessment(assessment, 'approved')} disabled={Boolean(working)}>Approve</Button><Button variant="outline" onClick={() => void transitionAssessment(assessment, 'rejected')} disabled={Boolean(working)}>Reject</Button></> : null}
                      {['approved', 'completed'].includes(assessment.status) ? <Button variant="outline" onClick={() => void transitionAssessment(assessment, 'reassess')} disabled={Boolean(working)}>Request reassessment</Button> : null}
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
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                        <div>{control.controlName}</div>
                        <div style={{ marginTop: theme.spacing[1], display: 'flex', gap: theme.spacing[1], flexWrap: 'wrap' }}>
                          {control.status !== 'implemented' ? <Button variant="outline" onClick={() => void transitionControl(control, 'implemented')} disabled={Boolean(working)}>Mark implemented</Button> : null}
                          {control.status !== 'needs_attention' ? <Button variant="outline" onClick={() => void transitionControl(control, 'needs_attention')} disabled={Boolean(working)}>Needs attention</Button> : null}
                          {control.status === 'needs_attention' ? <Button variant="outline" onClick={() => void transitionControl(control, 'planned')} disabled={Boolean(working)}>Return to planned</Button> : null}
                        </div>
                      </td>
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
                <Button variant="outline" onClick={() => setEntryKind('control')} disabled={Boolean(working)}>Add AI Control</Button>
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
                  <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    {incident.status !== 'resolved' && incident.status !== 'investigating' ? <Button variant="outline" onClick={() => void transitionIncident(incident, 'investigating')} disabled={Boolean(working)}>Investigate</Button> : null}
                    {incident.status === 'investigating' || incident.status === 'reported' ? <Button variant="primary" onClick={() => void transitionIncident(incident, 'resolved')} disabled={Boolean(working)}>Resolve</Button> : null}
                    {incident.status !== 'resolved' && incident.status !== 'reported' ? <Button variant="outline" onClick={() => void transitionIncident(incident, 'reported')} disabled={Boolean(working)}>Mark reported</Button> : null}
                  </div>
                </Card>
              ))}
              <div style={{ marginTop: theme.spacing[1] }}>
                <Button variant="outline" onClick={() => setEntryKind('incident')} disabled={Boolean(working) || !stateData.inventory.length}>Raise Incident</Button>
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
                        <Button variant="outline" size="sm" disabled={Boolean(working)} onClick={() => openComplianceProgram(program)}>Review</Button>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
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
                  <Button variant="outline" onClick={() => setEntryKind('vendor')} disabled={Boolean(working)}>Record AI Vendor</Button>
                  <Button variant="outline" onClick={() => setEntryKind('training')} disabled={Boolean(working)}>Plan Training Program</Button>
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
              <Button variant="outline" disabled={Boolean(working)} onClick={() => void handleAction('report-ai-governance', async () => { await generateAiGovernanceReport('ai_governance_report'); })}>{working === 'report-ai-governance' ? 'Generating...' : 'AI Governance Report'}</Button>
              <Button variant="outline" disabled={Boolean(working)} onClick={() => void handleAction('report-model-risk', async () => { await generateAiGovernanceReport('model_risk_report'); })}>{working === 'report-model-risk' ? 'Generating...' : 'Model Risk Report'}</Button>
              <Button variant="outline" disabled={Boolean(working)} onClick={() => void handleAction('report-iso', async () => { await generateAiGovernanceReport('iso42001_report'); })}>{working === 'report-iso' ? 'Generating...' : 'ISO 42001 Report'}</Button>
              <Button variant="outline" disabled={Boolean(working)} onClick={() => void handleAction('report-exec', async () => { await generateAiGovernanceReport('executive_ai_dashboard'); })}>{working === 'report-exec' ? 'Generating...' : 'Executive AI Dashboard'}</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: theme.spacing[3] }}>
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
          actions={<Button variant="primary" onClick={() => setEntryKind('system')}>Register First AI System</Button>}
        />
      )}
      <AiGovernanceEntryModal key={`${currentWorkspace.id}-${entryKind || 'closed'}`} kind={entryKind} systems={stateData.inventory} incidents={stateData.incidents} onClose={() => setEntryKind(null)} onSubmit={createEntry} />
      <ComplianceProgramModal program={complianceProgram} busy={Boolean(working)} onClose={() => { if (!working && !actionLock.current) setComplianceProgram(null); }} onSubmit={saveComplianceProgram} />
      <Modal
        accessibleDialog
        isOpen={Boolean(rejectedModel)}
        onClose={closeModelRejection}
        title={rejectedModel ? `Reject model: ${rejectedModel.modelName}` : 'Reject model'}
        width="620px"
        footer={<><Button variant="outline" onClick={closeModelRejection} disabled={Boolean(working)}>Cancel</Button><Button variant="danger" onClick={() => void rejectModel()} disabled={Boolean(working) || rejectionReason.trim().length < 3}>{working ? 'Rejecting...' : 'Reject model'}</Button></>}
      >
        <label htmlFor="ai-model-rejection-reason" aria-busy={Boolean(working)} style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>
          Rejection rationale
          <textarea
            id="ai-model-rejection-reason"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            disabled={Boolean(working)}
            rows={5}
            required
            autoFocus
            placeholder="Explain why this model cannot be approved and what must change before resubmission."
            style={{ width: '100%', resize: 'vertical', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, color: theme.colors.text.main, backgroundColor: theme.colors.surface, font: 'inherit' }}
          />
        </label>
        <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>A rationale of at least 3 characters is required and will be retained with the model decision.</div>
      </Modal>
    </div>
  );
}

export default AiGovernance;

function ComplianceProgramModal({ program, busy, onClose, onSubmit }: { program: AiComplianceProgramRecord | null; busy: boolean; onClose: () => void; onSubmit: (payload: Partial<AiComplianceProgramRecord>) => Promise<void> }) {
  if (!program) return null;
  const number = (data: FormData, name: string) => Number(data.get(name));
  const inputStyle = { width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
  return <Modal accessibleDialog isOpen onClose={onClose} title={`Review readiness: ${program.frameworkName}`} width="760px">
    <form aria-busy={busy} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSubmit({ frameworkCode: String(data.get('frameworkCode')) as AiComplianceProgramRecord['frameworkCode'], frameworkName: String(data.get('frameworkName')).trim(), score: number(data, 'score'), targetScore: number(data, 'targetScore'), gapCount: number(data, 'gapCount'), controlCoveragePercent: number(data, 'controlCoveragePercent'), evidenceCoveragePercent: number(data, 'evidenceCoveragePercent'), documentationCoveragePercent: number(data, 'documentationCoveragePercent'), trainingCoveragePercent: number(data, 'trainingCoveragePercent'), status: String(data.get('status')) as AiComplianceProgramRecord['status'] }); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: theme.spacing[4] }}>
        <label style={{ display: 'grid', gap: theme.spacing[1] }}>Framework{program.id ? <input type="hidden" name="frameworkCode" value={program.frameworkCode}/> : null}<select name={program.id ? undefined : 'frameworkCode'} defaultValue={program.frameworkCode} disabled={busy || Boolean(program.id)} style={inputStyle}>{[['EU_AI_ACT','EU AI Act'],['ISO42001','ISO/IEC 42001'],['NIST_AI_RMF','NIST AI RMF'],['OECD_AI','OECD AI Principles'],['RESPONSIBLE_AI','Responsible AI']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{program.id ? <small>The framework identity cannot be changed after it is recorded.</small> : null}</label>
        <label style={{ display: 'grid', gap: theme.spacing[1] }}>Framework name<input name="frameworkName" required minLength={3} maxLength={160} defaultValue={program.frameworkName} style={inputStyle}/></label>
        {[['score','Recorded readiness score',program.score],['targetScore','Target score',program.targetScore],['controlCoveragePercent','Control coverage',program.controlCoveragePercent],['evidenceCoveragePercent','Evidence coverage',program.evidenceCoveragePercent],['documentationCoveragePercent','Documentation coverage',program.documentationCoveragePercent],['trainingCoveragePercent','Training coverage',program.trainingCoveragePercent]].map(([name,label,value]) => <label key={String(name)} style={{ display: 'grid', gap: theme.spacing[1] }}>{label} (%)<input name={String(name)} type="number" min={0} max={100} step={1} required defaultValue={Number(value)} style={inputStyle}/></label>)}
        <label style={{ display: 'grid', gap: theme.spacing[1] }}>Recorded gaps<input name="gapCount" type="number" min={0} max={100000} step={1} required defaultValue={program.gapCount} style={inputStyle}/></label>
        <label style={{ display: 'grid', gap: theme.spacing[1] }}>Review status<select name="status" defaultValue={program.status} style={inputStyle}><option value="healthy">Healthy</option><option value="watch">Watch</option><option value="critical">Critical</option></select></label>
      </fieldset>
      <p style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Enter reviewed values from authorised governance evidence. LAFLO does not calculate these values from live AI monitoring or provider telemetry.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving assessment...' : 'Save readiness assessment'}</Button></div>
    </form>
  </Modal>;
}
