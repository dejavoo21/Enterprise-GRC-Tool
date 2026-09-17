import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AccessIcon, AppIcon, AuditIcon, CheckCircleIcon, FrameworkIcon, RiskIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const capabilities = [
  { label: 'Risk Management', detail: 'Identify, assess and treat enterprise risks.', Icon: RiskIcon, tone: 'blue' },
  { label: 'Compliance Frameworks', detail: 'Meet regulatory and industry requirements.', Icon: FrameworkIcon, tone: 'violet' },
  { label: 'Audit Readiness', detail: 'Be prepared, always.', Icon: AuditIcon, tone: 'teal' },
  { label: 'AI Governance', detail: 'Responsible AI. Greater trust.', Icon: AppIcon, tone: 'purple' },
];
const frameworks = ['ISO 27001', 'SOC 2', 'PCI DSS', 'GDPR', 'NIS2', 'EU AI Act', '+7 more'];
const trustSignals = ['Secure access', 'Role-based control', 'Audit-ready'];

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
      <div className="loginBackdrop" aria-hidden="true" />
      <header className="loginHeader">
        <img src="/laflo-logo.png" alt="LAFLO" />
        <span aria-hidden="true" />
        <strong>Enterprise GRC Tool</strong>
      </header>

      <section className="loginMain" aria-labelledby="login-product-title">
        <aside className="loginMessage">
          <p className="loginEyebrow">A more resilient tomorrow</p>
          <h1 id="login-product-title">Govern with confidence.<br />Turn risk into progress.</h1>
          <p>A unified platform for governance, risk, compliance, assurance, and AI oversight.</p>
          <i aria-hidden="true" />
          <div aria-label="Platform operating model"><span>People</span><span>Process</span><span>Trust</span><span>Progress</span></div>
          <small>Secure today.<br />A more resilient tomorrow.</small>
        </aside>

        <section className="loginCard" aria-label="Account sign in">
          <header className="loginCardHeader">
            <span>Enterprise GRC Tool</span>
            <h2>{isMfaStep ? 'Verify your identity' : 'Sign in to your secure workspace'}</h2>
            <p>{isMfaStep ? 'Complete secure verification to continue.' : 'Access your governance, risk, compliance, assurance, and AI oversight platform.'}</p>
          </header>

          {error ? <div className="loginAlert loginAlertError" role="alert" aria-live="assertive">{error}</div> : null}

          {!isMfaStep ? (
            <form className="loginForm" onSubmit={handlePrimarySubmit}>
              <div className="loginField">
                <label htmlFor="email">Email address</label>
                <div className="loginInputShell"><span className="loginInputIcon"><MailIcon /></span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus placeholder="onboarding@lafloadvisory.com" aria-describedby="login-support" /></div>
              </div>
              <div className="loginField">
                <div className="loginFieldLabel"><label htmlFor="password">Password</label><a href="#login-support">Forgot password?</a></div>
                <div className="loginPasswordField"><span className="loginInputIcon"><LockIcon /></span><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Enter your password" /><button type="button" className="loginPasswordToggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div>
              </div>
              <button className="loginPrimaryButton" type="submit" disabled={isLoading || isPasskeyLoading}>{isLoading ? <span className="loginSpinner" aria-hidden="true" /> : null}<span>{isLoading ? 'Signing in...' : 'Sign in'}</span>{!isLoading ? <span className="loginButtonArrow" aria-hidden="true">→</span> : null}</button>
              <div className="loginDivider"><span>or use secure sign-in</span></div>
              <button className="loginSecondaryButton" type="button" disabled={isPasskeyLoading || isLoading || !email} onClick={handlePasskeyLogin}><AccessIcon size={18} /><span>{isPasskeyLoading ? 'Checking passkey...' : 'Sign in with passkey'}</span></button>
            </form>
          ) : (
            <form className="loginForm" onSubmit={handleMfaSubmit}>
              <div className="loginIdentityContext"><span>Signing in as</span><strong>{pendingMfaChallenge?.user.email}</strong></div>
              <div className="loginField"><label htmlFor="mfa-code">{mfaMethod === 'recovery_code' ? 'Recovery code' : mfaMethod === 'email' ? 'Email verification code' : 'Authenticator code'}</label><input id="mfa-code" type="text" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required autoFocus autoComplete="one-time-code" className={mfaMethod === 'recovery_code' ? 'loginCodeRecovery' : 'loginCodeOtp'} placeholder={mfaMethod === 'recovery_code' ? 'AB12-CD34' : '123456'} /></div>
              {emailCodeStatus ? <div className="loginAlert loginAlertInfo" role="status" aria-live="polite">{emailCodeStatus}</div> : null}
              <div className="loginMethodPicker" aria-label="Verification method"><button type="button" className={mfaMethod === 'authenticator' ? 'active' : ''} onClick={() => selectMfaMethod('authenticator')}>Authenticator</button><button type="button" className={mfaMethod === 'email' ? 'active' : ''} onClick={handleSendEmailCode}>Email code</button><button type="button" className={mfaMethod === 'recovery_code' ? 'active' : ''} onClick={() => selectMfaMethod('recovery_code')}>Recovery code</button></div>
              <button className="loginPrimaryButton" type="submit" disabled={isLoading}>{isLoading ? <span className="loginSpinner" aria-hidden="true" /> : null}<span>{isLoading ? 'Verifying...' : 'Verify and continue'}</span></button>
              <button className="loginSecondaryButton" type="button" onClick={handleBackToPassword} disabled={isLoading}>Back to password sign-in</button>
            </form>
          )}

          <p className="loginSupport" id="login-support">Need access or a password reset? <strong>Contact your administrator.</strong></p>
          <div className="loginTrust" aria-label="Security features">{trustSignals.map((item) => <span key={item}><CheckCircleIcon size={16} />{item}</span>)}</div>
        </section>

        <aside className="loginCapabilityList" aria-label="Platform capabilities">
          {capabilities.map(({ label, detail, Icon, tone }) => <article key={label}><span className={`loginCapabilityIcon ${tone}`}><Icon size={24} /></span><div><strong>{label}</strong><p>{detail}</p></div><b aria-hidden="true">›</b></article>)}
          <small>Global perspective.<br />Stronger organisations.</small>
        </aside>
      </section>

      <footer className="loginFooter">
        <div className="loginFrameworks"><span>Framework coverage</span><div>{frameworks.map((framework) => <b key={framework}>{framework}</b>)}</div></div>
        <div className="loginEnterpriseTrust"><span>Trusted by modern enterprises</span><p>Secure&nbsp;&nbsp; • &nbsp;&nbsp;Compliant&nbsp;&nbsp; • &nbsp;&nbsp;Resilient&nbsp;&nbsp; • &nbsp;&nbsp;Future-ready</p></div>
      </footer>
    </main>
  );
}
