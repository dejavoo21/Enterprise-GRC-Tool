import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { Modal } from './Modal';
import { Button } from './Button';
import type { CreateControlInput, ControlStatus, ControlWithFrameworks } from '../types/control';
import { CONTROL_STATUS_LABELS } from '../types/control';
import { useFrameworks } from '../context/FrameworkContext';
import './ControlModal.css';

interface ControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (control: CreateControlInput) => Promise<void>;
  initialControl?: ControlWithFrameworks | null;
}

const STATUS_OPTIONS: ControlStatus[] = [
  'not_implemented',
  'in_progress',
  'implemented',
  'not_applicable',
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

export function ControlModal({ isOpen, onClose, onSubmit, initialControl = null }: ControlModalProps) {
  const { frameworkOptions } = useFrameworks();
  const [formData, setFormData] = useState<CreateControlInput>({
    title: '',
    description: '',
    owner: '',
    status: 'not_implemented',
    domain: '',
    primaryFramework: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialControl ? { title: initialControl.title, description: initialControl.description, owner: initialControl.owner, status: initialControl.status, domain: initialControl.domain, primaryFramework: initialControl.primaryFramework } : { title: '', description: '', owner: '', status: 'not_implemented', domain: '', primaryFramework: undefined });
  }, [initialControl, isOpen]);

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

    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        title: '',
        description: '',
        owner: '',
        status: 'not_implemented',
        domain: '',
        primaryFramework: undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create control');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !submitLock.current) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialControl ? 'Edit Control' : 'Create New Control'}
      width="640px"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : initialControl ? 'Save Control' : 'Create Control'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} className="control-modal__fields">
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
          <label htmlFor="control-title" style={labelStyle}>
            Title <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="text"
            id="control-title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter control title"
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="control-description" style={labelStyle}>Description</label>
          <textarea
            id="control-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the control objective and requirements..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '80px',
            }}
          />
        </div>

        <div className="control-modal__row">
          <div style={formGroupStyle}>
            <label htmlFor="control-owner" style={labelStyle}>
              Owner <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              type="text"
              id="control-owner"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              placeholder="Control owner name"
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="control-domain" style={labelStyle}>Domain</label>
            <input
              type="text"
              id="control-domain"
              value={formData.domain || ''}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="e.g. Access Control, Cryptography"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="control-modal__row">
          <div style={formGroupStyle}>
            <label htmlFor="control-status" style={labelStyle}>Status</label>
            <select
              id="control-status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ControlStatus })}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {CONTROL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="control-primary-framework" style={labelStyle}>Primary Framework</label>
            <select
              id="control-primary-framework"
              value={formData.primaryFramework || ''}
              onChange={(e) => setFormData({
                ...formData,
                primaryFramework: e.target.value || undefined
              })}
              style={inputStyle}
            >
              <option value="">Select framework (optional)</option>
              {frameworkOptions.map((fw) => (
                <option key={fw.value} value={fw.value}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        </fieldset>
      </form>
    </Modal>
  );
}
