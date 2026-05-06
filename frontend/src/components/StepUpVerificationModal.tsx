import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { serializeAuthenticationCredential, toPublicKeyRequestOptions } from '../lib/webauthn';
import { theme } from '../theme';
import type { SecuritySettingsResponse } from '../types/auth';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';

type VerificationMethod = 'authenticator' | 'email' | 'password' | 'passkey';

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');

export function StepUpVerificationModal({
  isOpen,
  onClose,
  onVerified,
  title = 'Verify Sensitive Action',
  description = 'Confirm your identity before continuing.',
  purpose = 'change_permissions',
}: {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (stepUpToken?: string) => Promise<void> | void;
  title?: string;
  description?: string;
  purpose?: 'assign_admin_role' | 'change_permissions' | 'approve_access_request' | 'revoke_access' | 'disable_mfa' | 'export_access_review';
}) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SecuritySettingsResponse | null>(null);
  const [method, setMethod] = useState<VerificationMethod>('password');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !token) return;

    const loadSettings = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/security/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error?.message || 'Unable to load security settings');
        }
        const nextSettings = result.data as SecuritySettingsResponse;
        setSettings(nextSettings);
        setMethod(
          nextSettings.authenticationMethods.passkeys.length
            ? 'passkey'
            : nextSettings.authenticationMethods.totpEnabled
              ? 'authenticator'
              : 'password',
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load verification methods');
      }
    };

    setValue('');
    setStatus(null);
    setError(null);
    void loadSettings();
  }, [isOpen, token]);

  if (!isOpen || !token) return null;

  const sendEmailCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/step-up/send-email-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to send email verification code');
      }
      setMethod('email');
      setStatus(`Email code sent to ${result.data.destination}.`);
      setValue('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send email verification code');
    } finally {
      setBusy(false);
    }
  };

  const verifyStepUp = async () => {
    setBusy(true);
    setError(null);
    try {
      if (method === 'passkey') {
        const optionsResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/step-up/options`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const optionsResult = await optionsResponse.json();
        if (!optionsResponse.ok || optionsResult.error) {
          throw new Error(optionsResult.error?.message || 'Unable to start passkey verification');
        }
        const credential = await navigator.credentials.get({
          publicKey: toPublicKeyRequestOptions(optionsResult.data.options),
        });
        if (!credential) {
          throw new Error('Passkey verification was cancelled');
        }
        const verifyResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/step-up/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            challengeToken: optionsResult.data.challengeToken,
            credential: serializeAuthenticationCredential(credential as PublicKeyCredential),
            purpose,
          }),
        });
        const verifyResult = await verifyResponse.json();
        if (!verifyResponse.ok || verifyResult.error) {
          throw new Error(verifyResult.error?.message || 'Passkey verification failed');
        }
        await onVerified(verifyResult.data?.stepUpToken);
        onClose();
        return;
      } else {
        const response = await fetch(`${API_BASE}/api/v1/auth/step-up/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(method === 'password' ? { method, password: value, purpose } : { method, code: value, purpose }),
        });
        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error?.message || 'Verification failed');
        }
        await onVerified(result.data?.stepUpToken);
        onClose();
        return;
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 540, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6] }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', marginBottom: theme.spacing[4] }}>
          <div>
            <h2 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>{title}</h2>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{description}</div>
          </div>
          <Badge variant="warning" size="sm">Step-up required</Badge>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          {settings?.authenticationMethods.passkeys.length ? <Button variant={method === 'passkey' ? 'primary' : 'outline'} onClick={() => setMethod('passkey')}>Passkey</Button> : null}
          {settings?.authenticationMethods.totpEnabled ? <Button variant={method === 'authenticator' ? 'primary' : 'outline'} onClick={() => setMethod('authenticator')}>OTP</Button> : null}
          {settings?.authenticationMethods.totpEnabled ? <Button variant={method === 'email' ? 'primary' : 'outline'} onClick={() => void sendEmailCode()}>Email Code</Button> : null}
          <Button variant={method === 'password' ? 'primary' : 'outline'} onClick={() => setMethod('password')}>Password</Button>
        </div>

        {method !== 'passkey' ? (
          <input
            type={method === 'password' ? 'password' : 'text'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={method === 'password' ? 'Confirm your password' : method === 'email' ? 'Enter emailed code' : 'Enter authenticator code'}
            style={{ width: '100%', boxSizing: 'border-box', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, letterSpacing: method === 'password' ? 'normal' : '0.2em' }}
          />
        ) : (
          <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
            Use Face ID, Touch ID, Windows Hello, or your platform passkey prompt to continue.
          </Card>
        )}

        {status ? <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.primary }}>{status}</div> : null}
        {error ? <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.semantic.danger }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3], marginTop: theme.spacing[5] }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void verifyStepUp()} disabled={busy || (method !== 'passkey' && !value.trim())}>
            {busy ? 'Verifying...' : 'Verify and Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
