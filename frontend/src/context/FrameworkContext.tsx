/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode, useMemo } from 'react';
import type { Framework, ApiResponse } from '../types/framework';
import { apiCall } from '../lib/api';
import { useAuth } from './AuthContext';

interface FrameworkContextType {
  frameworks: Framework[];
  loading: boolean;
  error: string | null;
  // Helper methods
  getFramework: (code: string) => Framework | undefined;
  getFrameworkName: (code: string) => string;
  getFrameworkColor: (code: string) => string;
  // Filtered lists
  aiHealthcareFrameworks: Framework[];
  privacyFrameworks: Framework[];
  defaultFrameworks: Framework[];
  // For dropdowns
  frameworkOptions: { value: string; label: string }[];
}

const FrameworkContext = createContext<FrameworkContextType | undefined>(undefined);

const DEFAULT_COLOR = '#6B7280';

export function FrameworkProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token, workspaceId } = useAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load frameworks from API on mount
  useEffect(() => {
    if (!isAuthenticated || !token || !workspaceId) {
      setFrameworks([]);
      setLoading(false);
      setError(null);
      return;
    }

    const loadFrameworks = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiCall<ApiResponse<Framework[]>>('/api/v1/frameworks');
        if (result.error) {
          throw new Error(result.error.message);
        }
        setFrameworks(result.data || []);
      } catch (err) {
        console.error('Failed to load frameworks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load frameworks');
        // Continue with empty array - components should handle gracefully
        setFrameworks([]);
      } finally {
        setLoading(false);
      }
    };

    loadFrameworks();
  }, [isAuthenticated, token, workspaceId]);

  // Helper to find a framework by code
  const getFramework = (code: string): Framework | undefined => {
    return frameworks.find(f => f.code === code);
  };

  // Helper to get display name
  const getFrameworkName = (code: string): string => {
    const fw = getFramework(code);
    return fw?.name || code;
  };

  // Helper to get color
  const getFrameworkColor = (code: string): string => {
    const fw = getFramework(code);
    return fw?.colorHex || DEFAULT_COLOR;
  };

  // Memoized filtered lists
  const aiHealthcareFrameworks = useMemo(
    () => frameworks.filter(f => f.isAiHealthcare),
    [frameworks]
  );

  const privacyFrameworks = useMemo(
    () => frameworks.filter(f => f.isPrivacy),
    [frameworks]
  );

  const defaultFrameworks = useMemo(
    () => frameworks.filter(f => f.isDefault),
    [frameworks]
  );

  // Options for dropdowns
  const frameworkOptions = useMemo(
    () => frameworks.map(f => ({ value: f.code, label: f.name })),
    [frameworks]
  );

  const value: FrameworkContextType = {
    frameworks,
    loading,
    error,
    getFramework,
    getFrameworkName,
    getFrameworkColor,
    aiHealthcareFrameworks,
    privacyFrameworks,
    defaultFrameworks,
    frameworkOptions,
  };

  return (
    <FrameworkContext.Provider value={value}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useFrameworks() {
  const context = useContext(FrameworkContext);
  if (context === undefined) {
    throw new Error('useFrameworks must be used within a FrameworkProvider');
  }
  return context;
}
