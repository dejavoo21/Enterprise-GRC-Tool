import { ActivityLedger } from './ActivityLedger';

export function AdminLoginActivity() {
  return <ActivityLedger initialCategory="auth" title="Authentication Activity" description="Recorded sign-in, MFA, passkey, session and authentication security events for the active workspace." />;
}
