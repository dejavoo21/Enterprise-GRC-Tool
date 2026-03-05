import React, { useState } from 'react';
import { theme } from '../theme';
import { Modal } from './Modal';
import { Button } from './Button';
import type { CreateRiskInput, RiskCategory } from '../types/risk';
import { RISK_CATEGORY_LABELS } from '../types/risk';

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (risk: CreateRiskInput) => Promise<void>;
}

const CATEGORY_OPTIONS: RiskCategory[] = [
  'information_security',
  'privacy',
  'vendor',
  'operational',
  'compliance',
  'strategic',
];

const LIKELIHOOD_OPTIONS = [
  { value: 1, label: '1 – Rare' },
  { value: 2, label: '2 – Unlikely' },
  { value: 3, label: '3 – Possible' },
  { value: 4, label: '4 – Likely' },
  { value: 5, label: '5 – Almost Certain' },
];

const IMPACT_OPTIONS = [
  { value: 1, label: '1 – Minor' },
  { value: 2, label: '2 – Moderate' },
  { value: 3, label: '3 – Significant' },
  { value: 4, label: '4 – Major' },
  { value: 5, label: '5 – Severe' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
  fontSize: theme.typography.sizes.sm,
  fontFamily: theme.typography.fontFamily,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  backgroundColor: theme.colors.background,
  color: theme.colors.text.main,
  outline: 'none',
  transition: 'border-color 0.2s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: theme.spacing[2],
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  color: theme.colors.text.main,
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: theme.spacing[4],
};

export function RiskModal({ isOpen, onClose, onSubmit }: RiskModalProps) {
  const [formData, setFormData] = useState<CreateRiskInput>({
    title: '',
    description: '',
    owner: '',
    category: 'information_security',
    inherentLikelihood: 3,
    inherentImpact: 3,
    dueDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.owner.trim()) {
      setError('Owner is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        title: '',
        description: '',
        owner: '',
        category: 'information_security',
        inherentLikelihood: 3,
        inherentImpact: 3,
        dueDate: '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create risk');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Risk"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Risk'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              padding: theme.spacing[3],
              marginBottom: theme.spacing[4],
              backgroundColor: '#FEE2E2',
              border: '1px solid #FECACA',
              borderRadius: theme.borderRadius.md,
              color: theme.colors.semantic.danger,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {error}
          </div>
        )}

        <div style={formGroupStyle}>
          <label style={labelStyle}>
            Title <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter risk title"
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the risk..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '80px',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Owner <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              type="text"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              placeholder="Risk owner name"
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Category <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as RiskCategory })}
              style={inputStyle}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {RISK_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Inherent Likelihood <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              value={formData.inherentLikelihood}
              onChange={(e) => setFormData({ ...formData, inherentLikelihood: parseInt(e.target.value, 10) })}
              style={inputStyle}
            >
              {LIKELIHOOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Inherent Impact <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              value={formData.inherentImpact}
              onChange={(e) => setFormData({ ...formData, inherentImpact: parseInt(e.target.value, 10) })}
              style={inputStyle}
            >
              {IMPACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            padding: theme.spacing[3],
            backgroundColor: theme.colors.surfaceHover,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing[4],
          }}
        >
          <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Risk Score: <strong style={{ color: theme.colors.text.main }}>{formData.inherentLikelihood * formData.inherentImpact}</strong>
            {' '}(Likelihood {formData.inherentLikelihood} × Impact {formData.inherentImpact})
          </span>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            style={inputStyle}
          />
        </div>
      </form>
    </Modal>
  );
}
