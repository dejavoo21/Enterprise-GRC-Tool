import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { fetchSeedProfiles, createWorkspace } from '../lib/api';
import { theme } from '../theme';
import type {
  CreateWorkspacePayload,
  SeedProfile,
  WorkspaceSeedProfile,
} from '../types/workspace';
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '../types/workspace';

const pageStyle = {
  maxWidth: '1120px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const inputStyle = {
  width: '100%',
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.sizes.sm,
  backgroundColor: theme.colors.surface,
};

export function WorkspaceWizard() {
  const navigate = useNavigate();
  const { switchWorkspace } = useWorkspace();
  const { switchWorkspace: switchAuthWorkspace } = useAuth();

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
        setSeedProfiles(await fetchSeedProfiles());
      } catch {
        setSeedProfiles([
          { id: 'minimal', name: 'Minimal', description: '1 risk, 3 core controls' },
          { id: 'standard', name: 'Standard', description: '3 risks, 8 controls, 1 policy' },
          { id: 'full', name: 'Full', description: '5 risks, 12 controls, 5 documents' },
        ]);
      }
    };
    void loadProfiles();
  }, []);

  const setupMetrics = useMemo(
    () => [
      { label: 'Setup Steps', value: 3, detail: 'Profile, region, and starter baseline', tone: 'primary' as const },
      { label: 'Seed Profiles', value: seedProfiles.length || 3, detail: 'Choose the launch baseline', tone: 'success' as const },
      { label: 'Region Scope', value: REGION_OPTIONS.length, detail: 'Starting regional context', tone: 'default' as const },
      { label: 'Launch State', value: success ? 'Ready' : 'Draft', detail: success ? 'Workspace created' : 'Awaiting submission', tone: success ? 'success' as const : 'warning' as const },
    ],
    [seedProfiles.length, success],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <div style={pageStyle}>
        <PageHeader
          title="Organization Setup"
          description="The organization workspace is ready and the initial operating baseline has been created."
        />
        <SummaryMetricStrip metrics={setupMetrics} />
        <EmptyStatePanel
          eyebrow="Setup Complete"
          title={`${displayName} is ready to operate`}
          description="The workspace has been provisioned, starter content was seeded, and you can move directly into governance, control design, reporting, and team onboarding."
          actions={
            <>
              <Button variant="primary" onClick={() => navigate('/')}>Go to Dashboard</Button>
              <Button variant="outline" onClick={() => navigate('/workspace-members')}>Invite Team Members</Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Organization Setup"
        description="Create a live operating workspace with the right region, industry context, and starter baseline."
        action={<Button variant="primary" type="submit" form="workspace-setup-form" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Workspace'}</Button>}
      />

      <SummaryMetricStrip metrics={setupMetrics} />

      <PageSectionCard title="Setup Progress" subtitle="A compact launch workflow for a new operating environment.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
          {[
            { step: '1', title: 'Organization Profile', detail: 'Name and business context', active: true },
            { step: '2', title: 'Region & Obligations', detail: 'Primary operating region', active: true },
            { step: '3', title: 'Starter Baseline', detail: 'Seed controls and risks', active: true },
          ].map((item) => (
            <div key={item.step} style={{ minWidth: 0, padding: theme.spacing[4], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surfaceHover }}>
              <div style={{ display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary, color: theme.colors.text.inverse, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.bold }}>
                {item.step}
              </div>
              <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                {item.title}
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </PageSectionCard>

      <form id="workspace-setup-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing[5] }}>
        <PageSectionCard title="Organization Profile" subtitle="Capture the minimum profile needed to initialize the workspace.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[4] }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="displayName" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Organization Name
              </label>
              <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Acme Healthcare" style={inputStyle} />
            </div>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="industry" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Industry
              </label>
              <select id="industry" value={industry} onChange={(event) => setIndustry(event.target.value)} style={inputStyle}>
                {INDUSTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </PageSectionCard>

        <PageSectionCard title="Operating Context" subtitle="Pick the initial regional and baseline assumptions for the tenant.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[4] }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="region" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Primary Region
              </label>
              <select id="region" value={region} onChange={(event) => setRegion(event.target.value)} style={inputStyle}>
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Launch Baseline
              </div>
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {seedProfiles.map((profile) => (
                  <label
                    key={profile.id}
                    style={{
                      display: 'flex',
                      gap: theme.spacing[3],
                      alignItems: 'flex-start',
                      padding: theme.spacing[3],
                      border: `1px solid ${seedProfile === profile.id ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: theme.borderRadius.lg,
                      backgroundColor: seedProfile === profile.id ? theme.colors.primaryLight : theme.colors.surface,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="seedProfile"
                      value={profile.id}
                      checked={seedProfile === profile.id}
                      onChange={() => setSeedProfile(profile.id as WorkspaceSeedProfile)}
                    />
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                        {profile.name}
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                        {profile.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {error ? (
            <div style={{ marginTop: theme.spacing[4], padding: theme.spacing[3], backgroundColor: theme.colors.semantic.dangerLight, border: `1px solid ${theme.colors.semantic.danger}`, borderRadius: theme.borderRadius.md, color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.sm }}>
              {error}
            </div>
          ) : null}
        </PageSectionCard>
      </form>
    </div>
  );
}
