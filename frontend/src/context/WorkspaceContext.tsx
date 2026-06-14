import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiCall, setCurrentWorkspaceId } from '../lib/api';
import type { Workspace } from '../types/workspace';

interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  workspaceId: string | null;
  organizationId: string | null;
  tenantId: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
}

const EMPTY_WORKSPACE: Workspace = {
  id: '',
  name: 'Select Workspace',
  displayName: 'Select Workspace',
  description: '',
  industry: null,
  region: null,
  status: 'draft',
  organizationId: '',
  organizationName: '',
  tenantId: '',
  tenantName: '',
  createdByUserId: null,
  createdAt: new Date(0).toISOString(),
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace>(EMPTY_WORKSPACE);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const applyWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem('selectedWorkspaceId', workspace.id);
    localStorage.setItem('workspaceId', workspace.id);
    setCurrentWorkspaceId(workspace.id);
  };

  const loadWorkspaces = async () => {
    if (!auth.isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspaceState(EMPTY_WORKSPACE);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall<{ data: Workspace[] }>('/api/v1/workspaces', { skipWorkspace: true });
      const list = response.data || [];
      setWorkspaces(list);

      if (list.length === 0) {
        setCurrentWorkspaceState({ ...EMPTY_WORKSPACE, name: 'Create Workspace', displayName: 'Create Workspace' });
        setCurrentWorkspaceId(null);
        return;
      }

      const stored = localStorage.getItem('selectedWorkspaceId');
      const preferred = auth.workspaceId || stored || currentWorkspace.id;
      const selected = list.find((workspace) => workspace.id === preferred) || list[0];
      applyWorkspace(selected);
    } catch {
      setWorkspaces([]);
      setCurrentWorkspaceState({
        ...EMPTY_WORKSPACE,
        name: auth.workspaceName || 'Unavailable',
        displayName: auth.workspaceName || 'Unavailable',
        organizationId: auth.organizationId || '',
        organizationName: auth.organizationName || '',
        tenantId: auth.tenantId || '',
        tenantName: auth.tenantName || '',
      });
      setCurrentWorkspaceId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadWorkspaces();
  }, [auth.isAuthenticated, auth.workspaceId]);

  const switchWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;

    await auth.switchWorkspace(workspaceId);
    applyWorkspace(workspace);
  };

  const refreshWorkspaces = async () => {
    await loadWorkspaces();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace: currentWorkspace.id ? currentWorkspace : null,
        currentWorkspace,
        workspaces,
        workspaceId: currentWorkspace.id || auth.workspaceId || null,
        organizationId: currentWorkspace.organizationId || auth.organizationId || null,
        tenantId: currentWorkspace.tenantId || auth.tenantId || null,
        setCurrentWorkspace: applyWorkspace,
        switchWorkspace,
        refreshWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
}
