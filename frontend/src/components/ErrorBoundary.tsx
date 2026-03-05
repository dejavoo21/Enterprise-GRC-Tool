import { Component, type ErrorInfo, type ReactNode } from 'react';
import { theme } from '../theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            padding: theme.spacing[6],
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: theme.borderRadius.lg,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
              padding: theme.spacing[8],
              textAlign: 'center',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto',
                marginBottom: theme.spacing[4],
                backgroundColor: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: theme.typography.sizes.xl,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text.main,
                margin: 0,
                marginBottom: theme.spacing[2],
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: theme.typography.sizes.base,
                color: theme.colors.text.secondary,
                margin: 0,
                marginBottom: theme.spacing[6],
                lineHeight: 1.6,
              }}
            >
              This page failed to load due to an unexpected error. Please try reloading the page.
            </p>

            <div
              style={{
                display: 'flex',
                gap: theme.spacing[3],
                justifyContent: 'center',
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.base,
                  fontWeight: theme.typography.weights.medium,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
              >
                Reload page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.base,
                  fontWeight: theme.typography.weights.medium,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = theme.colors.text.secondary)}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = theme.colors.border)}
              >
                Try again
              </button>
            </div>

            {/* Dev mode error details */}
            {isDev && this.state.error && (
              <details
                style={{
                  marginTop: theme.spacing[6],
                  textAlign: 'left',
                  backgroundColor: '#fef2f2',
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing[4],
                }}
              >
                <summary
                  style={{
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    color: '#dc2626',
                    cursor: 'pointer',
                    marginBottom: theme.spacing[2],
                  }}
                >
                  Error Details (Development Only)
                </summary>
                <div
                  style={{
                    fontSize: theme.typography.sizes.xs,
                    color: '#991b1b',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    marginTop: theme.spacing[2],
                  }}
                >
                  <strong>Error:</strong> {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {'\n\n'}
                      <strong>Stack:</strong>
                      {'\n'}
                      {this.state.error.stack}
                    </>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\n'}
                      <strong>Component Stack:</strong>
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
