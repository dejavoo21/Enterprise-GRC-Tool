import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { Button } from '../components/Button';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchSeedProfiles,
  createWorkspace,
} from '../lib/api';
import type {
  SeedProfile,
  WorkspaceSeedProfile,
  CreateWorkspacePayload,
} from '../types/workspace';
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '../types/workspace';

export function WorkspaceWizard() {
  const navigate = useNavigate();
  const { switchWorkspace } = useWorkspace();
  const { user, switchWorkspace: switchAuthWorkspace } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [industry, setIndustry] = useState('general');
  const [region, setRegion] = useState('global');
  const [seedProfile, setSeedProfile] = useState<WorkspaceSeedProfile>('standard');
  const [seedProfiles, setSeedProfiles] = useState<SeedProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profiles = await fetchSeedProfiles();
        setSeedProfiles(profiles);
      } catch (err) {
        console.error('Failed to load seed profiles:', err);
        // Fallback profiles
        setSeedProfiles([
          { id: 'minimal', name: 'Minimal', description: '1 risk, 3 core controls - Just the basics' },
          { id: 'standard', name: 'Standard', description: '3 risks, 8 controls, 1 policy, 1 training' },
          { id: 'full', name: 'Full', description: '5 risks, 12 controls, 5 documents, 4 training courses' },
        ]);
      }
    };
    loadProfiles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateWorkspacePayload = {
        displayName: displayName.trim(),
        industry,
        region,
        seedProfile,
      };

      const result = await createWorkspace(payload);

      setCreatedWorkspaceId(result.workspace.id);
      setSuccess(true);

      // Switch to the new organization context (auth token + UI context)
      await switchAuthWorkspace(result.workspace.id);
      switchWorkspace(result.workspace.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete organization setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && createdWorkspaceId) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <PageHeader
          title="Organization Setup Complete"
          description="Your operating environment is ready to use."
        />

        <div
          style={{
            backgroundColor: '#D1FAE5',
            border: '1px solid #10B981',
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing[6],
            textAlign: 'center',
            marginBottom: theme.spacing[6],
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: theme.spacing[4] }}>
            &#10003;
          </div>
          <h2 style={{ margin: 0, marginBottom: theme.spacing[2], color: '#059669' }}>
            Setup complete
          </h2>
          <p style={{ margin: 0, color: '#047857' }}>
            <strong>{displayName}</strong> has been created and seeded with initial operating data.
          </p>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing[6],
            marginBottom: theme.spacing[6],
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: theme.spacing[4] }}>Next steps</h3>
          <ul style={{ margin: 0, paddingLeft: theme.spacing[6], lineHeight: 2 }}>
            <li>Review and customize your seeded controls and risks</li>
            <li>Invite team members to collaborate</li>
            <li>Map controls to your relevant compliance frameworks</li>
            <li>Start collecting evidence for your controls</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'center' }}>
          <Button
            variant="primary"
            onClick={() => {
              navigate('/');
            }}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              navigate('/workspace-members');
            }}
          >
            Invite Team Members
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <PageHeader
        title="Organization Setup"
        description="Configure a live operating environment for your organization or client."
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1d4ed8 52%, #60a5fa 100%)',
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[6],
          marginBottom: theme.spacing[6],
          color: theme.colors.text.inverse,
        }}
      >
        <div style={{ fontSize: theme.typography.sizes.xs, letterSpacing: '0.08em', opacity: 0.74, marginBottom: theme.spacing[2] }}>
          ORGANIZATION SETUP
        </div>
        <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, marginBottom: theme.spacing[2] }}>
          Establish the operating environment before the platform starts reporting posture.
        </div>
        <div style={{ color: 'rgba(255,255,255,0.86)', lineHeight: 1.65 }}>
          Define the organization profile, region, and starter content so governance, risk, privacy, readiness, and training modules can begin from a clean baseline.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing[6],
            marginBottom: theme.spacing[6],
          }}
        >
          {/* Organization Name */}
          <div style={{ marginBottom: theme.spacing[6] }}>
            <label
              htmlFor="displayName"
              style={{
                display: 'block',
                marginBottom: theme.spacing[2],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Organization Name *
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Acme Healthcare, Client ABC"
              style={{
                width: '100%',
                padding: theme.spacing[3],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
            <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              This will be the primary label used across the operating suite.
            </p>
          </div>

          {/* Industry */}
          <div style={{ marginBottom: theme.spacing[6] }}>
            <label
              htmlFor="industry"
              style={{
                display: 'block',
                marginBottom: theme.spacing[2],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Industry
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{
                width: '100%',
                padding: theme.spacing[3],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                backgroundColor: 'white',
              }}
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              Helps tailor the initial control and compliance baseline.
            </p>
          </div>

          {/* Region */}
          <div style={{ marginBottom: theme.spacing[6] }}>
            <label
              htmlFor="region"
              style={{
                display: 'block',
                marginBottom: theme.spacing[2],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Primary Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={{
                width: '100%',
                padding: theme.spacing[3],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                backgroundColor: 'white',
              }}
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              Helps shape likely regulatory and privacy obligations.
            </p>
          </div>

          {/* Seed Profile */}
          <div style={{ marginBottom: theme.spacing[4] }}>
            <label
              style={{
                display: 'block',
                marginBottom: theme.spacing[3],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Launch Baseline
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
              {seedProfiles.map((profile) => (
                <label
                  key={profile.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: theme.spacing[3],
                    padding: theme.spacing[4],
                    border: `2px solid ${seedProfile === profile.id ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    cursor: 'pointer',
                    backgroundColor: seedProfile === profile.id ? `${theme.colors.primary}08` : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="seedProfile"
                    value={profile.id}
                    checked={seedProfile === profile.id}
                    onChange={() => setSeedProfile(profile.id)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing[1] }}>
                      {profile.name}
                    </div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {profile.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #FECACA',
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing[4],
              marginBottom: theme.spacing[6],
              color: '#DC2626',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !displayName.trim()}
          >
            {isSubmitting ? 'Setting up...' : 'Complete Setup'}
          </Button>
        </div>
      </form>

      {user && (
        <p style={{ marginTop: theme.spacing[6], textAlign: 'center', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
          You will be the owner of this environment and can invite other team members after setup.
        </p>
      )}
    </div>
  );
}

