import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { fetchSeedProfiles, createWorkspace } from '../lib/api';
import type { SeedProfile, WorkspaceSeedProfile } from '../types/workspace';
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '../types/workspace';
import { AdminCard, AdminHero, AdminMetrics, AdminNotice } from './admin/AdminPrimitives';

export function WorkspaceWizard() {
  const navigate = useNavigate();
  const { refreshWorkspaces } = useWorkspace();
  const { switchWorkspace } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [industry, setIndustry] = useState('general');
  const [region, setRegion] = useState('global');
  const [seedProfile, setSeedProfile] = useState<WorkspaceSeedProfile>('standard');
  const [seedProfiles, setSeedProfiles] = useState<SeedProfile[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeedProfiles().then(profiles => { if (!cancelled) { setSeedProfiles(profiles); setProfileError(null); } })
      .catch(err => { if (!cancelled) setProfileError(err instanceof Error ? err.message : 'Starter baselines are unavailable.'); })
      .finally(() => { if (!cancelled) setProfilesLoading(false); });
    return () => { cancelled = true; };
  }, [profileAttempt]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createdWorkspaceId || isSubmitting) return;
    setError(null);
    if (!displayName.trim()) { setError('Organization name is required.'); return; }
    if (!seedProfiles.some(profile => profile.id === seedProfile)) { setError('Select an available starter baseline.'); return; }
    setIsSubmitting(true);
    try {
      const result = await createWorkspace({ displayName: displayName.trim(), industry, region, seedProfile });
      // Record creation before switching so a failed switch cannot cause duplicate provisioning.
      setCreatedWorkspaceId(result.workspace.id);
      await switchWorkspace(result.workspace.id);
      await refreshWorkspaces();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete organization setup.'); }
    finally { setIsSubmitting(false); }
  };

  return <div className="adminPage">
    <AdminHero title="Organization Setup" description="Create an operating workspace with the right region, industry context, and starter baseline." action={!createdWorkspaceId && <Button variant="primary" type="submit" form="workspace-setup-form" disabled={isSubmitting || !seedProfiles.length}>{isSubmitting ? 'Creating...' : 'Create Workspace'}</Button>} />
    <AdminMetrics metrics={[
      { label: 'Setup Steps', value: 3, detail: 'Guided setup workflow' },
      { label: 'Seed Profiles', value: profilesLoading ? 'Loading' : profileError ? 'Unavailable' : seedProfiles.length, detail: 'Available starter baselines', tone: 'success' },
      { label: 'Region Scope', value: REGION_OPTIONS.length, detail: 'Operating regions' },
      { label: 'Launch State', value: createdWorkspaceId ? 'Created' : 'Draft', detail: createdWorkspaceId ? 'Workspace provisioned' : 'Awaiting submission', tone: createdWorkspaceId ? 'success' : 'warning' },
    ]} />
    {error && <AdminNotice error>{error}</AdminNotice>}
    {createdWorkspaceId ? <AdminCard title={`${displayName} has been created`} description="Your organization, tenant, and workspace have been provisioned.">
      <div className="adminFooterActions"><Button onClick={() => navigate('/workspace-management')}>Workspace Management</Button><Button onClick={() => navigate('/workspace-members')}>Team Access</Button><Button variant="primary" onClick={() => navigate('/')}>Go to Dashboard</Button></div>
    </AdminCard> : <>
      <AdminCard title="Setup Progress" description="Complete each section, then create your workspace."><ol className="adminStepper">
        <li><span>1</span><a href="#admin-profile">Organization Profile</a></li><li><span>2</span><a href="#admin-region">Region &amp; Obligations</a></li><li><span>3</span><a href="#admin-baseline">Starter Baseline</a></li>
      </ol></AdminCard>
      <form id="workspace-setup-form" className="adminStack" onSubmit={handleSubmit}>
        <div id="admin-profile"><AdminCard title="Organization Profile" description="Define the identity and business context of your organization."><div className="adminFormGrid">
          <label>Organization Name<input required maxLength={200} autoComplete="organization" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Enter organization name" /></label>
          <label>Industry<select value={industry} onChange={event => setIndustry(event.target.value)}>{INDUSTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div></AdminCard></div>
        <div className="adminGridTwo">
          <div id="admin-region"><AdminCard title="Operating Context" description="Set the primary operating region for the workspace."><label>Primary Region<select value={region} onChange={event => setRegion(event.target.value)}>{REGION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="adminHelp">This establishes the initial regional context. Review applicable obligations and frameworks after setup; selecting a region does not certify compliance.</p></AdminCard></div>
          <div id="admin-baseline"><AdminCard title="Launch Baseline" description="Choose the starter content returned by the provisioning service."><div className="adminStack" role="radiogroup" aria-label="Launch Baseline">
            {seedProfiles.map(profile => <label className="adminBaseline" key={profile.id}><input type="radio" name="seedProfile" value={profile.id} checked={seedProfile === profile.id} onChange={() => setSeedProfile(profile.id as WorkspaceSeedProfile)} /><div>{profile.name}<p className="adminHelp">{profile.description}</p></div></label>)}
            {profileError && <AdminNotice error>{profileError}<Button type="button" disabled={profilesLoading} onClick={() => { setProfilesLoading(true); setProfileAttempt(value => value + 1); }}>Retry baselines</Button></AdminNotice>}
            {!profileError && !seedProfiles.length && <p role="status">{profilesLoading ? 'Loading starter baselines...' : 'No starter baselines are available. Contact your administrator before creating a workspace.'}</p>}
          </div></AdminCard></div>
        </div>
      </form>
    </>}
  </div>;
}
