import React from 'react';
import { theme } from '../theme';
import { Badge } from './Badge';
import { Button } from './Button';
import { CloseIcon } from './icons';
import type { Risk } from '../types/risk';
import { RISK_STATUS_LABELS, RISK_CATEGORY_LABELS, getRiskSeverity, getRiskSeverityLabel } from '../types/risk';

interface RiskDetailPanelProps {
  risk: Risk | null;
  onClose: () => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: theme.spacing[4] }}>
      <div
        style={{
          fontSize: theme.typography.sizes.xs,
          fontWeight: theme.typography.weights.medium,
          color: theme.colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: theme.spacing[1],
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
        {children}
      </div>
    </div>
  );
}

function RiskScoreDisplay({ likelihood, impact, label }: { likelihood: number; impact: number; label: string }) {
  const score = likelihood * impact;
  const severity = getRiskSeverity(score);
  const severityLabel = getRiskSeverityLabel(score);

  return (
    <div
      style={{
        padding: theme.spacing[4],
        backgroundColor: theme.colors.surfaceHover,
        borderRadius: theme.borderRadius.lg,
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: theme.typography.sizes.xs,
          fontWeight: theme.typography.weights.medium,
          color: theme.colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: theme.spacing[2],
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
        <span
          style={{
            fontSize: theme.typography.sizes['2xl'],
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.text.main,
          }}
        >
          {score}
        </span>
        <Badge variant={severity}>{severityLabel}</Badge>
      </div>
      <div
        style={{
          fontSize: theme.typography.sizes.xs,
          color: theme.colors.text.secondary,
          marginTop: theme.spacing[2],
        }}
      >
        Likelihood: {likelihood} × Impact: {impact}
      </div>
    </div>
  );
}

export function RiskDetailPanel({ risk, onClose }: RiskDetailPanelProps) {
  if (!risk) return null;

  const statusVariant = {
    identified: 'warning',
    assessed: 'info',
    treated: 'primary',
    accepted: 'success',
    closed: 'default',
  }[risk.status] as 'warning' | 'info' | 'primary' | 'success' | 'default';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '480px',
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
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.muted,
              marginBottom: theme.spacing[1],
            }}
          >
            {risk.id}
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
            {risk.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} style={{ padding: theme.spacing[2] }}>
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
        {/* Risk Scores */}
        <div
          style={{
            display: 'flex',
            gap: theme.spacing[3],
            marginBottom: theme.spacing[6],
          }}
        >
          <RiskScoreDisplay
            likelihood={risk.inherentLikelihood}
            impact={risk.inherentImpact}
            label="Inherent Risk"
          />
          <RiskScoreDisplay
            likelihood={risk.residualLikelihood}
            impact={risk.residualImpact}
            label="Residual Risk"
          />
        </div>

        <DetailRow label="Status">
          <Badge variant={statusVariant}>{RISK_STATUS_LABELS[risk.status]}</Badge>
        </DetailRow>

        <DetailRow label="Category">
          <Badge variant="default">{RISK_CATEGORY_LABELS[risk.category]}</Badge>
        </DetailRow>

        <DetailRow label="Owner">{risk.owner}</DetailRow>

        {risk.description && (
          <DetailRow label="Description">
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {risk.description}
            </div>
          </DetailRow>
        )}

        {risk.treatmentPlan && (
          <DetailRow label="Treatment Plan">
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                padding: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                borderLeft: `3px solid ${theme.colors.primary}`,
              }}
            >
              {risk.treatmentPlan}
            </div>
          </DetailRow>
        )}

        {risk.dueDate && (
          <DetailRow label="Due Date">
            {new Date(risk.dueDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </DetailRow>
        )}

        {risk.controlIds && risk.controlIds.length > 0 && (
          <DetailRow label="Linked Controls">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2] }}>
              {risk.controlIds.map((id) => (
                <Badge key={id} variant="primary" size="sm">
                  {id}
                </Badge>
              ))}
            </div>
          </DetailRow>
        )}

        <div
          style={{
            marginTop: theme.spacing[6],
            paddingTop: theme.spacing[4],
            borderTop: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <div style={{ display: 'flex', gap: theme.spacing[4] }}>
            <DetailRow label="Created">
              <span style={{ fontSize: theme.typography.sizes.xs }}>
                {new Date(risk.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </DetailRow>
            <DetailRow label="Last Updated">
              <span style={{ fontSize: theme.typography.sizes.xs }}>
                {new Date(risk.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </DetailRow>
          </div>
        </div>
      </div>

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
