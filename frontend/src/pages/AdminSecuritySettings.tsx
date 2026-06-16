import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { serializeRegistrationCredential, toPublicKeyCreationOptions, type PublicKeyCreationOptionsInput } from '../lib/webauthn';
import { theme } from '../theme';
import type { MfaEnableResponse, MfaSetupResponse, SecuritySettingsResponse } from '../types/auth';

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');

const pageStyle = {
  maxWidth: '1400px',
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

export function AdminSecuritySettings() {
  const { token, refreshAuth, logout } = useAuth();
  const [settings, setSettings] = useState<SecuritySettingsResponse | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MfaSetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupCode, setSetupCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passkeyName, setPasskeyName] = useState('Primary device');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/v1/auth/security/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to load security settings');
      }
      setSettings(result.data as SecuritySettingsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load security settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const metrics = useMemo(() => {
    if (!settings) return [];
    return [
      {
        label: 'MFA Status',
        value: settings.mfa.enabled ? 'Enabled' : 'Disabled',
        detail: settings.mfa.enabled ? 'Authenticator app configured' : 'No authenticator enrolled',
        tone: settings.mfa.enabled ? 'success' as const : 'warning' as const,
      },
      {
        label: 'Passkeys',
        value: settings.authenticationMethods.passkeys.length,
        detail: 'Biometric or device credentials',
        tone: settings.authenticationMethods.passkeys.length > 0 ? 'primary' as const : 'default' as const,
      },
      {
        label: 'Recovery Codes',
        value: settings.authenticationMethods.recoveryCodesRemaining,
        detail: 'One-time backup codes remaining',
        tone: settings.authenticationMethods.recoveryCodesRemaining > 0 ? 'success' as const : 'danger' as const,
      },
      {
        label: 'Active Sessions',
        value: settings.sessions.length,
        detail: 'Current signed-in devices',
        tone: 'default' as const,
      },
    ];
  }, [settings]);

  const updateMfaPolicy = async (field: 'requireMfaForLogin' | 'requireMfaForSensitiveActions', value: boolean) => {
    if (!token) return;
    setBusyKey(field);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/security/mfa-policy`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          requireMfaForLogin: field === 'requireMfaForLogin' ? value : settings?.mfa.requireMfaForLogin,
          requireMfaForSensitiveActions: field === 'requireMfaForSensitiveActions' ? value : settings?.mfa.requireMfaForSensitiveActions,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to update MFA policy');
      }
      setMessage('Security policy updated.');
      await loadSettings();
      await refreshAuth();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update MFA policy');
    } finally {
      setBusyKey(null);
    }
  };

  const startTotpSetup = async () => {
    if (!token) return;
    setBusyKey('totp-setup');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/mfa/setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to start MFA setup');
      }
      setMfaSetup(result.data as MfaSetupResponse);
      setRecoveryCodes([]);
      setSetupCode('');
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Unable to start MFA setup');
    } finally {
      setBusyKey(null);
    }
  };

  const completeTotpSetup = async () => {
    if (!token || !setupCode.trim()) return;
    setBusyKey('totp-enable');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/mfa/enable`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ code: setupCode }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to enable authenticator app');
      }
      const data = result.data as MfaEnableResponse;
      setRecoveryCodes(data.recoveryCodes);
      setMfaSetup(null);
      setSetupCode('');
      setMessage('Authenticator app enabled.');
      await loadSettings();
      await refreshAuth();
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'Unable to enable authenticator app');
    } finally {
      setBusyKey(null);
    }
  };

  const regenerateRecoveryCodes = async () => {
    if (!token) return;
    setBusyKey('recovery');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/security/recovery-codes/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to regenerate recovery codes');
      }
      setRecoveryCodes(result.data.recoveryCodes as string[]);
      setMessage('Recovery codes regenerated.');
      await loadSettings();
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Unable to regenerate recovery codes');
    } finally {
      setBusyKey(null);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusyKey('password');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to change password');
      }
      setMessage('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Unable to change password');
    } finally {
      setBusyKey(null);
    }
  };

  const addPasskey = async () => {
    if (!token) return;
    setBusyKey('passkey');
    setError(null);
    try {
      const optionsResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/register/options`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const optionsResult = await optionsResponse.json();
      if (!optionsResponse.ok || optionsResult.error) {
        throw new Error(optionsResult.error?.message || 'Unable to start passkey registration');
      }

      const { options, challengeToken } = optionsResult.data as { options: PublicKeyCreationOptionsInput; challengeToken: string };
      const credential = await navigator.credentials.create({
        publicKey: toPublicKeyCreationOptions(options),
      });
      if (!credential) {
        throw new Error('Passkey registration was cancelled');
      }

      const verifyResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/register/verify`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          challengeToken,
          name: passkeyName,
          credential: serializeRegistrationCredential(credential as PublicKeyCredential),
        }),
      });
      const verifyResult = await verifyResponse.json();
      if (!verifyResponse.ok || verifyResult.error) {
        throw new Error(verifyResult.error?.message || 'Unable to verify passkey registration');
      }

      setMessage('Passkey added.');
      await loadSettings();
      await refreshAuth();
    } catch (passkeyError) {
      setError(passkeyError instanceof Error ? passkeyError.message : 'Unable to add passkey');
    } finally {
      setBusyKey(null);
    }
  };

  const deletePasskey = async (passkeyId: string) => {
    if (!token) return;
    setBusyKey(`passkey-${passkeyId}`);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/passkeys/${passkeyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to remove passkey');
      }
      setMessage('Passkey removed.');
      await loadSettings();
      await refreshAuth();
    } catch (passkeyError) {
      setError(passkeyError instanceof Error ? passkeyError.message : 'Unable to remove passkey');
    } finally {
      setBusyKey(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!token) return;
    setBusyKey('logout-all');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/sessions/logout-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to log out all sessions');
      }
      logout();
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to log out all sessions');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Security Settings" description="Manage authentication methods, MFA policy, passkeys, and active sessions." />
        <PageSectionCard title="Loading Security Settings">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading identity security controls...</div>
        </PageSectionCard>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Security Settings" description="Manage authentication methods, MFA policy, passkeys, and active sessions." />
        <EmptyStatePanel title="Security settings are unavailable" description={error || 'Unable to load the security profile for the current user.'} />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Security Settings"
        description="Manage authentication methods, MFA policy, passkeys, and active sessions."
        action={<Badge variant={settings.mfa.enabled ? 'success' : 'warning'} size="sm">{settings.mfa.enabled ? 'MFA Enabled' : 'MFA Not Enabled'}</Badge>}
      />

      <SummaryMetricStrip metrics={metrics} />

      {message ? <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.successLight, color: theme.colors.text.main }}>{message}</Card> : null}
      {error ? <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.dangerLight, color: theme.colors.semantic.danger }}>{error}</Card> : null}

      <PageSectionCard title="Authentication Methods" subtitle="Password, authenticator app, passkeys, and recovery controls.">
        <div style={{ display: 'grid', gap: theme.spacing[5] }}>
          <form onSubmit={changePassword} style={{ display: 'grid', gap: theme.spacing[3] }}>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Change Password</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" style={inputStyle} />
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" style={inputStyle} />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" style={inputStyle} />
            </div>
            <div>
              <Button type="submit" variant="outline" disabled={busyKey === 'password'}>{busyKey === 'password' ? 'Updating...' : 'Change Password'}</Button>
            </div>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 1fr)', gap: theme.spacing[4] }}>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Authenticator App</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Set up a TOTP app and verify it with a one-time code.</div>
                </div>
                <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                  <Badge variant={settings.authenticationMethods.totpEnabled ? 'success' : 'warning'} size="sm">{settings.authenticationMethods.totpEnabled ? 'Enabled' : 'Not Enabled'}</Badge>
                  <Button variant="primary" onClick={startTotpSetup} disabled={busyKey === 'totp-setup'}>{mfaSetup ? 'Refresh Setup' : 'Enable Authenticator App'}</Button>
                </div>
              </div>

              {mfaSetup ? (
                <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: theme.spacing[4], alignItems: 'start' }}>
                  <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <img src={mfaSetup.qrCodeDataUrl} alt="Authenticator QR code" style={{ width: '100%', display: 'block' }} />
                  </Card>
                  <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                    <Card style={{ padding: theme.spacing[3] }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Manual Setup Key</div>
                      <div style={{ marginTop: theme.spacing[2], fontFamily: 'monospace', wordBreak: 'break-all', color: theme.colors.text.main }}>{mfaSetup.manualEntryKey}</div>
                    </Card>
                    <input value={setupCode} onChange={(event) => setSetupCode(event.target.value)} placeholder="123456" style={{ ...inputStyle, letterSpacing: '0.18em' }} />
                    <div>
                      <Button variant="primary" onClick={completeTotpSetup} disabled={busyKey === 'totp-enable' || setupCode.trim().length < 6}>{busyKey === 'totp-enable' ? 'Enabling...' : 'Verify and Enable MFA'}</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Passkeys</div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Use Face ID, Touch ID, Windows Hello, or a hardware-backed device credential.</div>
                <input value={passkeyName} onChange={(event) => setPasskeyName(event.target.value)} style={{ ...inputStyle, marginTop: theme.spacing[3] }} placeholder="Passkey label" />
                <div style={{ marginTop: theme.spacing[3] }}>
                  <Button variant="primary" onClick={addPasskey} disabled={busyKey === 'passkey'}>{busyKey === 'passkey' ? 'Registering...' : 'Add Passkey'}</Button>
                </div>
              </Card>

              <Card style={{ padding: theme.spacing[4] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Recovery Codes</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{settings.authenticationMethods.recoveryCodesRemaining} codes remaining.</div>
                  </div>
                  <Button variant="outline" onClick={regenerateRecoveryCodes} disabled={!settings.authenticationMethods.totpEnabled || busyKey === 'recovery'}>{busyKey === 'recovery' ? 'Generating...' : 'Generate Backup Recovery Codes'}</Button>
                </div>
                {recoveryCodes.length > 0 ? (
                  <div style={{ marginTop: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                    {recoveryCodes.map((code) => (
                      <div key={code} style={{ padding: theme.spacing[2], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover, fontFamily: 'monospace' }}>{code}</div>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          </div>

          {settings.authenticationMethods.passkeys.length > 0 ? (
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main, marginBottom: theme.spacing[3] }}>Registered Passkeys</div>
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {settings.authenticationMethods.passkeys.map((passkey) => (
                  <div key={passkey.id} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{passkey.name}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                        {passkey.deviceType || 'Passkey'} · Created {new Date(passkey.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void deletePasskey(passkey.id)} disabled={busyKey === `passkey-${passkey.id}`}>Remove</Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </PageSectionCard>

      <PageSectionCard title="Multi-Factor Authentication (MFA)" subtitle="Control when second-factor verification is required.">
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'center', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg }}>
            <div>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Require MFA for login</div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Password logins require a verified authenticator factor before access is granted.</div>
            </div>
            <input type="checkbox" checked={settings.mfa.requireMfaForLogin} onChange={(event) => void updateMfaPolicy('requireMfaForLogin', event.target.checked)} disabled={busyKey === 'requireMfaForLogin'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'center', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg }}>
            <div>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Require MFA for sensitive actions</div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Approvals and privileged actions prompt for an authenticator code, passkey, or password confirmation.</div>
            </div>
            <input type="checkbox" checked={settings.mfa.requireMfaForSensitiveActions} onChange={(event) => void updateMfaPolicy('requireMfaForSensitiveActions', event.target.checked)} disabled={busyKey === 'requireMfaForSensitiveActions'} />
          </div>
        </div>
      </PageSectionCard>

      <PageSectionCard title="Sessions" subtitle="Review active devices and revoke them in one action if needed.">
        {settings.sessions.length > 0 ? (
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {settings.sessions.map((session) => (
              <Card key={session.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                      {session.deviceName || 'Unknown device'} · {session.browserName || 'Unknown browser'}
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {session.ipAddress || 'Unknown IP'} · Last seen {session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                  <Badge variant="default" size="sm">{session.authMethod}</Badge>
                </div>
              </Card>
            ))}
            <div>
              <Button variant="danger" onClick={logoutAllSessions} disabled={busyKey === 'logout-all'}>{busyKey === 'logout-all' ? 'Revoking...' : 'Log out of all sessions'}</Button>
            </div>
          </div>
        ) : (
          <EmptyStatePanel title="No active sessions found" description="The current security profile did not return any live sessions." />
        )}
      </PageSectionCard>
    </div>
  );
}
