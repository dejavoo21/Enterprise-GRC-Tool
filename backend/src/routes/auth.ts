/**
 * Authentication Routes
 *
 * Handles password login, MFA enrollment, passkeys, step-up verification,
 * registration, and user session management.
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  buildTotpKeyUri,
  consumeRecoveryCode,
  decryptSecret,
  encryptSecret,
  generateEmailOtp,
  generateQrCodeDataUrl,
  generateRecoveryCodes,
  getEmailOtpExpiresAt,
  getEmailOtpExpiresMinutes,
  generateTotpSecret,
  getFailedLoginThreshold,
  getLockoutDurationMinutes,
  getMfaIssuer,
  getPasskeyRpName,
  getStepUpWindowMinutes,
  hashPassword,
  hashRecoveryCodes,
  hashOneTimeCode,
  signAuthToken,
  signMfaChallengeToken,
  signPasskeyChallengeToken,
  signStepUpVerificationToken,
  verifyAuthToken,
  verifyMfaChallengeToken,
  verifyOneTimeCode,
  verifyPasskeyChallengeToken,
  verifyPassword,
  verifyTotpToken,
} from '../services/authService.js';
import * as authRepo from '../repositories/authRepo.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { WorkspaceRole } from '../types/models.js';
import { sendMfaOtpEmail } from '../services/emailService.js';
import { StepUpPurpose } from '../types/accessGovernance.js';
import * as governanceRepo from '../repositories/accessGovernanceRepo.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';

const router = Router();

interface LoginRequest {
  email: string;
  password: string;
  workspaceId?: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
  workspaceId: string;
  role: WorkspaceRole;
}

function buildAvailableWorkspaces(memberships: Awaited<ReturnType<typeof authRepo.getUserMemberships>>) {
  return memberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    role: membership.role,
  }));
}

async function getPasskeyCount(userId: string): Promise<number> {
  const passkeys = await authRepo.listUserPasskeys(userId);
  return passkeys.length;
}

async function buildAuthSuccessResponse(
  user: Awaited<ReturnType<typeof authRepo.findUserByEmail>>,
  memberships: Awaited<ReturnType<typeof authRepo.getUserMemberships>>,
  workspaceId: string,
  role: WorkspaceRole,
) {
  if (!user) {
    throw new Error('User not found');
  }

  const passkeysCount = await getPasskeyCount(user.id);
  const availableMfaMethods: ('authenticator' | 'email' | 'recovery_code')[] = [];
  if (user.mfaEnabled) {
    availableMfaMethods.push('authenticator', 'email', 'recovery_code');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      mfaEnabled: user.mfaEnabled ?? false,
      emailVerified: user.emailVerified ?? true,
      mfaLoginRequired: user.mfaLoginRequired ?? false,
      sensitiveActionMfaRequired: user.sensitiveActionMfaRequired ?? false,
      passkeysCount,
      availableMfaMethods,
    },
    workspaceId,
    role,
    availableWorkspaces: buildAvailableWorkspaces(memberships),
  };
}

function getSelectedMembership(
  memberships: Awaited<ReturnType<typeof authRepo.getUserMemberships>>,
  requestedWorkspaceId?: string,
) {
  let selectedMembership = memberships[0];

  if (requestedWorkspaceId) {
    const requested = memberships.find((membership) => membership.workspaceId === requestedWorkspaceId);
    if (!requested) {
      return null;
    }
    selectedMembership = requested;
  }

  return selectedMembership;
}

function getClientMetadata(req: Request) {
  const userAgent = req.headers['user-agent'] || null;
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  const ipAddress = rawIp?.trim() || req.ip || null;

  const browserName =
    userAgent?.includes('Edg') ? 'Microsoft Edge' :
    userAgent?.includes('Chrome') ? 'Google Chrome' :
    userAgent?.includes('Safari') && !userAgent?.includes('Chrome') ? 'Safari' :
    userAgent?.includes('Firefox') ? 'Firefox' :
    userAgent?.includes('MSIE') || userAgent?.includes('Trident') ? 'Internet Explorer' :
    'Unknown Browser';

  const deviceName =
    userAgent?.includes('Windows') ? 'Windows device' :
    userAgent?.includes('Macintosh') ? 'macOS device' :
    userAgent?.includes('iPhone') ? 'iPhone' :
    userAgent?.includes('iPad') ? 'iPad' :
    userAgent?.includes('Android') ? 'Android device' :
    'Unknown device';

  return {
    userAgent,
    ipAddress,
    browserName,
    deviceName,
  };
}

function getPasskeyRuntimeConfig(req: Request) {
  const fallbackOrigin = process.env.PASSKEY_ORIGIN || 'http://localhost:5173';
  const requestOrigin = (req.headers.origin as string | undefined) || fallbackOrigin;
  const parsedOrigin = new URL(requestOrigin);

  return {
    origin: requestOrigin,
    rpID: process.env.PASSKEY_RP_ID || parsedOrigin.hostname,
    rpName: getPasskeyRpName(),
  };
}

async function createAuthenticatedSession(
  req: Request,
  user: NonNullable<Awaited<ReturnType<typeof authRepo.findUserByEmail>>>,
  workspaceId: string,
  role: WorkspaceRole,
  authMethod: 'password' | 'password+mfa' | 'passkey',
) {
  const metadata = getClientMetadata(req);
  const session = await authRepo.createSession({
    userId: user.id,
    workspaceId,
    role,
    authMethod,
    deviceName: metadata.deviceName,
    browserName: metadata.browserName,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    workspaceId,
    role,
    sessionId: session.id,
    authMethod,
    authTime: Date.now(),
  });

  return { session, token };
}

async function sendEmailOtpForUser(user: NonNullable<Awaited<ReturnType<typeof authRepo.findUserByEmail>>>) {
  const otpCode = generateEmailOtp();
  const otpHash = await hashOneTimeCode(otpCode);
  const expiresAt = getEmailOtpExpiresAt();

  await authRepo.setEmailOtp(user.id, otpHash, expiresAt);

  const sent = await sendMfaOtpEmail({
    recipientEmail: user.email,
    recipientName: user.fullName,
    otpCode,
    expiresInMinutes: getEmailOtpExpiresMinutes(),
  });

  if (!sent) {
    throw new Error('Unable to send email OTP with current SMTP configuration');
  }

  return expiresAt;
}

async function verifyLoggedInStepUp(
  user: NonNullable<Awaited<ReturnType<typeof authRepo.findUserByEmail>>>,
  method: 'authenticator' | 'email' | 'password',
  payload: { code?: string; password?: string },
) {
  if (method === 'password') {
    if (!payload.password) {
      throw new Error('Password confirmation is required');
    }
    return verifyPassword(payload.password, user.passwordHash);
  }

  if (method === 'email') {
    if (!payload.code) {
      throw new Error('Verification code is required');
    }
    if (!user.emailOtpCodeHash || !user.emailOtpExpiresAt || new Date(user.emailOtpExpiresAt).getTime() < Date.now()) {
      throw new Error('Email verification code has expired. Request a new code.');
    }
    const verified = await verifyOneTimeCode(payload.code, user.emailOtpCodeHash);
    if (verified) {
      await authRepo.clearEmailOtp(user.id);
    }
    return verified;
  }

  if (!payload.code || !user.totpSecretEncrypted) {
    throw new Error('Authenticator code is required');
  }
  return verifyTotpToken(decryptSecret(user.totpSecretEncrypted), payload.code);
}

function getStepUpPurpose(input?: string): StepUpPurpose {
  const allowed: StepUpPurpose[] = [
    'assign_admin_role',
    'change_permissions',
    'approve_access_request',
    'revoke_access',
    'disable_mfa',
    'export_access_review',
  ];
  if (input && allowed.includes(input as StepUpPurpose)) {
    return input as StepUpPurpose;
  }
  return 'change_permissions';
}

async function buildStepUpResponse(req: Request, method: 'authenticator' | 'email' | 'password' | 'passkey', purpose: StepUpPurpose) {
  await authRepo.markSessionStepUp(req.authUser!.sessionId!);
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + getStepUpWindowMinutes() * 60 * 1000).toISOString();
  await governanceRepo.createStepUpChallenge({
    workspaceId: req.authUser!.workspaceId,
    userId: req.authUser!.userId,
    sessionId: req.authUser!.sessionId!,
    purpose,
    method,
    tokenId,
    expiresAt,
  });

  const stepUpToken = signStepUpVerificationToken({
    sub: req.authUser!.userId,
    email: req.authUser!.email,
    workspaceId: req.authUser!.workspaceId,
    role: req.authUser!.role,
    sessionId: req.authUser!.sessionId,
    authMethod: req.authUser!.authMethod as any,
    authTime: Date.now(),
    stepUpTokenId: tokenId,
    verificationMethod: method,
    actionPurpose: purpose,
  });

  return {
    verified: true,
    validForMinutes: getStepUpWindowMinutes(),
    stepUpToken,
    purpose,
    expiresAt,
  };
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, workspaceId: requestedWorkspaceId } = req.body as LoginRequest;

    if (!email || !password) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.login_failed',
        category: 'auth',
        targetType: 'user',
        targetName: email || 'Unknown user',
        outcome: 'failed',
        severity: 'medium',
        source: 'backend',
        notes: 'Email and password are required.',
      }));
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.login_failed',
        category: 'auth',
        targetType: 'user',
        targetName: email,
        outcome: 'failed',
        severity: 'medium',
        source: 'backend',
        notes: 'Invalid email or password.',
      }));
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (!user.isActive) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.account_disabled',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'blocked',
        severity: 'high',
        source: 'backend',
        notes: 'Disabled account attempted to sign in.',
      }));
      return res.status(401).json({
        data: null,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.account_locked',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'blocked',
        severity: 'high',
        source: 'backend',
        notes: `Account locked until ${new Date(user.lockedUntil).toISOString()}.`,
      }));
      return res.status(423).json({
        data: null,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account locked until ${new Date(user.lockedUntil).toISOString()}`,
        },
      });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = nextAttempts >= getFailedLoginThreshold();
      const lockedUntil = shouldLock
        ? new Date(Date.now() + getLockoutDurationMinutes() * 60 * 1000).toISOString()
        : null;

      await authRepo.recordFailedLoginAttempt(user.id, lockedUntil);
      await recordActivity(buildActivityFromRequest(req, {
        action: shouldLock ? 'auth.account_locked' : 'auth.login_failed',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: shouldLock ? 'blocked' : 'failed',
        severity: shouldLock ? 'high' : 'medium',
        source: 'backend',
        notes: shouldLock ? 'Account locked after failed login threshold.' : 'Invalid email or password.',
      }));

      return res.status(shouldLock ? 423 : 401).json({
        data: null,
        error: {
          code: shouldLock ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
          message: shouldLock
            ? `Too many failed login attempts. Account locked for ${getLockoutDurationMinutes()} minutes.`
            : 'Invalid email or password',
        },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);
    if (memberships.length === 0) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.no_workspace_access',
        category: 'auth',
        targetType: 'workspace',
        targetId: requestedWorkspaceId || null,
        targetName: user.email,
        outcome: 'blocked',
        severity: 'high',
        source: 'backend',
        notes: 'User has no workspace memberships.',
      }));
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'User has no workspace memberships' },
      });
    }

    const selectedMembership = getSelectedMembership(memberships, requestedWorkspaceId);
    if (!selectedMembership) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.no_workspace_access',
        category: 'auth',
        targetType: 'workspace',
        targetId: requestedWorkspaceId || null,
        targetName: user.email,
        outcome: 'blocked',
        severity: 'high',
        source: 'backend',
        notes: 'User requested a workspace they do not belong to.',
      }));
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    await authRepo.resetLoginSecurity(user.id);

    if (user.mfaLoginRequired && user.mfaEnabled && user.totpSecretEncrypted) {
      const mfaToken = signMfaChallengeToken({
        sub: user.id,
        email: user.email,
        workspaceId: selectedMembership.workspaceId,
        role: selectedMembership.role,
      });

      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.mfa_challenge_issued',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'pending',
        severity: 'medium',
        source: 'backend',
        notes: 'Password login requires MFA verification.',
      }));
      return res.json({
        data: {
          requiresMfa: true,
          mfaToken,
          ...(await buildAuthSuccessResponse(user, memberships, selectedMembership.workspaceId, selectedMembership.role)),
        },
        error: null,
      });
    }

    const { token } = await createAuthenticatedSession(req, user, selectedMembership.workspaceId, selectedMembership.role, 'password');
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.login_success',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'info',
      source: 'backend',
      notes: `Signed in to workspace ${selectedMembership.workspaceId}.`,
    }));

    return res.json({
      data: {
        requiresMfa: false,
        token,
        ...(await buildAuthSuccessResponse(user, memberships, selectedMembership.workspaceId, selectedMembership.role)),
      },
      error: null,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during login' },
    });
  }
});

router.post('/passkeys/login/options', async (req: Request, res: Response) => {
  try {
    const { email, workspaceId } = req.body as { email?: string; workspaceId?: string };

    if (!email) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Email is required to use a passkey' },
      });
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user || !user.isActive) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'No active user was found for that email address' },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);
    const selectedMembership = getSelectedMembership(memberships, workspaceId);
    if (!selectedMembership) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    const passkeys = await authRepo.listUserPasskeys(user.id);
    if (passkeys.length === 0) {
      return res.status(400).json({
        data: null,
        error: { code: 'NO_PASSKEYS', message: 'No passkeys are registered for this account' },
      });
    }

    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const options = await generateAuthenticationOptions({
      rpID: passkeyConfig.rpID,
      userVerification: 'required',
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as any,
      })),
    });

    const challengeToken = signPasskeyChallengeToken({
      sub: user.id,
      email: user.email,
      workspaceId: selectedMembership.workspaceId,
      role: selectedMembership.role,
      challenge: options.challenge,
      purpose: 'passkey_authentication',
    });

    return res.json({
      data: {
        options,
        challengeToken,
      },
      error: null,
    });
  } catch (error) {
    console.error('Passkey login options error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to start passkey sign-in' },
    });
  }
});

router.post('/passkeys/login/verify', async (req: Request, res: Response) => {
  try {
    const { challengeToken, credential } = req.body as { challengeToken?: string; credential?: any };
    if (!challengeToken || !credential) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'challengeToken and credential are required' },
      });
    }

    const challenge = verifyPasskeyChallengeToken(challengeToken);
    if (!challenge || challenge.purpose !== 'passkey_authentication') {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired passkey challenge' },
      });
    }

    const user = await authRepo.findUserByEmail(challenge.email);
    if (!user || !user.isActive) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passkey = await authRepo.findPasskeyByCredentialId(credential.id);
    if (!passkey || passkey.userId !== user.id) {
      return res.status(404).json({
        data: null,
        error: { code: 'PASSKEY_NOT_FOUND', message: 'Passkey not recognized for this account' },
      });
    }

    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      await recordActivity({
        ...buildActivityFromRequest(req, {
        action: 'auth.passkey_login_failed',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'failed',
        severity: 'high',
        source: 'backend',
        notes: 'Passkey verification failed during sign-in.',
        }),
        workspaceId: challenge.workspaceId,
        actorUserId: user.id,
        actorName: user.email,
        actorRole: challenge.role,
      });
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_PASSKEY', message: 'Passkey verification failed' },
      });
    }

    await authRepo.updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
    await authRepo.resetLoginSecurity(user.id);
    await recordActivity({
      ...buildActivityFromRequest(req, {
      action: 'auth.login_success',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'info',
      source: 'backend',
      notes: 'Signed in with passkey.',
      }),
      workspaceId: challenge.workspaceId,
      actorUserId: user.id,
      actorName: user.email,
      actorRole: challenge.role,
    });

    const memberships = await authRepo.getUserMemberships(user.id);
    const { token } = await createAuthenticatedSession(req, user, challenge.workspaceId, challenge.role, 'passkey');

    return res.json({
      data: {
        requiresMfa: false,
        token,
        ...(await buildAuthSuccessResponse(user, memberships, challenge.workspaceId, challenge.role)),
      },
      error: null,
    });
  } catch (error) {
    console.error('Passkey login verify error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to verify passkey sign-in' },
    });
  }
});

router.post('/mfa/verify-login', async (req: Request, res: Response) => {
  try {
    const { mfaToken, code, recoveryCode, method } = req.body as {
      mfaToken?: string;
      code?: string;
      recoveryCode?: string;
      method?: 'authenticator' | 'email' | 'recovery_code';
    };

    if (!mfaToken || (!code && !recoveryCode)) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'mfaToken and a verification code are required' },
      });
    }

    const payload = verifyMfaChallengeToken(mfaToken);
    if (!payload) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired MFA challenge' },
      });
    }

    const user = await authRepo.findUserByEmail(payload.email);
    if (!user || !user.isActive || !user.mfaEnabled || !user.totpSecretEncrypted) {
      return res.status(401).json({
        data: null,
        error: { code: 'MFA_NOT_AVAILABLE', message: 'MFA is not available for this account' },
      });
    }

    let verified = false;

    if (method === 'email' && code) {
      if (!user.emailOtpCodeHash || !user.emailOtpExpiresAt || new Date(user.emailOtpExpiresAt).getTime() < Date.now()) {
        return res.status(401).json({
          data: null,
          error: { code: 'EMAIL_OTP_EXPIRED', message: 'Email verification code has expired. Request a new code.' },
        });
      }
      verified = await verifyOneTimeCode(code, user.emailOtpCodeHash);
      if (verified) {
        await authRepo.clearEmailOtp(user.id);
      }
    } else if (code) {
      verified = await verifyTotpToken(decryptSecret(user.totpSecretEncrypted), code);
    } else if (recoveryCode) {
      const result = await consumeRecoveryCode(recoveryCode, user.recoveryCodeHashes ?? []);
      verified = result.matched;
      if (result.matched) {
        await authRepo.updateRecoveryCodeHashes(user.id, result.remainingHashes);
      }
    }

    if (!verified) {
      await recordActivity({
        ...buildActivityFromRequest(req, {
        action: 'auth.mfa_verification_failed',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'failed',
        severity: 'high',
        source: 'backend',
        notes: `MFA verification failed using ${method || 'unknown'} method.`,
        }),
        workspaceId: payload.workspaceId,
        actorUserId: user.id,
        actorName: user.email,
        actorRole: payload.role,
      });
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_MFA_CODE', message: 'Invalid verification code' },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);
    const { token } = await createAuthenticatedSession(req, user, payload.workspaceId, payload.role, 'password+mfa');
    await recordActivity({
      ...buildActivityFromRequest(req, {
      action: 'auth.login_success',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'info',
      source: 'backend',
      notes: `Completed MFA login using ${method || 'authenticator'}.`,
      }),
      workspaceId: payload.workspaceId,
      actorUserId: user.id,
      actorName: user.email,
      actorRole: payload.role,
    });

    return res.json({
      data: {
        requiresMfa: false,
        token,
        ...(await buildAuthSuccessResponse(user, memberships, payload.workspaceId, payload.role)),
      },
      error: null,
    });
  } catch (error) {
    console.error('MFA login verification error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during MFA verification' },
    });
  }
});

router.post('/mfa/send-email-otp', async (req: Request, res: Response) => {
  try {
    const { mfaToken } = req.body as { mfaToken?: string };
    if (!mfaToken) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'mfaToken is required' },
      });
    }

    const payload = verifyMfaChallengeToken(mfaToken);
    if (!payload) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired MFA challenge' },
      });
    }

    const user = await authRepo.findUserByEmail(payload.email);
    if (!user || !user.isActive) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const expiresAt = await sendEmailOtpForUser(user);

    return res.json({
      data: {
        sent: true,
        destination: user.email,
        expiresAt,
      },
      error: null,
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unable to send email OTP' },
    });
  }
});

router.get('/mfa/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passkeysCount = await getPasskeyCount(user.id);

    return res.json({
      data: {
        enabled: user.mfaEnabled ?? false,
        emailVerified: user.emailVerified ?? true,
        recoveryCodesRemaining: user.recoveryCodeHashes?.length ?? 0,
        mfaLoginRequired: user.mfaLoginRequired ?? false,
        sensitiveActionMfaRequired: user.sensitiveActionMfaRequired ?? false,
        passkeysCount,
      },
      error: null,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to load MFA status' },
    });
  }
});

router.post('/mfa/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptSecret(secret);
    const otpAuthUrl = buildTotpKeyUri(user.email, secret);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);

    await authRepo.storeMfaSetupSecret(user.id, encryptedSecret);

    return res.json({
      data: {
        issuer: getMfaIssuer(),
        accountName: user.email,
        manualEntryKey: secret,
        otpAuthUrl,
        qrCodeDataUrl,
      },
      error: null,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to start MFA setup' },
    });
  }
});

router.post('/mfa/enable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Verification code is required' },
      });
    }

    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user || !user.mfaTempSecretEncrypted) {
      return res.status(400).json({
        data: null,
        error: { code: 'MFA_SETUP_NOT_STARTED', message: 'Start MFA setup before enabling it' },
      });
    }

    const secret = decryptSecret(user.mfaTempSecretEncrypted);
    if (!(await verifyTotpToken(secret, code))) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_MFA_CODE', message: 'Invalid verification code' },
      });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await hashRecoveryCodes(recoveryCodes);
    await authRepo.enableMfa(user.id, user.mfaTempSecretEncrypted, recoveryCodeHashes);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.mfa_enabled',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'Authenticator app MFA enabled.',
    }));

    return res.json({
      data: {
        enabled: true,
        recoveryCodes,
      },
      error: null,
    });
  } catch (error) {
    console.error('Enable MFA error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to enable MFA' },
    });
  }
});

router.get('/security/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const [passkeys, sessions] = await Promise.all([
      authRepo.listUserPasskeys(user.id),
      authRepo.listActiveSessionsForUser(user.id),
    ]);

    return res.json({
      data: {
        authenticationMethods: {
          passwordEnabled: true,
          totpEnabled: user.mfaEnabled ?? false,
          recoveryCodesRemaining: user.recoveryCodeHashes?.length ?? 0,
          passkeys,
        },
        mfa: {
          enabled: user.mfaEnabled ?? false,
          requireMfaForLogin: user.mfaLoginRequired ?? false,
          requireMfaForSensitiveActions: user.sensitiveActionMfaRequired ?? false,
        },
        sessions,
      },
      error: null,
    });
  } catch (error) {
    console.error('Security settings error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to load security settings' },
    });
  }
});

router.post('/security/mfa-policy', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requireMfaForLogin, requireMfaForSensitiveActions } = req.body as {
      requireMfaForLogin?: boolean;
      requireMfaForSensitiveActions?: boolean;
    };

    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    if (requireMfaForLogin && !user.mfaEnabled) {
      return res.status(400).json({
        data: null,
        error: { code: 'MFA_REQUIRED', message: 'Enable an authenticator app before requiring MFA for password logins' },
      });
    }

    await authRepo.updateMfaPolicy(user.id, {
      mfaLoginRequired: requireMfaForLogin,
      sensitiveActionMfaRequired: requireMfaForSensitiveActions,
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.mfa_policy_changed',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      previousValue: {
        requireMfaForLogin: user.mfaLoginRequired ?? false,
        requireMfaForSensitiveActions: user.sensitiveActionMfaRequired ?? false,
      },
      newValue: {
        requireMfaForLogin: requireMfaForLogin ?? user.mfaLoginRequired ?? false,
        requireMfaForSensitiveActions: requireMfaForSensitiveActions ?? user.sensitiveActionMfaRequired ?? false,
      },
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'MFA policy updated.',
    }));

    return res.json({
      data: { success: true },
      error: null,
    });
  } catch (error) {
    console.error('Update MFA policy error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to update MFA policy' },
    });
  }
});

router.post('/security/recovery-codes/regenerate', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user || !user.mfaEnabled) {
      return res.status(400).json({
        data: null,
        error: { code: 'MFA_NOT_ENABLED', message: 'Enable the authenticator app before generating recovery codes' },
      });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await hashRecoveryCodes(recoveryCodes);
    await authRepo.updateRecoveryCodeHashes(user.id, recoveryCodeHashes);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.recovery_codes_regenerated',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'Backup recovery codes regenerated.',
    }));

    return res.json({
      data: {
        recoveryCodes,
      },
      error: null,
    });
  } catch (error) {
    console.error('Regenerate recovery codes error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to regenerate recovery codes' },
    });
  }
});

router.post('/sessions/logout-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const revokedCount = await authRepo.revokeAllSessionsForUser(req.authUser!.userId);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.sessions_revoked',
      category: 'auth',
      targetType: 'session',
      targetName: req.authUser!.email,
      outcome: 'success',
      severity: 'medium',
      source: 'backend',
      notes: `Revoked ${revokedCount} active sessions.`,
    }));
    return res.json({
      data: {
        revokedCount,
      },
      error: null,
    });
  } catch (error) {
    console.error('Logout all sessions error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to revoke sessions' },
    });
  }
});

router.get('/passkeys', requireAuth, async (req: Request, res: Response) => {
  try {
    const passkeys = await authRepo.listUserPasskeys(req.authUser!.userId);
    return res.json({ data: passkeys, error: null });
  } catch (error) {
    console.error('List passkeys error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to load passkeys' },
    });
  }
});

router.post('/passkeys/register/options', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passkeys = await authRepo.listUserPasskeys(user.id);
    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const options = await generateRegistrationOptions({
      rpName: passkeyConfig.rpName,
      rpID: passkeyConfig.rpID,
      userName: user.email,
      userID: Buffer.from(user.id, 'utf8'),
      userDisplayName: user.fullName || user.email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as any,
      })),
    });

    const challengeToken = signPasskeyChallengeToken({
      sub: user.id,
      email: user.email,
      workspaceId: req.authUser!.workspaceId,
      role: req.authUser!.role,
      sessionId: req.authUser!.sessionId,
      challenge: options.challenge,
      purpose: 'passkey_registration',
    });

    return res.json({
      data: {
        options,
        challengeToken,
      },
      error: null,
    });
  } catch (error) {
    console.error('Passkey registration options error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to start passkey registration' },
    });
  }
});

router.post('/passkeys/register/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { challengeToken, credential, name } = req.body as {
      challengeToken?: string;
      credential?: any;
      name?: string;
    };

    if (!challengeToken || !credential) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'challengeToken and credential are required' },
      });
    }

    const challenge = verifyPasskeyChallengeToken(challengeToken);
    if (!challenge || challenge.purpose !== 'passkey_registration' || challenge.sub !== req.authUser!.userId) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired passkey registration challenge' },
      });
    }

    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_PASSKEY', message: 'Passkey registration could not be verified' },
      });
    }

    const existingPasskeys = await authRepo.listUserPasskeys(req.authUser!.userId);
    const createdPasskey = await authRepo.createPasskey({
      userId: req.authUser!.userId,
      name: name?.trim() || `Passkey ${existingPasskeys.length + 1}`,
      credentialId: verification.registrationInfo.credential.id,
      publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64url'),
      counter: verification.registrationInfo.credential.counter,
      transports: credential.response?.transports || [],
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.passkey_added',
      category: 'auth',
      targetType: 'passkey',
      targetId: createdPasskey.id,
      targetName: createdPasskey.name,
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'Passkey added to account.',
    }));

    return res.status(201).json({
      data: createdPasskey,
      error: null,
    });
  } catch (error) {
    console.error('Passkey registration verify error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to verify passkey registration' },
    });
  }
});

router.delete('/passkeys/:passkeyId', requireAuth, async (req: Request, res: Response) => {
  try {
    await authRepo.deletePasskey(req.authUser!.userId, req.params.passkeyId);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.passkey_removed',
      category: 'auth',
      targetType: 'passkey',
      targetId: req.params.passkeyId,
      targetName: req.authUser!.email,
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'Passkey removed from account.',
    }));
    return res.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('Delete passkey error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to delete passkey' },
    });
  }
});

router.post('/passkeys/step-up/options', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passkeys = await authRepo.listUserPasskeys(user.id);
    if (passkeys.length === 0) {
      return res.status(400).json({
        data: null,
        error: { code: 'NO_PASSKEYS', message: 'No passkeys are registered for this account' },
      });
    }

    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const options = await generateAuthenticationOptions({
      rpID: passkeyConfig.rpID,
      userVerification: 'required',
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as any,
      })),
    });

    const challengeToken = signPasskeyChallengeToken({
      sub: user.id,
      email: user.email,
      workspaceId: req.authUser!.workspaceId,
      role: req.authUser!.role,
      sessionId: req.authUser!.sessionId,
      challenge: options.challenge,
      purpose: 'passkey_step_up',
    });

    return res.json({
      data: { options, challengeToken },
      error: null,
    });
  } catch (error) {
    console.error('Passkey step-up options error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to start passkey verification' },
    });
  }
});

router.post('/passkeys/step-up/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { challengeToken, credential, purpose } = req.body as { challengeToken?: string; credential?: any; purpose?: string };
    if (!challengeToken || !credential) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'challengeToken and credential are required' },
      });
    }

    const challenge = verifyPasskeyChallengeToken(challengeToken);
    if (!challenge || challenge.purpose !== 'passkey_step_up' || challenge.sub !== req.authUser!.userId || challenge.sessionId !== req.authUser!.sessionId) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired passkey verification challenge' },
      });
    }

    const passkey = await authRepo.findPasskeyByCredentialId(credential.id);
    if (!passkey || passkey.userId !== req.authUser!.userId) {
      return res.status(404).json({
        data: null,
        error: { code: 'PASSKEY_NOT_FOUND', message: 'Passkey not recognized for this account' },
      });
    }

    const passkeyConfig = getPasskeyRuntimeConfig(req);
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_PASSKEY', message: 'Passkey verification failed' },
      });
    }

    await authRepo.updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.step_up_verified',
      category: 'auth',
      targetType: 'user',
      targetId: req.authUser!.userId,
      targetName: req.authUser!.email,
      outcome: 'success',
      severity: 'medium',
      source: 'backend',
      notes: `Sensitive action verified with passkey for ${getStepUpPurpose(purpose)}.`,
    }));

    return res.json({
      data: await buildStepUpResponse(req, 'passkey', getStepUpPurpose(purpose)),
      error: null,
    });
  } catch (error) {
    console.error('Passkey step-up verify error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to verify passkey step-up' },
    });
  }
});

router.post('/step-up/send-email-otp', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const expiresAt = await sendEmailOtpForUser(user);
    return res.json({
      data: {
        sent: true,
        destination: user.email,
        expiresAt,
      },
      error: null,
    });
  } catch (error) {
    console.error('Step-up email OTP error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unable to send email verification code' },
    });
  }
});

router.post('/step-up/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { method, code, password, purpose } = req.body as {
      method?: 'authenticator' | 'email' | 'password';
      code?: string;
      password?: string;
      purpose?: string;
    };

    if (!method) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'A verification method is required' },
      });
    }

    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const verified = await verifyLoggedInStepUp(user, method, { code, password });
    if (!verified) {
      await recordActivity(buildActivityFromRequest(req, {
        action: 'auth.step_up_failed',
        category: 'auth',
        targetType: 'user',
        targetId: user.id,
        targetName: user.email,
        outcome: 'failed',
        severity: 'high',
        source: 'backend',
        notes: `Sensitive action verification failed with ${method}.`,
      }));
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_VERIFICATION', message: 'Verification failed' },
      });
    }
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.step_up_verified',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'medium',
      source: 'backend',
      notes: `Sensitive action verified with ${method} for ${getStepUpPurpose(purpose)}.`,
    }));

    return res.json({
      data: await buildStepUpResponse(req, method, getStepUpPurpose(purpose)),
      error: null,
    });
  } catch (error) {
    console.error('Step-up verification error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unable to verify sensitive action' },
    });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);
    return res.json({
      data: await buildAuthSuccessResponse(user, memberships, req.authUser!.workspaceId, req.authUser!.role),
      error: null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

router.post('/switch-workspace', requireAuth, async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body as { workspaceId: string };
    if (!workspaceId) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'workspaceId is required' },
      });
    }

    const membership = await authRepo.getMembership(req.authUser!.userId, workspaceId);
    if (!membership) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    await authRepo.revokeSession(req.authUser!.sessionId!);
    const { token } = await createAuthenticatedSession(req, user, membership.workspaceId, membership.role, (req.authUser!.authMethod as 'password' | 'password+mfa' | 'passkey') || 'password');

    return res.json({
      data: {
        token,
        workspaceId: membership.workspaceId,
        role: membership.role,
      },
      error: null,
    });
  } catch (error) {
    console.error('Switch workspace error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const allowRegistration =
      process.env.ALLOW_REGISTRATION === 'true' ||
      process.env.NODE_ENV === 'development';

    if (!allowRegistration) {
      return res.status(403).json({
        data: null,
        error: { code: 'REGISTRATION_DISABLED', message: 'Registration is disabled' },
      });
    }

    const { email, password, fullName, workspaceId, role } = req.body as RegisterRequest;
    if (!email || !password || !workspaceId || !role) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'email, password, workspaceId, and role are required' },
      });
    }

    const validRoles: WorkspaceRole[] = ['owner', 'admin', 'grc', 'auditor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_ROLE', message: `Role must be one of: ${validRoles.join(', ')}` },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        data: null,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
      });
    }

    const existingUser = await authRepo.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        data: null,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await authRepo.createUser(email, passwordHash, fullName);
    const membership = await authRepo.createWorkspaceMembership(user.id, workspaceId, role);
    const secureUser = await authRepo.findUserByEmail(user.email);
    if (!secureUser) {
      throw new Error('User creation succeeded but lookup failed');
    }

    const { token } = await createAuthenticatedSession(req, secureUser, membership.workspaceId, membership.role, 'password');
    await recordActivity({
      ...buildActivityFromRequest(req, {
      action: 'auth.user_registered',
      category: 'user',
      targetType: 'user',
      targetId: secureUser.id,
      targetName: secureUser.email,
      newValue: { role: membership.role, workspaceId: membership.workspaceId },
      outcome: 'success',
      severity: 'medium',
      source: 'backend',
      notes: 'New user registered and joined workspace.',
      }),
      workspaceId,
      actorUserId: secureUser.id,
      actorName: secureUser.email,
      actorRole: membership.role,
    });

    return res.status(201).json({
      data: {
        requiresMfa: false,
        token,
        ...(await buildAuthSuccessResponse(secureUser, [membership], membership.workspaceId, membership.role)),
      },
      error: null,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during registration' },
    });
  }
});

router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'currentPassword and newPassword are required' },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        data: null,
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters' },
      });
    }

    const user = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await authRepo.updateUserPassword(user.id, newPasswordHash);
    await recordActivity(buildActivityFromRequest(req, {
      action: 'auth.password_changed',
      category: 'auth',
      targetType: 'user',
      targetId: user.id,
      targetName: user.email,
      outcome: 'success',
      severity: 'high',
      source: 'backend',
      notes: 'Password changed successfully.',
    }));

    return res.json({
      data: { success: true },
      error: null,
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

export default router;
