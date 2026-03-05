/**
 * AI Debug Panel Component
 *
 * Displays AI prompt debug information when available.
 * Only shown when the API returns debug info (AI_DEBUG_PROMPT=true in backend).
 */

import { useState } from 'react';
import { theme } from '../theme';

export interface AiDebugInfo {
  provider: string;
  model: string;
  prompt: {
    system: string;
    user: string;
  };
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

interface AiDebugPanelProps {
  debug?: AiDebugInfo;
  title?: string;
}

export function AiDebugPanel({ debug, title = 'AI Debug Info' }: AiDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!debug) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: theme.spacing[4],
        border: `1px solid ${theme.colors.semantic.warning}`,
        borderRadius: theme.borderRadius.md,
        backgroundColor: 'rgba(234, 179, 8, 0.05)',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing[3],
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.semantic.warning,
          fontSize: theme.typography.sizes.sm,
          fontWeight: theme.typography.weights.medium,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          {title}
        </span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div style={{ padding: theme.spacing[4], paddingTop: 0 }}>
          <div style={{ marginBottom: theme.spacing[4] }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: theme.spacing[4],
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Provider
                </span>
                <div
                  style={{
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    color: theme.colors.text.main,
                  }}
                >
                  {debug.provider}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Model
                </span>
                <div
                  style={{
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    color: theme.colors.text.main,
                  }}
                >
                  {debug.model}
                </div>
              </div>
              {debug.options?.maxTokens && (
                <div>
                  <span
                    style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.text.secondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Max Tokens
                  </span>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      color: theme.colors.text.main,
                    }}
                  >
                    {debug.options.maxTokens}
                  </div>
                </div>
              )}
              {debug.options?.temperature !== undefined && (
                <div>
                  <span
                    style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.text.secondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Temperature
                  </span>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      color: theme.colors.text.main,
                    }}
                  >
                    {debug.options.temperature}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: theme.spacing[4] }}>
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text.main,
                  marginBottom: theme.spacing[2],
                }}
              >
                System Prompt ({debug.prompt.system.length} chars)
              </summary>
              <pre
                style={{
                  backgroundColor: theme.colors.surfaceHover,
                  padding: theme.spacing[3],
                  borderRadius: theme.borderRadius.sm,
                  fontSize: theme.typography.sizes.xs,
                  overflow: 'auto',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: theme.colors.text.main,
                  margin: 0,
                }}
              >
                {debug.prompt.system}
              </pre>
            </details>
          </div>

          <div>
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text.main,
                  marginBottom: theme.spacing[2],
                }}
              >
                User Prompt ({debug.prompt.user.length} chars)
              </summary>
              <pre
                style={{
                  backgroundColor: theme.colors.surfaceHover,
                  padding: theme.spacing[3],
                  borderRadius: theme.borderRadius.sm,
                  fontSize: theme.typography.sizes.xs,
                  overflow: 'auto',
                  maxHeight: '400px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: theme.colors.text.main,
                  margin: 0,
                }}
              >
                {debug.prompt.user}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
