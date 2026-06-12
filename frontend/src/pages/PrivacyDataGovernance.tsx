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
  createConsentEntry,
  createDataDiscoveryEntry,
  createDataGovernanceEntry,
  createDataInventoryEntry,
  createDpiaEntry,
  createDsarEntry,
  createPrivacyAuditEntry,
  createPrivacyBreachEntry,
  createPrivacyRiskEntry,
  createRetentionEntry,
  createRopaEntry,
  createThirdPartyPrivacyEntry,
  createTransferEntry,
  fetchPrivacyState,
  generatePrivacyReport,
} from '../lib/api';
import { theme } from '../theme';
import type {
  DataInventoryRecord,
  DpiaRecord,
  PrivacyClassification,
  PrivacySeverity,
  PrivacyState,
} from '../types/privacy';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function statusVariant(status: string) {
  if (status === 'healthy' || status === 'complete' || status === 'approved' || status === 'granted' || status === 'completed') return 'success';
  if (status === 'critical' || status === 'open' || status === 'rejected' || status === 'overdue') return 'danger';
  if (status === 'watch' || status === 'in_progress' || status === 'in_review' || status === 'investigating' || status === 'planned' || status === 'submitted') return 'warning';
  return 'default';
}

function severityVariant(level: PrivacySeverity) {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  return 'default';
}

function classificationVariant(classification: PrivacyClassification) {
  if (classification === 'Protected Health Information' || classification === 'Payment Card Data' || classification === 'Special Category Data') return 'danger';
  if (classification === 'Sensitive Personal Data' || classification === 'Highly Restricted' || classification === 'Personal Data') return 'warning';
  return 'default';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not scheduled';
}

function riskBadge(score: number) {
  if (score >= 75) return 'danger';
  if (score >= 50) return 'warning';
  return 'success';
}

export function PrivacyDataGovernance() {
  const [state, setState] = useState<PrivacyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      setState(await fetchPrivacyState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load privacy data governance state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

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

  const metrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'Privacy Score', value: '0%', detail: 'Loading command center', tone: 'default' as const },
        { label: 'PII Assets', value: 0, detail: 'Loading inventory', tone: 'default' as const },
        { label: 'Open Risks', value: 0, detail: 'Loading risk exposure', tone: 'default' as const },
        { label: 'DSAR Queue', value: 0, detail: 'Loading requests', tone: 'default' as const },
        { label: 'Retention', value: '0%', detail: 'Loading lifecycle posture', tone: 'default' as const },
      ];
    }
    return [
      { label: 'Privacy Score', value: `${state.summary.complianceScore}%`, detail: state.executiveView.complianceStatus, tone: state.summary.complianceScore >= 80 ? 'success' as const : 'warning' as const },
      { label: 'PII Assets', value: state.summary.piiAssets, detail: `${state.summary.sensitiveDataAssets} sensitive assets`, tone: 'primary' as const },
      { label: 'Open Risks', value: state.summary.openPrivacyRisks, detail: `${state.summary.dataBreaches} open breaches`, tone: state.summary.openPrivacyRisks > 3 ? 'danger' as const : 'warning' as const },
      { label: 'DSAR Queue', value: state.summary.dsarRequests, detail: `${state.summary.openDpias} open DPIAs`, tone: 'warning' as const },
      { label: 'Retention', value: `${state.summary.retentionCompliance}%`, detail: `${state.summary.thirdPartyProcessors} processors in scope`, tone: state.summary.retentionCompliance >= 80 ? 'success' as const : 'warning' as const },
    ];
  }, [state]);

  const addInventory = async () => {
    await createDataInventoryEntry({
      dataAssetId: `DA-${Date.now().toString().slice(-4)}`,
      dataAssetName: `Customer support transcript vault ${Date.now().toString().slice(-4)}`,
      businessOwner: 'Chief Customer Officer',
      custodian: 'Data Platform Team',
      location: 'EU data lake',
      systemName: 'Support Lakehouse',
      application: 'Service Console',
      department: 'Customer Operations',
      country: 'Germany',
      jurisdiction: 'EU',
      dataCategory: 'Customer service records',
      sensitivityLevel: 'High',
      classification: 'Sensitive Personal Data',
      retentionRequirement: '24 months',
      legalBasis: 'Legitimate interest',
      status: 'in_progress',
      classificationRiskScore: 74,
    } satisfies Partial<DataInventoryRecord>);
  };

  const addRopa = async () => {
    await createRopaEntry({
      processingActivity: `Customer analytics workflow ${Date.now().toString().slice(-4)}`,
      purpose: 'Trend analysis and product quality improvement',
      legalBasis: 'Legitimate interest',
      dataCategories: ['Usage data', 'Support transcripts'],
      dataSubjects: ['Customers'],
      recipients: ['Analytics team'],
      crossBorderTransfers: ['US support analytics region'],
      retentionPeriod: '18 months',
      securityMeasures: ['Encryption', 'Access reviews'],
      controllers: ['Sochrist Ventures'],
      processors: ['Analytics Processor'],
      reviewDate: new Date('2026-12-31').toISOString(),
      status: 'watch',
    });
  };

  const addDpia = async () => {
    await createDpiaEntry({
      assessmentName: `Claims review DPIA ${Date.now().toString().slice(-4)}`,
      owner: 'Data Protection Officer',
      purpose: 'Assess privacy impact of automated review workflow',
      riskRating: 'high',
      likelihood: 4,
      impact: 5,
      controls: ['Encryption', 'Role segregation', 'Human review'],
      residualRisk: 62,
      approvalStatus: 'in_review',
      reviewDate: new Date('2026-10-31').toISOString(),
      evidence: ['Architecture diagram', 'Use case assessment'],
      linkedRiskIds: [],
      linkedControlIds: [],
      linkedAssetIds: [],
      linkedAiSystemIds: [],
      linkedVendorIds: [],
    } satisfies Partial<DpiaRecord>);
  };

  const addRisk = async () => {
    await createPrivacyRiskEntry({
      title: `Cross-border consent mismatch ${Date.now().toString().slice(-4)}`,
      category: 'cross_border',
      severity: 'high',
      status: 'identified',
      owner: 'Privacy Manager',
      riskScore: 71,
      mitigation: 'Align consent language, transfer notices, and transfer impact assessments.',
    });
  };

  const addConsent = async () => {
    await createConsentEntry({
      consentType: 'Marketing consent',
      purpose: 'Email marketing',
      dataSubject: `Subject ${Date.now().toString().slice(-4)}`,
      collectionMethod: 'Web form',
      dateCollected: new Date().toISOString(),
      expirationDate: new Date('2027-06-30').toISOString(),
      status: 'granted',
      evidence: 'Preference center capture',
      consentHistory: ['Captured with double opt-in'],
    });
  };

  const addDsar = async () => {
    await createDsarEntry({
      requestId: `DSAR-${Date.now().toString().slice(-4)}`,
      requestType: 'access',
      dataSubject: 'Alex Morgan',
      submissionDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 21 * 86400000).toISOString(),
      status: 'submitted',
      owner: 'Privacy Analyst',
      evidence: ['Identity verification pending'],
      slaCompliant: true,
    });
  };

  const addBreach = async () => {
    await createPrivacyBreachEntry({
      breachType: `Misrouted data extract ${Date.now().toString().slice(-4)}`,
      discoveryDate: new Date().toISOString(),
      affectedRecords: 184,
      affectedIndividuals: 112,
      rootCause: 'Routing rule applied to the wrong export queue',
      riskLevel: 'high',
      regulatorNotificationStatus: 'required',
      customerNotificationStatus: 'not_required',
      remediation: 'Disable export path and revalidate routing controls.',
      status: 'investigating',
    });
  };

  const addRetention = async () => {
    await createRetentionEntry({
      assetName: `Archive cohort ${Date.now().toString().slice(-4)}`,
      retentionPeriod: '36 months',
      legalHold: false,
      deletionSchedule: 'Quarterly batch purge',
      archiveStatus: 'healthy',
      disposalStatus: 'planned',
      reviewDate: new Date('2026-11-15').toISOString(),
      violationStatus: 'watch',
    });
  };

  const addTransfer = async () => {
    await createTransferEntry({
      transferName: `Support analytics sync ${Date.now().toString().slice(-4)}`,
      transferType: 'cross_border',
      transferMechanism: 'SCCs',
      jurisdiction: 'United States',
      sccInPlace: true,
      bcrInPlace: false,
      transferRiskRating: 'medium',
      reviewDate: new Date('2026-09-30').toISOString(),
    });
  };

  const addThirdParty = async () => {
    await createThirdPartyPrivacyEntry({
      vendorName: `Processor ${Date.now().toString().slice(-4)}`,
      role: 'processor',
      privacyAssessmentStatus: 'watch',
      dataTransferRisk: 'high',
      dpaStatus: 'watch',
      complianceRating: 69,
      privacyIncidentCount: 0,
      contractClauses: ['DPA', 'SCCs'],
    });
  };

  const addGovernance = async () => {
    await createDataGovernanceEntry({
      dataDomain: `Customer identity ${Date.now().toString().slice(-4)}`,
      dataOwner: 'Head of Identity',
      dataSteward: 'Privacy Steward',
      dataCustodian: 'Platform Engineering',
      dataQualityScore: 78,
      lifecycleStage: 'Operational',
      glossaryTerm: 'Customer master identity',
      status: 'watch',
    });
  };

  const addDiscovery = async () => {
    await createDataDiscoveryEntry({
      repositoryName: `S3 archive ${Date.now().toString().slice(-4)}`,
      repositoryType: 'cloud_service',
      piiLocations: ['customer/profile', 'tickets/attachments'],
      sensitiveDataLocations: ['medical-notes'],
      dataFlowMapping: ['App -> ETL -> Archive'],
      owner: 'Data Engineering',
      status: 'in_progress',
    });
  };

  const addAudit = async () => {
    await createPrivacyAuditEntry({
      auditName: `Transfer mechanism review ${Date.now().toString().slice(-4)}`,
      auditType: 'third_party',
      status: 'planned',
      findingsCount: 0,
      recommendationsCount: 2,
      owner: 'Internal Audit',
      dueDate: new Date('2026-10-20').toISOString(),
    });
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Privacy & Data Governance Platform" description="Unified command center for privacy, data governance, records of processing, DPIAs, DSARs, breaches, retention, transfers, and executive oversight." />
        <PageSectionCard title="Loading privacy command center">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Loading privacy frameworks, inventory, RoPA, DPIAs, DSARs, breach management, and governance signals...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Privacy & Data Governance Platform" description="Unified command center for privacy, data governance, records of processing, DPIAs, DSARs, breaches, retention, transfers, and executive oversight." />
        <EmptyStatePanel
          eyebrow="Privacy"
          title="Unable to load privacy data governance"
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
        title="Privacy & Data Governance Platform"
        description="Run data inventory, classification, RoPA, DPIAs, privacy risk, consent, DSAR, breach, retention, transfer, third-party privacy, and board-ready reporting from one enterprise privacy console."
        action={<Button variant="primary" onClick={() => void handleAction('report-board-privacy', async () => { await generatePrivacyReport('board_privacy_pack'); })}>Generate Board Privacy Pack</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="outline" onClick={() => void handleAction('report-gdpr', async () => { await generatePrivacyReport('gdpr_report'); })} disabled={Boolean(working)}>GDPR Report</Button>
            <Button variant="outline" onClick={() => void handleAction('report-dsar', async () => { await generatePrivacyReport('dsar_report'); })} disabled={Boolean(working)}>DSAR Report</Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => void handleAction('inventory', addInventory)} disabled={Boolean(working)}>Add Data Asset</Button>
        <Button variant="outline" onClick={() => void handleAction('dpia', addDpia)} disabled={Boolean(working)}>Launch DPIA</Button>
        <Button variant="outline" onClick={() => void handleAction('breach', addBreach)} disabled={Boolean(working)}>Log Breach</Button>
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
              title="Privacy Command Center"
              subtitle="Board-facing privacy score across inventory, data subject rights, risk, transfers, retention, incidents, and audits."
              action={<Badge variant={stateData.summary.complianceScore >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.complianceScore}% privacy score</Badge>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                {[
                  { label: 'Inventory', value: stateData.dataInventory.length, detail: `${stateData.summary.piiAssets} PII assets` },
                  { label: 'RoPA', value: stateData.ropaRecords.length, detail: `${stateData.frameworks.length} frameworks` },
                  { label: 'DPIAs', value: stateData.summary.openDpias, detail: `${stateData.dpias.length} assessments` },
                  { label: 'DSARs', value: stateData.summary.dsarRequests, detail: stateData.executiveView.dsarPerformance },
                  { label: 'Transfers', value: stateData.transfers.length, detail: stateData.executiveView.dataTransferRisk },
                ].map((item) => (
                  <Card key={item.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{item.value}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.detail}</div>
                  </Card>
                ))}
              </div>
              <div style={{ marginTop: theme.spacing[4], display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                {stateData.analytics.privacyTrend.map((point) => (
                  <div key={point.month} style={{ textAlign: 'center' }}>
                    <div style={{ height: 72, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ width: 18, height: `${Math.max(point.score, 10)}%`, borderRadius: theme.borderRadius.sm, backgroundColor: point.score >= 80 ? theme.colors.semantic.success : theme.colors.primary }} />
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{point.month}</div>
                  </div>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Executive Privacy View"
              subtitle="Compact decision view for privacy risk, incidents, transfers, processors, and retention posture."
              action={<Badge variant={stateData.summary.dataBreaches > 0 ? 'warning' : 'success'} size="sm">{stateData.summary.dataBreaches} active incidents</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {[
                  ['Open privacy risks', `${stateData.executiveView.openPrivacyRisks}`],
                  ['DSAR performance', stateData.executiveView.dsarPerformance],
                  ['Third-party exposure', stateData.executiveView.thirdPartyExposure],
                  ['Transfers', stateData.executiveView.dataTransferRisk],
                  ['Retention', stateData.executiveView.retentionCompliance],
                ].map(([label, value]) => (
                  <Card key={label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, fontWeight: theme.typography.weights.semibold }}>{value}</div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <DataTableShell
            title="Data Inventory & Classification"
            subtitle="Business-owned catalog of personal and sensitive data with location, legal basis, retention, and classification risk."
            action={<Badge variant="default" size="sm">{stateData.dataInventory.length} assets</Badge>}
          >
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Data Asset</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Owner</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>System</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Region</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Classification</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Legal Basis</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Risk</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stateData.dataInventory.map((item) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                      <div>{item.dataAssetName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.dataCategory} · {item.retentionRequirement}</div>
                    </td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{item.businessOwner}</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{item.systemName}</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{item.jurisdiction}</td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={classificationVariant(item.classification)} size="sm">{item.classification}</Badge></td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{item.legalBasis}</td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={riskBadge(item.classificationRiskScore)} size="sm">{item.classificationRiskScore}</Badge></td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(item.status)} size="sm">{item.status.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: theme.spacing[3], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => void handleAction('inventory-add', addInventory)} disabled={Boolean(working)}>Add Inventory Record</Button>
              <Button variant="outline" onClick={() => void handleAction('discovery', addDiscovery)} disabled={Boolean(working)}>Run Discovery Mapping</Button>
            </div>
          </DataTableShell>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="RoPA Register"
              subtitle="Processing activities, purposes, legal basis, recipients, controllers, processors, and transfer context."
              action={<Button variant="outline" onClick={() => void handleAction('ropa', addRopa)} disabled={Boolean(working)}>Add Processing Activity</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.ropaRecords.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.processingActivity}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.purpose} · review {formatDate(item.reviewDate)}</div>
                      </div>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {item.legalBasis} · {item.recipients.join(', ')} · transfers {item.crossBorderTransfers.join(', ') || 'None'}
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="DPIA Workbench"
              subtitle="Risk-based DPIA queue with control evidence, residual risk, and approval state."
              action={<Button variant="outline" onClick={() => void handleAction('dpia-add', addDpia)} disabled={Boolean(working)}>Create DPIA</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.dpias.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.assessmentName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.owner} · review {formatDate(item.reviewDate)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Badge variant={severityVariant(item.riskRating)} size="sm">{item.riskRating}</Badge>
                        <Badge variant={statusVariant(item.approvalStatus)} size="sm">{item.approvalStatus.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Likelihood {item.likelihood}</div>
                      <div>Impact {item.impact}</div>
                      <div>Residual {item.residualRisk}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 0.95fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="Privacy Risk Register"
              subtitle="Unauthorized access, leakage, consent, transfer, retention, third-party, AI privacy, and data accuracy exposure."
              action={<Button variant="outline" onClick={() => void handleAction('risk-add', addRisk)} disabled={Boolean(working)}>Add Privacy Risk</Button>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Risk</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Category</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Severity</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Score</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Owner</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.risks.map((risk) => (
                    <tr key={risk.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                        <div>{risk.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{risk.mitigation}</div>
                      </td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{risk.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={severityVariant(risk.severity)} size="sm">{risk.severity}</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={riskBadge(risk.riskScore)} size="sm">{risk.riskScore}</Badge></td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{risk.owner}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(risk.status)} size="sm">{risk.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <ActivityFeed
              title="Consent & DSAR Operations"
              subtitle="Consent lifecycle and subject rights workflow with SLA visibility and evidence status."
              countLabel={`${stateData.consents.length + stateData.dsars.length} records`}
            >
              {stateData.consents.slice(0, 4).map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.dataSubject}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.consentType} · {item.purpose}</div>
                    </div>
                    <Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge>
                  </div>
                </Card>
              ))}
              {stateData.dsars.slice(0, 4).map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.requestId}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.dataSubject} · due {formatDate(item.dueDate)}</div>
                    </div>
                    <Badge variant={statusVariant(item.status)} size="sm">{item.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </Card>
              ))}
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={() => void handleAction('consent-add', addConsent)} disabled={Boolean(working)}>Add Consent</Button>
                <Button variant="outline" onClick={() => void handleAction('dsar-add', addDsar)} disabled={Boolean(working)}>Open DSAR</Button>
              </div>
            </ActivityFeed>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <ActivityFeed
              title="Breach, Transfer & Third-Party Privacy"
              subtitle="Incident response, regulator notifications, transfer mechanisms, processors, and privacy contract posture."
              countLabel={`${stateData.breaches.length + stateData.transfers.length + stateData.thirdParties.length} records`}
            >
              {stateData.breaches.map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.breachType}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.affectedIndividuals} individuals · {formatDate(item.discoveryDate)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Badge variant={severityVariant(item.riskLevel)} size="sm">{item.riskLevel}</Badge>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge>
                    </div>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.remediation}</div>
                </Card>
              ))}
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={() => void handleAction('breach-add', addBreach)} disabled={Boolean(working)}>Add Breach</Button>
                <Button variant="outline" onClick={() => void handleAction('retention-add', addRetention)} disabled={Boolean(working)}>Update Retention</Button>
                <Button variant="outline" onClick={() => void handleAction('transfer-add', addTransfer)} disabled={Boolean(working)}>Add Transfer</Button>
                <Button variant="outline" onClick={() => void handleAction('third-party-add', addThirdParty)} disabled={Boolean(working)}>Add Processor</Button>
              </div>
            </ActivityFeed>

            <PageSectionCard
              title="Data Governance Center"
              subtitle="Governance ownership, lineage, quality, discovery, and lifecycle operating context."
              action={<Button variant="outline" onClick={() => void handleAction('governance-add', addGovernance)} disabled={Boolean(working)}>Add Governance Record</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.governanceRecords.slice(0, 3).map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.dataDomain}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.dataOwner} · {item.lifecycleStage}</div>
                      </div>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.dataQualityScore}%</Badge>
                    </div>
                  </Card>
                ))}
                {stateData.qualityRecords.slice(0, 2).map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.datasetName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.remediationAction}</div>
                      </div>
                      <Badge variant={item.qualityScore >= 80 ? 'success' : 'warning'} size="sm">{item.qualityScore}%</Badge>
                    </div>
                  </Card>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  <div>Lineage maps: <strong style={{ color: theme.colors.text.main }}>{stateData.lineages.length}</strong></div>
                  <div>Discovery scans: <strong style={{ color: theme.colors.text.main }}>{stateData.discoveryRecords.length}</strong></div>
                </div>
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Privacy Compliance Engine"
              subtitle="Framework readiness for GDPR, POPIA, ISO 27701, NIST Privacy Framework, HIPAA Privacy, and related obligations."
              action={<Badge variant={stateData.summary.complianceScore >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.complianceScore}% readiness</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.compliancePrograms.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.frameworkName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.gapCount} gaps · target {item.targetScore}%</div>
                      </div>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.score}%</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Evidence {item.evidenceCoveragePercent}%</div>
                      <div>Controls {item.controlCoveragePercent}%</div>
                      <div>Risk {item.riskExposureScore}%</div>
                      <div>Readiness {item.readinessPercent}%</div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Privacy Audit & Reporting"
              subtitle="Audit center and reporting packs for board, executive, regulatory, DPIA, DSAR, and governance oversight."
              action={<Badge variant="default" size="sm">{stateData.reports.length} reports</Badge>}
            >
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', marginBottom: theme.spacing[3] }}>
                <Button variant="outline" onClick={() => void handleAction('report-iso27701', async () => { await generatePrivacyReport('iso27701_report'); })} disabled={Boolean(working)}>ISO 27701 Report</Button>
                <Button variant="outline" onClick={() => void handleAction('report-risk', async () => { await generatePrivacyReport('privacy_risk_report'); })} disabled={Boolean(working)}>Privacy Risk Report</Button>
                <Button variant="outline" onClick={() => void handleAction('report-governance', async () => { await generatePrivacyReport('data_governance_report'); })} disabled={Boolean(working)}>Data Governance Report</Button>
                <Button variant="outline" onClick={() => void handleAction('audit-add', addAudit)} disabled={Boolean(working)}>Add Audit</Button>
              </div>
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.audits.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.auditName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.auditType} · due {formatDate(item.dueDate)}</div>
                      </div>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.findingsCount} findings</Badge>
                    </div>
                  </Card>
                ))}
                {stateData.reports.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.generatedBy} · {formatDate(item.generatedAt)}</div>
                      </div>
                      <Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>
        </>
      ) : (
        <EmptyStatePanel
          eyebrow="Privacy"
          title="No privacy program data available"
          description="Register a data asset, launch a DPIA, or create a DSAR record to activate the privacy and data governance command center."
          actions={<Button variant="primary" onClick={() => void handleAction('inventory-init', addInventory)}>Register First Data Asset</Button>}
        />
      )}
    </div>
  );
}

export default PrivacyDataGovernance;
