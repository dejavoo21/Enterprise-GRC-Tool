import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, Badge } from '../components';import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';import { DataTable } from '../components/DataTable';
import type { Asset, CreateAssetInput, ApiResponse } from '../types/asset';
import {
  ASSET_TYPE_LABELS,
  ASSET_CRITICALITY_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_CRITICALITY_COLORS,
  ASSET_STATUS_COLORS,
} from '../types/asset';

const API_BASE = '/api/v1';

interface AssetWithComputedFields extends Asset {
  daysUntilReview?: number;
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      setFormData({
        name: '',
        description: '',
        type: 'application',
        owner: '',
        businessUnit: '',
        criticality: 'medium',
        dataClassification: 'Internal',
        status: 'active',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[8],
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6] }}>Create New Asset</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="application">Application</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="database">Database</option>
                <option value="saas">SaaS</option>
                <option value="endpoint">Endpoint</option>
                <option value="data_store">Data Store</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Criticality *
              </label>
              <select
                name="criticality"
                value={formData.criticality}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Owner *
              </label>
              <input
                type="text"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                required
                placeholder="e.g., John Doe"
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Business Unit *
              </label>
              <input
                type="text"
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleChange}
                required
                placeholder="e.g., Finance"
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Data Classification *
              </label>
              <select
                name="dataClassification"
                value={formData.dataClassification}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="Public">Public</option>
                <option value="Internal">Internal</option>
                <option value="Confidential">Confidential</option>
                <option value="Restricted">Restricted</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="active">Active</option>
                <option value="planned">Planned</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end', marginTop: theme.spacing[4] }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                backgroundColor: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Assets() {
  const { currentWorkspace } = useWorkspace();
  const [assets, setAssets] = useState<AssetWithComputedFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [_selectedCriticality] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result: ApiResponse<Asset[]> = await apiCall(`${API_BASE}/assets`, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
        throw new Error(errorMsg);
      }

      setAssets(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleCreateAsset = async (input: CreateAssetInput) => {
    const result: ApiResponse<Asset> = await apiCall(`${API_BASE}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify(input),
    });

    if (result.error) {
      const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
      throw new Error(errorMsg);
    }

    // Refresh the assets list
    await fetchAssets();
  };

  const filteredAssets = assets;

  const summaryStats = {
    total: assets.length,
    critical: assets.filter(a => a.criticality === 'critical').length,
    active: assets.filter(a => a.status === 'active').length,
    planned: assets.filter(a => a.status === 'planned').length,
  };

  const columns = [
    { key: 'id', header: 'ID', width: '80px' },
    {
      key: 'name',
      header: 'Name',
      render: (item: Asset) => (
        <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>
          {item.name}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: Asset) => <Badge variant="default">{ASSET_TYPE_LABELS[item.type]}</Badge>,
    },
    { key: 'owner', header: 'Owner' },
    { key: 'businessUnit', header: 'Business Unit' },
    {
      key: 'criticality',
      header: 'Criticality',
      render: (item: Asset) => {
        const colors = ASSET_CRITICALITY_COLORS[item.criticality];
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: colors.bg,
              color: colors.text,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            {ASSET_CRITICALITY_LABELS[item.criticality]}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Asset) => {
        const colors = ASSET_STATUS_COLORS[item.status];
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: colors.bg,
              color: colors.text,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            {ASSET_STATUS_LABELS[item.status]}
          </span>
        );
      },
    },
    { key: 'dataClassification', header: 'Data Classification' },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Asset Inventory"
          description="Manage your organization's critical assets and infrastructure components."
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[12],
            color: theme.colors.text.secondary,
          }}
        >
          Loading assets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Asset Inventory"
          description="Manage your organization's critical assets and infrastructure components."
        />
        <div
          style={{
            padding: theme.spacing[6],
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: theme.borderRadius.lg,
            color: theme.colors.semantic.danger,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading assets</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchAssets}
            style={{
              marginTop: theme.spacing[4],
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              backgroundColor: theme.colors.semantic.danger,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Asset Inventory"
        description="Manage your organization's critical assets and infrastructure components."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[8],
        }}
      >
        {[
          { label: 'Total Assets', value: summaryStats.total, color: theme.colors.primary },
          { label: 'Critical', value: summaryStats.critical, color: '#DC2626' },
          { label: 'Active', value: summaryStats.active, color: '#16A34A' },
          { label: 'Planned', value: summaryStats.planned, color: '#2563EB' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: theme.spacing[6],
              backgroundColor: 'white',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[2] }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '32px', fontWeight: theme.typography.weights.bold, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <DataTable
        data={filteredAssets}
        columns={columns}
        searchPlaceholder="Search assets..."
        primaryAction={{
          label: 'New Asset',
          onClick: () => setIsModalOpen(true),
        }}
      />

      <AssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateAsset} />
    </div>
  );
}
