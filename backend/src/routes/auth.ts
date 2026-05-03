/**
 * Authentication Routes
 *
 * Handles password login, MFA enrollment, MFA login verification,
 * registration, and user session management.
 */

import { Router, Request, Response } from 'express';
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
  hashPassword,
  hashRecoveryCodes,
  hashOneTimeCode,
  signAuthToken,
  signMfaChallengeToken,
  verifyAuthToken,
  verifyMfaChallengeToken,
  verifyOneTimeCode,
  verifyPassword,
  verifyTotpToken,
} from '../services/authService.js';
import * as authRepo from '../repositories/authRepo.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { WorkspaceRole } from '../types/models.js';
import { sendMfaOtpEmail } from '../services/emailService.js';

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

function buildAuthSuccessResponse(
  user: Awaited<ReturnType<typeof authRepo.findUserByEmail>>,
  memberships: Awaited<ReturnType<typeof authRepo.getUserMemberships>>,
  workspaceId: string,
  role: WorkspaceRole
) {
  if (!user) {
    throw new Error('User not found');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      mfaEnabled: user.mfaEnabled ?? false,
      emailVerified: user.emailVerified ?? true,
      availableMfaMethods: ['authenticator', 'email', 'recovery_code'],
    },
    workspaceId,
    role,
    availableWorkspaces: buildAvailableWorkspaces(memberships),
  };
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

function getSelectedMembership(
  memberships: Awaited<ReturnType<typeof authRepo.getUserMemberships>>,
  requestedWorkspaceId?: string
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

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, workspaceId: requestedWorkspaceId } = req.body as LoginRequest;

    if (!email || !password) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
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
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'User has no workspace memberships' },
      });
    }

    const selectedMembership = getSelectedMembership(memberships, requestedWorkspaceId);
    if (!selectedMembership) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    await authRepo.resetLoginSecurity(user.id);

    if (user.mfaEnabled && user.totpSecretEncrypted) {
      const mfaToken = signMfaChallengeToken({
        sub: user.id,
        email: user.email,
        workspaceId: selectedMembership.workspaceId,
        role: selectedMembership.role,
      });

      return res.json({
        data: {
          requiresMfa: true,
          mfaToken,
          ...buildAuthSuccessResponse(user, memberships, selectedMembership.workspaceId, selectedMembership.role),
        },
        error: null,
      });
    }

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: selectedMembership.workspaceId,
      role: selectedMembership.role,
    });

    return res.json({
      data: {
        requiresMfa: false,
        token,
        ...buildAuthSuccessResponse(user, memberships, selectedMembership.workspaceId, selectedMembership.role),
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

    const user = await authRepo.findUserById(payload.sub);
    const secureUser = await authRepo.findUserByEmail(payload.email);
    if (!user || !secureUser || !user.isActive || !secureUser.mfaEnabled || !secureUser.totpSecretEncrypted) {
      return res.status(401).json({
        data: null,
        error: { code: 'MFA_NOT_AVAILABLE', message: 'MFA is not available for this account' },
      });
    }

    let verified = false;

    if (method === 'email' && code) {
      if (
        !secureUser.emailOtpCodeHash ||
        !secureUser.emailOtpExpiresAt ||
        new Date(secureUser.emailOtpExpiresAt).getTime() < Date.now()
      ) {
        return res.status(401).json({
          data: null,
          error: { code: 'EMAIL_OTP_EXPIRED', message: 'Email verification code has expired. Request a new code.' },
        });
      }

      verified = await verifyOneTimeCode(code, secureUser.emailOtpCodeHash);
      if (verified) {
        await authRepo.clearEmailOtp(user.id);
      }
    } else if (code) {
      const secret = decryptSecret(secureUser.totpSecretEncrypted);
      verified = await verifyTotpToken(secret, code);
    } else if (recoveryCode) {
      const result = await consumeRecoveryCode(recoveryCode, secureUser.recoveryCodeHashes ?? []);
      verified = result.matched;
      if (result.matched) {
        await authRepo.updateRecoveryCodeHashes(user.id, result.remainingHashes);
      }
    }

    if (!verified) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_MFA_CODE', message: 'Invalid verification code' },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);
    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: payload.workspaceId,
      role: payload.role,
    });

    return res.json({
      data: {
        requiresMfa: false,
        token,
        ...buildAuthSuccessResponse(secureUser, memberships, payload.workspaceId, payload.role),
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
    const user = await authRepo.findUserById(req.authUser!.userId);
    const secureUser = await authRepo.findUserByEmail(req.authUser!.email);
    if (!user || !secureUser) {
      return res.status(404).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({
      data: {
        enabled: secureUser.mfaEnabled ?? false,
        emailVerified: secureUser.emailVerified ?? true,
        recoveryCodesRemaining: secureUser.recoveryCodeHashes?.length ?? 0,
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

router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAuthToken(token);
    if (!payload) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    const user = await authRepo.findUserById(payload.sub);
    const secureUser = await authRepo.findUserByEmail(payload.email);
    if (!user || !secureUser || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    const memberships = await authRepo.getUserMemberships(user.id);

    return res.json({
      data: {
        ...buildAuthSuccessResponse(secureUser, memberships, payload.workspaceId, payload.role),
      },
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

router.post('/switch-workspace', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAuthToken(token);
    if (!payload) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    const { workspaceId } = req.body as { workspaceId: string };
    if (!workspaceId) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'workspaceId is required' },
      });
    }

    const membership = await authRepo.getMembership(payload.sub, workspaceId);
    if (!membership) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    const user = await authRepo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    const newToken = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });

    return res.json({
      data: {
        token: newToken,
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

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });

    return res.status(201).json({
      data: {
        requiresMfa: false,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          mfaEnabled: false,
          emailVerified: true,
        },
        workspaceId: membership.workspaceId,
        role: membership.role,
        availableWorkspaces: [{ workspaceId: membership.workspaceId, role: membership.role }],
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

router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAuthToken(token);
    if (!payload) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

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

    const user = await authRepo.findUserByEmail(payload.email);
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
