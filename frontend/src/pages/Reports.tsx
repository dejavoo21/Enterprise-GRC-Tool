import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
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
  const activeWorkspaceId = currentWorkspace?.id || '';
  const [state, setState] = useState<ReportingCenterState | null>(null);
  const [stateWorkspaceId, setStateWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stateRequestSequence = useRef(0);
  const currentWorkspaceIdRef = useRef(activeWorkspaceId);
  currentWorkspaceIdRef.current = activeWorkspaceId;
  const [category, setCategory] = useState<ReportingCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [reportStatus, setReportStatus] = useState<GeneratedReportRecord['status'] | 'all'>('all');
  const [reportFormat, setReportFormat] = useState<GeneratedReportRecord['format'] | 'all'>('all');
  const [reportScope, setReportScope] = useState<GeneratedReportRecord['scopeType'] | 'all'>('all');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [draftSections, setDraftSections] = useState<Record<string, ReportSectionKey[]>>({});
  const [working, setWorking] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const mutationRequestSequence = useRef(0);
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<{ name: string; frequency: ScheduleFrequency; recipient: string; nextRunAt: string }>({ name: '', frequency: 'monthly', recipient: '', nextRunAt: '' });
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [attestationDecision, setAttestationDecision] = useState<'approved' | 'rejected' | null>(null);
  const [attestationComments, setAttestationComments] = useState('');
  const [attestationError, setAttestationError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const closeSchedule = () => { if (!working && !mutationLock.current) setScheduleTemplateId(null); };
  const closeAttestation = () => {
    if (!working && !mutationLock.current) {
      setAttestationDecision(null);
      setAttestationComments('');
    }
  };
  const closePublish = () => { if (!working && !mutationLock.current) setPublishOpen(false); };
  const [publishRecipient, setPublishRecipient] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    const sequence = ++stateRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const next = await fetchReportingCenterState();
      if (sequence !== stateRequestSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return;
      setState(next);
      setStateWorkspaceId(requestedWorkspaceId);
      setDraftSections((current) => {
        const merged = { ...current };
        next.templates.forEach((template) => {
          if (!merged[template.id]) merged[template.id] = [...template.sections];
        });
        return merged;
      });
      if (next.templates[0]) setSelectedTemplateId((current) => current || next.templates[0].id);
      if (next.generatedReports[0]) setSelectedReportId((current) => current || next.generatedReports[0].id);
    } catch (err) {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setStateWorkspaceId(requestedWorkspaceId);
        setError(err instanceof Error ? err.message : 'Unable to load reporting center');
      }
    } finally {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sequenceRef = stateRequestSequence;
    setState(null);
    setStateWorkspaceId('');
    setError(null);
    setSearch('');
    setCategory('all');
    setReportStatus('all');
    setReportFormat('all');
    setReportScope('all');
    setReportFrom('');
    setReportTo('');
    setSelectedTemplateId(null);
    setSelectedReportId(null);
    setDraftSections({});
    setWorking(null);
    mutationRequestSequence.current++;
    mutationLock.current = false;
    setScheduleTemplateId(null);
    setScheduleDraft({ name: '', frequency: 'monthly', recipient: '', nextRunAt: '' });
    setScheduleError(null);
    setAttestationDecision(null);
    setAttestationComments('');
    setAttestationError(null);
    setPublishOpen(false);
    setPublishRecipient('');
    setPublishError(null);
    void loadState();
    return () => { sequenceRef.current++; };
  }, [activeWorkspaceId, loadState]);

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

  const filteredReports = useMemo(() => {
    if (!state) return [];
    const needle = search.trim().toLowerCase();
    const from = reportFrom ? new Date(`${reportFrom}T00:00:00.000Z`).getTime() : null;
    const to = reportTo ? new Date(`${reportTo}T23:59:59.999Z`).getTime() : null;
    return state.generatedReports.filter((report) => {
      const created = new Date(report.createdAt).getTime();
      return (category === 'all' || report.reportType === category)
        && (reportStatus === 'all' || report.status === reportStatus)
        && (reportFormat === 'all' || report.format === reportFormat)
        && (reportScope === 'all' || report.scopeType === reportScope)
        && (from === null || created >= from)
        && (to === null || created <= to)
        && (!needle || `${report.title} ${report.generatedByName} ${report.authorName} ${report.scopeValue} ${categoryLabels[report.reportType]}`.toLowerCase().includes(needle));
    });
  }, [category, reportFormat, reportFrom, reportScope, reportStatus, reportTo, search, state]);

  const selectedReport = useMemo(
    () => filteredReports.find((report) => report.id === selectedReportId) || filteredReports[0] || null,
    [filteredReports, selectedReportId],
  );
  const hasReportFilters = Boolean(search || category !== 'all' || reportStatus !== 'all' || reportFormat !== 'all' || reportScope !== 'all' || reportFrom || reportTo);
  const clearReportFilters = () => { setSearch(''); setCategory('all'); setReportStatus('all'); setReportFormat('all'); setReportScope('all'); setReportFrom(''); setReportTo(''); };

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
    if (mutationLock.current) return;
    mutationLock.current = true;
    const mutationSequence = ++mutationRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(`template-${templateId}`);
      await updateReportingTemplate(templateId, draftSections[templateId] || []);
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) await loadState();
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) setError(err instanceof Error ? err.message : 'Failed to save report template');
    } finally {
      if (mutationSequence === mutationRequestSequence.current) mutationLock.current = false;
      if (mutationSequence === mutationRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  const handleGenerate = async (templateId: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    const mutationSequence = ++mutationRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(`generate-${templateId}`);
      const report = await generateExecutiveReport({
        templateId,
        scopeType: 'workspace',
        scopeValue: currentWorkspace?.name || 'Enterprise',
      });
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setSelectedReportId(report.id);
        await loadState();
      }
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      if (mutationSequence === mutationRequestSequence.current) mutationLock.current = false;
      if (mutationSequence === mutationRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  const handleSchedule = (templateId: string) => {
    if (mutationLock.current) return;
    setScheduleTemplateId(templateId);
    setScheduleDraft({ name: '', frequency: 'monthly', recipient: '', nextRunAt: '' });
    setScheduleError(null);
  };

  const submitSchedule = async () => {
    if (mutationLock.current) return;
    if (!scheduleTemplateId || !scheduleDraft.name.trim() || !scheduleDraft.recipient.trim() || !scheduleDraft.nextRunAt) return;
    mutationLock.current = true;
    const mutationSequence = ++mutationRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
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
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) {
        await loadState();
        setScheduleTemplateId(null);
      }
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) setScheduleError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      if (mutationSequence === mutationRequestSequence.current) mutationLock.current = false;
      if (mutationSequence === mutationRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  const openPublish = () => {
    if (mutationLock.current) return;
    setPublishRecipient('');
    setPublishError(null);
    setPublishOpen(true);
  };

  const handleDistribute = async () => {
    if (mutationLock.current) return;
    if (!selectedReport || !publishRecipient.trim()) return;
    mutationLock.current = true;
    const mutationSequence = ++mutationRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(`distribute-${selectedReport.id}`);
      setPublishError(null);
      await distributeExecutiveReport(selectedReport.id, {
        recipientType: 'committee',
        recipientValue: publishRecipient.trim(),
        deliveryMethod: 'portal_access',
      });
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) {
        await loadState();
        setPublishOpen(false);
        setPublishRecipient('');
      }
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) setPublishError(err instanceof Error ? err.message : 'Failed to publish report');
    } finally {
      if (mutationSequence === mutationRequestSequence.current) mutationLock.current = false;
      if (mutationSequence === mutationRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  const openAttestation = (decision: 'approved' | 'rejected') => {
    if (mutationLock.current) return;
    setAttestationDecision(decision);
    setAttestationComments('');
    setAttestationError(null);
  };

  const handleAttest = async () => {
    if (mutationLock.current) return;
    if (!selectedReport || !attestationDecision || attestationComments.trim().length < 3) return;
    mutationLock.current = true;
    const mutationSequence = ++mutationRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(`attest-${selectedReport.id}-${attestationDecision}`);
      setAttestationError(null);
      await attestExecutiveReport(selectedReport.id, {
        decision: attestationDecision,
        comments: attestationComments.trim(),
      });
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) {
        await loadState();
        setAttestationDecision(null);
        setAttestationComments('');
      }
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) setAttestationError(err instanceof Error ? err.message : 'Failed to record attestation');
    } finally {
      if (mutationSequence === mutationRequestSequence.current) mutationLock.current = false;
      if (mutationSequence === mutationRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  if (loading || stateWorkspaceId !== activeWorkspaceId) {
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
        <details className="reportingExtraFilters">
          <summary>Generated report filters</summary>
          <div className="reportingFilterGrid">
            <label className="reportingField"><span>Status</span><select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as typeof reportStatus)}><option value="all">All statuses</option>{['draft','generated','approved','rejected','distributed'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="reportingField"><span>Format</span><select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as typeof reportFormat)}><option value="all">All formats</option>{['pdf','word','excel','powerpoint'].map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
            <label className="reportingField"><span>Scope</span><select value={reportScope} onChange={(event) => setReportScope(event.target.value as typeof reportScope)}><option value="all">All scopes</option>{['workspace','department','business_unit','region','legal_entity','enterprise_rollup'].map(value => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
            <label className="reportingField"><span>Generated from</span><input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label>
            <label className="reportingField"><span>Generated to</span><input type="date" min={reportFrom} value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label>
          </div>
        </details>
        <Button variant="outline" onClick={clearReportFilters} disabled={!hasReportFilters}>Clear filters</Button>
      </PageToolbar>

      {hasReportFilters ? <div className="reportingAppliedFilters" aria-label="Applied reporting filters"><strong>Applied filters</strong>{search&&<AppliedQueryFilter label={`Search: ${search}`} onRemove={()=>setSearch('')} />}{category!=='all'&&<AppliedQueryFilter label={`Category: ${categoryLabels[category]}`} onRemove={()=>setCategory('all')} />}{reportStatus!=='all'&&<AppliedQueryFilter label={`Status: ${reportStatus}`} onRemove={()=>setReportStatus('all')} />}{reportFormat!=='all'&&<AppliedQueryFilter label={`Format: ${reportFormat.toUpperCase()}`} onRemove={()=>setReportFormat('all')} />}{reportScope!=='all'&&<AppliedQueryFilter label={`Scope: ${reportScope.replaceAll('_',' ')}`} onRemove={()=>setReportScope('all')} />}{reportFrom&&<AppliedQueryFilter label={`From: ${reportFrom}`} onRemove={()=>setReportFrom('')} />}{reportTo&&<AppliedQueryFilter label={`To: ${reportTo}`} onRemove={()=>setReportTo('')} />}<span role="status">{filteredTemplates.length} templates · {filteredReports.length} generated reports</span></div> : null}

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
              action={<Badge variant="primary" size="sm">{filteredReports.length} matching</Badge>}
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
                  {filteredReports.map((report) => (
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
                  {!filteredReports.length ? <tr><td colSpan={5} className="reportingEmpty">No generated reports match the applied filters.</td></tr> : null}
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
                    <div className="reportingProvenance">Snapshot generated {formatDate(selectedReport.createdAt)} · Last workflow update {formatDate(selectedReport.updatedAt)} · Recorded source: Reporting Center</div>
                  </div>

                  <details className="reportingMetricTable">
                    <summary>View metrics as table</summary>
                    <div className="reportingTableScroll"><table className="reportingTable"><thead><tr><th>Metric</th><th>Value</th><th>Context</th></tr></thead><tbody>{selectedReport.content.metrics.map(metric=><tr key={metric.label}><th scope="row">{metric.label}</th><td>{metric.value}</td><td>{metric.detail || 'No additional context recorded'}</td></tr>)}</tbody></table></div>
                  </details>

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
          <Modal accessibleDialog isOpen={Boolean(scheduleTemplateId)} onClose={closeSchedule} title="Schedule report" width="640px" footer={<><Button variant="outline" onClick={closeSchedule} disabled={Boolean(working)}>Cancel</Button><Button variant="primary" onClick={() => void submitSchedule()} disabled={Boolean(working) || !scheduleDraft.name.trim() || !scheduleDraft.recipient.trim() || !scheduleDraft.nextRunAt}>{working ? 'Saving...' : 'Create portal schedule'}</Button></>}>
            <fieldset disabled={Boolean(working)} aria-busy={Boolean(working)} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>This creates an internal portal schedule only. It does not email or externally distribute a report.</p>
              <label>Schedule name<input value={scheduleDraft.name} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, name: event.target.value }))} /></label>
              <label>Frequency<select value={scheduleDraft.frequency} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, frequency: event.target.value as ScheduleFrequency }))}>{['daily','weekly','monthly','quarterly','annually'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Committee or recipient group<input value={scheduleDraft.recipient} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, recipient: event.target.value }))} /></label>
              <label>Next run<input type="datetime-local" value={scheduleDraft.nextRunAt} onChange={(event) => setScheduleDraft((draft) => ({ ...draft, nextRunAt: event.target.value }))} /></label>
              {scheduleError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{scheduleError}</div> : null}
            </fieldset>
          </Modal>
          <Modal accessibleDialog isOpen={Boolean(attestationDecision)} onClose={closeAttestation} title={attestationDecision === 'approved' ? 'Approve report' : 'Reject report'} width="620px" footer={<><Button variant="outline" onClick={closeAttestation} disabled={Boolean(working)}>Cancel</Button><Button variant={attestationDecision === 'rejected' ? 'danger' : 'primary'} onClick={() => void handleAttest()} disabled={Boolean(working) || attestationComments.trim().length < 3}>{working ? 'Saving...' : 'Record attestation'}</Button></>}>
            <fieldset disabled={Boolean(working)} aria-busy={Boolean(working)} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>Record the authorised reviewer rationale. The server enforces independent approval.</p>
              <label>Attestation comments<textarea rows={5} value={attestationComments} onChange={(event) => setAttestationComments(event.target.value)} /></label>
              {attestationError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{attestationError}</div> : null}
            </fieldset>
          </Modal>
          <Modal accessibleDialog isOpen={publishOpen} onClose={closePublish} title="Publish approved report" width="620px" footer={<><Button variant="outline" onClick={closePublish} disabled={Boolean(working)}>Cancel</Button><Button variant="primary" onClick={() => void handleDistribute()} disabled={Boolean(working) || !publishRecipient.trim()}>{working ? 'Publishing...' : 'Publish to portal'}</Button></>}>
            <fieldset disabled={Boolean(working)} aria-busy={Boolean(working)} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
              <p style={{ margin: 0, color: theme.colors.text.secondary }}>Publication is limited to the internal portal. No email, secure link, or external delivery is performed.</p>
              <label>Committee or recipient group<input value={publishRecipient} onChange={(event) => setPublishRecipient(event.target.value)} /></label>
              {publishError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{publishError}</div> : null}
            </fieldset>
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
