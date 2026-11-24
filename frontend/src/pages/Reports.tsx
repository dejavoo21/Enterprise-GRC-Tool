import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityFeed,
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  Modal,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  attestExecutiveReport,
  createReportSchedule,
  distributeExecutiveReport,
  fetchReportingCenterState,
  generateExecutiveReport,
  updateReportingTemplate,
} from '../lib/api';
import { theme } from '../theme';
import type {
  GeneratedReportRecord,
  ReportSectionKey,
  ReportTemplateRecord,
  ReportingCenterState,
  ReportingCategory,
  ScheduleFrequency,
} from '../types/reportingCenter';
import './Reports.css';

const categoryLabels: Record<ReportingCategory, string> = {
  board_reports: 'Board Reports',
  executive_reports: 'Executive Reports',
  audit_committee: 'Audit Committee',
  risk_committee: 'Risk Committee',
  compliance_reports: 'Compliance Reports',
  regulatory_reports: 'Regulatory Reports',
  operational_reports: 'Operational Reports',
  scheduled_reports: 'Scheduled',
};

const sectionLabels: Record<ReportSectionKey, string> = {
  executive_summary: 'Executive Summary',
  enterprise_risk_posture: 'Risk Posture',
  risk_appetite_status: 'Appetite Status',
  risk_tolerance_breaches: 'Tolerance Breaches',
  risk_capacity_utilization: 'Capacity Utilization',
  top_risks: 'Top Risks',
  top_kris: 'Top KRIs',
  emerging_risks: 'Emerging Risks',
  control_effectiveness: 'Control Effectiveness',
  audit_readiness: 'Audit Readiness',
  vendor_exposure: 'Vendor Exposure',
  critical_assets: 'Critical Assets',
  training_metrics: 'Training Metrics',
  regulatory_status: 'Regulatory Status',
  strategic_recommendations: 'Recommendations',
  forecasted_issues: 'Forecasted Issues',
  loss_events: 'Loss Events',
  near_misses: 'Near Misses',
  compliance_coverage: 'Compliance Coverage',
  management_actions: 'Management Actions',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled';
}

function toneForStatus(status: GeneratedReportRecord['status']) {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'distributed':
      return 'primary';
    case 'generated':
      return 'warning';
    default:
      return 'default';
  }
}

function buildActivityFeed(state: ReportingCenterState) {
  return [
    ...state.generatedReports.slice(0, 4).map((report) => ({
      id: `report-${report.id}`,
      title: report.title,
      meta: `${report.generatedByName} generated ${report.format.toUpperCase()} pack`,
      detail: `${formatDate(report.createdAt)} · ${categoryLabels[report.reportType]}`,
      variant: toneForStatus(report.status) as 'default' | 'primary' | 'success' | 'warning' | 'danger',
    })),
    ...state.attestations.slice(0, 3).map((attestation) => ({
      id: `attest-${attestation.id}`,
      title: `Report ${attestation.decision}`,
      meta: `${attestation.approverName} marked a report as ${attestation.decision}`,
      detail: formatDate(attestation.attestedAt),
      variant: attestation.decision === 'rejected' ? 'danger' as const : 'success' as const,
    })),
    ...state.distributions.slice(0, 3).map((distribution) => ({
      id: `dist-${distribution.id}`,
      title: `Distributed via ${distribution.deliveryMethod.replace(/_/g, ' ')}`,
      meta: `${distribution.recipientType}: ${distribution.recipientValue}`,
      detail: formatDate(distribution.sentAt || distribution.createdAt),
      variant: 'primary' as const,
    })),
  ].slice(0, 8);
}

function TemplateCard({
  template,
  selected,
  draftSections,
  onSelect,
  onToggleSection,
  onSaveSections,
  onGenerate,
  onSchedule,
}: {
  template: ReportTemplateRecord;
  selected: boolean;
  draftSections: ReportSectionKey[];
  onSelect: () => void;
  onToggleSection: (section: ReportSectionKey) => void;
  onSaveSections: () => void;
  onGenerate: () => void;
  onSchedule: () => void;
}) {
  return (
    <Card
      style={{
        padding: theme.spacing[4],
        minWidth: 0,
        border: selected ? `1px solid ${theme.colors.primary}` : `1px solid ${theme.colors.border}`,
        backgroundColor: selected ? theme.colors.primaryLight : theme.colors.surface,
      }}
    >
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
              {template.title}
            </div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {template.description}
            </div>
          </div>
          <Badge variant="default" size="sm">{template.defaultFormat.toUpperCase()}</Badge>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          <Badge variant="primary" size="sm">{categoryLabels[template.category]}</Badge>
          <Badge variant="default" size="sm">{draftSections.length} sections</Badge>
          <Badge variant="default" size="sm">{template.classification}</Badge>
        </div>

        <details open={selected}>
          <summary style={{ cursor: 'pointer', fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, fontWeight: theme.typography.weights.medium }}>
            Customize sections
          </summary>
          <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {template.sections.map((section) => (
              <label key={section} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                <input
                  type="checkbox"
                  checked={draftSections.includes(section)}
                  onChange={() => onToggleSection(section)}
                />
                {sectionLabels[section]}
              </label>
            ))}
          </div>
          <div style={{ marginTop: theme.spacing[3], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={onSaveSections}>Save Layout</Button>
            <Button variant="primary" onClick={onGenerate}>Generate Pack</Button>
            <Button variant="secondary" onClick={onSchedule}>Schedule</Button>
          </div>
        </details>

        <Button variant="secondary" onClick={onSelect}>View Details</Button>
      </div>
    </Card>
  );
}

export function Reports() {
  const { currentWorkspace } = useWorkspace();
  const [state, setState] = useState<ReportingCenterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportingCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [draftSections, setDraftSections] = useState<Record<string, ReportSectionKey[]>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<{ name: string; frequency: ScheduleFrequency; recipient: string; nextRunAt: string }>({ name: '', frequency: 'monthly', recipient: '', nextRunAt: '' });
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [attestationDecision, setAttestationDecision] = useState<'approved' | 'rejected' | null>(null);
  const [attestationComments, setAttestationComments] = useState('');
  const [attestationError, setAttestationError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishRecipient, setPublishRecipient] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await fetchReportingCenterState();
      setState(next);
      setDraftSections((current) => {
        const merged = { ...current };
        next.templates.forEach((template) => {
          if (!merged[template.id]) merged[template.id] = [...template.sections];
        });
        return merged;
      });
      if (!selectedTemplateId && next.templates[0]) setSelectedTemplateId(next.templates[0].id);
      if (!selectedReportId && next.generatedReports[0]) setSelectedReportId(next.generatedReports[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reporting center');
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, selectedTemplateId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const filteredTemplates = useMemo(() => {
    if (!state) return [];
    return state.templates.filter((template) => {
      const matchesCategory = category === 'all' || template.category === category;
      const haystack = `${template.title} ${template.description}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [category, search, state]);

  const selectedTemplate = useMemo(
    () => state?.templates.find((template) => template.id === selectedTemplateId) || filteredTemplates[0] || null,
    [filteredTemplates, selectedTemplateId, state],
  );

  const selectedReport = useMemo(
    () => state?.generatedReports.find((report) => report.id === selectedReportId) || state?.generatedReports[0] || null,
    [selectedReportId, state],
  );

  const summaryMetrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'Templates', value: 0, detail: 'Loading reporting inventory', tone: 'default' as const },
        { label: 'Generated This Month', value: 0, detail: 'Awaiting data', tone: 'warning' as const },
        { label: 'Scheduled', value: 0, detail: 'Awaiting data', tone: 'default' as const },
        { label: 'Awaiting Attestation', value: 0, detail: 'Awaiting data', tone: 'default' as const },
        { label: 'Distributed', value: 0, detail: 'Awaiting data', tone: 'default' as const },
      ];
    }
    return [
      { label: 'Templates', value: state.summary.totalTemplates, detail: 'Board, committee, and operating packs', tone: 'primary' as const },
      { label: 'Generated This Month', value: state.summary.generatedThisMonth, detail: `${state.recentReports.length} recent reports`, tone: 'success' as const },
      { label: 'Scheduled', value: state.summary.scheduledReports, detail: `${state.upcomingReports.length} upcoming runs`, tone: 'default' as const },
      { label: 'Awaiting Attestation', value: state.summary.awaitingAttestation, detail: 'Committee sign-off queue', tone: state.summary.awaitingAttestation > 0 ? 'warning' as const : 'default' as const },
      { label: 'Distributed', value: state.summary.distributedReports, detail: 'Sent through portal or committee flow', tone: 'primary' as const },
    ];
  }, [state]);

  const handleToggleSection = (templateId: string, section: ReportSectionKey) => {
    setDraftSections((current) => {
      const existing = current[templateId] || [];
      const next = existing.includes(section)
        ? existing.filter((item) => item !== section)
        : [...existing, section];
      return { ...current, [templateId]: next };
    });
  };

  const handleSaveSections = async (templateId: string) => {
    try {
      setWorking(`template-${templateId}`);
      await updateReportingTemplate(templateId, draftSections[templateId] || []);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report template');
    } finally {
      setWorking(null);
    }
  };

  const handleGenerate = async (templateId: string) => {
    try {
      setWorking(`generate-${templateId}`);
      const report = await generateExecutiveReport({
        templateId,
        scopeType: 'workspace',
        scopeValue: currentWorkspace?.name || 'Enterprise',
      });
      setSelectedReportId(report.id);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setWorking(null);
    }
  };

  const handleSchedule = (templateId: string) => {
    setScheduleTemplateId(templateId);
    setScheduleDraft({ name: '', frequency: 'monthly', recipient: '', nextRunAt: '' });
    setScheduleError(null);
  };

  const submitSchedule = async () => {
    if (!scheduleTemplateId || !scheduleDraft.name.trim() || !scheduleDraft.recipient.trim() || !scheduleDraft.nextRunAt) return;
    try {
      setWorking(`schedule-${scheduleTemplateId}`);
      setScheduleError(null);
      await createReportSchedule({
        templateId: scheduleTemplateId,
        name: scheduleDraft.name.trim(),
        frequency: scheduleDraft.frequency,
        recipients: [{ type: 'committee', value: scheduleDraft.recipient.trim() }],
        deliveryMethods: ['portal_access'],
        scopeType: 'workspace',
        scopeValue: currentWorkspace?.name || 'Enterprise',
        nextRunAt: new Date(scheduleDraft.nextRunAt).toISOString(),
      });
      await loadState();
      setScheduleTemplateId(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setWorking(null);
    }
  };

  const openPublish = () => {
    setPublishRecipient('');
    setPublishError(null);
    setPublishOpen(true);
  };

  const handleDistribute = async () => {
    if (!selectedReport || !publishRecipient.trim()) return;
    try {
      setWorking(`distribute-${selectedReport.id}`);
      setPublishError(null);
      await distributeExecutiveReport(selectedReport.id, {
        recipientType: 'committee',
        recipientValue: publishRecipient.trim(),
        deliveryMethod: 'portal_access',
      });
      await loadState();
      setPublishOpen(false);
      setPublishRecipient('');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish report');
    } finally {
      setWorking(null);
    }
  };

  const openAttestation = (decision: 'approved' | 'rejected') => {
    setAttestationDecision(decision);
    setAttestationComments('');
    setAttestationError(null);
  };

  const handleAttest = async () => {
    if (!selectedReport || !attestationDecision || attestationComments.trim().length < 3) return;
    try {
      setWorking(`attest-${selectedReport.id}-${attestationDecision}`);
      setAttestationError(null);
      await attestExecutiveReport(selectedReport.id, {
        decision: attestationDecision,
        comments: attestationComments.trim(),
      });
      await loadState();
      setAttestationDecision(null);
      setAttestationComments('');
    } catch (err) {
      setAttestationError(err instanceof Error ? err.message : 'Failed to record attestation');
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div className="reportingWorkspace">
        <PageHeader title="Board Reporting Center" description="Board packs, executive summaries, committee reports, and scheduled leadership reporting." />
        <PageSectionCard title="Loading Reporting Center">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Building reporting inventory and board metrics...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="reportingWorkspace">
        <PageHeader title="Board Reporting Center" description="Board packs, executive summaries, committee reports, and scheduled leadership reporting." />
        <EmptyStatePanel
          eyebrow="Reporting"
          title="Unable to load reporting center"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadState()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="reportingWorkspace">
      <PageHeader
        breadcrumb="Enterprise / Reporting & Analytics"
        title="Board Reporting Center"
        description="Generate board packs, executive summaries, committee reporting, and attestation-ready leadership narratives."
        action={<Button variant="primary" onClick={() => selectedTemplate && void handleGenerate(selectedTemplate.id)}>Generate Current Pack</Button>}
      />

      <div aria-label="Reporting workflow summary">
        <SummaryMetricStrip metrics={summaryMetrics} />
      </div>

      <PageToolbar
        actions={
          <>
            <Button variant="outline" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="secondary" onClick={openPublish} disabled={!selectedReport || selectedReport.status !== 'approved' || Boolean(working)}>
              {working?.startsWith('distribute-') ? 'Publishing...' : 'Publish to Portal'}
            </Button>
          </>
        }
      >
        <label className="reportingField reportingSearchField">
          <span>Search report packs</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates or committee packs"
          />
        </label>
        <label className="reportingField">
          <span>Report category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ReportingCategory | 'all')}>
            <option value="all">All packs</option>
            {Object.entries(categoryLabels).filter(([key]) => key !== 'scheduled_reports').map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={() => { setSearch(''); setCategory('all'); }} disabled={!search && category === 'all'}>Clear filters</Button>
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}

      {!state || filteredTemplates.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Reporting"
          title="No report packs match the current filters"
          description="Adjust the category or search filter, or generate the first board pack to start the reporting cycle."
          actions={<Button variant="primary" onClick={() => setCategory('all')}>Reset Filters</Button>}
        />
      ) : (
        <>
          <PageSectionCard
            title="Report Templates"
            subtitle="Standardized board, committee, compliance, and operational packs. Each template can be trimmed to the sections you want before generation."
            action={<Badge variant="default" size="sm">{filteredTemplates.length} templates</Badge>}
          >
            <div className="reportingTemplateGrid">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedTemplate?.id === template.id}
                  draftSections={draftSections[template.id] || template.sections}
                  onSelect={() => setSelectedTemplateId(template.id)}
                  onToggleSection={(section) => handleToggleSection(template.id, section)}
                  onSaveSections={() => void handleSaveSections(template.id)}
                  onGenerate={() => void handleGenerate(template.id)}
                  onSchedule={() => void handleSchedule(template.id)}
                />
              ))}
            </div>
          </PageSectionCard>

          <div className="reportingReviewGrid">
            <DataTableShell
              title="Generated Reports"
              subtitle="Recently generated board and executive packs ready for review, attestation, and circulation."
              action={<Badge variant="primary" size="sm">{state.generatedReports.length} generated</Badge>}
            >
              <div className="reportingTableScroll">
              <table className="reportingTable">
                <colgroup>
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Report</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Format</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Scope</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {state.generatedReports.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedReportId(report.id);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={selectedReport?.id === report.id}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedReport?.id === report.id ? theme.colors.surfaceHover : 'transparent',
                        borderTop: `1px solid ${theme.colors.borderLight}`,
                      }}
                    >
                      <td style={{ padding: `${theme.spacing[3]}`, verticalAlign: 'top' }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                          {report.title}
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          {categoryLabels[report.reportType]} · {report.generatedByName}
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]}`, fontSize: theme.typography.sizes.sm }}>{report.format.toUpperCase()}</td>
                      <td style={{ padding: `${theme.spacing[3]}` }}><Badge variant={toneForStatus(report.status)} size="sm">{report.status}</Badge></td>
                      <td style={{ padding: `${theme.spacing[3]}`, fontSize: theme.typography.sizes.sm }}>{report.scopeValue}</td>
                      <td style={{ padding: `${theme.spacing[3]}`, fontSize: theme.typography.sizes.sm }}>{formatDate(report.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </DataTableShell>

            <PageSectionCard
              title="Selected Report"
              subtitle="Use the generated content for board distribution, committee sign-off, and leadership briefings."
              action={selectedReport ? <Badge variant={toneForStatus(selectedReport.status)} size="sm">{selectedReport.status}</Badge> : null}
            >
              {selectedReport ? (
                <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                      {selectedReport.title}
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {selectedReport.scopeValue} · {selectedReport.format.toUpperCase()} · {selectedReport.authorName}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: theme.spacing[2] }}>
                    {selectedReport.content.metrics.map((metric) => (
                      <Card key={metric.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{metric.label}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold }}>{metric.value}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{metric.detail}</div>
                      </Card>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                    {selectedReport.content.sections.map((section) => (
                      <Card key={section.key} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                          {section.heading}
                        </div>
                        <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                          {section.bullets.map((bullet) => (
                            <div key={bullet} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                              {bullet}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={openPublish} disabled={selectedReport.status !== 'approved' || Boolean(working)}>Publish to Portal</Button>
                    <Button variant="outline" onClick={() => openAttestation('approved')} disabled={selectedReport.status !== 'generated' || Boolean(working)}>Approve</Button>
                    <Button variant="outline" onClick={() => openAttestation('rejected')} disabled={selectedReport.status !== 'generated' || Boolean(working)}>Reject</Button>
                  </div>
                </div>
              ) : (
                <EmptyStatePanel
                  title="No report selected"
                  description="Generate or select a report to review sections, metrics, and attestation options."
                />
              )}
            </PageSectionCard>
          </div>
          <Modal accessibleDialog isOpen={Boolean(scheduleTemplateId)} onClose={() => { if (!working) setScheduleTemplateId(null); }} title="Schedule report" width="640px" footer={<><Button variant="outline" onClick={() => setScheduleTemplateId(null)} disabled={Boolean(working)}>Cancel</Button><Button variant="primary" onClick={() => void submitSchedule()} disabled={Boolean(working) || !scheduleDraft.name.trim() || !scheduleDraft.recipient.trim() || !scheduleDraft.nextRunAt}>{working ? 'Saving...' : 'Create portal schedule'}</Button></>}>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>This creates an internal portal schedule only. It does not email or externally distribute a report.</p>
              <label>Schedule name<input value={scheduleDraft.name} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, name: event.target.value }))} /></label>
              <label>Frequency<select value={scheduleDraft.frequency} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, frequency: event.target.value as ScheduleFrequency }))}>{['daily','weekly','monthly','quarterly','annually'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Committee or recipient group<input value={scheduleDraft.recipient} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, recipient: event.target.value }))} /></label>
              <label>Next run<input type="datetime-local" value={scheduleDraft.nextRunAt} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, nextRunAt: event.target.value }))} /></label>
              {scheduleError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{scheduleError}</div> : null}
            </div>
          </Modal>
          <Modal accessibleDialog isOpen={Boolean(attestationDecision)} onClose={() => { if (!working) { setAttestationDecision(null); setAttestationComments(''); } }} title={attestationDecision === 'approved' ? 'Approve report' : 'Reject report'} width="620px" footer={<><Button variant="outline" onClick={() => setAttestationDecision(null)} disabled={Boolean(working)}>Cancel</Button><Button variant={attestationDecision === 'rejected' ? 'danger' : 'primary'} onClick={() => void handleAttest()} disabled={Boolean(working) || attestationComments.trim().length < 3}>{working ? 'Saving...' : 'Record attestation'}</Button></>}>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>Record the authorised reviewer rationale. The server enforces independent approval.</p>
              <label>Attestation comments<textarea rows={5} value={attestationComments} onChange={(event) => setAttestationComments(event.target.value)} /></label>
              {attestationError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{attestationError}</div> : null}
            </div>
          </Modal>
          <Modal accessibleDialog isOpen={publishOpen} onClose={() => { if (!working) setPublishOpen(false); }} title="Publish approved report" width="620px" footer={<><Button variant="outline" onClick={() => setPublishOpen(false)} disabled={Boolean(working)}>Cancel</Button><Button variant="primary" onClick={() => void handleDistribute()} disabled={Boolean(working) || !publishRecipient.trim()}>{working ? 'Publishing...' : 'Publish to portal'}</Button></>}>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>Publication is limited to the internal portal. No email, secure link, or external delivery is performed.</p>
              <label>Committee or recipient group<input value={publishRecipient} onChange={(event) => setPublishRecipient(event.target.value)} /></label>
              {publishError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{publishError}</div> : null}
            </div>
          </Modal>

          <div className="reportingSecondaryGrid">
            <PageSectionCard
              title="Scheduled Cadence"
              subtitle="Active board and committee schedules that define the next reporting cycle."
              action={<Badge variant="default" size="sm">{state.schedules.length} schedules</Badge>}
            >
              {state.schedules.length > 0 ? (
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  {state.schedules.slice(0, 6).map((schedule) => (
                    <Card key={schedule.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{schedule.name}</div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                            {schedule.frequency} · {schedule.scopeValue}
                          </div>
                        </div>
                        <Badge variant={schedule.isActive ? 'success' : 'default'} size="sm">{schedule.isActive ? 'active' : 'paused'}</Badge>
                      </div>
                      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                        Next run: {formatDate(schedule.nextRunAt)}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyStatePanel
                  title="No schedules created"
                  description="Create a recurring board or committee cadence from any report template."
                />
              )}
            </PageSectionCard>

            <ActivityFeed
              title="Reporting Activity"
              subtitle="Recent pack generation, approvals, and distribution activity across the reporting workflow."
              countLabel={`${buildActivityFeed(state).length} recent events`}
            >
              {buildActivityFeed(state).length > 0 ? buildActivityFeed(state).map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                      {item.title}
                    </div>
                    <Badge variant={item.variant} size="sm">{item.variant}</Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.meta}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{item.detail}</div>
                </Card>
              )) : (
                <Card style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>
                  No reporting workflow activity has been logged yet.
                </Card>
              )}
            </ActivityFeed>
          </div>
        </>
      )}
    </div>
  );
}
