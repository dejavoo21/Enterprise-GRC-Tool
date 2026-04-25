/**
 * Login Page
 *
 * Simple login form for email/password authentication.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

function formatLoginError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Unable to connect to the platform right now. Please try again in a moment.';
  }

  if (/401|invalid|unauthorized/i.test(message)) {
    return 'Your email or password is incorrect. Check your details and try again.';
  }

  return message || 'Sign-in failed. Please try again.';
}

export default function Login() {
  const logoSrc = '/laflo-logo.png';
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the redirect path from location state, or default to /executive-overview
  const from = (location.state as { from?: string })?.from || '/executive-overview';

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(formatLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme.colors.gradients.hero,
      fontFamily: theme.typography.fontFamily,
      padding: theme.spacing[6],
    }}>
      <div style={{
        background: 'white',
        borderRadius: theme.borderRadius['2xl'],
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${theme.colors.borderLight}`,
      }}>
        {/* Logo/Header */}
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
            color: theme.colors.text.main,
            margin: '0 0 8px',
          }}>
            Enterprise GRC Tool
          </h1>
          <p style={{
            fontSize: '14px',
            color: theme.colors.text.secondary,
            margin: 0,
          }}>
            Sign in to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#FFF4F4',
            border: `1px solid ${theme.colors.semantic.dangerLight}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#B42318',
            fontSize: '14px',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: theme.colors.text.main,
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
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.colors.primary;
                e.target.style.boxShadow = '0 0 0 4px rgba(23, 144, 221, 0.14)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.colors.border;
                e.target.style.boxShadow = 'none';
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
                color: theme.colors.text.main,
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
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.colors.primary;
                e.target.style.boxShadow = '0 0 0 4px rgba(23, 144, 221, 0.14)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.colors.border;
                e.target.style.boxShadow = 'none';
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
                : theme.colors.gradients.accent,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s, box-shadow 0.2s',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(23, 144, 221, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid ${theme.colors.borderLight}`,
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '12px',
            color: theme.colors.text.muted,
            margin: 0,
          }}>
            Contact your administrator if you need access
          </p>
        </div>
      </div>
    </div>
  );
}
