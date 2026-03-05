import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';

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
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>({
    id: 'demo-workspace',
    name: 'Demo Workspace',
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  // Load workspaces from API
  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/v1/workspaces');
      if (response.ok) {
        const data = await response.json();
        const workspacesList = data.data || [];
        setWorkspaces(workspacesList);

        // If current workspace no longer exists, reset to demo
        if (!workspacesList.find((w: Workspace) => w.id === currentWorkspace.id)) {
          setCurrentWorkspace({
            id: 'demo-workspace',
            name: 'Demo Workspace',
          });
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      // Continue with default workspaces
      setWorkspaces([
        { id: 'demo-workspace', name: 'Demo Workspace' },
        { id: 'olive-internal', name: 'Olive EHS Internal' },
        { id: 'client-a', name: 'Client A - ISP' },
        { id: 'client-b', name: 'Client B - Fintech' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Persist workspace selection to localStorage
  useEffect(() => {
    localStorage.setItem('selectedWorkspaceId', currentWorkspace.id);
    localStorage.setItem('workspaceId', currentWorkspace.id);
  }, [currentWorkspace]);

  // Switch to a workspace by ID
  const switchWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
    } else {
      // If workspace not in list, create a temporary entry and refresh
      setCurrentWorkspace({ id: workspaceId, name: workspaceId });
      loadWorkspaces();
    }
  };

  // Refresh workspaces list
  const refreshWorkspaces = async () => {
    await loadWorkspaces();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        setCurrentWorkspace,
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
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
