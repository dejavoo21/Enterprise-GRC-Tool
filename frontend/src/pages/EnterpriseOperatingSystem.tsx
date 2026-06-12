import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { fetchEnterpriseEntity360, fetchEnterpriseOpsState, searchEnterpriseOpsEntities } from '../lib/api';
import { theme } from '../theme';
import type {
  EnterpriseApprovalItem,
  EnterpriseEntity360,
  EnterpriseEntityNode,
  EnterpriseEntityType,
  EnterpriseOpsState,
  EnterpriseRelationshipEdge,
  EnterpriseTaskItem,
} from '../types/enterpriseOps';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const twoColumnGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: theme.spacing[4],
};

function statusVariant(status: string) {
  if (['active', 'healthy', 'implemented', 'approved', 'completed', 'success', 'compliant', 'enabled'].includes(status)) return 'success';
  if (['critical', 'high', 'failed', 'overdue', 'rejected', 'blocked', 'disabled'].includes(status)) return 'danger';
  if (['pending', 'in_review', 'in_progress', 'watch', 'draft', 'planned', 'open'].includes(status)) return 'warning';
  return 'default';
}

function priorityVariant(priority: string) {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'default';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'No due date';
}

function prettyLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function Entity360Drawer({
  view,
  onClose,
}: {
  view: EnterpriseEntity360 | null;
  onClose: () => void;
}) {
  if (!view) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.32)',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(560px, 100vw)',
          height: '100%',
          backgroundColor: theme.colors.surface,
          boxShadow: theme.shadows.xl,
          padding: theme.spacing[6],
          overflowY: 'auto',
          display: 'grid',
          gap: theme.spacing[4],
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant="default" size="sm">{prettyLabel(view.entity.entityType)}</Badge>
              {view.entity.status ? <Badge variant={statusVariant(view.entity.status)} size="sm">{prettyLabel(view.entity.status)}</Badge> : null}
            </div>
            <h3 style={{ margin: `${theme.spacing[3]} 0 ${theme.spacing[1]} 0`, fontSize: theme.typography.sizes.xl, color: theme.colors.text.main }}>
              {view.entity.name}
            </h3>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {view.entity.owner || 'Unassigned'} · {view.entity.businessUnit || 'Enterprise scope'}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>

        <PageSectionCard title="Overview">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {view.overview.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
                <strong style={{ color: theme.colors.text.main }}>{String(item.value)}</strong>
              </div>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Related Entities">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {view.relatedEntities.slice(0, 10).map((item) => (
              <Card key={`${item.entityType}-${item.id}`} style={{ padding: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.name}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {prettyLabel(item.entityType)} · {item.owner || 'No owner'}
                    </div>
                  </div>
                  {item.status ? <Badge variant={statusVariant(item.status)} size="sm">{prettyLabel(item.status)}</Badge> : null}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Relationship Map">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {view.relatedRelationships.slice(0, 12).map((item) => (
              <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                  <strong>{item.sourceName}</strong> → <strong>{item.targetName}</strong>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {prettyLabel(item.relationshipType)} · {prettyLabel(item.sourceType)} to {prettyLabel(item.targetType)}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Activity">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {view.activity.length === 0 ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                No related activity entries recorded yet.
              </div>
            ) : (
              view.activity.map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.action}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                        {item.actorName} · {new Date(item.timestamp).toLocaleString('en-GB')}
                      </div>
                    </div>
                    <Badge variant={statusVariant(item.outcome)} size="sm">{item.outcome}</Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </PageSectionCard>
      </div>
    </div>
  );
}

function RelationshipList({
  title,
  edges,
  onSelect,
}: {
  title: string;
  edges: EnterpriseRelationshipEdge[];
  onSelect: (entityType: EnterpriseEntityType, entityId: string) => void;
}) {
  return (
    <PageSectionCard title={title} subtitle="Cross-module links surfaced from the shared enterprise relationship engine.">
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {edges.slice(0, 10).map((edge) => (
          <Card key={edge.id} style={{ padding: theme.spacing[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>
                  {edge.sourceName} → {edge.targetName}
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {prettyLabel(edge.relationshipType)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => onSelect(edge.sourceType, edge.sourceId)}>Source 360</Button>
                <Button variant="secondary" onClick={() => onSelect(edge.targetType, edge.targetId)}>Target 360</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageSectionCard>
  );
}

export function EnterpriseOperatingSystem() {
  const [state, setState] = useState<EnterpriseOpsState | null>(null);
  const [searchResults, setSearchResults] = useState<EnterpriseEntityNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedView, setSelectedView] = useState<EnterpriseEntity360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchEnterpriseOpsState();
      setState(result);
      setSearchResults(result.entities.slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load enterprise operating system state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  const handleSearch = async () => {
    try {
      setSearching(true);
      if (!searchQuery.trim()) {
        setSearchResults((state?.entities || []).slice(0, 8));
        setError(null);
        return;
      }

      setSearchResults(await searchEnterpriseOpsEntities(searchQuery));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search enterprise entities');
    } finally {
      setSearching(false);
    }
  };

  const open360 = async (entityType: EnterpriseEntityType, entityId: string) => {
    try {
      setSelectedView(await fetchEnterpriseEntity360(entityType, entityId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load entity 360 view');
    }
  };

  const metrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'Entities', value: 0, detail: 'Loading enterprise graph', tone: 'default' as const },
        { label: 'Relationships', value: 0, detail: 'Loading dependencies', tone: 'default' as const },
        { label: 'Open Tasks', value: 0, detail: 'Loading work queue', tone: 'default' as const },
        { label: 'Pending Approvals', value: 0, detail: 'Loading approvals', tone: 'default' as const },
        { label: 'Cross-Domain Impact', value: 0, detail: 'Loading executive view', tone: 'default' as const },
      ];
    }

    return [
      { label: 'Entities', value: state.summary.totalEntities, detail: `${state.references.length} reference records`, tone: 'primary' as const },
      { label: 'Relationships', value: state.summary.totalRelationships, detail: `${state.workflows.length} active workflows`, tone: 'default' as const },
      {
        label: 'Open Tasks',
        value: state.summary.openTasks,
        detail: `${state.taskCenter.filter((item) => item.status === 'overdue').length} overdue`,
        tone: state.taskCenter.some((item) => item.status === 'overdue') ? 'danger' as const : 'warning' as const,
      },
      {
        label: 'Pending Approvals',
        value: state.summary.pendingApprovals,
        detail: `${state.approvalQueue.length} items in queue`,
        tone: state.summary.pendingApprovals > 0 ? 'warning' as const : 'success' as const,
      },
      {
        label: 'Cross-Domain Impact',
        value: state.summary.crossDomainImpact,
        detail: `${state.summary.criticalNotifications} critical alerts`,
        tone: state.summary.criticalNotifications > 0 ? 'danger' as const : 'success' as const,
      },
    ];
  }, [state]);

  const topRelationships = useMemo(
    () => [...(state?.relationships || [])].sort((left, right) => right.strength - left.strength),
    [state],
  );

  const topTasks = useMemo(() => {
    return [...(state?.taskCenter || [])].sort((left, right) => {
      const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [state]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader
          title="Enterprise Governance Operating System"
          description="Unified entity model, relationship engine, task center, approvals, workflows, analytics, and executive 360 views across the GRC platform."
        />
        <PageSectionCard title="Loading enterprise operating system">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Loading shared entities, cross-module relationships, actions, tasks, approvals, workflows, and executive analytics...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div style={pageStyle}>
        <PageHeader
          title="Enterprise Governance Operating System"
          description="Unified entity model, relationship engine, task center, approvals, workflows, analytics, and executive 360 views across the GRC platform."
        />
        <EmptyStatePanel
          eyebrow="Enterprise OS"
          title="Unable to load enterprise operating system"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadState()}>Retry</Button>}
        />
      </div>
    );
  }

  const data = state!;
  const executive = data.executiveSummary;

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Enterprise Governance Operating System"
        description="Connected operating model across governance, risk, audit, privacy, third party, ESG, AI, controls, assets, evidence, workflows, approvals, and activity."
        action={<Button variant="primary" onClick={() => void loadState()}>Refresh State</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar actions={<Button variant="secondary" onClick={() => void handleSearch()} disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>}>
        <input
          type="search"
          placeholder="Search risks, controls, assets, vendors, policies, AI, privacy, ESG..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSearch();
            }
          }}
          style={{
            padding: theme.spacing[3],
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            minWidth: 0,
            width: '100%',
          }}
        />
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}

      <div style={twoColumnGrid}>
        <PageSectionCard
          title="Executive Relationship Dashboard"
          subtitle="Top risks, control coverage, open findings, vendor exposure, privacy exposure, ESG exposure, AI exposure, and cross-domain impact."
          action={<Badge variant={executive.crossDomainImpact > 15 ? 'warning' : 'success'} size="sm">{executive.crossDomainImpact} impact links</Badge>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing[3] }}>
            {[
              { label: 'Control Coverage', value: `${executive.controlCoverage}%` },
              { label: 'Open Findings', value: executive.openFindings },
              { label: 'Vendor Exposure', value: executive.vendorExposure },
              { label: 'Privacy Exposure', value: executive.privacyExposure },
              { label: 'ESG Exposure', value: executive.esgExposure },
              { label: 'AI Exposure', value: executive.aiExposure },
              { label: 'Pending Approvals', value: data.summary.pendingApprovals },
              { label: 'Critical Alerts', value: data.summary.criticalNotifications },
            ].map((item) => (
              <Card key={item.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{item.value}</div>
              </Card>
            ))}
          </div>
          <div style={{ marginTop: theme.spacing[4], display: 'grid', gap: theme.spacing[2] }}>
            {executive.topRisks.map((risk) => (
              <Card key={risk.id} style={{ padding: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{risk.title}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Score {risk.score}</div>
                  </div>
                  <Button variant="secondary" onClick={() => void open360('risk', risk.id)}>Open 360</Button>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard
          title="Enterprise Search Index"
          subtitle="One index across risks, controls, policies, assets, audits, findings, vendors, AI systems, privacy records, ESG records, users, tasks, and activities."
          action={<Badge variant="default" size="sm">{searchResults.length} matches</Badge>}
        >
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {searchResults.map((item) => (
              <Card key={`${item.entityType}-${item.id}`} style={{ padding: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.name}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {prettyLabel(item.entityType)} · {item.owner || 'No owner'} · {item.businessUnit || 'Enterprise'}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => void open360(item.entityType, item.id)}>View 360</Button>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={twoColumnGrid}>
        <RelationshipList title="Enterprise Relationship Engine" edges={topRelationships} onSelect={(type, id) => void open360(type, id)} />

        <PageSectionCard
          title="Shared Workflow Engine"
          subtitle="Reusable workflows spanning risk, audit, vendor, policy, DPIA, incident, and control review operations."
          action={<Badge variant="default" size="sm">{data.workflows.length} workflows</Badge>}
        >
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {data.workflows.map((workflow) => (
              <Card key={workflow.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{workflow.title}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{workflow.stages.join(' → ')}</div>
                  </div>
                  <Badge variant={statusVariant(workflow.status)} size="sm">{workflow.status}</Badge>
                </div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  Approvals: {workflow.approvalsRequired.join(', ')}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={twoColumnGrid}>
        <PageSectionCard
          title="Unified Task Center"
          subtitle="Assigned tasks, overdue tasks, pending reviews, audit actions, compliance actions, risk actions, vendor actions, and privacy actions."
          action={<Badge variant="warning" size="sm">{topTasks.filter((item) => item.status !== 'completed').length} open</Badge>}
        >
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {topTasks.slice(0, 10).map((item: EnterpriseTaskItem) => (
              <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.title}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {item.sourceModule} · {item.owner} · due {formatDate(item.dueDate)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Badge variant={priorityVariant(item.priority)} size="sm">{item.priority}</Badge>
                    <Badge variant={statusVariant(item.status)} size="sm">{prettyLabel(item.status)}</Badge>
                  </div>
                </div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  Progress {item.progressPercent}%
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard
          title="Shared Approval Engine"
          subtitle="Central approvals for access requests, privacy DPIAs, AI approvals, and other cross-module review decisions."
          action={<Badge variant="warning" size="sm">{data.approvalQueue.length} approvals</Badge>}
        >
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {data.approvalQueue.map((item: EnterpriseApprovalItem) => (
              <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.title}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {item.approvalType} · requester {item.requester} · approver {item.approver || 'Unassigned'}
                    </div>
                  </div>
                  <Badge variant={statusVariant(item.status)} size="sm">{prettyLabel(item.status)}</Badge>
                </div>
                {item.notes ? (
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {item.notes}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={twoColumnGrid}>
        <PageSectionCard
          title="Cross-Module Analytics"
          subtitle="Risk by vendor, risk by asset, risk by AI system, findings by framework, controls by regulation, privacy by business unit, ESG by supplier, and audit by department."
          action={<Badge variant="default" size="sm">8 analytics views</Badge>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
            {[
              { label: 'Risk by Vendor', rows: data.analytics.riskByVendor.map((item) => `${item.vendor}: ${item.count}`) },
              { label: 'Risk by Asset', rows: data.analytics.riskByAsset.map((item) => `${item.asset}: ${item.count}`) },
              { label: 'Risk by AI System', rows: data.analytics.riskByAiSystem.map((item) => `${item.aiSystem}: ${item.count}`) },
              { label: 'Findings by Framework', rows: data.analytics.findingsByFramework.map((item) => `${item.framework}: ${item.count}`) },
              { label: 'Controls by Regulation', rows: data.analytics.controlsByRegulation.map((item) => `${item.regulation}: ${item.count}`) },
              { label: 'Privacy by Business Unit', rows: data.analytics.privacyByBusinessUnit.map((item) => `${item.businessUnit}: ${item.count}`) },
              { label: 'ESG by Supplier', rows: data.analytics.esgBySupplier.map((item) => `${item.supplier}: ${item.score}%`) },
              { label: 'Audit by Department', rows: data.analytics.auditByDepartment.map((item) => `${item.department}: ${item.count}`) },
            ].map((block) => (
              <Card key={block.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{block.label}</div>
                <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                  {(block.rows.length ? block.rows : ['No linked data yet']).slice(0, 5).map((row) => (
                    <div key={row} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{row}</div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard
          title="Master Data Governance"
          subtitle="Reference tables for departments, regions, countries, business units, frameworks, categories, taxonomies, risk types, and control types."
          action={<Badge variant="default" size="sm">{data.references.length} reference rows</Badge>}
        >
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {data.references.map((item) => (
              <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.label}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {prettyLabel(item.referenceType)} · {item.code}
                    </div>
                  </div>
                  <Badge variant="default" size="sm">{prettyLabel(item.referenceType)}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <PageSectionCard
        title="Enterprise Notifications"
        subtitle="In-app alerts derived from overdue tasks, pending approvals, active privacy incidents, and other cross-module operating pressure."
        action={<Badge variant={data.notifications.some((item) => item.severity === 'critical') ? 'danger' : 'default'} size="sm">{data.notifications.length} notifications</Badge>}
      >
        <div style={{ display: 'grid', gap: theme.spacing[2] }}>
          {data.notifications.map((item) => (
            <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.title}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.message}</div>
                </div>
                <Badge variant={priorityVariant(item.severity)} size="sm">{item.severity}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </PageSectionCard>

      <Entity360Drawer view={selectedView} onClose={() => setSelectedView(null)} />
    </div>
  );
}

export default EnterpriseOperatingSystem;
