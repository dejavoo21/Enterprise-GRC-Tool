import React, { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Modal } from './Modal';
import { Button } from './Button';
import type { CreateEvidenceInput, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPE_LABELS } from '../types/evidence';
import type { ControlWithFrameworks, ApiResponse } from '../types/control';
import { apiCall } from '../lib/api';

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
    sourceType: 'manual_reference',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<ControlWithFrameworks[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsError, setControlsError] = useState('');

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
        sourceType: 'manual_reference',
      });
      setError(null);
      setControls([]);
      setControlsError('');

      // Fetch controls for dropdown
      const fetchControls = async () => {
        setControlsLoading(true);
        try {
          const result = await apiCall<ApiResponse<ControlWithFrameworks[]>>(`${API_BASE}/controls`);
          if (result.data) {
            setControls(result.data);
          }
        } catch (err) {
          setControlsError(err instanceof Error ? err.message : 'Controls could not be loaded.');
        } finally {
          setControlsLoading(false);
        }
      };
      void fetchControls();
    }
  }, [isOpen, preselectedControlId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
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
      accessibleDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Evidence Reference"
      width="640px"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Reference'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} style={{ margin: 0, padding: 0, border: 0 }}>
        {error && (
          <div
            role="alert"
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
          <label htmlFor="evidence-name" style={labelStyle}>
            Name <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            id="evidence-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter evidence name"
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="evidence-description" style={labelStyle}>Description</label>
          <textarea
            id="evidence-description"
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
            <label htmlFor="evidence-type" style={labelStyle}>
              Type <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              id="evidence-type"
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
            <label htmlFor="evidence-collected-by" style={labelStyle}>
              Collected By <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              id="evidence-collected-by"
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
            <label htmlFor="evidence-collected-at" style={labelStyle}>Collection Date</label>
            <input
              id="evidence-collected-at"
              type="date"
              value={formData.collectedAt}
              onChange={(e) => setFormData({ ...formData, collectedAt: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="evidence-linked-control" style={labelStyle}>Linked Control</label>
            <select
              id="evidence-linked-control"
              value={formData.controlId}
              onChange={(e) => setFormData({ ...formData, controlId: e.target.value })}
              disabled={controlsLoading || Boolean(controlsError)}
              aria-describedby={controlsError ? 'evidence-control-error' : 'evidence-control-help'}
              style={inputStyle}
            >
              <option value="">{controlsLoading ? 'Loading controls...' : controlsError ? 'Control selection unavailable' : 'No linked control'}</option>
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.id} - {control.title}
                </option>
              ))}
            </select>
            {controlsError ? <p id="evidence-control-error" role="alert" style={{ margin: `${theme.spacing[1]} 0 0`, color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{controlsError} Evidence can still be recorded without a control link.</p> : <p id="evidence-control-help" style={{ margin: `${theme.spacing[1]} 0 0`, color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs }}>Only persisted controls in the current workspace are available.</p>}
          </div>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="evidence-source-type" style={labelStyle}>Source type</label>
          <select
            id="evidence-source-type"
            value={formData.sourceType}
            onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as CreateEvidenceInput['sourceType'] })}
            style={inputStyle}
          >
            <option value="manual_reference">Manual reference</option>
            <option value="external_system">External system</option>
            <option value="automated_collection">Automated collection</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="evidence-location-url" style={labelStyle}>External source URL</label>
          <input
            id="evidence-location-url"
            type="url"
            value={formData.locationUrl}
            onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
            placeholder="https://... (reference only; no file is uploaded)"
            style={inputStyle}
          />
          <p style={{ margin: `${theme.spacing[2]} 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
            This records metadata and an optional external reference. No file is uploaded or stored by LAFLO.
          </p>
        </div>
        <div style={{...formGroupStyle,padding:theme.spacing[3],backgroundColor:theme.colors.surfaceHover,borderRadius:theme.borderRadius.md,fontSize:theme.typography.sizes.sm,color:theme.colors.text.secondary}}>Binary evidence storage is not configured. A URL is saved only as an external reference and does not mean LAFLO stores the underlying file.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}>
            <label htmlFor="evidence-source-system" style={labelStyle}>Source system</label>
            <input id="evidence-source-system" value={formData.sourceSystem || ''} onChange={(e) => setFormData({ ...formData, sourceSystem: e.target.value })} placeholder="Optional system name" style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="evidence-source-reference" style={labelStyle}>Source reference</label>
            <input id="evidence-source-reference" value={formData.sourceReference || ''} onChange={(e) => setFormData({ ...formData, sourceReference: e.target.value })} placeholder="Optional immutable reference" style={inputStyle} />
          </div>
        </div>
        <div style={formGroupStyle}>
          <label htmlFor="evidence-expires-at" style={labelStyle}>Expiry date</label>
          <input id="evidence-expires-at" type="date" value={formData.expiresAt || ''} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} style={inputStyle} />
        </div>
        </fieldset>
      </form>
    </Modal>
  );
}
