/**
 * Authentication Context
 *
 * Provides authentication state and actions throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AuthState,
  WorkspaceRole,
  LoginResponse,
  LoginSuccessResponse,
  MeResponse,
  SendEmailOtpResponse,
  SwitchWorkspaceResponse,
  MfaChallengeResponse,
} from '../types/auth';
import { canEdit, isAdmin } from '../types/auth';
import { serializeAuthenticationCredential, toPublicKeyRequestOptions } from '../lib/webauthn';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'authToken',
  USER: 'authUser',
  WORKSPACE_ID: 'workspaceId',
  ROLE: 'authRole',
  AVAILABLE_WORKSPACES: 'availableWorkspaces',
};

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, workspaceId?: string) => Promise<{ requiresMfa: boolean }>;
  loginWithPasskey: (email: string, workspaceId?: string) => Promise<void>;
  verifyMfaLogin: (code: string, method?: 'authenticator' | 'email' | 'recovery_code') => Promise<void>;
  sendEmailOtpLoginCode: () => Promise<SendEmailOtpResponse>;
  cancelMfaLogin: () => void;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
  pendingMfaChallenge: MfaChallengeResponse | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';

// API base URL - use backend URL in production, empty string for Vite proxy in dev
const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');

/**
 * Load initial state from localStorage
 */
function loadInitialState(): AuthState {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    const workspaceId = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID);
    const role = localStorage.getItem(STORAGE_KEYS.ROLE) as WorkspaceRole | null;
    const workspacesJson = localStorage.getItem(STORAGE_KEYS.AVAILABLE_WORKSPACES);

    const user = userJson ? JSON.parse(userJson) : null;
    const availableWorkspaces = workspacesJson ? JSON.parse(workspacesJson) : [];

    return {
      token,
      user,
      workspaceId,
      role,
      availableWorkspaces,
      isAuthenticated: !!token && !!user,
    };
  } catch {
    return {
      token: null,
      user: null,
      workspaceId: null,
      role: null,
      availableWorkspaces: [],
      isAuthenticated: false,
    };
  }
}

/**
 * Save state to localStorage
 */
function saveToStorage(state: Partial<AuthState>) {
  if (state.token !== undefined) {
    if (state.token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, state.token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  }

  if (state.user !== undefined) {
    if (state.user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  if (state.workspaceId !== undefined) {
    if (state.workspaceId) {
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, state.workspaceId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
    }
  }

  if (state.role !== undefined) {
    if (state.role) {
      localStorage.setItem(STORAGE_KEYS.ROLE, state.role);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ROLE);
    }
  }

  if (state.availableWorkspaces !== undefined) {
    if (state.availableWorkspaces.length > 0) {
      localStorage.setItem(STORAGE_KEYS.AVAILABLE_WORKSPACES, JSON.stringify(state.availableWorkspaces));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AVAILABLE_WORKSPACES);
    }
  }
}

/**
 * Clear all auth data from localStorage
 */
function clearStorage() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState);
  const [pendingMfaChallenge, setPendingMfaChallenge] = useState<MfaChallengeResponse | null>(null);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string, workspaceId?: string) => {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, workspaceId }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Login failed');
    }

    const data = result.data as LoginResponse;

    if (data.requiresMfa) {
      setPendingMfaChallenge(data);
      return { requiresMfa: true };
    }

    const successData = data as LoginSuccessResponse;
    const newState: AuthState = {
      token: successData.token,
      user: successData.user,
      workspaceId: successData.workspaceId,
      role: successData.role,
      availableWorkspaces: successData.availableWorkspaces,
      isAuthenticated: true,
    };

    saveToStorage(newState);
    setState(newState);
    setPendingMfaChallenge(null);
    return { requiresMfa: false };
  }, []);

  const verifyMfaLogin = useCallback(async (code: string, method: 'authenticator' | 'email' | 'recovery_code' = 'authenticator') => {
    if (!pendingMfaChallenge) {
      throw new Error('No MFA challenge is in progress');
    }

    const response = await fetch(`${API_BASE}/api/v1/auth/mfa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        method === 'recovery_code'
          ? { mfaToken: pendingMfaChallenge.mfaToken, recoveryCode: code, method }
          : { mfaToken: pendingMfaChallenge.mfaToken, code, method }
      ),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'MFA verification failed');
    }

    const data = result.data as LoginSuccessResponse;
    const newState: AuthState = {
      token: data.token,
      user: data.user,
      workspaceId: data.workspaceId,
      role: data.role,
      availableWorkspaces: data.availableWorkspaces,
      isAuthenticated: true,
    };

    saveToStorage(newState);
    setState(newState);
    setPendingMfaChallenge(null);
  }, [pendingMfaChallenge]);

  const loginWithPasskey = useCallback(async (email: string, workspaceId?: string) => {
    const optionsResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, workspaceId }),
    });
    const optionsResult = await optionsResponse.json();
    if (!optionsResponse.ok || optionsResult.error) {
      throw new Error(optionsResult.error?.message || 'Unable to start passkey sign-in');
    }

    const { options, challengeToken } = optionsResult.data as { options: unknown; challengeToken: string };
    const credential = await navigator.credentials.get({
      publicKey: toPublicKeyRequestOptions(options),
    });

    if (!credential) {
      throw new Error('Passkey sign-in was cancelled');
    }

    const verifyResponse = await fetch(`${API_BASE}/api/v1/auth/passkeys/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken,
        credential: serializeAuthenticationCredential(credential as PublicKeyCredential),
      }),
    });
    const verifyResult = await verifyResponse.json();
    if (!verifyResponse.ok || verifyResult.error) {
      throw new Error(verifyResult.error?.message || 'Passkey verification failed');
    }

    const data = verifyResult.data as LoginSuccessResponse;
    const newState: AuthState = {
      token: data.token,
      user: data.user,
      workspaceId: data.workspaceId,
      role: data.role,
      availableWorkspaces: data.availableWorkspaces,
      isAuthenticated: true,
    };

    saveToStorage(newState);
    setState(newState);
    setPendingMfaChallenge(null);
  }, []);

  const sendEmailOtpLoginCode = useCallback(async () => {
    if (!pendingMfaChallenge) {
      throw new Error('No MFA challenge is in progress');
    }

    const response = await fetch(`${API_BASE}/api/v1/auth/mfa/send-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: pendingMfaChallenge.mfaToken }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Unable to send email code');
    }

    return result.data as SendEmailOtpResponse;
  }, [pendingMfaChallenge]);

  const cancelMfaLogin = useCallback(() => {
    setPendingMfaChallenge(null);
  }, []);

  /**
   * Logout - clear all auth state
   */
  const logout = useCallback(() => {
    clearStorage();
    setPendingMfaChallenge(null);
    setState({
      token: null,
      user: null,
      workspaceId: null,
      role: null,
      availableWorkspaces: [],
      isAuthenticated: false,
    });
  }, []);

  /**
   * Switch to a different workspace
   */
  const switchWorkspace = useCallback(async (newWorkspaceId: string) => {
    if (!state.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE}/api/v1/auth/switch-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body: JSON.stringify({ workspaceId: newWorkspaceId }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Failed to switch workspace');
    }

    const data = result.data as SwitchWorkspaceResponse;

    const updates = {
      token: data.token,
      workspaceId: data.workspaceId,
      role: data.role,
    };

    saveToStorage(updates);
    setState(prev => ({
      ...prev,
      ...updates,
    }));
  }, [state.token]);

  /**
   * Refresh auth state from server
   */
  const refreshAuth = useCallback(async () => {
    if (!state.token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${state.token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        // Token is invalid, logout
        logout();
        return;
      }

      const data = result.data as MeResponse;

      const updates = {
        user: data.user,
        workspaceId: data.workspaceId,
        role: data.role,
        availableWorkspaces: data.availableWorkspaces,
      };

      saveToStorage(updates);
      setState(prev => ({
        ...prev,
        ...updates,
      }));
    } catch {
      // Network error, keep current state
      console.error('Failed to refresh auth state');
    }
  }, [state.token, logout]);

  // Verify token on mount
  useEffect(() => {
    if (state.token) {
      refreshAuth();
    }
  }, []); // Only run on mount

  const contextValue: AuthContextValue = {
    ...state,
    login,
    loginWithPasskey,
    verifyMfaLogin,
    sendEmailOtpLoginCode,
    cancelMfaLogin,
    logout,
    switchWorkspace,
    refreshAuth,
    canEdit: canEdit(state.role),
    isAdmin: isAdmin(state.role),
    pendingMfaChallenge,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user has required role
 */
export function useRequireRole(allowedRoles: WorkspaceRole[]): {
  hasAccess: boolean;
  role: WorkspaceRole | null;
} {
  const { role, isAuthenticated } = useAuth();
  const hasAccess = isAuthenticated && role !== null && allowedRoles.includes(role);
  return { hasAccess, role };
}
