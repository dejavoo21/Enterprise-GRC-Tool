import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyStatePanel, Modal, PageHeader, PageSectionCard } from '../components';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/api';
import type { ApiResponse, Asset, AssetDetailResponse, AssetReviewRecord, CreateAssetReviewInput } from '../types/asset';
import './AppReviewRegister.css';

const API_BASE = '/api/v1/assets';
type ReviewFilter = 'all' | 'current' | 'overdue' | 'missing';

function reviewState(asset: Asset, today: string): Exclude<ReviewFilter, 'all'> {
  if (!asset.lastReviewDate) return 'missing';
  if (asset.nextReviewDate && asset.nextReviewDate.slice(0, 10) < today) return 'overdue';
  return 'current';
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function ReviewDialog({ asset, reviewer, onClose, onSaved }: {
  asset: Asset;
  reviewer: string;
  onClose: () => void;
  onSaved: (input: CreateAssetReviewInput) => Promise<void>;
}) {
  const [reviewType, setReviewType] = useState<CreateAssetReviewInput['reviewType']>('quarterly');
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState({ ownerConfirmed: false, classificationValidated: false, riskValidated: false, locationValidated: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const allConfirmed = Object.values(checks).every(Boolean);

  const submit = async () => {
    if (!notes.trim() || !allConfirmed) return;
    try {
      setSubmitting(true);
      setError('');
      await onSaved({ reviewType, reviewer, status: 'completed', ...checks, completedAt: new Date().toISOString(), notes: notes.trim() });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete the application review.');
    } finally {
      setSubmitting(false);
    }
  };

  return <Modal accessibleDialog isOpen onClose={onClose} title={`Complete review: ${asset.name}`} width="620px" footer={<><Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={submitting || !notes.trim() || !allConfirmed}>{submitting ? 'Saving...' : 'Complete review'}</Button></>}>
    <div className="appReviewDialog">
      <label>Review type<select value={reviewType} onChange={(event) => setReviewType(event.target.value as CreateAssetReviewInput['reviewType'])}><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="ad_hoc">Ad hoc</option></select></label>
      <div className="appReviewChecks" aria-label="Review confirmations">
        {([
          ['ownerConfirmed', 'Application ownership is confirmed'],
          ['classificationValidated', 'Information classification is validated'],
          ['riskValidated', 'Risk rating is validated'],
          ['locationValidated', 'Hosting or location information is validated'],
        ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
      </div>
      <label>Reviewer notes<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} required placeholder="Record the evidence reviewed, decisions made, and any follow-up required." /></label>
      <p className="appReviewHint">Reviewer: {reviewer}. Completing this review creates a persisted review record, lifecycle event, and activity-ledger entry.</p>
      {error ? <div role="alert" className="appReviewError">{error}</div> : null}
    </div>
  </Modal>;
}

export function AppReviewRegister() {
  const { user } = useAuth();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [applications, setApplications] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<AssetDetailResponse | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadApplications = useCallback(async (preferredId?: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiCall<ApiResponse<Asset[]>>(`${API_BASE}?type=application`);
      setApplications(response.data);
      const selectedId = preferredId || response.data[0]?.id;
      if (selectedId) {
        const detail = await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${selectedId}`);
        setSelected(detail.data);
      } else setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load application reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  const metrics = useMemo(() => applications.reduce((result, asset) => {
    result[reviewState(asset, today)] += 1;
    return result;
  }, { current: 0, overdue: 0, missing: 0 }), [applications, today]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((asset) => {
      const matchesSearch = !term || [asset.name, asset.assetTag, asset.owner, asset.businessOwner, asset.technicalOwner].some((value) => value?.toLowerCase().includes(term));
      return matchesSearch && (filter === 'all' || reviewState(asset, today) === filter);
    });
  }, [applications, filter, search, today]);

  const selectApplication = async (assetId: string) => {
    try {
      setError('');
      const response = await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${assetId}`);
      setSelected(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the selected application.');
    }
  };

  const completeReview = async (input: CreateAssetReviewInput) => {
    if (!selected) return;
    await apiCall<ApiResponse<AssetReviewRecord>>(`${API_BASE}/${selected.asset.id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    await loadApplications(selected.asset.id);
  };

  const metricCards: Array<{ label: string; value: number; filter: ReviewFilter; detail: string }> = [
    { label: 'Applications', value: applications.length, filter: 'all', detail: 'Persisted application assets' },
    { label: 'Current reviews', value: metrics.current, filter: 'current', detail: 'Review date is current' },
    { label: 'Overdue', value: metrics.overdue, filter: 'overdue', detail: 'Next review date has passed' },
    { label: 'Never reviewed', value: metrics.missing, filter: 'missing', detail: 'No completed review recorded' },
  ];

  return <div className="appReviewPage">
    <PageHeader title="Application Review Register" description="Review persisted application assets, record assurance decisions, and retain an auditable review history." breadcrumb="Audit / Application Reviews" />
    <div className="appReviewMetrics" aria-label="Application review summary">
      {metricCards.map((metric) => <button key={metric.label} type="button" className={filter === metric.filter ? 'active' : ''} onClick={() => setFilter(metric.filter)} aria-pressed={filter === metric.filter}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}
    </div>
    <PageSectionCard title="Application review queue" subtitle="Select an application to inspect its recorded assurance history and complete a governed review.">
      <div className="appReviewToolbar">
        <label>Search applications<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, asset tag, or owner" /></label>
        <label>Review status<select value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)}><option value="all">All applications</option><option value="current">Current</option><option value="overdue">Overdue</option><option value="missing">Never reviewed</option></select></label>
      </div>
      {error ? <div role="alert" className="appReviewError">{error}</div> : null}
      {loading ? <p className="appReviewHint">Loading persisted application assets...</p> : applications.length === 0 ? <EmptyStatePanel eyebrow="Application inventory" title="No application assets recorded" description="Create application assets in Asset Management before completing application reviews. LAFLO does not generate sample applications, owners, findings, or review outcomes." /> : <div className="appReviewLayout">
        <div className="appReviewTableWrap">
          <table className="appReviewTable"><thead><tr><th>Application</th><th>Owner</th><th>Criticality</th><th>Review status</th><th>Next review</th></tr></thead><tbody>
            {filtered.map((asset) => { const state = reviewState(asset, today); return <tr key={asset.id} tabIndex={0} className={selected?.asset.id === asset.id ? 'selected' : ''} onClick={() => void selectApplication(asset.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void selectApplication(asset.id); } }}><td><strong>{asset.name}</strong><small>{asset.assetTag}</small></td><td>{asset.businessOwner || asset.assetOwner || asset.owner || 'Not assigned'}</td><td><Badge variant={asset.criticality === 'critical' ? 'danger' : asset.criticality === 'high' ? 'warning' : 'default'} size="sm">{asset.criticality}</Badge></td><td><Badge variant={state === 'current' ? 'success' : state === 'overdue' ? 'danger' : 'warning'} size="sm">{state === 'missing' ? 'Never reviewed' : state}</Badge></td><td>{formatDate(asset.nextReviewDate)}</td></tr>; })}
          </tbody></table>
          {filtered.length === 0 ? <EmptyStatePanel eyebrow="Filtered queue" title="No applications match these filters" description="Change the search or review-status filter to see other persisted application assets." /> : null}
        </div>
        {selected ? <aside className="appReviewDetail" aria-label={`${selected.asset.name} review details`}>
          <div><span className="appReviewEyebrow">Selected application</span><h2>{selected.asset.name}</h2><p>{selected.asset.description || 'No application description recorded.'}</p></div>
          <div className="appReviewFacts"><div><span>Classification</span><strong>{selected.asset.classification || 'Not recorded'}</strong></div><div><span>Risk rating</span><strong>{selected.asset.riskRating || 'Not recorded'}</strong></div><div><span>Open findings</span><strong>{selected.asset.openFindingsCount ?? 0}</strong></div><div><span>Evidence gaps</span><strong>{selected.asset.evidenceGapCount ?? 0}</strong></div></div>
          <Button variant="primary" onClick={() => setDialogOpen(true)}>Complete application review</Button>
          <div><h3>Review history</h3>{selected.reviews.length === 0 ? <p className="appReviewHint">No completed reviews are recorded for this application.</p> : <div className="appReviewHistory">{selected.reviews.map((review) => <article key={review.id}><div><strong>{review.reviewType.replace('_', ' ')} review</strong><Badge variant={review.status === 'completed' ? 'success' : review.status === 'overdue' ? 'danger' : 'warning'} size="sm">{review.status}</Badge></div><span>{formatDate(review.completedAt || review.dueAt)} · {review.reviewer}</span>{review.notes ? <p>{review.notes}</p> : null}</article>)}</div>}</div>
        </aside> : null}
      </div>}
    </PageSectionCard>
    {dialogOpen && selected ? <ReviewDialog asset={selected.asset} reviewer={user?.email || 'Signed-in reviewer'} onClose={() => setDialogOpen(false)} onSaved={completeReview} /> : null}
  </div>;
}
