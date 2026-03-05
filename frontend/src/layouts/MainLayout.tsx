import React, { useState } from 'react';
import { theme } from '../theme';
import { Sidebar, TopBar } from '../components';

interface MainLayoutProps {
  children: React.ReactNode;
  activeKey: string;
  onNavigate: (key: string) => void;
}

export function MainLayout({ children, activeKey, onNavigate }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.colors.background,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <TopBar
        appName="GRC Suite"
        subtitle="playwright-agents"
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeKey={activeKey} onSelect={onNavigate} isOpen={sidebarOpen} />

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: theme.spacing[6],
            backgroundColor: theme.colors.background,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
