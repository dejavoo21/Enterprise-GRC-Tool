import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import type { Vendor, CreateVendorInput, ApiResponse } from '../types/vendor';
import {
  VENDOR_RISK_LABELS,
  VENDOR_STATUS_LABELS,
  VENDOR_RISK_COLORS,
  VENDOR_STATUS_COLORS,
} from '../types/vendor';

const API_BASE = '/api/v1';

function VendorModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVendorInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateVendorInput>({
    name: '',
    category: '',
    owner: '',
    riskLevel: 'medium',
    status: 'active',
    nextReviewDate: new Date().toISOString().split('T')[0],
    hasDPA: false,
    regions: [],
    dataTypesProcessed: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      setFormData({
        name: '',
        category: '',
        owner: '',
        riskLevel: 'medium',
        status: 'active',
        nextReviewDate: new Date().toISOString().split('T')[0],
        hasDPA: false,
        regions: [],
        dataTypesProcessed: [],
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
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6] }}>Create New Vendor</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Vendor Name *
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
              Category *
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              placeholder="e.g., Cloud SaaS, Enterprise Software"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
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
                Risk Level *
              </label>
              <select
                name="riskLevel"
                value={formData.riskLevel}
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
                <option value="onboarding">Onboarding</option>
                <option value="offboarded">Offboarded</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Next Review Date *
              </label>
              <input
                type="date"
                name="nextReviewDate"
                value={formData.nextReviewDate}
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
            <input
              type="checkbox"
              name="hasDPA"
              id="hasDPA"
              checked={formData.hasDPA}
              onChange={handleChange}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="hasDPA" style={{ cursor: 'pointer', fontSize: theme.typography.sizes.sm }}>
              Has Data Processing Agreement (DPA)
            </label>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Regions (comma-separated)
            </label>
            <input
              type="text"
              name="regions"
              placeholder="e.g., EU, NA, APAC"
              onChange={e => setFormData(prev => ({ ...prev, regions: e.target.value.split(',').map(r => r.trim()).filter(r => r) }))}
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
              Data Types Processed (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., PII, Financial Data"
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  dataTypesProcessed: e.target.value.split(',').map(d => d.trim()).filter(d => d),
                }))
              }
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
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
              {isSubmitting ? 'Creating...' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Vendors() {
  const { currentWorkspace } = useWorkspace();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [_selectedRiskLevel] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result: ApiResponse<Vendor[]> = await apiCall(`${API_BASE}/vendors`, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
        throw new Error(errorMsg);
      }

      setVendors(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleCreateVendor = async (input: CreateVendorInput) => {
    const result: ApiResponse<Vendor> = await apiCall(`${API_BASE}/vendors`, {
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

    // Refresh the vendors list
    await fetchVendors();
  };

  const filteredVendors = vendors;

  const summaryStats = {
    total: vendors.length,
    critical: vendors.filter(v => v.riskLevel === 'critical').length,
    active: vendors.filter(v => v.status === 'active').length,
    withDPA: vendors.filter(v => v.hasDPA).length,
  };

  const columns = [
    { key: 'id', header: 'ID', width: '80px' },
    {
      key: 'name',
      header: 'Vendor Name',
      render: (item: Vendor) => (
        <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>
          {item.name}
        </span>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'owner', header: 'Owner' },
    {
      key: 'riskLevel',
      header: 'Risk Level',
      render: (item: Vendor) => {
        const colors = VENDOR_RISK_COLORS[item.riskLevel];
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
            {VENDOR_RISK_LABELS[item.riskLevel]}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Vendor) => {
        const colors = VENDOR_STATUS_COLORS[item.status];
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
            {VENDOR_STATUS_LABELS[item.status]}
          </span>
        );
      },
    },
    {
      key: 'nextReviewDate',
      header: 'Next Review',
      render: (item: Vendor) => {
        const reviewDate = new Date(item.nextReviewDate);
        const today = new Date();
        const isOverdue = reviewDate < today;
        return (
          <span
            style={{
              color: isOverdue ? theme.colors.semantic.danger : theme.colors.text.main,
              fontWeight: isOverdue ? theme.typography.weights.medium : 'normal',
            }}
          >
            {reviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {isOverdue ? ' (Overdue)' : ''}
          </span>
        );
      },
    },
    {
      key: 'hasDPA',
      header: 'DPA',
      render: (item: Vendor) => (
        <span style={{ color: item.hasDPA ? theme.colors.semantic.success : theme.colors.text.secondary }}>
          {item.hasDPA ? '✓ Yes' : '✗ No'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Vendor Management"
          description="Manage third-party vendors and assess associated risks."
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
          Loading vendors...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Vendor Management"
          description="Manage third-party vendors and assess associated risks."
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
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading vendors</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchVendors}
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
        title="Vendor Management"
        description="Manage third-party vendors and assess associated risks."
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
          { label: 'Total Vendors', value: summaryStats.total, color: theme.colors.primary },
          { label: 'Critical Risk', value: summaryStats.critical, color: '#DC2626' },
          { label: 'Active', value: summaryStats.active, color: '#16A34A' },
          { label: 'With DPA', value: summaryStats.withDPA, color: '#2563EB' },
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
        data={filteredVendors}
        columns={columns}
        searchPlaceholder="Search vendors..."
        primaryAction={{
          label: 'New Vendor',
          onClick: () => setIsModalOpen(true),
        }}
      />

      <VendorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateVendor} />
    </div>
  );
}
