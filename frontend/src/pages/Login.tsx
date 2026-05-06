/**
 * Login Page
 *
 * Supports password login plus TOTP / recovery-code MFA verification.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const logoSrc = '/laflo-logo.png';
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    loginWithPasskey,
    verifyMfaLogin,
    sendEmailOtpLoginCode,
    cancelMfaLogin,
    pendingMfaChallenge,
    isAuthenticated,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'email' | 'recovery_code'>('authenticator');
  const [emailCodeStatus, setEmailCodeStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const from = (location.state as { from?: string })?.from || '/executive-overview';

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const isMfaStep = Boolean(pendingMfaChallenge);

  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.requiresMfa) {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await verifyMfaLogin(verificationCode, mfaMethod);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPassword = () => {
    setVerificationCode('');
    setMfaMethod('authenticator');
    setEmailCodeStatus(null);
    setError(null);
    cancelMfaLogin();
  };

  const handleSendEmailCode = async () => {
    setError(null);
    setEmailCodeStatus(null);
    setIsLoading(true);

    try {
      const result = await sendEmailOtpLoginCode();
      setMfaMethod('email');
      setEmailCodeStatus(`Code sent to ${result.destination}. Expires at ${new Date(result.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
      setVerificationCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send email code');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setIsPasskeyLoading(true);
    try {
      await loginWithPasskey(email);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '220px',
            height: '72px',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={logoSrc}
              alt="Laflo logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px',
          }}>
            Enterprise GRC Tool
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0,
          }}>
            {isMfaStep ? 'Verify your sign-in' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#dc2626',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {!isMfaStep ? (
          <form onSubmit={handlePrimarySubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                placeholder="you@company.com"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: isLoading
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              disabled={isPasskeyLoading || !email}
              onClick={handlePasskeyLogin}
              style={{
                width: '100%',
                padding: '13px',
                marginTop: '12px',
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isPasskeyLoading || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {isPasskeyLoading ? 'Checking passkey...' : 'Sign in with passkey'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Signing in as</div>
              <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                {pendingMfaChallenge?.user.email}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="mfa-code"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                {mfaMethod === 'recovery_code' ? 'Recovery code' : mfaMethod === 'email' ? 'Email verification code' : 'Authenticator code'}
              </label>
              <input
                id="mfa-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: mfaMethod === 'recovery_code' ? '0.04em' : '0.2em',
                }}
                placeholder={mfaMethod === 'recovery_code' ? 'AB12-CD34' : '123456'}
              />
            </div>

            {emailCodeStatus ? (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                marginBottom: '14px',
              }}>
                {emailCodeStatus}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => {
                  setMfaMethod('authenticator');
                  setVerificationCode('');
                  setEmailCodeStatus(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mfaMethod === 'authenticator' ? '#1d4ed8' : '#2563eb',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0,
                  fontWeight: mfaMethod === 'authenticator' ? 700 : 500,
                }}
              >
                Use authenticator
              </button>
              <button
                type="button"
                onClick={handleSendEmailCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mfaMethod === 'email' ? '#1d4ed8' : '#2563eb',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0,
                  fontWeight: mfaMethod === 'email' ? 700 : 500,
                }}
              >
                Email me a code
              </button>
              <button
                type="button"
                onClick={() => {
                  setMfaMethod('recovery_code');
                  setVerificationCode('');
                  setEmailCodeStatus(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mfaMethod === 'recovery_code' ? '#1d4ed8' : '#2563eb',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0,
                  fontWeight: mfaMethod === 'recovery_code' ? 700 : 500,
                }}
              >
                Use a recovery code
              </button>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: isLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Verifying...' : 'Verify and continue'}
              </button>

              <button
                type="button"
                onClick={handleBackToPassword}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Back to password sign-in
              </button>
            </div>
          </form>
        )}

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            margin: 0,
          }}>
            Contact your administrator if you need access
          </p>
        </div>
      </div>
    </div>
  );
}
