import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { CloseIcon } from '../components/icons';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import { apiCall, fetchActivityLog } from '../lib/api';
import type { ActivityLogEntry } from '../types/activity';
import type {
  GovernanceDocument,
  CreateGovernanceDocumentInput,
  GovernanceDocumentType,
  GovernanceDocumentStatus,
  GovernanceDocumentClassification,
  GovernancePolicyRule,
  GovernancePolicyRuleEvent,
  CreateGovernancePolicyRuleInput,
  PolicyRuleCriterion,
} from '../types/governance';
import type { TrainingCourse } from '../types/training';
import type { ControlWithFrameworks } from '../types/control';
import type {
  ControlRelationType,
  DocumentTrainingRelationType,
} from '../types/links';
import {
  CONTROL_RELATION_LABELS,
  DOCUMENT_TRAINING_RELATION_LABELS,
  CONTROL_RELATION_OPTIONS,
  DOCUMENT_TRAINING_RELATION_OPTIONS,
} from '../types/links';
import { DELIVERY_FORMAT_LABELS } from '../types/training';
import { CONTROL_STATUS_LABELS, CONTROL_STATUS_COLORS } from '../types/control';
import { safeExternalReference } from '../lib/externalReference';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

const API_BASE = '/api/v1';

const DOC_TYPE_LABELS: Record<GovernanceDocumentType, string> = {
  policy: 'Policy',
  standard: 'Standard',
  procedure: 'Procedure',
  guideline: 'Guideline',
  framework_document: 'Framework Document',
  risk_document: 'Risk Document',
  control_document: 'Control Document',
  evidence_document: 'Evidence Document',
  audit_document: 'Audit Document',
  training_material: 'Training Material',
  incident_document: 'Incident Document',
  vendor_document: 'Vendor Document',
  compliance_register: 'Compliance Register',
  management_review_document: 'Management Review Document',
  custom: 'Custom Document Type',
};

const DOC_STATUS_LABELS: Record<GovernanceDocumentStatus, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  approved: 'Approved',
  published: 'Published',
  active: 'Active',
  expired: 'Expired',
  superseded: 'Superseded',
  archived: 'Archived',
  retired: 'Retired',
  rejected: 'Rejected',
  pending_attestation: 'Pending Attestation',
};

const DOC_STATUS_COLORS: Record<GovernanceDocumentStatus, { bg: string; text: string }> = {
  draft: { bg: '#FEF3C7', text: '#D97706' },
  under_review: { bg: '#DBEAFE', text: '#2563EB' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  published: { bg: '#E0F2FE', text: '#0369A1' },
  active: { bg: '#DCFCE7', text: '#15803D' },
  expired: { bg: '#FEE2E2', text: '#DC2626' },
  superseded: { bg: '#EDE9FE', text: '#7C3AED' },
  archived: { bg: '#F3F4F6', text: '#6B7280' },
  retired: { bg: '#F3F4F6', text: '#6B7280' },
  rejected: { bg: '#FCE7F3', text: '#BE185D' },
  pending_attestation: { bg: '#FEF3C7', text: '#B45309' },
};

const DOC_CLASSIFICATION_LABELS: Record<GovernanceDocumentClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};

// Extended types with relationType
type LinkedControl = ControlWithFrameworks & { relationType: ControlRelationType };
type LinkedTrainingCourse = TrainingCourse & { relationType: DocumentTrainingRelationType };

function DocumentModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateGovernanceDocumentInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateGovernanceDocumentInput>({
    title: '',
    description: '',
    docType: 'policy',
    owner: '',
    status: 'draft',
    classification: 'internal',
    currentVersion: '1.0',
    locationUrl: '',
    reviewFrequencyMonths: 12,
    nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0],
    attestationRequired: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const requestClose = () => {
    if (!isSubmitting && !submitLock.current) onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isCheckbox = e.target instanceof HTMLInputElement && e.target.type === 'checkbox';
    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox
        ? (e.target as HTMLInputElement).checked
        : name === 'reviewFrequencyMonths'
          ? parseInt(value, 10) || undefined
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onSubmit(formData);
      setFormData({
        title: '',
        description: '',
        docType: 'policy',
        owner: '',
        status: 'draft',
        classification: 'internal',
        currentVersion: '1.0',
        locationUrl: '',
        reviewFrequencyMonths: 12,
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        effectiveDate: new Date().toISOString().split('T')[0],
        attestationRequired: false,
      });
      onClose();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to create the governance document.');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal accessibleDialog isOpen={isOpen} onClose={requestClose} title="Create Policy or Document Record" width="620px">
        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <fieldset disabled={isSubmitting} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4], margin: 0, padding: 0, border: 0 }}>
          <div>
            <label htmlFor="document-title" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Document Title *
            </label>
            <input
              id="document-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Information Security Policy"
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
            <label htmlFor="document-description" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Description
            </label>
            <textarea
              id="document-description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Short business purpose, scope, or document summary"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.spacing[3] }}>
            <div>
              <label htmlFor="document-type" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Document Type *
              </label>
              <select
                id="document-type"
                name="docType"
                value={formData.docType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="policy">Policy</option>
                <option value="standard">Standard</option>
                <option value="procedure">Procedure</option>
                <option value="guideline">Guideline</option>
                <option value="framework_document">Framework Document</option>
                <option value="risk_document">Risk Document</option>
                <option value="control_document">Control Document</option>
                <option value="evidence_document">Evidence Document</option>
                <option value="audit_document">Audit Document</option>
                <option value="training_material">Training Material</option>
                <option value="incident_document">Incident Document</option>
                <option value="vendor_document">Vendor Document</option>
                <option value="compliance_register">Compliance Register</option>
                <option value="management_review_document">Management Review Document</option>
                <option value="custom">Custom Document Type</option>
              </select>
            </div>

            <div>
              <label htmlFor="document-status" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Status *
              </label>
              <select
                id="document-status"
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
                <option value="draft">Draft</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="superseded">Superseded</option>
                <option value="archived">Archived</option>
                <option value="retired">Retired</option>
                <option value="rejected">Rejected</option>
                <option value="pending_attestation">Pending Attestation</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.spacing[3] }}>
            <div>
              <label htmlFor="document-owner" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Owner *
              </label>
              <input
                id="document-owner"
                type="text"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                required
                placeholder="e.g., John Smith"
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
              <label htmlFor="document-classification" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Classification
              </label>
              <select
                id="document-classification"
                name="classification"
                value={formData.classification || 'internal'}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>

            <div>
              <label htmlFor="document-version" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Version
              </label>
              <input
                id="document-version"
                type="text"
                name="currentVersion"
                value={formData.currentVersion || ''}
                onChange={handleChange}
                placeholder="e.g., 1.0"
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

          <div>
            <label htmlFor="document-location" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Document Location URL
            </label>
            <input
              id="document-location"
              type="url"
              name="locationUrl"
              value={formData.locationUrl || ''}
              onChange={handleChange}
              placeholder="https://sharepoint.company.com/docs/policy.pdf"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.spacing[3] }}>
            <div>
              <label htmlFor="document-review-frequency" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Review Frequency (months)
              </label>
              <select
                id="document-review-frequency"
                name="reviewFrequencyMonths"
                value={formData.reviewFrequencyMonths || 12}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="3">Quarterly (3 months)</option>
                <option value="6">Semi-Annual (6 months)</option>
                <option value="12">Annual (12 months)</option>
                <option value="24">Biennial (24 months)</option>
              </select>
            </div>

            <div>
              <label htmlFor="document-next-review" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Next Review Date
              </label>
              <input
                id="document-next-review"
                type="date"
                name="nextReviewDate"
                value={formData.nextReviewDate || ''}
                onChange={handleChange}
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
              <label htmlFor="document-effective-date" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Effective Date
              </label>
              <input
                id="document-effective-date"
                type="date"
                name="effectiveDate"
                value={formData.effectiveDate || ''}
                onChange={handleChange}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.spacing[3] }}>
            <div>
              <label htmlFor="document-published-date" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Published Date
              </label>
              <input
                id="document-published-date"
                type="date"
                name="publishedAt"
                value={formData.publishedAt ? formData.publishedAt.slice(0, 10) : ''}
                onChange={handleChange}
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
              <label htmlFor="document-expiry-date" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Expiry Date
              </label>
              <input
                id="document-expiry-date"
                type="date"
                name="expiryDate"
                value={formData.expiryDate || ''}
                onChange={handleChange}
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

          <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
            <input
              type="checkbox"
              name="attestationRequired"
              checked={Boolean(formData.attestationRequired)}
              onChange={handleChange}
            />
            Require acknowledgement or attestation before the document is considered active
          </label>

          {submitError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{submitError}</div> : null}
          <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end', marginTop: theme.spacing[4], flexWrap: 'wrap' }}>
            <Button type="button" onClick={requestClose} variant="outline" disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </Button>
          </div>
          </fieldset>
        </form>
    </Modal>
  );
}

// Mini-modal for linking
function LinkModal({
  title,
  isOpen,
  onClose,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return <Modal accessibleDialog isOpen onClose={onClose} title={title} width="440px">{children}</Modal>;
}

function RelationBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '3px',
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

function PolicyAcknowledgement({ document }: { document: GovernanceDocument }) {
  const [record, setRecord] = useState<{ acknowledged_at?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiCall<ApiResponse<{ acknowledged_at?: string }>>(`${API_BASE}/governance-documents/${document.id}/acknowledgement`)
      .then((result) => { if (active) setRecord(result.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Acknowledgement status unavailable'); });
    return () => { active = false; };
  }, [document.id, document.currentVersion]);

  if (!['published', 'active'].includes(document.status)) {
    return <p style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Acknowledgement becomes available after controlled publication.</p>;
  }
  if (record) {
    return <p role="status" style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.semantic.success }}>Acknowledged {record.acknowledged_at ? new Date(record.acknowledged_at).toLocaleString() : ''}</p>;
  }
  return <div><Button disabled={busy} onClick={() => {
    setBusy(true);
    setError(null);
    void apiCall<ApiResponse<{ acknowledged_at?: string }>>(`${API_BASE}/governance-documents/${document.id}/acknowledge`, { method: 'POST' })
      .then((result) => setRecord(result.data))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Acknowledgement failed'))
      .finally(() => setBusy(false));
  }}>{busy ? 'Recording...' : 'Acknowledge policy'}</Button>{error && <p role="alert" style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.semantic.danger }}>{error}</p>}</div>;
}

const RULE_FIELD_LABELS: Record<PolicyRuleCriterion['field'], string> = {
  data_classification: 'Data classification',
  business_unit: 'Business unit',
  system_type: 'System type',
  location: 'Location',
  provider: 'Provider',
};

function PolicyRules({ document }: { document: GovernanceDocument }) {
  const emptyCriterion: PolicyRuleCriterion = { field: 'data_classification', operator: 'equals', value: '' };
  const emptyInput: CreateGovernancePolicyRuleInput = {
    name: '', description: '', scopeSummary: '', matchCriteria: [{ ...emptyCriterion }], excludeCriteria: [],
    severity: 'medium', responseMode: 'monitor', plainLanguageSummary: '',
  };
  const [rules, setRules] = useState<GovernancePolicyRule[]>([]);
  const [input, setInput] = useState<CreateGovernancePolicyRuleInput>(emptyInput);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GovernancePolicyRule | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [ruleDecision, setRuleDecision] = useState<{ rule: GovernancePolicyRule; action: 'pending_review' | 'active' | 'rejected' | 'archived' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [historyRule, setHistoryRule] = useState<GovernancePolicyRule | null>(null);
  const [ruleHistory, setRuleHistory] = useState<GovernancePolicyRuleEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mutationLock = useRef(false);
  const historySequence = useRef(0);
  const editable = ['draft', 'rejected'].includes(document.status);
  const requestClose = () => { if (!busy && !mutationLock.current) { setIsOpen(false); setEditingRule(null); setRevisionReason(''); } };
  const closeDecision = () => { if (!busy && !mutationLock.current) { setRuleDecision(null); setDecisionReason(''); } };
  const closeHistory = () => { historySequence.current += 1; setHistoryRule(null); setRuleHistory([]); setHistoryLoading(false); };

  const loadRules = useCallback(async () => {
    try {
      setError('');
      const result = await apiCall<ApiResponse<GovernancePolicyRule[]>>(`${API_BASE}/governance-documents/${document.id}/rules`);
      setRules(result.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy rules could not be loaded.');
    }
  }, [document.id]);

  useEffect(() => { void loadRules(); }, [loadRules]);

  const setCriterion = (kind: 'matchCriteria' | 'excludeCriteria', index: number, patch: Partial<PolicyRuleCriterion>) => {
    setInput((current) => ({ ...current, [kind]: current[kind].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const save = async () => {
    if (mutationLock.current) return;
    const reviewedInput = { ...input, matchCriteria: input.matchCriteria.map((item) => ({ ...item })), excludeCriteria: input.excludeCriteria.map((item) => ({ ...item })) };
    const reviewedRule = editingRule;
    const reviewedReason = revisionReason.trim();
    if (reviewedRule && reviewedReason.length < 10) { setError('A revision rationale of at least 10 characters is required.'); return; }
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      await apiCall<ApiResponse<GovernancePolicyRule>>(`${API_BASE}/governance-documents/${document.id}/rules${reviewedRule ? `/${reviewedRule.id}` : ''}`, { method: reviewedRule ? 'PUT' : 'POST', body: JSON.stringify(reviewedRule ? { ...reviewedInput, revisionReason: reviewedReason } : reviewedInput) });
      setInput(emptyInput);
      setEditingRule(null);
      setRevisionReason('');
      setIsOpen(false);
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy rule could not be saved.');
    } finally { mutationLock.current = false; setBusy(false); }
  };

  const edit = (rule: GovernancePolicyRule) => {
    if (busy || mutationLock.current || !['draft', 'rejected'].includes(rule.status)) return;
    setEditingRule(rule);
    setRevisionReason('');
    setInput({
      name: rule.name,
      description: rule.description || '',
      scopeSummary: rule.scopeSummary,
      matchCriteria: rule.matchCriteria.map((item) => ({ ...item })),
      excludeCriteria: rule.excludeCriteria.map((item) => ({ ...item })),
      severity: rule.severity,
      responseMode: rule.responseMode,
      plainLanguageSummary: rule.plainLanguageSummary,
    });
    setIsOpen(true);
  };

  const archive = async (ruleId: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      await apiCall(`${API_BASE}/governance-documents/${document.id}/rules/${ruleId}`, { method: 'DELETE' });
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy rule could not be archived.');
    } finally { mutationLock.current = false; setBusy(false); }
  };

  const transition = async () => {
    if (mutationLock.current || !ruleDecision) return;
    const reviewedDecision = { ...ruleDecision, reason: decisionReason.trim() };
    if (reviewedDecision.reason.length < 10) { setError('A decision rationale of at least 10 characters is required.'); return; }
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      const submitting = reviewedDecision.action === 'pending_review';
      const withdrawing = reviewedDecision.action === 'archived';
      await apiCall<ApiResponse<GovernancePolicyRule>>(`${API_BASE}/governance-documents/${document.id}/rules/${reviewedDecision.rule.id}/${submitting ? 'submit' : withdrawing ? 'withdraw' : 'decision'}`, {
        method: 'POST',
        body: JSON.stringify(submitting || withdrawing ? { reason: reviewedDecision.reason } : { decision: reviewedDecision.action, reason: reviewedDecision.reason }),
      });
      setRuleDecision(null);
      setDecisionReason('');
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy rule decision could not be recorded.');
    } finally { mutationLock.current = false; setBusy(false); }
  };

  const openHistory = async (rule: GovernancePolicyRule) => {
    const sequence = ++historySequence.current;
    setHistoryRule(rule);
    setRuleHistory([]);
    setHistoryLoading(true);
    setError('');
    try {
      const result = await apiCall<ApiResponse<GovernancePolicyRuleEvent[]>>(`${API_BASE}/governance-documents/${document.id}/rules/${rule.id}/history`);
      if (sequence !== historySequence.current) return;
      setRuleHistory(result.data || []);
    } catch (cause) {
      if (sequence === historySequence.current) setError(cause instanceof Error ? cause.message : 'Policy rule history could not be loaded.');
    } finally {
      if (sequence === historySequence.current) setHistoryLoading(false);
    }
  };

  const criterionEditor = (kind: 'matchCriteria' | 'excludeCriteria', title: string) => (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: theme.typography.sizes.sm }}>{title}</strong>
        <Button variant="ghost" size="sm" disabled={busy || input[kind].length >= 20} onClick={() => setInput((current) => ({ ...current, [kind]: [...current[kind], { ...emptyCriterion }] }))}>+ Condition</Button>
      </div>
      {input[kind].length === 0 ? <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>No exclusion conditions.</span> : input[kind].map((criterion, index) => (
        <div key={`${kind}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr auto', gap: theme.spacing[2] }}>
          <select aria-label={`${title} field ${index + 1}`} value={criterion.field} onChange={(event) => setCriterion(kind, index, { field: event.target.value as PolicyRuleCriterion['field'] })}>
            {Object.entries(RULE_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label={`${title} operator ${index + 1}`} value={criterion.operator} onChange={(event) => setCriterion(kind, index, { operator: event.target.value as PolicyRuleCriterion['operator'] })}>
            <option value="equals">Equals</option><option value="contains">Contains</option><option value="in">Is one of</option>
          </select>
          <input aria-label={`${title} value ${index + 1}`} maxLength={500} value={criterion.value} onChange={(event) => setCriterion(kind, index, { value: event.target.value })} placeholder="Approved value" />
          <Button aria-label={`Remove ${title.toLowerCase()} condition ${index + 1}`} variant="ghost" size="sm" onClick={() => setInput((current) => ({ ...current, [kind]: current[kind].filter((_, itemIndex) => itemIndex !== index) }))}>Remove</Button>
        </div>
      ))}
    </div>
  );

  return <div style={{ marginBottom: theme.spacing[6], borderTop: `1px solid ${theme.colors.border}`, paddingTop: theme.spacing[5] }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', marginBottom: theme.spacing[3] }}>
      <div><strong>Policy review rules ({rules.filter((rule) => rule.status === 'active').length})</strong><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: 3 }}>Governed review criteria. These rules do not monitor endpoints, block activity, or prove enforcement.</div></div>
      {editable ? <Button size="sm" disabled={busy} onClick={() => { setEditingRule(null); setRevisionReason(''); setInput(emptyInput); setIsOpen(true); }}>Add review rule</Button> : null}
    </div>
    {!editable ? <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, background: theme.colors.background, fontSize: theme.typography.sizes.xs }}>Rule changes are locked while this policy is {DOC_STATUS_LABELS[document.status].toLowerCase()}. Return it to the governed draft workflow to revise criteria.</div> : null}
    {error ? <p role="alert" style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{error}</p> : null}
    <div style={{ display: 'grid', gap: theme.spacing[3], marginTop: theme.spacing[3] }}>
      {rules.length === 0 ? <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>No policy review rules recorded.</div> : rules.map((rule) => <article key={rule.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing[3], opacity: rule.status === 'archived' ? 0.65 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2] }}><strong>{rule.name}</strong><span style={{ textTransform: 'capitalize', fontSize: theme.typography.sizes.xs }}>{rule.severity} · {rule.responseMode} · {rule.status.replace('_', ' ')}</span></div>
        <p style={{ margin: `${theme.spacing[2]} 0`, fontSize: theme.typography.sizes.sm }}>{rule.plainLanguageSummary}</p>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Scope: {rule.scopeSummary}</div>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: 4 }}>Match: {rule.matchCriteria.map((item) => `${RULE_FIELD_LABELS[item.field]} ${item.operator} ${item.value}`).join('; ') || 'None'} · Exclude: {rule.excludeCriteria.map((item) => `${RULE_FIELD_LABELS[item.field]} ${item.operator} ${item.value}`).join('; ') || 'None'}</div>
        {rule.decisionReason ? <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: 4 }}>Latest rationale: {rule.decisionReason}</div> : null}
        {editable ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2], marginTop: theme.spacing[2] }}>
          {rule.status === 'draft' || rule.status === 'rejected' ? <Button disabled={busy} variant="ghost" size="sm" onClick={() => edit(rule)}>Revise rule</Button> : null}
          {rule.status === 'draft' || rule.status === 'rejected' ? <Button disabled={busy} variant="outline" size="sm" onClick={() => { setDecisionReason(''); setRuleDecision({ rule, action: 'pending_review' }); }}>Submit for review</Button> : null}
          {rule.status === 'draft' || rule.status === 'rejected' ? <Button disabled={busy} variant="ghost" size="sm" onClick={() => { setDecisionReason(''); setRuleDecision({ rule, action: 'archived' }); }}>Withdraw rule</Button> : null}
          {rule.status === 'pending_review' ? <><Button disabled={busy} variant="outline" size="sm" onClick={() => { setDecisionReason(''); setRuleDecision({ rule, action: 'active' }); }}>Activate rule</Button><Button disabled={busy} variant="ghost" size="sm" onClick={() => { setDecisionReason(''); setRuleDecision({ rule, action: 'rejected' }); }}>Reject rule</Button></> : null}
          {rule.status === 'active' ? <Button disabled={busy} variant="ghost" size="sm" onClick={() => void archive(rule.id)}>Archive rule</Button> : null}
        </div> : null}
        <Button disabled={busy} variant="ghost" size="sm" onClick={() => void openHistory(rule)} style={{ marginTop: theme.spacing[2] }}>View history</Button>
      </article>)}
    </div>
    <Modal accessibleDialog isOpen={isOpen} onClose={requestClose} title={editingRule ? 'Revise policy review rule' : 'Add policy review rule'} width="760px">
      <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[4] }}>
        <p style={{ margin: 0, color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>Define criteria for governed human review. Endpoint warning, blocking and automated enforcement are intentionally unavailable.</p>
        <label>Rule name<input maxLength={200} value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} /></label>
        <label>Purpose<textarea maxLength={2000} value={input.description} onChange={(event) => setInput({ ...input, description: event.target.value })} /></label>
        <label>Scope summary<input maxLength={2000} value={input.scopeSummary} onChange={(event) => setInput({ ...input, scopeSummary: event.target.value })} /></label>
        {criterionEditor('matchCriteria', 'Match conditions')}
        {criterionEditor('excludeCriteria', 'Exclude conditions')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}><label>Severity<select value={input.severity} onChange={(event) => setInput({ ...input, severity: event.target.value as GovernancePolicyRule['severity'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Supported response<select value={input.responseMode} onChange={(event) => setInput({ ...input, responseMode: event.target.value as GovernancePolicyRule['responseMode'] })}><option value="monitor">Monitor through review records</option><option value="review">Require human review</option></select></label></div>
        <label>Plain-language summary<textarea maxLength={4000} value={input.plainLanguageSummary} onChange={(event) => setInput({ ...input, plainLanguageSummary: event.target.value })} placeholder="When this criterion matches, the policy owner reviews the record..." /></label>
        {editingRule ? <label>Revision rationale<textarea rows={3} maxLength={2000} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="Explain what changed and why..." /></label> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}><Button variant="ghost" onClick={requestClose}>Cancel</Button><Button disabled={busy || !input.name.trim() || !input.scopeSummary.trim() || !input.plainLanguageSummary.trim() || input.matchCriteria.length === 0 || input.matchCriteria.some((item) => !item.value.trim()) || input.excludeCriteria.some((item) => !item.value.trim()) || Boolean(editingRule && revisionReason.trim().length < 10)} onClick={() => void save()}>{busy ? 'Saving...' : editingRule ? 'Save revision' : 'Save review rule'}</Button></div>
      </fieldset>
    </Modal>
    {ruleDecision ? <Modal accessibleDialog isOpen onClose={closeDecision} title={`${ruleDecision.action === 'pending_review' ? 'Submit' : ruleDecision.action === 'active' ? 'Activate' : ruleDecision.action === 'archived' ? 'Withdraw' : 'Reject'} policy review rule`} width="560px">
      <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
        <p style={{ margin: 0 }}>Record a governed decision for <strong>{ruleDecision.rule.name}</strong>. {ruleDecision.action === 'archived' ? 'Withdrawal is terminal and preserves the complete rule history.' : 'Activation requires a different authorised user from the rule author.'}</p>
        <label>Decision rationale<textarea rows={4} maxLength={2000} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}><Button variant="ghost" onClick={closeDecision}>Cancel</Button><Button disabled={busy || decisionReason.trim().length < 10} onClick={() => void transition()}>{busy ? 'Recording...' : 'Record decision'}</Button></div>
      </fieldset>
    </Modal> : null}
    {historyRule ? <Modal accessibleDialog isOpen onClose={closeHistory} title={`Policy rule history · ${historyRule.name}`} width="680px">
      <div aria-busy={historyLoading} style={{ display: 'grid', gap: theme.spacing[3] }}>
        {historyLoading ? <p>Loading recorded rule history...</p> : null}
        {!historyLoading && ruleHistory.length === 0 ? <p>No rule history events are recorded.</p> : null}
        {ruleHistory.map((event) => {
          const previous = typeof event.snapshot.previousStatus === 'string' ? event.snapshot.previousStatus : null;
          const current = typeof event.snapshot.status === 'string' ? event.snapshot.status : null;
          const rationale = typeof event.snapshot.decisionReason === 'string' ? event.snapshot.decisionReason : null;
          return <article key={event.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2] }}><strong style={{ textTransform: 'capitalize' }}>{event.eventType.replace('_', ' ')}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div>
            <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs, marginTop: 4 }}>Actor: {event.actorEmail || 'Recorded user unavailable'}{previous || current ? ` · ${previous || 'Not recorded'} → ${current || 'Not recorded'}` : ''}</div>
            {rationale ? <p style={{ marginBottom: 0 }}>{rationale}</p> : null}
          </article>;
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="ghost" onClick={closeHistory}>Close</Button></div>
      </div>
    </Modal> : null}
  </div>;
}

// Document Detail Panel
function DocumentDetailPanel({
  document,
  onClose,
}: {
  document: GovernanceDocument | null;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspace();
  const { getFrameworkName } = useFrameworks();

  // Linked controls state
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [allControls, setAllControls] = useState<ControlWithFrameworks[]>([]);
  const [showLinkControlModal, setShowLinkControlModal] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedControlRelation, setSelectedControlRelation] = useState<ControlRelationType>('supports');

  // Linked training state
  const [linkedCourses, setLinkedCourses] = useState<LinkedTrainingCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [allCourses, setAllCourses] = useState<TrainingCourse[]>([]);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseRelation, setSelectedCourseRelation] = useState<DocumentTrainingRelationType>('enforces');

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [controlActionError, setControlActionError] = useState('');
  const [courseActionError, setCourseActionError] = useState('');

  useEffect(() => {
    if (!document) return;
    const previous = globalThis.document.activeElement;
    drawerRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [document]);
  const [relationBusy, setRelationBusy] = useState<'control' | 'course' | ''>('');

  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {};
    if (currentWorkspace) {
      nextHeaders['X-Workspace-Id'] = currentWorkspace.id;
    }
    return nextHeaders;
  }, [currentWorkspace]);

  useEffect(() => {
    if (!document) return;
    setPanelError('');
    setControlActionError('');
    setCourseActionError('');

    const fetchLinkedControls = async () => {
      setLoadingControls(true);
      try {
        const response = await fetch(`${API_BASE}/links/documents/${document.id}/controls`, { headers });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error?.message || 'Linked controls are unavailable.');
        if (result.data) {
          setLinkedControls(result.data);
        }
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : 'Linked controls are unavailable.');
      } finally {
        setLoadingControls(false);
      }
    };

    const fetchLinkedCourses = async () => {
      setLoadingCourses(true);
      try {
        const response = await fetch(`${API_BASE}/links/documents/${document.id}/courses`, { headers });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error?.message || 'Linked training is unavailable.');
        if (result.data) {
          setLinkedCourses(result.data);
        }
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : 'Linked training is unavailable.');
      } finally {
        setLoadingCourses(false);
      }
    };

    const fetchRecentActivity = async () => {
      setLoadingActivity(true);
      try {
        const activities = await fetchActivityLog({
          entityType: 'governance_document',
          entityId: document.id,
          limit: 5,
        });
        setRecentActivity(activities);
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : 'Recent document activity is unavailable.');
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchLinkedControls();
    fetchLinkedCourses();
    fetchRecentActivity();
  }, [document, currentWorkspace, headers]);

  const fetchAllControls = async () => {
    setControlActionError('');
    try {
      const response = await fetch(`${API_BASE}/controls`, { headers });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Available controls could not be loaded.');
      if (result.data) {
        setAllControls(result.data);
      }
    } catch (err) {
      setControlActionError(err instanceof Error ? err.message : 'Available controls could not be loaded.');
    }
  };

  const fetchAllCourses = async () => {
    setCourseActionError('');
    try {
      const response = await fetch(`${API_BASE}/training/courses`, { headers });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Available training could not be loaded.');
      if (result.data) {
        setAllCourses(result.data);
      }
    } catch (err) {
      setCourseActionError(err instanceof Error ? err.message : 'Available training could not be loaded.');
    }
  };

  const handleLinkControl = async () => {
    if (!document || !selectedControlId) return;
    try {
      setRelationBusy('control');
      setControlActionError('');
      // Link via control endpoint (control -> document)
      const createResponse = await fetch(`${API_BASE}/links/controls/${selectedControlId}/documents`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, relationType: selectedControlRelation }),
      });
      const createResult = await createResponse.json();
      if (!createResponse.ok || createResult.error) throw new Error(createResult.error?.message || 'Control link could not be created.');
      // Refresh linked controls
      const response = await fetch(`${API_BASE}/links/documents/${document.id}/controls`, { headers });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Linked controls could not be refreshed.');
      if (result.data) {
        setLinkedControls(result.data);
      }
      setShowLinkControlModal(false);
      setSelectedControlId('');
      setSelectedControlRelation('supports');
    } catch (err) {
      setControlActionError(err instanceof Error ? err.message : 'Control link could not be created.');
    } finally {
      setRelationBusy('');
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!document) return;
    try {
      setRelationBusy('control');
      setControlActionError('');
      const response = await fetch(`${API_BASE}/links/controls/${controlId}/documents/${document.id}`, {
        method: 'DELETE',
        headers,
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Control link could not be removed.');
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (err) {
      setControlActionError(err instanceof Error ? err.message : 'Control link could not be removed.');
    } finally {
      setRelationBusy('');
    }
  };

  const handleLinkCourse = async () => {
    if (!document || !selectedCourseId) return;
    try {
      setRelationBusy('course');
      setCourseActionError('');
      const createResponse = await fetch(`${API_BASE}/links/documents/${document.id}/courses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourseId, relationType: selectedCourseRelation }),
      });
      const createResult = await createResponse.json();
      if (!createResponse.ok || createResult.error) throw new Error(createResult.error?.message || 'Training link could not be created.');
      // Refresh linked courses
      const response = await fetch(`${API_BASE}/links/documents/${document.id}/courses`, { headers });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Linked training could not be refreshed.');
      if (result.data) {
        setLinkedCourses(result.data);
      }
      setShowLinkCourseModal(false);
      setSelectedCourseId('');
      setSelectedCourseRelation('enforces');
    } catch (err) {
      setCourseActionError(err instanceof Error ? err.message : 'Training link could not be created.');
    } finally {
      setRelationBusy('');
    }
  };

  const handleUnlinkCourse = async (courseId: string) => {
    if (!document) return;
    try {
      setRelationBusy('course');
      setCourseActionError('');
      const response = await fetch(`${API_BASE}/links/documents/${document.id}/courses/${courseId}`, {
        method: 'DELETE',
        headers,
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Training link could not be removed.');
      setLinkedCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      setCourseActionError(err instanceof Error ? err.message : 'Training link could not be removed.');
    } finally {
      setRelationBusy('');
    }
  };

  if (!document) return null;

  const linkedControlIds = new Set(linkedControls.map((c) => c.id));
  const availableControls = allControls.filter((c) => !linkedControlIds.has(c.id));

  const linkedCourseIds = new Set(linkedCourses.map((c) => c.id));
  const availableCourses = allCourses.filter((c) => !linkedCourseIds.has(c.id));

  const statusColors = DOC_STATUS_COLORS[document.status];

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="false"
      aria-label={`${document.title} details`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !showLinkControlModal && !showLinkCourseModal) {
          event.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(520px, 100vw)',
        backgroundColor: theme.colors.surface,
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: theme.spacing[6],
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, marginRight: theme.spacing[4] }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              marginBottom: theme.spacing[2],
            }}
          >
            <span
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: `${theme.colors.primary}15`,
                color: theme.colors.primary,
                borderRadius: '4px',
                textTransform: 'capitalize',
              }}
            >
              {DOC_TYPE_LABELS[document.docType]}
            </span>
            <span
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: statusColors.bg,
                color: statusColors.text,
                borderRadius: '4px',
              }}
            >
              {DOC_STATUS_LABELS[document.status]}
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.lg,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text.main,
              lineHeight: 1.4,
            }}
          >
            {document.title}
          </h2>
        </div>
        <Button aria-label="Close document details" variant="ghost" size="sm" onClick={onClose} style={{ padding: theme.spacing[2] }}>
          <CloseIcon size={20} />
        </Button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing[6],
        }}
      >
        {panelError ? <div role="alert" style={{ marginBottom: theme.spacing[4], padding: theme.spacing[3], border: `1px solid ${theme.colors.semantic.danger}`, borderRadius: theme.borderRadius.md, color: theme.colors.semantic.danger, backgroundColor: `${theme.colors.semantic.danger}12` }}>{panelError} Some relationship context may be incomplete; no missing link is being inferred.</div> : null}
        {/* Document Details */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Owner
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: 500 }}>{document.owner}</div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Classification
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.classification ? DOC_CLASSIFICATION_LABELS[document.classification] : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Version
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>{document.currentVersion || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Next Review
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.nextReviewDate
                  ? new Date(document.nextReviewDate).toLocaleDateString()
                  : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Review Frequency
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.reviewFrequencyMonths
                  ? `${document.reviewFrequencyMonths} months`
                  : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Effective Date
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.effectiveDate ? new Date(document.effectiveDate).toLocaleDateString() : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Expiry Date
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Published
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.publishedAt ? new Date(document.publishedAt).toLocaleDateString() : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Attestation
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: 500 }}>
                {document.attestationRequired ? 'Required' : 'Not required'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: theme.spacing[4] }}><PolicyAcknowledgement key={`${document.id}:${document.currentVersion || 'unversioned'}`} document={document} /></div>
          {document.description && (
            <div style={{ marginTop: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Description
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, lineHeight: 1.5 }}>
                {document.description}
              </div>
            </div>
          )}
          {(document.fileName || document.mimeType || document.fileSizeBytes) && (
            <div style={{ marginTop: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                File Metadata
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, lineHeight: 1.5 }}>
                {document.fileName || 'Document record'}
                {document.mimeType ? ` • ${document.mimeType}` : ''}
                {document.fileSizeBytes ? ` • ${(document.fileSizeBytes / 1024).toFixed(0)} KB` : ''}
              </div>
            </div>
          )}
          {safeExternalReference(document.locationUrl) && (
            <div style={{ marginTop: theme.spacing[4] }}>
              <a
                href={safeExternalReference(document.locationUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.colors.primary, fontSize: theme.typography.sizes.sm }}
              >
                View Document →
              </a>
            </div>
          )}
        </div>

        {document.docType === 'policy' ? <PolicyRules key={`${document.id}:${document.status}`} document={document} /> : null}

        {/* Linked Controls */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing[3],
            }}
          >
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.medium,
                color: theme.colors.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Linked Controls ({linkedControls.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void fetchAllControls();
                setShowLinkControlModal(true);
              }}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              + Link Control
            </Button>
          </div>
          {controlActionError && !showLinkControlModal ? <div role="alert" style={{ marginBottom: theme.spacing[3], color: theme.colors.semantic.danger }}>{controlActionError}</div> : null}
          {loadingControls ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading controls...
            </div>
          ) : linkedControls.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No controls linked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {linkedControls.map((control) => (
                <div
                  key={control.id}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid ${theme.colors.primary}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] }}>
                        <span
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            fontWeight: 600,
                            color: theme.colors.primary,
                          }}
                        >
                          {control.id}
                        </span>
                        <span
                          style={{
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: `${CONTROL_STATUS_COLORS[control.status]}15`,
                            color: CONTROL_STATUS_COLORS[control.status],
                            borderRadius: '3px',
                          }}
                        >
                          {CONTROL_STATUS_LABELS[control.status]}
                        </span>
                        <RelationBadge label={CONTROL_RELATION_LABELS[control.relationType]} color="#6366f1" />
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.text.main,
                        }}
                      >
                        {control.title}
                      </div>
                      {control.primaryFramework && (
                        <div
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            color: theme.colors.text.muted,
                            marginTop: theme.spacing[1],
                          }}
                        >
                          Framework: {getFrameworkName(control.primaryFramework)}
                        </div>
                      )}
                    </div>
                    <button
                      aria-label={`Unlink ${control.title}`}
                      disabled={relationBusy === 'control'}
                      onClick={() => void handleUnlinkControl(control.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.text.muted,
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      title="Unlink control"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Training Modules */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing[3],
            }}
          >
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.medium,
                color: theme.colors.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Linked Training Modules ({linkedCourses.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void fetchAllCourses();
                setShowLinkCourseModal(true);
              }}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              + Link Training
            </Button>
          </div>
          {courseActionError && !showLinkCourseModal ? <div role="alert" style={{ marginBottom: theme.spacing[3], color: theme.colors.semantic.danger }}>{courseActionError}</div> : null}
          {loadingCourses ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading courses...
            </div>
          ) : linkedCourses.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No training modules linked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {linkedCourses.map((course) => (
                <div
                  key={course.id}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid #10b981`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] }}>
                        {course.mandatory && (
                          <span
                            style={{
                              padding: '1px 6px',
                              fontSize: '10px',
                              fontWeight: 500,
                              backgroundColor: '#ef444415',
                              color: '#ef4444',
                              borderRadius: '3px',
                            }}
                          >
                            Mandatory
                          </span>
                        )}
                        <span
                          style={{
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: '#10b98115',
                            color: '#10b981',
                            borderRadius: '3px',
                          }}
                        >
                          {DELIVERY_FORMAT_LABELS[course.deliveryFormat]}
                        </span>
                        <RelationBadge label={DOCUMENT_TRAINING_RELATION_LABELS[course.relationType]} color="#10b981" />
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.text.main,
                        }}
                      >
                        {course.title}
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.text.muted,
                          marginTop: theme.spacing[1],
                        }}
                      >
                        {course.durationMinutes && <>{course.durationMinutes} min</>}
                      </div>
                    </div>
                    <button
                      aria-label={`Unlink ${course.title}`}
                      disabled={relationBusy === 'course'}
                      onClick={() => void handleUnlinkCourse(course.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.text.muted,
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      title="Unlink training"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div
          style={{
            marginTop: theme.spacing[6],
            paddingTop: theme.spacing[4],
            borderTop: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
              color: theme.colors.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: theme.spacing[3],
            }}
          >
            Recent Activity
          </div>
          {loadingActivity ? (
            <div
              style={{
                padding: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No recent activity
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    padding: theme.spacing[2],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: theme.typography.sizes.xs,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: theme.colors.text.main, fontWeight: 500 }}>
                        {activity.userEmail}
                      </span>
                      <span style={{ color: theme.colors.text.secondary }}> {activity.action}d</span>
                    </div>
                    <span style={{ color: theme.colors.text.muted, fontSize: '10px' }}>
                      {new Date(activity.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ color: theme.colors.text.secondary, marginTop: theme.spacing[1] }}>
                    {activity.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Link Control Modal */}
      <LinkModal
        title="Link Control"
        isOpen={showLinkControlModal}
        onClose={() => { if (relationBusy !== 'control') setShowLinkControlModal(false); }}
      >
        {controlActionError ? <div role="alert" style={{ marginBottom: theme.spacing[3], color: theme.colors.semantic.danger }}>{controlActionError}</div> : null}
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            htmlFor="governance-control-link"
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Control
          </label>
          <select
            id="governance-control-link"
            value={selectedControlId}
            onChange={(e) => setSelectedControlId(e.target.value)}
            disabled={relationBusy === 'control'}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Select a control...</option>
            {availableControls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.id} - {control.title}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            htmlFor="governance-control-relation"
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Relation Type
          </label>
          <select
            id="governance-control-relation"
            value={selectedControlRelation}
            onChange={(e) => setSelectedControlRelation(e.target.value as ControlRelationType)}
            disabled={relationBusy === 'control'}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {CONTROL_RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}>
          <Button variant="secondary" disabled={relationBusy === 'control'} onClick={() => setShowLinkControlModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleLinkControl()} disabled={!selectedControlId || relationBusy === 'control'}>
            {relationBusy === 'control' ? 'Linking...' : 'Link Control'}
          </Button>
        </div>
      </LinkModal>

      {/* Link Training Modal */}
      <LinkModal
        title="Link Training Module"
        isOpen={showLinkCourseModal}
        onClose={() => { if (relationBusy !== 'course') setShowLinkCourseModal(false); }}
      >
        {courseActionError ? <div role="alert" style={{ marginBottom: theme.spacing[3], color: theme.colors.semantic.danger }}>{courseActionError}</div> : null}
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            htmlFor="governance-training-link"
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Training Course
          </label>
          <select
            id="governance-training-link"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={relationBusy === 'course'}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Select a course...</option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} {course.mandatory ? '(Mandatory)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            htmlFor="governance-training-relation"
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Relation Type
          </label>
          <select
            id="governance-training-relation"
            value={selectedCourseRelation}
            onChange={(e) => setSelectedCourseRelation(e.target.value as DocumentTrainingRelationType)}
            disabled={relationBusy === 'course'}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {DOCUMENT_TRAINING_RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}>
          <Button variant="secondary" disabled={relationBusy === 'course'} onClick={() => setShowLinkCourseModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleLinkCourse()} disabled={!selectedCourseId || relationBusy === 'course'}>
            {relationBusy === 'course' ? 'Linking...' : 'Link Training'}
          </Button>
        </div>
      </LinkModal>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export function GovernanceDocuments() {
  const { currentWorkspace } = useWorkspace();
  const [documents, setDocuments] = useState<GovernanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<GovernanceDocumentType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<GovernanceDocumentStatus | ''>('');
  const [selectedDocument, setSelectedDocument] = useState<GovernanceDocument | null>(null);
  const documentRequestSequence = useRef(0);

  const fetchDocuments = useCallback(async () => {
    const sequence = ++documentRequestSequence.current;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedType) params.append('docType', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);

      const url = `${API_BASE}/governance-documents${params.toString() ? `?${params.toString()}` : ''}`;
      const result: ApiResponse<GovernanceDocument[]> = await apiCall(url, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });
      if (sequence !== documentRequestSequence.current) return;

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
        throw new Error(errorMsg);
      }

      const loadedDocuments = result.data || [];
      setDocuments(loadedDocuments);
      const sourceId = new URLSearchParams(window.location.search).get('source');
      if (sourceId) setSelectedDocument(loadedDocuments.find((item) => item.id === sourceId) || null);
    } catch (err) {
      if (sequence === documentRequestSequence.current) setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      if (sequence === documentRequestSequence.current) setLoading(false);
    }
  }, [currentWorkspace.id, selectedType, selectedStatus]);

  useEffect(() => {
    const sequenceRef = documentRequestSequence;
    void fetchDocuments();
    return () => { sequenceRef.current++; };
  }, [fetchDocuments]);

  const handleCreateDocument = async (input: CreateGovernanceDocumentInput) => {
    const result: ApiResponse<GovernanceDocument> = await apiCall(`${API_BASE}/governance-documents`, {
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

    await fetchDocuments();
  };

  const summaryStats = {
    total: documents.length,
    active: documents.filter(d => d.status === 'active' || d.status === 'published' || d.status === 'approved').length,
    underReview: documents.filter(d => d.status === 'under_review').length,
    pendingAttestation: documents.filter(d => d.status === 'pending_attestation' || d.attestationRequired).length,
    dueForReview: documents.filter(d => {
      if (!d.nextReviewDate) return false;
      return new Date(d.nextReviewDate) <= new Date();
    }).length,
  };

  const columns = [
    { key: 'id', header: 'ID', width: '100px' },
    {
      key: 'title',
      header: 'Document Title',
      render: (item: GovernanceDocument) => (
        <div>
          <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>
            {item.title}
          </span>
          {safeExternalReference(item.locationUrl) && (
            <a
              href={safeExternalReference(item.locationUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: theme.spacing[2],
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.xs,
              }}
              onClick={e => e.stopPropagation()}
            >
              [Link]
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'docType',
      header: 'Type',
      render: (item: GovernanceDocument) => DOC_TYPE_LABELS[item.docType],
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (item: GovernanceDocument) => item.classification ? DOC_CLASSIFICATION_LABELS[item.classification] : '-',
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'currentVersion',
      header: 'Version',
      render: (item: GovernanceDocument) => item.currentVersion || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: GovernanceDocument) => {
        const colors = DOC_STATUS_COLORS[item.status];
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
            {DOC_STATUS_LABELS[item.status]}
          </span>
        );
      },
    },
    {
      key: 'nextReviewDate',
      header: 'Next Review',
      render: (item: GovernanceDocument) => {
        if (!item.nextReviewDate) return '-';
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
      key: 'lastReviewedAt',
      header: 'Last Reviewed',
      render: (item: GovernanceDocument) => {
        if (!item.lastReviewedAt) return 'Never';
        return new Date(item.lastReviewedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      },
    },
  ];

  const filterSection = (
    <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
      <select
        value={selectedType}
        onChange={e => setSelectedType(e.target.value as GovernanceDocumentType | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Types</option>
        <option value="policy">Policy</option>
        <option value="standard">Standard</option>
        <option value="procedure">Procedure</option>
        <option value="guideline">Guideline</option>
        <option value="framework_document">Framework Document</option>
        <option value="risk_document">Risk Document</option>
        <option value="control_document">Control Document</option>
        <option value="evidence_document">Evidence Document</option>
        <option value="audit_document">Audit Document</option>
        <option value="training_material">Training Material</option>
        <option value="incident_document">Incident Document</option>
        <option value="vendor_document">Vendor Document</option>
        <option value="compliance_register">Compliance Register</option>
        <option value="management_review_document">Management Review Document</option>
        <option value="custom">Custom Document Type</option>
      </select>

      <select
        value={selectedStatus}
        onChange={e => setSelectedStatus(e.target.value as GovernanceDocumentStatus | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="under_review">Under Review</option>
        <option value="approved">Approved</option>
        <option value="published">Published</option>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
        <option value="superseded">Superseded</option>
        <option value="archived">Archived</option>
        <option value="retired">Retired</option>
        <option value="rejected">Rejected</option>
        <option value="pending_attestation">Pending Attestation</option>
      </select>
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Policy and Document Management"
          description="Manage policy records, lifecycle states, review cycles, approvals, and framework-linked governance documents."
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
          Loading documents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Policy and Document Management"
          description="Manage policy records, lifecycle states, review cycles, approvals, and framework-linked governance documents."
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
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading documents</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchDocuments}
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
        title="Policy and Document Management"
        description="Manage policy records, lifecycle states, review cycles, approvals, attestation readiness, and linked governance documents."
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
          { label: 'Total Documents', value: summaryStats.total, color: theme.colors.primary },
          { label: 'Active / Published', value: summaryStats.active, color: '#059669' },
          { label: 'Under Review', value: summaryStats.underReview, color: '#2563EB' },
          { label: 'Pending Attestation', value: summaryStats.pendingAttestation, color: '#B45309' },
          { label: 'Due for Review', value: summaryStats.dueForReview, color: '#DC2626' },
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

      {filterSection}

      <DataTable
        data={documents}
        columns={columns}
        searchPlaceholder="Search documents..."
        primaryAction={{
          label: 'New Document',
          onClick: () => setIsModalOpen(true),
        }}
        onRowClick={(doc) => setSelectedDocument(doc)}
      />

      <DocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateDocument} />
      <DocumentDetailPanel document={selectedDocument} onClose={() => setSelectedDocument(null)} />
    </div>
  );
}
