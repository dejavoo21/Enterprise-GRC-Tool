import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { serializeAuthenticationCredential, toPublicKeyRequestOptions } from '../lib/webauthn';
import { theme } from '../theme';
import type { SecuritySettingsResponse } from '../types/auth';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Modal } from './Modal';

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
  const requestLock = useRef(false);
  const requestClose = () => { if (!busy) onClose(); };

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
    if (requestLock.current) return;
    requestLock.current = true;
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
      requestLock.current = false;
      setBusy(false);
    }
  };

  const verifyStepUp = async () => {
    if (requestLock.current) return;
    requestLock.current = true;
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
      requestLock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      accessibleDialog
      isOpen
      onClose={requestClose}
      title={title}
      width="540px"
      footer={<><Button variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void verifyStepUp()} disabled={busy || (method !== 'passkey' && !value.trim())}>{busy ? 'Verifying...' : 'Verify and Continue'}</Button></>}
    >
      <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[4] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{description}</div>
          <Badge variant="warning" size="sm">Step-up required</Badge>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          {settings?.authenticationMethods.passkeys.length ? <Button aria-pressed={method === 'passkey'} variant={method === 'passkey' ? 'primary' : 'outline'} onClick={() => setMethod('passkey')} disabled={busy}>Passkey</Button> : null}
          {settings?.authenticationMethods.totpEnabled ? <Button aria-pressed={method === 'authenticator'} variant={method === 'authenticator' ? 'primary' : 'outline'} onClick={() => setMethod('authenticator')} disabled={busy}>OTP</Button> : null}
          {settings?.authenticationMethods.totpEnabled ? <Button aria-pressed={method === 'email'} variant={method === 'email' ? 'primary' : 'outline'} onClick={() => void sendEmailCode()} disabled={busy}>Email Code</Button> : null}
          <Button aria-pressed={method === 'password'} variant={method === 'password' ? 'primary' : 'outline'} onClick={() => setMethod('password')} disabled={busy}>Password</Button>
        </div>

        {method !== 'passkey' ? (
          <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
            {method === 'password' ? 'Confirm password' : method === 'email' ? 'Email verification code' : 'Authenticator code'}
            <input
              type={method === 'password' ? 'password' : 'text'}
              autoComplete={method === 'password' ? 'current-password' : 'one-time-code'}
              inputMode={method === 'password' ? undefined : 'numeric'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, letterSpacing: method === 'password' ? 'normal' : '0.2em' }}
            />
          </label>
        ) : (
          <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
            Use Face ID, Touch ID, Windows Hello, or your platform passkey prompt to continue.
          </Card>
        )}

        {status ? <div role="status" aria-live="polite" style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.primary }}>{status}</div> : null}
        {error ? <div role="alert" style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.semantic.danger }}>{error}</div> : null}
      </fieldset>
    </Modal>
  );
}
