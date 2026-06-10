import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type {
  ApiResponse,
  Asset,
  AssetDashboardData,
  AssetDetailResponse,
  AssetLifecycleEvent,
  AssetLocationHistoryEntry,
  AssetRelationship,
  AssetReviewRecord,
  AssetStatus,
  AssetType,
  BulkAssetUpdateInput,
  CaptureAssetLocationInput,
  CreateAssetInput,
  CreateAssetRelationshipInput,
  CreateAssetReviewInput,
  UpdateAssetInput,
} from '../types/asset';
import {
  ASSET_CLASSIFICATION_LABELS,
  ASSET_CRITICALITY_COLORS,
  ASSET_CRITICALITY_LABELS,
  ASSET_STATUS_COLORS,
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
} from '../types/asset';

const API_BASE = '/api/v1/assets';

const pageStyle = {
  maxWidth: 1400,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const clampStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not set';
}

function formatCoordinates(location?: Asset['lastKnownLocation'] | null) {
  if (!location) return 'Not captured';
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

function Pill({
  label,
  colors,
}: {
  label: string;
  colors: { bg: string; text: string };
}) {
  return (
    <span
      style={{
        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: theme.borderRadius.full,
        fontSize: theme.typography.sizes.xs,
        fontWeight: theme.typography.weights.medium,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function AssetFormModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAssetInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateAssetInput>({
    name: '',
    type: 'application',
    owner: '',
    assetOwner: '',
    businessOwner: '',
    technicalOwner: '',
    custodian: '',
    reviewer: '',
    approver: '',
    department: '',
    businessUnit: '',
    location: '',
    criticality: 'medium',
    classification: 'Internal',
    dataClassification: 'Internal',
    lifecycleStatus: 'requested',
    status: 'requested',
    vendorDependency: 'medium',
    riskRating: 'medium',
    vulnerabilities: 0,
    openIssuesCount: 0,
    openFindingsCount: 0,
    missingControlsCount: 0,
    evidenceGapCount: 0,
    complianceStatus: 'Needs review',
    frameworkCodes: [],
    linkedRiskIds: [],
    linkedControlIds: [],
    linkedEvidenceIds: [],
    linkedPolicyIds: [],
    linkedIssueIds: [],
    linkedAuditIds: [],
    barcodeType: 'code128',
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const update = (key: keyof CreateAssetInput, value: any) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.42)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 80 }} onClick={onClose}>
      <div style={{ width: '94%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6] }} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: theme.spacing[5], fontSize: theme.typography.sizes.xl }}>Add Enterprise Asset</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing[4] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
            <input value={formData.name} onChange={(e) => update('name', e.target.value)} placeholder="Asset name" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <select value={formData.type} onChange={(e) => update('type', e.target.value as AssetType)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={formData.owner} onChange={(e) => update('owner', e.target.value)} placeholder="Platform owner" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.assetOwner || ''} onChange={(e) => update('assetOwner', e.target.value)} placeholder="Asset owner" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.businessOwner || ''} onChange={(e) => update('businessOwner', e.target.value)} placeholder="Business owner" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.custodian || ''} onChange={(e) => update('custodian', e.target.value)} placeholder="Custodian" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.department || ''} onChange={(e) => update('department', e.target.value)} placeholder="Department" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.businessUnit || ''} onChange={(e) => update('businessUnit', e.target.value)} placeholder="Business unit" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input value={formData.location || ''} onChange={(e) => update('location', e.target.value)} placeholder="Location / site" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <select value={formData.criticality} onChange={(e) => update('criticality', e.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              {Object.entries(ASSET_CRITICALITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={formData.classification} onChange={(e) => update('classification', e.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              {Object.entries(ASSET_CLASSIFICATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={formData.lifecycleStatus} onChange={(e) => { update('lifecycleStatus', e.target.value as AssetStatus); update('status', e.target.value as AssetStatus); }} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <textarea value={formData.description || ''} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="Business context, asset purpose, regulatory notes" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <textarea value={formData.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Operational notes" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3] }}>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Asset'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkUpdateModal({
  isOpen,
  selectedCount,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (payload: Omit<BulkAssetUpdateInput, 'assetIds'>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Omit<BulkAssetUpdateInput, 'assetIds'>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.42)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 80 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 560, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6] }} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.xl }}>Bulk Update Assets</h2>
        <div style={{ marginBottom: theme.spacing[5], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Update {selectedCount} selected assets with ownership, lifecycle, classification, or location changes.
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input placeholder="Owner" onChange={(e) => setFormData((current) => ({ ...current, owner: e.target.value || undefined }))} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <input placeholder="Location" onChange={(e) => setFormData((current) => ({ ...current, location: e.target.value || undefined }))} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <select onChange={(e) => setFormData((current) => ({ ...current, classification: (e.target.value || undefined) as any }))} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
            <option value="">Classification</option>
            {Object.entries(ASSET_CLASSIFICATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select onChange={(e) => setFormData((current) => ({ ...current, lifecycleStatus: (e.target.value || undefined) as any, status: (e.target.value || undefined) as any }))} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
            <option value="">Lifecycle status</option>
            {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3] }}>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Updating...' : 'Apply Changes'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAssetReviewInput) => Promise<void>;
}) {
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        reviewType: 'quarterly',
        reviewer,
        status: 'completed',
        ownerConfirmed: true,
        classificationValidated: true,
        riskValidated: true,
        locationValidated: true,
        completedAt: new Date().toISOString(),
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.42)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 80 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 520, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6] }} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: theme.spacing[5], fontSize: theme.typography.sizes.xl }}>Complete Asset Review</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Review notes" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3] }}>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Complete Review'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AssetLifecycleEvent }) {
  const variant =
    event.eventType === 'retired' || event.eventType === 'disposed'
      ? 'danger'
      : event.eventType === 'verified' || event.eventType === 'review_completed'
        ? 'success'
        : event.eventType === 'location_updated'
          ? 'warning'
          : 'default';

  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Badge variant={variant} size="sm">{event.eventType.replace(/_/g, ' ')}</Badge>
            <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{event.summary}</span>
          </div>
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{formatDateTime(event.createdAt)}</span>
        </div>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          {event.actorEmail || 'System'}{event.location ? ` · ${formatCoordinates(event.location)}` : ''}
        </div>
        {event.notes ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{event.notes}</div> : null}
      </div>
    </Card>
  );
}

export function Assets() {
  const [dashboard, setDashboard] = useState<AssetDashboardData | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, assetsRes] = await Promise.all([
        apiCall<ApiResponse<AssetDashboardData>>(`${API_BASE}/dashboard`),
        apiCall<ApiResponse<Asset[]>>(`${API_BASE}?${new URLSearchParams({
          ...(search ? { search } : {}),
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(statusFilter ? { lifecycleStatus: statusFilter } : {}),
        }).toString()}`),
      ]);

      setDashboard(dashboardRes.data);
      setAssets(assetsRes.data);

      if (!selectedAsset && assetsRes.data[0]) {
        const detail = await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${assetsRes.data[0].id}`);
        setSelectedAsset(detail.data);
      } else if (selectedAsset) {
        const detail = await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${selectedAsset.asset.id}`);
        setSelectedAsset(detail.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, selectedAsset]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const selectAsset = async (assetId: string) => {
    const detail = await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${assetId}`);
    setSelectedAsset(detail.data);
  };

  const createAsset = async (payload: CreateAssetInput) => {
    await apiCall<ApiResponse<AssetDetailResponse>>(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAssets();
  };

  const bulkUpdate = async (payload: Omit<BulkAssetUpdateInput, 'assetIds'>) => {
    await apiCall<ApiResponse<Asset[]>>(`${API_BASE}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: selectedIds, ...payload }),
    });
    setSelectedIds([]);
    await fetchAssets();
  };

  const updateAsset = async (assetId: string, payload: UpdateAssetInput) => {
    await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAssets();
  };

  const captureLocation = async () => {
    if (!selectedAsset || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const payload: CaptureAssetLocationInput = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date().toISOString(),
        source: 'browser_geolocation',
        device: navigator.userAgent,
      };
      await apiCall<ApiResponse<{ asset: Asset; location: AssetLocationHistoryEntry }>>(`${API_BASE}/${selectedAsset.asset.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchAssets();
    });
  };

  const completeReview = async (payload: CreateAssetReviewInput) => {
    if (!selectedAsset) return;
    await apiCall<ApiResponse<AssetReviewRecord>>(`${API_BASE}/${selectedAsset.asset.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAssets();
  };

  const verifyAsset = async () => {
    if (!selectedAsset) return;
    await apiCall<ApiResponse<AssetDetailResponse>>(`${API_BASE}/${selectedAsset.asset.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Field verification completed from asset workspace.' }),
    });
    await fetchAssets();
  };

  const regenerateQr = async () => {
    if (!selectedAsset) return;
    await apiCall<ApiResponse<Asset>>(`${API_BASE}/${selectedAsset.asset.id}/qrcode/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await fetchAssets();
  };

  const regenerateBarcode = async () => {
    if (!selectedAsset) return;
    await apiCall<ApiResponse<Asset>>(`${API_BASE}/${selectedAsset.asset.id}/barcode/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcodeType: selectedAsset.asset.barcodeType || 'code128' }),
    });
    await fetchAssets();
  };

  const addRelationship = async () => {
    if (!selectedAsset) return;
    const payload: CreateAssetRelationshipInput = {
      relationshipType: 'risk',
      targetId: `RISK-${Date.now().toString().slice(-4)}`,
      targetName: 'New linked operational risk',
    };
    await apiCall<ApiResponse<AssetRelationship>>(`${API_BASE}/${selectedAsset.asset.id}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAssets();
  };

  const metrics = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: 'Total Assets', value: dashboard.totalAssets, detail: 'Enterprise register size', tone: 'primary' as const },
      { label: 'Critical Assets', value: dashboard.criticalAssets, detail: 'Highest business impact', tone: 'danger' as const },
      { label: 'High Risk Assets', value: dashboard.highRiskAssets, detail: 'Risk score above threshold', tone: 'warning' as const },
      { label: 'Missing Owner', value: dashboard.assetsMissingOwner, detail: 'Ownership gap', tone: 'danger' as const },
      { label: 'Missing Review', value: dashboard.assetsMissingReview, detail: 'Periodic review overdue', tone: 'warning' as const },
      { label: 'Near End Of Life', value: dashboard.assetsNearEndOfLife, detail: 'Refresh planning needed', tone: 'default' as const },
      { label: 'Missing Evidence', value: dashboard.assetsMissingEvidence, detail: 'Compliance evidence gaps', tone: 'warning' as const },
      { label: 'Open Findings', value: dashboard.assetsWithOpenFindings, detail: 'Assurance follow-up', tone: 'danger' as const },
    ];
  }, [dashboard]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Asset Operations" description="Enterprise asset register, ownership, lifecycle, location, compliance, and assurance." />
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading enterprise asset workspace...
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Asset Operations" description="Enterprise asset register, ownership, lifecycle, location, compliance, and assurance." />
        <EmptyStatePanel
          eyebrow="Asset Platform"
          title="Unable to load asset data"
          description={error}
          actions={<Button variant="primary" onClick={fetchAssets}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Asset Operations"
        description="Enterprise asset register, lifecycle management, ownership, QR/barcode tracking, and integrated GRC relationships."
        action={
          <>
            <Button variant="outline" onClick={() => setIsBulkModalOpen(true)} disabled={selectedIds.length === 0}>Bulk Update</Button>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>Add Asset</Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={<Button variant="secondary" onClick={fetchAssets}>Refresh</Button>}
      >
        <input
          type="search"
          placeholder="Search by asset ID, name, owner, location"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 260 }}
        />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
          <option value="">All asset types</option>
          {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
          <option value="">All lifecycle statuses</option>
          {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </PageToolbar>

      {assets.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Asset Register"
          title="No assets in the register yet"
          description="Start with manual entry or use the bulk update flow later for imported records. QR, barcode, reviews, and compliance mappings become available as soon as the first asset exists."
          actions={
            <>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>Add Asset</Button>
              <Button variant="outline" onClick={() => setIsBulkModalOpen(true)}>Bulk Update</Button>
            </>
          }
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <DataTableShell title="Asset Register" subtitle="Compact register with ownership, lifecycle, classification, and risk posture." action={<Badge variant="default" size="sm">{assets.length} assets</Badge>}>
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}></th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Asset</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Ownership</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Type</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Lifecycle</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Criticality</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Classification</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Risk</th>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => void selectAsset(asset.id)}
                      style={{ borderTop: `1px solid ${theme.colors.border}`, cursor: 'pointer', backgroundColor: selectedAsset?.asset.id === asset.id ? theme.colors.surfaceHover : 'transparent' }}
                    >
                      <td style={{ padding: `${theme.spacing[3]} 0` }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(asset.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            setSelectedIds((current) => event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id));
                          }}
                        />
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                        <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                          <strong style={clampStyle}>{asset.name}</strong>
                          <span style={{ ...clampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{asset.assetTag}</span>
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                        <div style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          <span style={clampStyle}>{asset.assetOwner || asset.owner}</span>
                          <span style={clampStyle}>{asset.businessOwner || asset.businessUnit || 'No business owner'}</span>
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{ASSET_TYPE_LABELS[asset.type]}</td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                        <Pill label={ASSET_STATUS_LABELS[asset.lifecycleStatus || asset.status]} colors={ASSET_STATUS_COLORS[asset.lifecycleStatus || asset.status]} />
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                        <Pill label={ASSET_CRITICALITY_LABELS[asset.criticality]} colors={ASSET_CRITICALITY_COLORS[asset.criticality]} />
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{asset.classification || asset.dataClassification || 'Not set'}</td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>
                        <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                          <strong>{asset.riskScore || 0}</strong>
                          <span>{asset.riskRating || 'low'}</span>
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDate(asset.nextReviewDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            {selectedAsset ? (
              <PageSectionCard
                title="Asset Detail Workspace"
                subtitle="Ownership, lifecycle, QR/barcode labels, relationship context, and operational location."
                action={<Badge variant="default" size="sm">{selectedAsset.asset.assetTag}</Badge>}
              >
                <div style={{ display: 'grid', gap: theme.spacing[4] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>{selectedAsset.asset.name}</h3>
                      <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
                        {ASSET_TYPE_LABELS[selectedAsset.asset.type]} · {selectedAsset.asset.location || 'Location not set'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Pill label={ASSET_STATUS_LABELS[selectedAsset.asset.lifecycleStatus || selectedAsset.asset.status]} colors={ASSET_STATUS_COLORS[selectedAsset.asset.lifecycleStatus || selectedAsset.asset.status]} />
                      <Pill label={ASSET_CRITICALITY_LABELS[selectedAsset.asset.criticality]} colors={ASSET_CRITICALITY_COLORS[selectedAsset.asset.criticality]} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Ownership</div>
                      <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                        <div>Asset owner: {selectedAsset.asset.assetOwner || selectedAsset.asset.owner}</div>
                        <div>Business owner: {selectedAsset.asset.businessOwner || 'Not assigned'}</div>
                        <div>Custodian: {selectedAsset.asset.custodian || 'Not assigned'}</div>
                        <div>Reviewer: {selectedAsset.asset.reviewer || 'Not assigned'}</div>
                      </div>
                    </Card>
                    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Risk & Compliance</div>
                      <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                        <div>Risk score: {selectedAsset.asset.riskScore || 0} · {selectedAsset.asset.riskRating || 'low'}</div>
                        <div>Compliance: {selectedAsset.asset.complianceStatus || 'Needs review'}</div>
                        <div>Open findings: {selectedAsset.asset.openFindingsCount || 0}</div>
                        <div>Evidence gaps: {selectedAsset.asset.evidenceGapCount || 0}</div>
                      </div>
                    </Card>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>QR Preview</div>
                      {selectedAsset.asset.qrCodeDataUrl ? (
                        <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[3], justifyItems: 'start' }}>
                          <img src={selectedAsset.asset.qrCodeDataUrl} alt={selectedAsset.asset.assetTag} style={{ width: 170, height: 170, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }} />
                          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                            <Button variant="secondary" onClick={regenerateQr}>Generate QR</Button>
                            <Button variant="outline" onClick={() => window.open(selectedAsset.asset.qrCodeDataUrl, '_blank')}>Download QR</Button>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Barcode Preview</div>
                      {selectedAsset.asset.barcodeDataUrl ? (
                        <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[3], justifyItems: 'start' }}>
                          <img src={selectedAsset.asset.barcodeDataUrl} alt={selectedAsset.asset.assetTag} style={{ width: '100%', maxWidth: 260, height: 100, objectFit: 'contain', borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }} />
                          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                            <Button variant="secondary" onClick={regenerateBarcode}>Generate Barcode</Button>
                            <Button variant="outline" onClick={() => window.open(selectedAsset.asset.barcodeDataUrl, '_blank')}>Print Barcode</Button>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  </div>

                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => void updateAsset(selectedAsset.asset.id, { lifecycleStatus: 'assigned', status: 'assigned' })}>Assign</Button>
                    <Button variant="secondary" onClick={captureLocation}>Capture Location</Button>
                    <Button variant="secondary" onClick={verifyAsset}>Verify Asset</Button>
                    <Button variant="outline" onClick={() => setIsReviewModalOpen(true)}>Complete Review</Button>
                    <Button variant="outline" onClick={addRelationship}>Link Risk</Button>
                    <Button variant="outline" onClick={() => void updateAsset(selectedAsset.asset.id, { lifecycleStatus: 'retired', status: 'retired' })}>Retire</Button>
                    <Button variant="outline" onClick={() => void updateAsset(selectedAsset.asset.id, { lifecycleStatus: 'disposed', status: 'disposed' })}>Dispose</Button>
                  </div>

                  <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Map / Location Panel</div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div>Coordinates: {formatCoordinates(selectedAsset.asset.lastKnownLocation)}</div>
                      <div>Address: {selectedAsset.asset.lastKnownLocation?.address || selectedAsset.asset.location || 'Not captured'}</div>
                      <div>
                        Building / Floor / Room / Rack:{' '}
                        {[selectedAsset.asset.lastKnownLocation?.building, selectedAsset.asset.lastKnownLocation?.floor, selectedAsset.asset.lastKnownLocation?.room, selectedAsset.asset.lastKnownLocation?.rack]
                          .filter(Boolean)
                          .join(' / ') || 'Not captured'}
                      </div>
                    </div>
                  </Card>
                </div>
              </PageSectionCard>
            ) : null}
          </div>

          {selectedAsset ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
              <ActivityFeed title="Lifecycle Activity" subtitle="Lifecycle workflow, QR/barcode operations, scanning, verification, and location movements." countLabel={`${selectedAsset.events.length} events`}>
                {selectedAsset.events.length === 0 ? <EmptyStatePanel title="No lifecycle activity yet" description="Create or update the asset to start the ledger-backed lifecycle feed." /> : selectedAsset.events.slice(0, 8).map((event) => <EventRow key={event.id} event={event} />)}
              </ActivityFeed>

              <PageSectionCard title="Relationships & Review Program" subtitle="Traceability to risks, controls, evidence, issues, audits, and review cadence.">
                <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                  <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Relationship Graph</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                      {selectedAsset.relationships.length === 0 ? (
                        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No linked risks, controls, evidence, issues, or audits yet.</div>
                      ) : (
                        selectedAsset.relationships.map((relationship) => (
                          <div key={relationship.id} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{relationship.relationshipType} → {relationship.targetName}</span>
                            <Badge variant="default" size="sm">{relationship.targetId}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Asset Review Program</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                      {selectedAsset.reviews.length === 0 ? (
                        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No quarterly, annual, or ad-hoc reviews completed yet.</div>
                      ) : (
                        selectedAsset.reviews.map((review) => (
                          <div key={review.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing[3] }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                              <strong style={{ fontSize: theme.typography.sizes.sm }}>{review.reviewType}</strong>
                              <Badge variant={review.status === 'completed' ? 'success' : review.status === 'overdue' ? 'danger' : 'warning'} size="sm">{review.status}</Badge>
                            </div>
                            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                              Reviewer: {review.reviewer} · Completed {formatDate(review.completedAt)} · Due {formatDate(review.dueAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              </PageSectionCard>
            </div>
          ) : null}
        </>
      )}

      <AssetFormModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={createAsset} />
      <BulkUpdateModal isOpen={isBulkModalOpen} selectedCount={selectedIds.length} onClose={() => setIsBulkModalOpen(false)} onSubmit={bulkUpdate} />
      <ReviewModal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} onSubmit={completeReview} />
    </div>
  );
}

export default Assets;
