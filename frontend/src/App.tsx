import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { FrameworkProvider } from './context/FrameworkContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShellProvider } from './context/ShellContext';
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
  ActivityLedger,
  EnterpriseOperatingSystem,
  WorkspaceWizard,
  WorkspaceManagement,
  WorkspaceMembers,
  TPRMDashboard,
  AdminUsers,
  AdminRoles,
  AdminPermissions,
  AdminAuthentication,
  AdminAccessReviews,
  AdminLoginActivity,
  AdminSecuritySettings,
  RegulatoryChangeManagement,
  BusinessContinuity,
  AiGovernance,
  EsgManagement,
  PrivacyDataGovernance,
  ExecutiveWorkspace,
  RiskWorkspace,
  ComplianceWorkspace,
  ControlsWorkspace,
  EvidenceWorkspace,
  AuditWorkspace,
  ContinuousAssuranceWorkspace,
  AssetWorkspace,
  VendorWorkspace,
  PrivacyWorkspace,
  AIGovernanceWorkspace,
  ESGWorkspace,
  AdministrationWorkspace,
  ContinuousAssuranceOverview,
  ContinuousAssuranceMonitors,
  ContinuousAssuranceTests,
  ContinuousAssuranceEvidenceCollection,
  ContinuousAssuranceExceptions,
  ContinuousAssuranceDrift,
  ContinuousAssuranceConnectors,
  ContinuousAssuranceAnalytics,
  ContinuousAssuranceReports,
  ContinuousAssuranceSettings,
} from './pages';

const DEFAULT_PAGE_KEY = 'dashboard';

const pageKeyToPath: Record<string, string> = {
  dashboard: '/',
  'executive-workspace': '/workspaces/executive',
  'risk-workspace': '/workspaces/risk',
  'compliance-workspace': '/workspaces/compliance',
  'controls-workspace': '/workspaces/controls',
  'evidence-workspace': '/workspaces/evidence',
  'audit-workspace': '/workspaces/audit',
  'continuous-assurance-workspace': '/workspaces/continuous-assurance',
  'asset-workspace': '/workspaces/assets',
  'vendor-workspace': '/workspaces/vendors',
  'privacy-workspace': '/workspaces/privacy',
  'ai-governance-workspace': '/workspaces/ai-governance',
  'esg-workspace': '/workspaces/esg',
  'administration-workspace': '/workspaces/administration',
  reports: '/reports',
  'risk-matrix': '/risk-matrix',
  risks: '/risks',
  controls: '/controls',
  issues: '/issues',
  evidence: '/evidence',
  'app-review': '/app-review',
  'access-review': '/access-review',
  frameworks: '/frameworks',
  'control-library': '/control-library',
  assets: '/assets',
  vendors: '/vendors',
  applications: '/applications',
  policies: '/policies',
  'governance-documents': '/governance-documents',
  'review-tasks': '/review-tasks',
  treatments: '/treatments',
  incidents: '/incidents',
  tasks: '/tasks',
  soa: '/soa',
  traceability: '/traceability',
  'audit-readiness': '/audit-readiness',
  'continuous-assurance-overview': '/continuous-assurance',
  'ccm-monitors': '/continuous-assurance/monitors',
  'ccm-tests': '/continuous-assurance/tests',
  'ccm-evidence-jobs': '/continuous-assurance/evidence-collection',
  'ccm-exceptions': '/continuous-assurance/exceptions',
  'ccm-drift': '/continuous-assurance/drift',
  'ccm-connectors': '/continuous-assurance/connectors',
  'ccm-analytics': '/continuous-assurance/analytics',
  'ccm-reports': '/continuous-assurance/reports',
  'ccm-settings': '/continuous-assurance/settings',
  training: '/training',
  'training-engagements': '/training-engagements',
  'awareness-library': '/awareness-library',
  'training-kpis': '/training-kpis',
  'compliance-tracker': '/compliance-tracker',
  'data-protection': '/data-protection',
  'executive-overview': '/executive-overview',
  'activity-log': '/activity-log',
  'activity-ledger': '/activity-ledger',
  'enterprise-operating-system': '/enterprise-operating-system',
  'regulatory-change': '/regulatory-change-management',
  'business-continuity': '/business-continuity',
  'ai-governance': '/ai-governance',
  'esg-management': '/esg-management',
  'privacy-data-governance': '/privacy-data-governance',
  'workspace-new': '/workspace-new',
  'workspace-management': '/workspace-management',
  'workspace-members': '/workspace-members',
  settings: '/settings',
  'tprm-dashboard': '/tprm-dashboard',
  'tprm-assessments': '/tprm-assessments',
  'tprm-questionnaires': '/tprm-questionnaires',
  'tprm-contracts': '/tprm-contracts',
  'tprm-incidents': '/tprm-incidents',
  'admin-users': '/admin/users',
  'admin-roles': '/admin/roles',
  'admin-permissions': '/admin/permissions',
  'admin-authentication': '/admin/authentication',
  'admin-access-reviews': '/admin/access-reviews',
  'admin-login-activity': '/admin/login-activity',
  'admin-security-settings': '/admin/security-settings',
};

const pagePathToKey = Object.entries(pageKeyToPath).reduce<Record<string, string>>((acc, [key, path]) => {
  acc[path] = key;
  return acc;
}, {});

function getActiveKeyFromPath(pathname: string): string {
  return pagePathToKey[pathname] || DEFAULT_PAGE_KEY;
}

function getDocumentTitle(activeKey: string): string {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    'executive-workspace': 'Executive Workspace',
    'risk-workspace': 'Risk Workspace',
    'compliance-workspace': 'Compliance Workspace',
    'controls-workspace': 'Controls Workspace',
    'evidence-workspace': 'Evidence Workspace',
    'audit-workspace': 'Audit Workspace',
    'continuous-assurance-workspace': 'Continuous Assurance Workspace',
    'asset-workspace': 'Asset Workspace',
    'vendor-workspace': 'Vendor Workspace',
    'privacy-workspace': 'Privacy Workspace',
    'ai-governance-workspace': 'AI Governance Workspace',
    'esg-workspace': 'ESG Workspace',
    'administration-workspace': 'Administration Workspace',
    reports: 'Board Reporting Center',
    'risk-matrix': 'Risk Matrix',
    risks: 'Enterprise Risk Intelligence',
    controls: 'Controls',
    issues: 'Issues',
    evidence: 'Evidence',
    'app-review': 'Application Review Register',
    'access-review': 'Access Review Register',
    frameworks: 'Frameworks',
    'control-library': 'Control Library',
    assets: 'Assets',
    vendors: 'Vendors',
    'audit-readiness': 'Audit Command Center',
    'continuous-assurance-overview': 'Continuous Assurance Overview',
    'ccm-monitors': 'Control Monitors',
    'ccm-tests': 'Automated Tests',
    'ccm-evidence-jobs': 'Automated Evidence Collection',
    'ccm-exceptions': 'Assurance Exceptions',
    'ccm-drift': 'Compliance Drift Detection',
    'ccm-connectors': 'Connector Management',
    'ccm-analytics': 'Assurance Analytics',
    'ccm-reports': 'Continuous Assurance Reports',
    'ccm-settings': 'Continuous Assurance Settings',
    training: 'Training & Awareness',
    'training-engagements': 'Training Engagements',
    'awareness-library': 'Awareness Library',
    'training-kpis': 'Training KPIs',
    'compliance-tracker': 'Evidence Operations',
    'data-protection': 'Data Protection',
    'executive-overview': 'Executive Center',
    'activity-log': 'Activity Log',
    'activity-ledger': 'Enterprise Activity Ledger',
    'enterprise-operating-system': 'Enterprise Governance Operating System',
    'regulatory-change': 'Regulatory Change Management',
    'business-continuity': 'Business Continuity Dashboard',
    'ai-governance': 'AI Governance Dashboard',
    'esg-management': 'ESG Management Platform',
    'privacy-data-governance': 'Privacy & Data Governance Platform',
    'workspace-new': 'Organization Setup',
    'workspace-management': 'Workspace Management',
    'workspace-members': 'Team Access',
    'tprm-dashboard': 'TPRM Dashboard',
    'admin-users': 'User Management',
    'admin-roles': 'Role Management',
    'admin-permissions': 'Permission Matrix',
    'admin-authentication': 'Authentication Settings',
    'admin-access-reviews': 'Access Reviews',
    'admin-login-activity': 'Login Activity',
    'admin-security-settings': 'Security Settings',
  };

  return `${labels[activeKey] || 'Enterprise GRC Tool'} | Enterprise GRC Tool`;
}

function navigateToPage(key: string, navigate: ReturnType<typeof useNavigate>) {
  navigate(pageKeyToPath[key] || pageKeyToPath[DEFAULT_PAGE_KEY]);
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = getActiveKeyFromPath(location.pathname);
  const handleNavigate = (key: string) => navigateToPage(key, navigate);

  useEffect(() => {
    document.title = getDocumentTitle(activeKey);
  }, [activeKey]);

  const renderPage = () => {
    switch (activeKey) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'executive-workspace':
        return <ExecutiveWorkspace onNavigate={handleNavigate} />;
      case 'risk-workspace':
        return <RiskWorkspace onNavigate={handleNavigate} />;
      case 'compliance-workspace':
        return <ComplianceWorkspace onNavigate={handleNavigate} />;
      case 'controls-workspace':
        return <ControlsWorkspace onNavigate={handleNavigate} />;
      case 'evidence-workspace':
        return <EvidenceWorkspace onNavigate={handleNavigate} />;
      case 'audit-workspace':
        return <AuditWorkspace onNavigate={handleNavigate} />;
      case 'continuous-assurance-workspace':
        return <ContinuousAssuranceWorkspace onNavigate={handleNavigate} />;
      case 'asset-workspace':
        return <AssetWorkspace onNavigate={handleNavigate} />;
      case 'vendor-workspace':
        return <VendorWorkspace onNavigate={handleNavigate} />;
      case 'privacy-workspace':
        return <PrivacyWorkspace onNavigate={handleNavigate} />;
      case 'ai-governance-workspace':
        return <AIGovernanceWorkspace onNavigate={handleNavigate} />;
      case 'esg-workspace':
        return <ESGWorkspace onNavigate={handleNavigate} />;
      case 'administration-workspace':
        return <AdministrationWorkspace onNavigate={handleNavigate} />;
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
        return <ComplianceWorkspace onNavigate={handleNavigate} />;
      case 'control-library':
        return <ControlsWorkspace onNavigate={handleNavigate} />;
      case 'assets':
        return <Assets />;
      case 'vendors':
        return <Vendors />;
      case 'applications':
        return <AssetWorkspace onNavigate={handleNavigate} />;
      case 'policies':
      case 'governance-documents':
        return <GovernanceDocuments />;
      case 'review-tasks':
        return <ReviewTasks />;
      case 'treatments':
        return <RiskWorkspace onNavigate={handleNavigate} />;
      case 'incidents':
        return <Issues />;
      case 'tasks':
        return <ReviewTasks />;
      case 'soa':
        return <ComplianceWorkspace onNavigate={handleNavigate} />;
      case 'traceability':
        return <ControlsWorkspace onNavigate={handleNavigate} />;
      case 'audit-readiness':
        return <AuditReadiness />;
      case 'continuous-assurance-overview':
        return <ContinuousAssuranceOverview />;
      case 'ccm-monitors':
        return <ContinuousAssuranceMonitors />;
      case 'ccm-tests':
        return <ContinuousAssuranceTests />;
      case 'ccm-evidence-jobs':
        return <ContinuousAssuranceEvidenceCollection />;
      case 'ccm-exceptions':
        return <ContinuousAssuranceExceptions />;
      case 'ccm-drift':
        return <ContinuousAssuranceDrift />;
      case 'ccm-connectors':
        return <ContinuousAssuranceConnectors />;
      case 'ccm-analytics':
        return <ContinuousAssuranceAnalytics />;
      case 'ccm-reports':
        return <ContinuousAssuranceReports />;
      case 'ccm-settings':
        return <ContinuousAssuranceSettings />;
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
      case 'activity-ledger':
        return <ActivityLedger />;
      case 'enterprise-operating-system':
        return <EnterpriseOperatingSystem />;
      case 'regulatory-change':
        return <RegulatoryChangeManagement />;
      case 'business-continuity':
        return <BusinessContinuity />;
      case 'ai-governance':
        return <AiGovernance />;
      case 'esg-management':
        return <EsgManagement />;
      case 'privacy-data-governance':
        return <PrivacyDataGovernance />;
      case 'workspace-new':
        return <WorkspaceWizard />;
      case 'workspace-management':
        return <WorkspaceManagement />;
      case 'workspace-members':
        return <WorkspaceMembers />;
      case 'settings':
        return <AdministrationWorkspace onNavigate={handleNavigate} />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-roles':
        return <AdminRoles />;
      case 'admin-permissions':
        return <AdminPermissions />;
      case 'admin-authentication':
        return <AdminAuthentication />;
      case 'admin-access-reviews':
        return <AdminAccessReviews />;
      case 'admin-login-activity':
        return <AdminLoginActivity />;
      case 'admin-security-settings':
        return <AdminSecuritySettings />;
      case 'tprm-dashboard':
        return <TPRMDashboard onNavigate={handleNavigate} />;
      case 'tprm-assessments':
        return <VendorWorkspace onNavigate={handleNavigate} />;
      case 'tprm-questionnaires':
        return <VendorWorkspace onNavigate={handleNavigate} />;
      case 'tprm-contracts':
        return <VendorWorkspace onNavigate={handleNavigate} />;
      case 'tprm-incidents':
        return <VendorWorkspace onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <ShellProvider>
      <WorkspaceProvider>
        <FrameworkProvider>
          <MainLayout activeKey={activeKey} onNavigate={handleNavigate}>
            {renderPage()}
          </MainLayout>
        </FrameworkProvider>
      </WorkspaceProvider>
    </ShellProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="*"
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
