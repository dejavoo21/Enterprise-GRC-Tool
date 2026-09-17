import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AccessIcon, AppIcon, AuditIcon, CheckCircleIcon, EvidenceIcon, FrameworkIcon, RiskIcon, VendorIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const capabilities = [
  { label: 'Risk Management', Icon: RiskIcon },
  { label: 'Compliance Frameworks', Icon: FrameworkIcon },
  { label: 'Audit Readiness', Icon: AuditIcon },
  { label: 'Evidence Assurance', Icon: EvidenceIcon },
  { label: 'AI Governance', Icon: AppIcon },
  { label: 'Vendor Risk', Icon: VendorIcon },
];
const frameworks = ['ISO 27001', 'SOC 2', 'PCI DSS', 'GDPR', 'DORA', 'NIS2', 'EU AI Act'];
const trustSignals = ['Secure workspace access', 'Role-based access control', 'Audit-ready logging', 'Passkey supported'];

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithPasskey, verifyMfaLogin, sendEmailOtpLoginCode, cancelMfaLogin, pendingMfaChallenge, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  const handlePrimarySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (!result.requiresMfa) navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await verifyMfaLogin(verificationCode, mfaMethod);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification failed');
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send email code');
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Passkey sign-in failed');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const selectMfaMethod = (method: typeof mfaMethod) => {
    setMfaMethod(method);
    setVerificationCode('');
    setEmailCodeStatus(null);
  };

  return (
    <main className="loginPage">
      <section className="loginStory" aria-labelledby="login-product-title">
        <div className="loginStoryGlow" aria-hidden="true" />
        <div className="loginStoryGrid" aria-hidden="true" />
        <div className="loginOrbit loginOrbitOne" aria-hidden="true"><span /></div>
        <div className="loginOrbit loginOrbitTwo" aria-hidden="true" />
        <div className="loginStoryContent">
          <div className="loginBrandLockup">
            <div className="loginBrandMark"><img src="/laflo-logo.png" alt="LAFLO" /></div>
            <span aria-hidden="true" />
            <p>Govern with confidence</p>
          </div>
          <div className="loginStoryCopy">
            <p className="loginEyebrow">Enterprise governance, unified</p>
            <h1 id="login-product-title">Turn governance into operational clarity.</h1>
            <p className="loginLead">Enterprise governance operating system for risk, compliance, assurance, and board oversight.</p>
            <div className="loginCapabilities" aria-label="Platform capabilities">
              {capabilities.map(({ label, Icon }) => <span key={label}><Icon size={16} />{label}</span>)}
            </div>
          </div>
          <div className="loginStoryFooter">
            <div className="loginFrameworks">
              <span>Framework coverage</span>
              <p>{frameworks.join('  /  ')}</p>
            </div>
            <p className="loginOperatingPrinciple"><i aria-hidden="true" />People&nbsp; + &nbsp;Process&nbsp; + &nbsp;Trust&nbsp; = &nbsp;Progress</p>
          </div>
        </div>
      </section>

      <section className="loginAccess" aria-label="Account sign in">
        <div className="loginCard">
          <header className="loginCardHeader">
            <div className="loginCardLogo"><img src="/laflo-logo.png" alt="LAFLO" /></div>
            <h2>Enterprise GRC Tool</h2>
            <p>{isMfaStep ? 'Verify your identity to continue securely.' : 'Sign in to your secure workspace.'}</p>
          </header>

          {error ? <div className="loginAlert loginAlertError" role="alert" aria-live="assertive">{error}</div> : null}

          {!isMfaStep ? (
            <form className="loginForm" onSubmit={handlePrimarySubmit}>
              <div className="loginField">
                <label htmlFor="email">Email address</label>
                <div className="loginInputShell">
                  <span className="loginInputIcon"><MailIcon /></span>
                  <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus placeholder="you@company.com" aria-describedby="login-support" />
                </div>
              </div>
              <div className="loginField">
                <label htmlFor="password">Password</label>
                <div className="loginPasswordField">
                  <span className="loginInputIcon"><LockIcon /></span>
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Enter your password" />
                  <button type="button" className="loginPasswordToggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <button className="loginPrimaryButton" type="submit" disabled={isLoading || isPasskeyLoading}>
                {isLoading ? <span className="loginSpinner" aria-hidden="true" /> : null}<span>{isLoading ? 'Signing in...' : 'Sign in'}</span>{!isLoading ? <span className="loginButtonArrow" aria-hidden="true">→</span> : null}
              </button>
              <div className="loginDivider"><span>or use secure sign-in</span></div>
              <button className="loginSecondaryButton" type="button" disabled={isPasskeyLoading || isLoading || !email} onClick={handlePasskeyLogin}>
                <AccessIcon size={18} /><span>{isPasskeyLoading ? 'Checking passkey...' : 'Sign in with passkey'}</span>
              </button>
            </form>
          ) : (
            <form className="loginForm" onSubmit={handleMfaSubmit}>
              <div className="loginIdentityContext"><span>Signing in as</span><strong>{pendingMfaChallenge?.user.email}</strong></div>
              <div className="loginField">
                <label htmlFor="mfa-code">{mfaMethod === 'recovery_code' ? 'Recovery code' : mfaMethod === 'email' ? 'Email verification code' : 'Authenticator code'}</label>
                <input id="mfa-code" type="text" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required autoFocus autoComplete="one-time-code" className={mfaMethod === 'recovery_code' ? 'loginCodeRecovery' : 'loginCodeOtp'} placeholder={mfaMethod === 'recovery_code' ? 'AB12-CD34' : '123456'} />
              </div>
              {emailCodeStatus ? <div className="loginAlert loginAlertInfo" role="status" aria-live="polite">{emailCodeStatus}</div> : null}
              <div className="loginMethodPicker" aria-label="Verification method">
                <button type="button" className={mfaMethod === 'authenticator' ? 'active' : ''} onClick={() => selectMfaMethod('authenticator')}>Authenticator</button>
                <button type="button" className={mfaMethod === 'email' ? 'active' : ''} onClick={handleSendEmailCode}>Email code</button>
                <button type="button" className={mfaMethod === 'recovery_code' ? 'active' : ''} onClick={() => selectMfaMethod('recovery_code')}>Recovery code</button>
              </div>
              <button className="loginPrimaryButton" type="submit" disabled={isLoading}>{isLoading ? <span className="loginSpinner" aria-hidden="true" /> : null}<span>{isLoading ? 'Verifying...' : 'Verify and continue'}</span></button>
              <button className="loginSecondaryButton" type="button" onClick={handleBackToPassword} disabled={isLoading}>Back to password sign-in</button>
            </form>
          )}

          <p className="loginSupport" id="login-support">Need access or a password reset? <strong>Contact your administrator.</strong></p>
          <div className="loginTrust" aria-label="Security features">
            {trustSignals.map((item) => <span key={item}><CheckCircleIcon size={14} />{item}</span>)}
          </div>
        </div>
        <p className="loginLegal">Protected enterprise access · LAFLO</p>
      </section>
    </main>
  );
}
