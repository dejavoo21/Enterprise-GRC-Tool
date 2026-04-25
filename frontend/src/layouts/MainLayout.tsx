import React, { useEffect, useState } from 'react';
import { theme } from '../theme';
import { Sidebar, TopBar } from '../components';

interface MainLayoutProps {
  children: React.ReactNode;
  activeKey: string;
  onNavigate: (key: string) => void;
}

export function MainLayout({ children, activeKey, onNavigate }: MainLayoutProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 960 : true
  );
  const subtitle = 'Operational visibility across governance, risk, and compliance';

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 960;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const handleNavigate = (key: string) => {
    onNavigate(key);
    setSidebarOpen(false);
  };

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
        appName="Enterprise GRC Tool"
        subtitle={subtitle}
        onToggleSidebar={handleToggleSidebar}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Sidebar
          activeKey={activeKey}
          onSelect={handleNavigate}
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
        />

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? theme.spacing[4] : theme.spacing[6],
            backgroundColor: theme.colors.background,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
