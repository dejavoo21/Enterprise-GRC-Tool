import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiCall, setCurrentWorkspaceId } from '../lib/api';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  setCurrentWorkspace: (workspace: Workspace) => void;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, workspaceId } = useAuth();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace>({ id: '', name: 'Select Workspace' });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const applyWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem('selectedWorkspaceId', workspace.id);
    localStorage.setItem('workspaceId', workspace.id);
    setCurrentWorkspaceId(workspace.id);
  };

  const loadWorkspaces = async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspaceState({ id: '', name: 'Select Workspace' });
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall<{ data: Workspace[] }>('/api/v1/workspaces', { skipWorkspace: true });
      const list = response.data || [];
      setWorkspaces(list);

      if (list.length === 0) {
        setCurrentWorkspaceState({ id: '', name: 'Create Workspace' });
        setCurrentWorkspaceId(null);
        return;
      }

      const stored = localStorage.getItem('selectedWorkspaceId');
      const preferred = workspaceId || stored || currentWorkspace.id;
      const selected = list.find((w) => w.id === preferred) || list[0];
      applyWorkspace(selected);
    } catch {
      setWorkspaces([]);
      setCurrentWorkspaceState({ id: '', name: 'Unavailable' });
      setCurrentWorkspaceId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadWorkspaces();
  }, [isAuthenticated, workspaceId]);

  const switchWorkspace = (id: string) => {
    const w = workspaces.find((x) => x.id === id);
    if (w) applyWorkspace(w);
  };

  const refreshWorkspaces = async () => {
    await loadWorkspaces();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        setCurrentWorkspace: applyWorkspace,
        switchWorkspace,
        refreshWorkspaces,
        workspaces,
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
