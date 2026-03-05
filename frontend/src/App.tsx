import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { FrameworkProvider } from './context/FrameworkContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components';
import Login from './pages/Login';
import {
  Dashboard,
  RiskMatrix,
  Reports,
  Risks,
  Controls,
  Issues,
  Evidence,
  AppReviewRegister,
  AccessReviewRegister,
  AuditReadiness,
  Training,
  Assets,
  Vendors,
  ComplianceEvidenceTracker,
  TrainingEngagements,
  AwarenessLibrary,
  TrainingKpis,
  GovernanceDocuments,
  ReviewTasks,
  DataProtection,
  ExecutiveOverview,
  ActivityLog,
  WorkspaceWizard,
  WorkspaceMembers,
  Placeholder,
  TPRMDashboard,
} from './pages';

/**
 * Protected Route wrapper - redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

/**
 * Main application content with page routing
 */
function AppContent() {
  const [activeKey, setActiveKey] = useState('dashboard');

  const renderPage = () => {
    switch (activeKey) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveKey} />;
      case 'reports':
        return <Reports />;
      case 'risk-matrix':
        return <RiskMatrix />;
      case 'risks':
        return <Risks />;
      case 'controls':
        return <Controls />;
      case 'issues':
        return <Issues />;
      case 'evidence':
        return <Evidence />;
      case 'app-review':
        return <AppReviewRegister />;
      case 'access-review':
        return <AccessReviewRegister />;
      case 'frameworks':
        return <Placeholder title="Framework Library" description="Browse and manage compliance frameworks including ISO 27001, SOC 2, PCI DSS, HIPAA, and more." />;
      case 'control-library':
        return <Placeholder title="Control Library" description="Centralized library of security and compliance controls mapped to multiple frameworks." />;
      case 'assets':
        return <Assets />;
      case 'vendors':
        return <Vendors />;
      case 'applications':
        return <Placeholder title="Applications" description="Catalog business applications and track their security posture." />;
      case 'policies':
        return <GovernanceDocuments />;
      case 'governance-documents':
        return <GovernanceDocuments />;
      case 'review-tasks':
        return <ReviewTasks />;
      case 'treatments':
        return <Placeholder title="Risk Treatments" description="Define and track risk treatment plans and mitigation strategies." />;
      case 'incidents':
        return <Placeholder title="Incidents" description="Log, track, and manage security incidents and their resolution." />;
      case 'tasks':
        return <Placeholder title="Tasks" description="Track GRC-related tasks, assignments, and deadlines." />;
      case 'soa':
        return <Placeholder title="Statement of Applicability" description="Manage your Statement of Applicability (SoA) for compliance frameworks." />;
      case 'traceability':
        return <Placeholder title="Traceability" description="View traceability matrices linking requirements, controls, and evidence." />;
      case 'audit-readiness':
        return <AuditReadiness />;
      case 'training':
        return <Training />;
      case 'training-engagements':
        return <TrainingEngagements />;
      case 'awareness-library':
        return <AwarenessLibrary />;
      case 'training-kpis':
        return <TrainingKpis />;
      case 'compliance-tracker':
        return <ComplianceEvidenceTracker />;
      case 'data-protection':
        return <DataProtection />;
      case 'executive-overview':
        return <ExecutiveOverview />;
      case 'activity-log':
        return <ActivityLog />;
      case 'workspace-new':
        return <WorkspaceWizard />;
      case 'workspace-members':
        return <WorkspaceMembers />;
      case 'settings':
        return <Placeholder title="Settings" description="Configure system settings, user preferences, and integrations." />;
      // TPRM (Third-Party Risk Management) pages
      case 'tprm-dashboard':
        return <TPRMDashboard onNavigate={setActiveKey} />;
      case 'tprm-assessments':
        return <Placeholder title="Vendor Assessments" description="Manage vendor risk assessments, track findings, and monitor remediation." />;
      case 'tprm-questionnaires':
        return <Placeholder title="Vendor Questionnaires" description="Create and manage security questionnaire templates and track vendor responses." />;
      case 'tprm-contracts':
        return <Placeholder title="Vendor Contracts" description="Track vendor contracts, renewal dates, and key terms." />;
      case 'tprm-incidents':
        return <Placeholder title="Vendor Incidents" description="Log and track security incidents involving third-party vendors." />;
      default:
        return <Dashboard onNavigate={setActiveKey} />;
    }
  };

  return (
    <WorkspaceProvider>
      <FrameworkProvider>
        <MainLayout activeKey={activeKey} onNavigate={setActiveKey}>
          {renderPage()}
        </MainLayout>
      </FrameworkProvider>
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
