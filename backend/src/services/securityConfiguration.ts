const developmentDefaults: Record<string, string> = {
  JWT_SECRET: 'dev-secret-change-me-in-production',
  MFA_ENCRYPTION_KEY: 'dev-mfa-encryption-key-change-me',
};

export function resolveSecuritySecret(name: 'JWT_SECRET' | 'MFA_ENCRYPTION_KEY', environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment[name]?.trim();
  if (configured) {
    if (environment.NODE_ENV === 'production' && configured.length < 32) throw new Error(`${name} must contain at least 32 characters in production`);
    return configured;
  }
  if (environment.NODE_ENV === 'production') throw new Error(`${name} is required in production`);
  return developmentDefaults[name];
}
