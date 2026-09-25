import { apiCall, API_BASE } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { ratingFor, type MethodologyConfig, type MethodologyVersion } from '../lib/methodologyMatrix';
import React, { useEffect, useState } from 'react';
import { theme } from '../theme';
import { Modal } from './Modal';
import { Button } from './Button';
import type { CiaImpact, CreateRiskInput, RiskCategory, RiskReviewStatus, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/risk';
import { normalizeCiaImpacts, RISK_CATEGORY_LABELS, RISK_STATUS_LABELS } from '../types/risk';

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (risk: CreateRiskInput) => Promise<void>;
  initialRisk?: (Partial<CreateRiskInput> & Pick<CreateRiskInput, 'title' | 'owner' | 'category' | 'inherentLikelihood' | 'inherentImpact' | 'ciaImpacts'> & { id: string }) | null;
}

const CATEGORY_OPTIONS: RiskCategory[] = [
  'information_security',
  'privacy',
  'vendor',
  'operational',
  'compliance',
  'strategic',
];

const CIA_OPTIONS: CiaImpact[] = ['Confidentiality', 'Integrity', 'Availability'];

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

const EMPTY_RISK: CreateRiskInput = {
  title: '',
  description: '',
  owner: '',
  category: 'information_security',
  inherentLikelihood: 3,
  inherentImpact: 3,
  residualLikelihood: 3,
  residualImpact: 3,
  ciaImpacts: [],
  dueDate: '',
  treatmentPlan: '',
  status: 'identified',
  treatmentStatus: 'not_started', treatmentProgress: 0, reviewStatus: 'not_reviewed', reassessmentRequired: false,
};

export function RiskModal({ isOpen, onClose, onSubmit, initialRisk = null }: RiskModalProps) {
  const { currentWorkspace } = useWorkspace();
  const [methodology, setMethodology] = useState<MethodologyConfig | null>(null);
  const [methodologyError, setMethodologyError] = useState('');
  const riskId = initialRisk?.id;
  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    setMethodology(null); setMethodologyError('');
    const load = async () => {
      let config: MethodologyConfig | null = null;
      if (riskId) {
        const { data } = await apiCall<{data: { methodologyId?: string | null; methodology?: MethodologyVersion | null }}>(`${API_BASE}/risks/${encodeURIComponent(riskId)}`);
        if (data.methodologyId && !data.methodology) throw new Error('Pinned methodology unavailable. Contact your administrator.');
        config = data.methodology?.config ?? (await apiCall<{data:MethodologyConfig}>(`${API_BASE}/risk-methodologies/template`)).data;
        if (!data.methodologyId) {
          const state = (await apiCall<{data:{methodologyMode:string}}>(`${API_BASE}/risk-methodologies/state`)).data;
          if (current) setMethodologyError(state.methodologyMode === 'enforced'
            ? 'Legacy risk: non-scoring edits only. Scoring changes require an explicit migration workflow.'
            : 'Legacy scoring mode. This risk has no pinned methodology version.');
        }
      } else {
        config = (await apiCall<{data:MethodologyVersion|null}>(`${API_BASE}/risk-methodologies/active`)).data?.config ?? null;
        if (!config) {
          const state = (await apiCall<{data:{legacyCompatibility:boolean; enforcementWarning:string}}>(`${API_BASE}/risk-methodologies/state`)).data;
          if (!state.legacyCompatibility) throw new Error('Risk methodology must be configured before creating risks');
          config = (await apiCall<{data:MethodologyConfig}>(`${API_BASE}/risk-methodologies/template`)).data;
          if (current) setMethodologyError(state.enforcementWarning);
        }
      }
      if (current) setMethodology(config);
    };
    void load().catch(err => { if (current) setMethodologyError(err instanceof Error ? err.message : 'Methodology unavailable'); });
    return () => { current = false; };
  }, [isOpen, riskId, currentWorkspace.id]);
  const LIKELIHOOD_OPTIONS = methodology?.likelihoodLevels ?? [];
  const IMPACT_OPTIONS = methodology?.impactLevels ?? [];
  const previewRating = (score: number) => methodology ? ratingFor(methodology, score)?.label ?? 'Outside methodology scale' : 'Methodology unavailable';
  const [formData, setFormData] = useState<CreateRiskInput>({
    ...EMPTY_RISK,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialRisk ? {
      title: initialRisk.title,
      description: initialRisk.description || '',
      owner: initialRisk.owner,
      category: initialRisk.category,
      inherentLikelihood: initialRisk.inherentLikelihood,
      inherentImpact: initialRisk.inherentImpact,
      residualLikelihood: initialRisk.residualLikelihood ?? initialRisk.inherentLikelihood,
      residualImpact: initialRisk.residualImpact ?? initialRisk.inherentImpact,
      ciaImpacts: normalizeCiaImpacts(initialRisk.ciaImpacts),
      dueDate: initialRisk.dueDate?.slice(0, 10) || '',
      treatmentPlan: initialRisk.treatmentPlan || '',
      status: initialRisk.status || 'identified',
      treatmentStrategy: initialRisk.treatmentStrategy,
      treatmentOwner: initialRisk.treatmentOwner || '',
      treatmentStatus: initialRisk.treatmentStatus || 'not_started',
      treatmentProgress: initialRisk.treatmentProgress || 0,
      treatmentDueDate: initialRisk.treatmentDueDate?.slice(0, 10) || '',
      targetLikelihood: initialRisk.targetLikelihood,
      targetImpact: initialRisk.targetImpact,
      acceptanceRationale: initialRisk.acceptanceRationale || '',
      nextReviewDate: initialRisk.nextReviewDate?.slice(0, 10) || initialRisk.dueDate?.slice(0, 10) || '',
      reviewStatus: initialRisk.reviewStatus || 'not_reviewed',
      reviewNotes: initialRisk.reviewNotes || '',
      reviewOwner: initialRisk.reviewOwner || '',
      reassessmentRequired: initialRisk.reassessmentRequired || false,
    } : { ...EMPTY_RISK, ciaImpacts: [] });
    setError(null);
  }, [initialRisk, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodology) { setError(methodologyError || "Loading methodology..."); return; }
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.owner.trim()) {
      setError('Owner is required');
      return;
    }
    if (formData.ciaImpacts.length === 0) {
      setError('Select at least one CIA impact');
      return;
    }
    if (['planned', 'in_progress'].includes(formData.treatmentStatus || '') && (!formData.treatmentOwner?.trim() || !formData.treatmentDueDate)) {
      setError('Treatment owner and due date are required for planned or in-progress treatment');
      return;
    }
    if ((formData.status === 'accepted' || formData.treatmentStrategy === 'accept' || formData.treatmentStatus === 'accepted') && !formData.acceptanceRationale?.trim()) {
      setError('Acceptance rationale is required for accepted risks');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData, targetLikelihood: formData.targetLikelihood ?? null, targetImpact: formData.targetImpact ?? null });
      // Reset form
      setFormData({ ...EMPTY_RISK, ciaImpacts: [] });
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
      accessibleDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={initialRisk ? 'Edit Risk' : 'Create New Risk'}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !methodology}>
            {isSubmitting ? 'Saving...' : initialRisk ? 'Save Changes' : 'Create Risk'}
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

        <p role="status">{methodologyError || (methodology ? methodology.name + ' - server validates final scores' : 'Loading methodology...')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
          <label>Target likelihood<select style={inputStyle} value={formData.targetLikelihood ?? ''} onChange={e => setFormData({ ...formData, targetLikelihood: e.target.value ? Number(e.target.value) : undefined })}><option value="">Not set</option>{LIKELIHOOD_OPTIONS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
          <label>Target impact<select style={inputStyle} value={formData.targetImpact ?? ''} onChange={e => setFormData({ ...formData, targetImpact: e.target.value ? Number(e.target.value) : undefined })}><option value="">Not set</option>{IMPACT_OPTIONS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
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
            <label style={labelStyle}>Residual Likelihood</label>
            <select value={formData.residualLikelihood} onChange={(e) => setFormData({ ...formData, residualLikelihood: parseInt(e.target.value, 10) })} style={inputStyle}>
              {LIKELIHOOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Residual Impact</label>
            <select value={formData.residualImpact} onChange={(e) => setFormData({ ...formData, residualImpact: parseInt(e.target.value, 10) })} style={inputStyle}>
              {IMPACT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ ...formGroupStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }} aria-live="polite">
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, background: theme.colors.surfaceHover }}>
            <strong>Inherent risk preview: {formData.inherentLikelihood * formData.inherentImpact}</strong>
            <div>{previewRating(formData.inherentLikelihood * formData.inherentImpact)}</div>
          </div>
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, background: theme.colors.surfaceHover }}>
            <strong>Current residual risk preview: {(formData.residualLikelihood ?? formData.inherentLikelihood) * (formData.residualImpact ?? formData.inherentImpact)}</strong>
            <div>{previewRating((formData.residualLikelihood ?? formData.inherentLikelihood) * (formData.residualImpact ?? formData.inherentImpact))}</div>
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

        <fieldset style={{ ...formGroupStyle, border: 0, padding: 0, marginInline: 0 }}>
          <legend style={labelStyle}>
            CIA Impact <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {CIA_OPTIONS.map((impact) => {
              const checked = formData.ciaImpacts.includes(impact);
              return (
                <label key={impact} style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing[2], padding: `${theme.spacing[2]} ${theme.spacing[3]}`, border: `1px solid ${checked ? theme.colors.primary : theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: checked ? theme.colors.surfaceHover : theme.colors.surface, cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => setFormData({ ...formData, ciaImpacts: checked ? formData.ciaImpacts.filter((item) => item !== impact) : [...formData.ciaImpacts, impact] })} />
                  <span>{impact}</span>
                </label>
              );
            })}
          </div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Select every information-security objective affected by this risk.</div>
        </fieldset>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as RiskStatus })} style={inputStyle}>
              {(Object.entries(RISK_STATUS_LABELS) as Array<[RiskStatus, string]>).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Review date</label>
            <input type="date" value={formData.dueDate || ''} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={inputStyle} />
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Treatment plan</label>
          <textarea value={formData.treatmentPlan || ''} onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })} placeholder="Summarise the current treatment approach" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div style={formGroupStyle}><label style={labelStyle}>Treatment strategy</label><select value={formData.treatmentStrategy || ''} onChange={(e) => setFormData({ ...formData, treatmentStrategy: e.target.value ? e.target.value as RiskTreatmentStrategy : undefined })} style={inputStyle}><option value="">Not selected</option>{['mitigate','accept','transfer','avoid','monitor'].map((value) => <option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></div>
          <div style={formGroupStyle}><label style={labelStyle}>Treatment status</label><select value={formData.treatmentStatus} onChange={(e) => setFormData({ ...formData, treatmentStatus: e.target.value as RiskTreatmentStatus })} style={inputStyle}>{['not_started','planned','in_progress','awaiting_evidence','under_review','completed','overdue','accepted','deferred','cancelled'].map((value) => <option key={value} value={value}>{value.replace(/_/g,' ')}</option>)}</select></div>
          <div style={formGroupStyle}><label style={labelStyle}>Treatment owner</label><input value={formData.treatmentOwner || ''} onChange={(e) => setFormData({ ...formData, treatmentOwner: e.target.value })} style={inputStyle}/></div>
          <div style={formGroupStyle}><label style={labelStyle}>Treatment due date</label><input type="date" value={formData.treatmentDueDate || ''} onChange={(e) => setFormData({ ...formData, treatmentDueDate: e.target.value })} style={inputStyle}/></div>
          <div style={formGroupStyle}><label style={labelStyle}>Treatment progress (%)</label><input type="number" min="0" max="100" value={formData.treatmentProgress ?? 0} onChange={(e) => setFormData({ ...formData, treatmentProgress: Number(e.target.value) })} style={inputStyle}/></div>
          <div style={formGroupStyle}><label style={labelStyle}>Next review date</label><input type="date" value={formData.nextReviewDate || ''} onChange={(e) => setFormData({ ...formData, nextReviewDate: e.target.value })} style={inputStyle}/></div>
          <div style={formGroupStyle}><label style={labelStyle}>Review status</label><select value={formData.reviewStatus} onChange={(e) => setFormData({ ...formData, reviewStatus: e.target.value as RiskReviewStatus })} style={inputStyle}>{['not_reviewed','review_due','in_review','reviewed','overdue','reassessment_required'].map((value) => <option key={value} value={value}>{value.replace(/_/g,' ')}</option>)}</select></div>
          <div style={formGroupStyle}><label style={labelStyle}>Review owner</label><input value={formData.reviewOwner || ''} onChange={(e) => setFormData({ ...formData, reviewOwner: e.target.value })} style={inputStyle}/></div>
        </div>
        {(formData.status === 'accepted' || formData.treatmentStrategy === 'accept' || formData.treatmentStatus === 'accepted') ? <div style={formGroupStyle}><label style={labelStyle}>Acceptance rationale <span style={{ color: theme.colors.semantic.danger }}>*</span></label><textarea value={formData.acceptanceRationale || ''} onChange={(e) => setFormData({ ...formData, acceptanceRationale: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }}/></div> : null}
        <div style={formGroupStyle}><label style={labelStyle}>Review notes</label><textarea value={formData.reviewNotes || ''} onChange={(e) => setFormData({ ...formData, reviewNotes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }}/></div>
      </form>
    </Modal>
  );
}
