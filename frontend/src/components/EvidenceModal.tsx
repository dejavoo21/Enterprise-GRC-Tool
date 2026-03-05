import React, { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Modal } from './Modal';
import { Button } from './Button';
import type { CreateEvidenceInput, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPE_LABELS } from '../types/evidence';
import type { ControlWithFrameworks, ApiResponse } from '../types/control';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (evidence: CreateEvidenceInput) => Promise<void>;
  preselectedControlId?: string;
}

const TYPE_OPTIONS: EvidenceType[] = [
  'policy',
  'configuration',
  'log',
  'screenshot',
  'report',
  'other',
];

const API_BASE = '/api/v1';

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

export function EvidenceModal({ isOpen, onClose, onSubmit, preselectedControlId }: EvidenceModalProps) {
  const [formData, setFormData] = useState<CreateEvidenceInput>({
    name: '',
    description: '',
    type: 'policy',
    locationUrl: '',
    controlId: preselectedControlId || '',
    riskId: '',
    collectedBy: '',
    collectedAt: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<ControlWithFrameworks[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setFormData({
        name: '',
        description: '',
        type: 'policy',
        locationUrl: '',
        controlId: preselectedControlId || '',
        riskId: '',
        collectedBy: '',
        collectedAt: new Date().toISOString().split('T')[0],
      });
      setError(null);

      // Fetch controls for dropdown
      const fetchControls = async () => {
        try {
          const response = await fetch(`${API_BASE}/controls`);
          const result: ApiResponse<ControlWithFrameworks[]> = await response.json();
          if (result.data) {
            setControls(result.data);
          }
        } catch (err) {
          console.error('Failed to fetch controls:', err);
        }
      };
      fetchControls();
    }
  }, [isOpen, preselectedControlId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.collectedBy.trim()) {
      setError('Collected By is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData: CreateEvidenceInput = {
        ...formData,
        controlId: formData.controlId || undefined,
        riskId: formData.riskId || undefined,
        collectedAt: formData.collectedAt ? new Date(formData.collectedAt).toISOString() : undefined,
      };
      await onSubmit(submitData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create evidence');
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
      title="Add Evidence"
      width="640px"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Evidence'}
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
            Name <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter evidence name"
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the evidence..."
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
              Type <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as EvidenceType })}
              style={inputStyle}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {EVIDENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Collected By <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              type="text"
              value={formData.collectedBy}
              onChange={(e) => setFormData({ ...formData, collectedBy: e.target.value })}
              placeholder="Who collected this?"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Collection Date</label>
            <input
              type="date"
              value={formData.collectedAt}
              onChange={(e) => setFormData({ ...formData, collectedAt: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Linked Control</label>
            <select
              value={formData.controlId}
              onChange={(e) => setFormData({ ...formData, controlId: e.target.value })}
              style={inputStyle}
            >
              <option value="">No linked control</option>
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.id} - {control.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Location URL</label>
          <input
            type="url"
            value={formData.locationUrl}
            onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
      </form>
    </Modal>
  );
}
