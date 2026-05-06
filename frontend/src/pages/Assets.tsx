import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ActivityFeed,
  Badge,
  Button,
  DataTable,
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
  AssetDetailResponse,
  AssetLifecycleEvent,
  AssetLocationHistoryEntry,
  CaptureAssetLocationInput,
  CreateAssetInput,
  UpdateAssetInput,
} from '../types/asset';
import {
  ASSET_CRITICALITY_COLORS,
  ASSET_CRITICALITY_LABELS,
  ASSET_STATUS_COLORS,
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
} from '../types/asset';

const API_BASE = '/api/v1';

const pageStyle = {
  maxWidth: '1400px',
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

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement | ImageBitmapSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function formatShortDateTime(value?: string) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Browser';
  return navigator.userAgent;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function printQrCode(title: string, dataUrl: string) {
  const popup = window.open('', '_blank', 'width=420,height=520');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head><title>${title}</title></head>
      <body style="font-family: sans-serif; padding: 24px; text-align: center;">
        <h2 style="margin-bottom: 16px;">${title}</h2>
        <img src="${dataUrl}" style="width: 240px; height: 240px;" />
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function StatusPill({ status }: { status: Asset['status'] }) {
  const colors = ASSET_STATUS_COLORS[status];
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
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}

function CriticalityPill({ criticality }: { criticality: Asset['criticality'] }) {
  const colors = ASSET_CRITICALITY_COLORS[criticality];
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
      {ASSET_CRITICALITY_LABELS[criticality]}
    </span>
  );
}

function AssetModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAssetInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateAssetInput>({
    name: '',
    description: '',
    type: 'application',
    owner: '',
    businessUnit: '',
    criticality: 'medium',
    dataClassification: 'Internal',
    status: 'active',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        name: '',
        description: '',
        type: 'application',
        owner: '',
        businessUnit: '',
        criticality: 'medium',
        dataClassification: 'Internal',
        status: 'active',
        notes: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 60 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 640, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6] }} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: theme.spacing[5], fontSize: theme.typography.sizes.xl }}>Add Asset</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing[4] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Asset name" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input name="owner" value={formData.owner} onChange={handleChange} placeholder="Owner" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input name="businessUnit" value={formData.businessUnit} onChange={handleChange} placeholder="Business unit" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <select name="type" value={formData.type} onChange={handleChange} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              <option value="application">Application</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="database">Database</option>
              <option value="saas">SaaS</option>
              <option value="endpoint">Endpoint</option>
              <option value="data_store">Data Store</option>
              <option value="other">Other</option>
            </select>
            <select name="criticality" value={formData.criticality} onChange={handleChange} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select name="status" value={formData.status} onChange={handleChange} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <input name="dataClassification" value={formData.dataClassification} onChange={handleChange} placeholder="Data classification" required style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} placeholder="Description" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontFamily: theme.typography.fontFamily }} />
          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} placeholder="Operational notes" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontFamily: theme.typography.fontFamily }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3] }}>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Asset'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScanAssetModal({
  isOpen,
  onClose,
  onScan,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => Promise<void>;
}) {
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);

  const stopStream = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const submitCode = useCallback(async (code: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onScan(code);
      setManualCode('');
      onClose();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Scan failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [onClose, onScan]);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not available in this browser. You can still paste an asset code manually.');
        return;
      }

      if (!window.BarcodeDetector) {
        setError('Live scanning is not supported on this browser yet. Paste the asset QR payload or asset tag manually.');
        return;
      }

      try {
        setIsScanning(true);
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detectLoop = async () => {
          if (!videoRef.current || !detectorRef.current) return;

          try {
            const results = await detectorRef.current.detect(videoRef.current);
            const code = results.find((result) => result.rawValue)?.rawValue;
            if (code) {
              stopStream();
              await submitCode(code);
              return;
            }
          } catch {
            setError('Camera opened, but scanning is not available on this device. You can use manual entry below.');
            stopStream();
            return;
          }

          rafRef.current = requestAnimationFrame(() => {
            void detectLoop();
          });
        };

        void detectLoop();
      } catch (cameraError) {
        setError(cameraError instanceof Error ? cameraError.message : 'Unable to access the camera');
      } finally {
        setIsScanning(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen, stopStream, submitCode]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 70 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 560, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6], display: 'grid', gap: theme.spacing[4] }} onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>Scan Asset</h2>
          <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
            Use the device camera for field scanning, or paste an asset tag manually if camera scanning is unavailable.
          </div>
        </div>

        <div style={{ borderRadius: theme.borderRadius.lg, overflow: 'hidden', backgroundColor: '#0F172A', minHeight: 280, position: 'relative' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: 280, objectFit: 'cover' }} />
          {!streamRef.current ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: theme.typography.sizes.sm, padding: theme.spacing[4], textAlign: 'center' }}>
              {isScanning ? 'Opening camera…' : 'Camera preview will appear here when supported.'}
            </div>
          ) : null}
        </div>

        {error ? (
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: theme.typography.sizes.sm }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Paste asset QR payload or asset tag"
            style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3], flexWrap: 'wrap' }}>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="button" variant="primary" disabled={!manualCode || isSubmitting} onClick={() => void submitCode(manualCode)}>
              {isSubmitting ? 'Resolving...' : 'Open Asset'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: AssetLifecycleEvent }) {
  const outcomeVariant =
    event.eventType === 'retired'
      ? 'danger'
      : event.eventType === 'scanned' || event.eventType === 'verified'
        ? 'success'
        : event.eventType === 'location_updated'
          ? 'warning'
          : 'default';

  return (
    <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing[4], backgroundColor: theme.colors.surface, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: theme.spacing[2], minWidth: 0 }}>
          <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant={outcomeVariant} size="sm">{event.eventType.replace('_', ' ')}</Badge>
            <strong style={{ color: theme.colors.text.main, ...clampStyle }}>{event.actorEmail || 'System'}</strong>
          </div>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{event.summary}</div>
          {event.notes ? (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{event.notes}</div>
          ) : null}
        </div>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, whiteSpace: 'nowrap' }}>{formatShortDateTime(event.createdAt)}</div>
      </div>
      {(event.device || event.location) ? (
        <details style={{ marginTop: theme.spacing[3] }}>
          <summary style={{ cursor: 'pointer', fontSize: theme.typography.sizes.xs, color: theme.colors.primary }}>View details</summary>
          <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {event.device ? <div>Device: {event.device}</div> : null}
            {event.location ? <div>Location: {formatCoordinates(event.location.latitude, event.location.longitude)}</div> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function Assets() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedAssetId = new URLSearchParams(location.search).get('asset');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [events, setEvents] = useState<AssetLifecycleEvent[]>([]);
  const [locationHistory, setLocationHistory] = useState<AssetLocationHistoryEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<Asset['status']>('active');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result: ApiResponse<Asset[]> = await apiCall(`${API_BASE}/assets`);
      setAssets(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssetDetail = useCallback(async (assetId: string) => {
    try {
      setDetailLoading(true);
      setDetailError(null);
      const result: ApiResponse<AssetDetailResponse> = await apiCall(`${API_BASE}/assets/${assetId}`);
      setSelectedAsset(result.data.asset);
      setEvents(result.data.events);
      setLocationHistory(result.data.locationHistory);
      setNoteDraft(result.data.asset.notes || '');
      setStatusDraft(result.data.asset.status);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to fetch asset detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (selectedAssetId) {
      void fetchAssetDetail(selectedAssetId);
      return;
    }

    setSelectedAsset(null);
    setEvents([]);
    setLocationHistory([]);
    setNoteDraft('');
  }, [fetchAssetDetail, selectedAssetId]);

  const openAsset = useCallback((assetId: string) => {
    navigate(`/assets?asset=${assetId}`);
  }, [navigate]);

  const handleCreateAsset = async (input: CreateAssetInput) => {
    const result: ApiResponse<AssetDetailResponse> = await apiCall(`${API_BASE}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    await fetchAssets();
    setSelectedAsset(result.data.asset);
    setEvents(result.data.events);
    setLocationHistory(result.data.locationHistory);
    setNoteDraft(result.data.asset.notes || '');
    setStatusDraft(result.data.asset.status);
    navigate(`/assets?asset=${result.data.asset.id}`);
  };

  const handleSaveOperationalUpdate = async () => {
    if (!selectedAsset) return;

    setSaving(true);
    try {
      const payload: UpdateAssetInput = {
        status: statusDraft,
        notes: noteDraft,
      };

      const result: ApiResponse<AssetDetailResponse> = await apiCall(`${API_BASE}/assets/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      setSelectedAsset(result.data.asset);
      setEvents(result.data.events);
      setLocationHistory(result.data.locationHistory);
      setStatusDraft(result.data.asset.status);
      await fetchAssets();
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyAsset = async () => {
    if (!selectedAsset) return;

    setSaving(true);
    try {
      const result: ApiResponse<AssetDetailResponse> = await apiCall(`${API_BASE}/assets/${selectedAsset.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Asset verification completed from field workflow.' }),
      });

      setSelectedAsset(result.data.asset);
      setEvents(result.data.events);
      setLocationHistory(result.data.locationHistory);
      await fetchAssets();
    } finally {
      setSaving(false);
    }
  };

  const handleCaptureLocation = async () => {
    if (!selectedAsset) return;
    if (!navigator.geolocation) {
      setDetailError('Geolocation is not supported on this device.');
      return;
    }

    setCapturingLocation(true);
    setDetailError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const payload: CaptureAssetLocationInput = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date().toISOString(),
        device: getDeviceLabel(),
        source: 'browser_geolocation',
        notes: 'Captured from Asset Operations field flow.',
      };

      await apiCall(`${API_BASE}/assets/${selectedAsset.id}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      await fetchAssetDetail(selectedAsset.id);
      await fetchAssets();
    } catch (geoError) {
      setDetailError(geoError instanceof Error ? geoError.message : 'Failed to capture location');
    } finally {
      setCapturingLocation(false);
    }
  };

  const handleScanAsset = async (code: string) => {
    const result: ApiResponse<AssetDetailResponse> = await apiCall(`${API_BASE}/assets/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        device: getDeviceLabel(),
      }),
    });

    setSelectedAsset(result.data.asset);
    setEvents(result.data.events);
    setLocationHistory(result.data.locationHistory);
    setNoteDraft(result.data.asset.notes || '');
    setStatusDraft(result.data.asset.status);
    navigate(`/assets?asset=${result.data.asset.id}`);
    await fetchAssets();
  };

  const metrics = useMemo(() => {
    const recentlyLocated = assets.filter((asset) => {
      if (!asset.lastKnownLocation?.capturedAt) return false;
      return Date.now() - new Date(asset.lastKnownLocation.capturedAt).getTime() < 1000 * 60 * 60 * 24 * 30;
    }).length;

    return [
      { label: 'Total Assets', value: assets.length, detail: 'Tracked in the operating inventory', tone: 'primary' as const },
      { label: 'Critical', value: assets.filter((asset) => asset.criticality === 'critical').length, detail: 'Highest impact assets', tone: 'danger' as const },
      { label: 'Active', value: assets.filter((asset) => asset.status === 'active').length, detail: 'Available for field operations', tone: 'success' as const },
      { label: 'Located Recently', value: recentlyLocated, detail: 'GPS captured in the last 30 days', tone: 'warning' as const },
    ];
  }, [assets]);

  const columns = [
    {
      key: 'assetTag',
      header: 'Asset ID',
      width: '170px',
      render: (item: Asset) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.assetTag}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{ASSET_TYPE_LABELS[item.type]}</div>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Asset',
      render: (item: Asset) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main, ...clampStyle }}>{item.name}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, ...clampStyle }}>{item.owner}</div>
        </div>
      ),
    },
    { key: 'businessUnit', header: 'Business Unit' },
    {
      key: 'criticality',
      header: 'Criticality',
      render: (item: Asset) => <CriticalityPill criticality={item.criticality} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Asset) => <StatusPill status={item.status} />,
    },
    {
      key: 'lastKnownLocation',
      header: 'Last Location',
      render: (item: Asset) => (
        <div style={{ minWidth: 0 }}>
          {item.lastKnownLocation ? (
            <>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{formatCoordinates(item.lastKnownLocation.latitude, item.lastKnownLocation.longitude)}</div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{formatShortDateTime(item.lastKnownLocation.capturedAt)}</div>
            </>
          ) : (
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Not captured</span>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Asset Operations" description="Track business systems, infrastructure, and field activity with scan-ready asset records." />
        <PageSectionCard title="Loading Assets">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading asset register...</div>
        </PageSectionCard>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Asset Operations"
        description="Generate QR-enabled assets, scan them in the field, capture GPS position, and keep a lifecycle trail for operational and audit use."
        action={(
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={() => setIsScanModalOpen(true)}>Scan Asset</Button>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>Add Asset</Button>
          </div>
        )}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={(
          <>
            <Button variant="outline" onClick={() => setIsScanModalOpen(true)}>Open Scanner</Button>
            <Button variant="outline" onClick={() => window.alert('Import workflow can be connected to your existing bulk upload route.')}>Import Assets</Button>
            <Button variant="outline" onClick={() => window.alert('Template download can be wired to your CSV template endpoint.')}>Download Template</Button>
          </>
        )}
      >
        <Badge variant="default" size="sm">Field Workflow</Badge>
        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Scan an asset, open the detail panel, then update status, location, and notes from the same screen.
        </span>
      </PageToolbar>

      {error ? (
        <EmptyStatePanel
          eyebrow="Asset Register"
          title="Unable to load assets"
          description={error}
          actions={<Button variant="primary" onClick={fetchAssets}>Retry</Button>}
        />
      ) : assets.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Asset Register"
          title="No assets are registered yet"
          description="Start with a QR-ready asset so field teams can scan it, capture its location, and maintain a lifecycle trail without leaving the Asset Operations module."
          actions={(
            <>
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>Add Asset</Button>
              <Button variant="outline" onClick={() => setIsScanModalOpen(true)}>Scan Asset</Button>
              <Button variant="outline" onClick={() => window.alert('Template download can be wired to your CSV template endpoint.')}>Download Template</Button>
            </>
          )}
        />
      ) : null}

      {selectedAsset ? (
        <PageSectionCard
          title={selectedAsset.name}
          subtitle={`Asset ${selectedAsset.assetTag} · ${ASSET_TYPE_LABELS[selectedAsset.type]}`}
          action={(
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <CriticalityPill criticality={selectedAsset.criticality} />
              <StatusPill status={selectedAsset.status} />
            </div>
          )}
        >
          {detailLoading ? (
            <div style={{ padding: theme.spacing[6], color: theme.colors.text.secondary }}>Loading asset detail…</div>
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing[4], minWidth: 0 }}>
              {detailError ? (
                <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: theme.typography.sizes.sm }}>
                  {detailError}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: theme.spacing[4], minWidth: 0 }}>
                <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing[4], minWidth: 0 }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset Profile</div>
                  <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <div><strong style={{ color: theme.colors.text.main }}>Owner:</strong> {selectedAsset.owner}</div>
                    <div><strong style={{ color: theme.colors.text.main }}>Business Unit:</strong> {selectedAsset.businessUnit}</div>
                    <div><strong style={{ color: theme.colors.text.main }}>Classification:</strong> {selectedAsset.dataClassification}</div>
                    <div><strong style={{ color: theme.colors.text.main }}>Created:</strong> {formatShortDateTime(selectedAsset.createdAt)}</div>
                    <div><strong style={{ color: theme.colors.text.main }}>Last Updated:</strong> {formatShortDateTime(selectedAsset.updatedAt)}</div>
                    <div><strong style={{ color: theme.colors.text.main }}>Description:</strong> {selectedAsset.description || 'No description provided.'}</div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing[4], minWidth: 0, display: 'grid', justifyItems: 'center', alignContent: 'start', gap: theme.spacing[3] }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', justifySelf: 'start' }}>Asset QR Code</div>
                  {selectedAsset.qrCodeDataUrl ? (
                    <img src={selectedAsset.qrCodeDataUrl} alt={`QR code for ${selectedAsset.assetTag}`} style={{ width: 200, height: 200, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }} />
                  ) : null}
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, textAlign: 'center', wordBreak: 'break-word' }}>{selectedAsset.qrCodeValue}</div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button variant="outline" onClick={() => selectedAsset.qrCodeDataUrl && downloadDataUrl(selectedAsset.qrCodeDataUrl, `${selectedAsset.assetTag}.png`)}>Download QR Code</Button>
                    <Button variant="outline" onClick={() => selectedAsset.qrCodeDataUrl && printQrCode(selectedAsset.assetTag, selectedAsset.qrCodeDataUrl)}>Print Label</Button>
                  </div>
                </div>

                <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing[4], minWidth: 0, display: 'grid', gap: theme.spacing[3] }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Field Actions</div>
                  <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as Asset['status'])}
                      style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
                    >
                      <option value="active">Active</option>
                      <option value="planned">Planned</option>
                      <option value="retired">Retired</option>
                    </select>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      rows={5}
                      placeholder="Add field notes, findings, or handoff context"
                      style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, resize: 'vertical', fontFamily: theme.typography.fontFamily }}
                    />
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Button variant="primary" onClick={() => void handleSaveOperationalUpdate()} disabled={saving}>{saving ? 'Saving...' : 'Save Update'}</Button>
                      <Button variant="outline" onClick={() => void handleCaptureLocation()} disabled={capturingLocation}>
                        {capturingLocation ? 'Capturing...' : 'Capture Location'}
                      </Button>
                      <Button variant="outline" onClick={() => void handleVerifyAsset()} disabled={saving}>Verify Asset</Button>
                    </div>
                    <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {selectedAsset.lastKnownLocation ? (
                        <>
                          <strong style={{ color: theme.colors.text.main }}>Last known location:</strong> {formatCoordinates(selectedAsset.lastKnownLocation.latitude, selectedAsset.lastKnownLocation.longitude)} on {formatShortDateTime(selectedAsset.lastKnownLocation.capturedAt)}
                        </>
                      ) : (
                        'No GPS location has been captured for this asset yet.'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: theme.spacing[4], minWidth: 0 }}>
                <ActivityFeed
                  title="Lifecycle Activity"
                  subtitle="Stored asset events for creation, scans, verification, retirement, and location updates."
                  countLabel={`${events.length} events`}
                  empty={<div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>No lifecycle events recorded yet.</div>}
                >
                  {events.map((event) => <EventCard key={event.id} event={event} />)}
                </ActivityFeed>

                <PageSectionCard title="Location History" subtitle="Recent GPS captures from field operations.">
                  <div style={{ display: 'grid', gap: theme.spacing[3], minWidth: 0 }}>
                    {locationHistory.length === 0 ? (
                      <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>No location updates captured yet.</div>
                    ) : (
                      locationHistory.slice(0, 8).map((entry) => (
                        <div key={entry.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing[4], backgroundColor: theme.colors.surface }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                            <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
                              <strong style={{ color: theme.colors.text.main }}>{formatCoordinates(entry.latitude, entry.longitude)}</strong>
                              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{entry.address || 'Coordinates only'}</span>
                              <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{entry.device || entry.source || 'Field capture'}</span>
                            </div>
                            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, whiteSpace: 'nowrap' }}>{formatShortDateTime(entry.capturedAt)}</span>
                          </div>
                          {entry.notes ? (
                            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{entry.notes}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </PageSectionCard>
              </div>
            </div>
          )}
        </PageSectionCard>
      ) : null}

      <DataTableShell title="Asset Register" subtitle="Scan-ready operational view of assets currently in scope.">
        <DataTable
          data={assets}
          columns={columns}
          searchPlaceholder="Search assets..."
          primaryAction={{ label: 'New Asset', onClick: () => setIsModalOpen(true) }}
          onRowClick={(asset) => openAsset(asset.id)}
        />
      </DataTableShell>

      <AssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateAsset} />
      <ScanAssetModal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} onScan={handleScanAsset} />
    </div>
  );
}
