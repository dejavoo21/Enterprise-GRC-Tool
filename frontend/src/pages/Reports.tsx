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
} from '../types/reportingCenter';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

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

  const loadState = async () => {
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
  };

  useEffect(() => {
    void loadState();
  }, []);

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

  const handleSchedule = async (templateId: string) => {
    try {
      setWorking(`schedule-${templateId}`);
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + 7);
      await createReportSchedule({
        templateId,
        name: `${selectedTemplate?.title || 'Report'} cadence`,
        frequency: 'monthly',
        recipients: [{ type: 'committee', value: 'Board Committee' }],
        deliveryMethods: ['portal_access', 'email'],
        scopeType: 'workspace',
        scopeValue: currentWorkspace?.name || 'Enterprise',
        nextRunAt: nextRun.toISOString(),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setWorking(null);
    }
  };

  const handleDistribute = async () => {
    if (!selectedReport) return;
    try {
      setWorking(`distribute-${selectedReport.id}`);
      await distributeExecutiveReport(selectedReport.id, {
        recipientType: 'committee',
        recipientValue: 'Board Committee',
        deliveryMethod: 'portal_access',
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to distribute report');
    } finally {
      setWorking(null);
    }
  };

  const handleAttest = async (decision: 'approved' | 'rejected') => {
    if (!selectedReport) return;
    try {
      setWorking(`attest-${selectedReport.id}-${decision}`);
      await attestExecutiveReport(selectedReport.id, {
        decision,
        comments: decision === 'approved' ? 'Ready for leadership circulation.' : 'Needs section refinement before committee use.',
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attestation');
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
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
      <div style={pageStyle}>
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
    <div style={pageStyle}>
      <PageHeader
        title="Board Reporting Center"
        description="Generate board packs, executive summaries, committee reporting, and attestation-ready leadership narratives."
        action={<Button variant="primary" onClick={() => selectedTemplate && void handleGenerate(selectedTemplate.id)}>Generate Current Pack</Button>}
      />

      <SummaryMetricStrip metrics={summaryMetrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="outline" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="secondary" onClick={handleDistribute} disabled={!selectedReport || Boolean(working)}>
              {working?.startsWith('distribute-') ? 'Distributing...' : 'Distribute Report'}
            </Button>
          </>
        }
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates or committee packs"
          style={{
            minWidth: 260,
            padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
          }}
        />
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {(['all', 'board_reports', 'executive_reports', 'risk_committee', 'audit_committee', 'compliance_reports', 'regulatory_reports', 'operational_reports'] as Array<ReportingCategory | 'all'>).map((item) => (
            <Button
              key={item}
              variant={category === item ? 'primary' : 'outline'}
              onClick={() => setCategory(item)}
            >
              {item === 'all' ? 'All Packs' : categoryLabels[item]}
            </Button>
          ))}
        </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: theme.spacing[3] }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="Generated Reports"
              subtitle="Recently generated board and executive packs ready for review, attestation, and circulation."
              action={<Badge variant="primary" size="sm">{state.generatedReports.length} generated</Badge>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
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
                    <Button variant="primary" onClick={handleDistribute} disabled={Boolean(working)}>Distribute</Button>
                    <Button variant="outline" onClick={() => void handleAttest('approved')} disabled={Boolean(working)}>Approve</Button>
                    <Button variant="outline" onClick={() => void handleAttest('rejected')} disabled={Boolean(working)}>Reject</Button>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
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
