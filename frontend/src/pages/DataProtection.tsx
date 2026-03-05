import { useState, useEffect, useRef } from 'react';
import { theme } from '../theme';
import { Card, PageHeader, Badge, Button } from '../components';
import { useFrameworks } from '../context/FrameworkContext';

const API_BASE = '/api/v1';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DataProtectionFrameworkStats {
  framework: string;
  name: string;
  totalControls: number;
  implemented: number;
  inProgress: number;
  notImplemented: number;
  notApplicable: number;
  controlsWithEvidence: number;
}

interface DataProtectionControlMatrixRow {
  controlId: string;
  title: string;
  owner: string;
  domain?: string;
  status: string;
  frameworks: string[];
  references: string[];
  evidenceCount: number;
  lastEvidenceAt?: string;
  relatedRiskCount: number;
}

interface DataProtectionOverviewReport {
  workspaceId: string;
  totalRelevantControls: number;
  totalEvidenceItems: number;
  totalRelatedRisks: number;
  frameworkStats: DataProtectionFrameworkStats[];
  controlMatrix: DataProtectionControlMatrixRow[];
}

interface AISummaryResponse {
  narrative: string;
  keyInsights: string[];
  recommendations: string[];
  generatedAt: string;
}

interface AIQAResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources?: string[];
  generatedAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusColor(status: string): string {
  switch (status) {
    case 'implemented': return theme.colors.semantic.success;
    case 'in_progress': return theme.colors.semantic.warning;
    case 'not_implemented': return theme.colors.semantic.danger;
    default: return theme.colors.text.muted;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'implemented': return 'Implemented';
    case 'in_progress': return 'In Progress';
    case 'not_implemented': return 'Not Implemented';
    case 'not_applicable': return 'N/A';
    default: return status;
  }
}

function getImplementationRate(stats: DataProtectionFrameworkStats): number {
  if (stats.totalControls === 0) return 0;
  return Math.round((stats.implemented / stats.totalControls) * 100);
}

// ============================================
// METRIC CARD COMPONENT
// ============================================

function MetricCard({ title, value, subtitle, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: '180px' }}>
      <div style={{
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.text.muted,
        marginBottom: theme.spacing[2],
      }}>
        {title}
      </div>
      <div style={{
        fontSize: theme.typography.sizes['3xl'],
        fontWeight: theme.typography.weights.bold,
        color: color || theme.colors.text.main,
        marginBottom: subtitle ? theme.spacing[1] : 0,
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: theme.typography.sizes.xs,
          color: theme.colors.text.secondary,
        }}>
          {subtitle}
        </div>
      )}
    </Card>
  );
}

// ============================================
// FRAMEWORK CARD COMPONENT
// ============================================

function FrameworkCard({ stats, onClick }: {
  stats: DataProtectionFrameworkStats;
  onClick: () => void;
}) {
  const rate = getImplementationRate(stats);
  const color = rate >= 75 ? theme.colors.semantic.success
    : rate >= 50 ? theme.colors.semantic.warning
    : theme.colors.semantic.danger;

  return (
    <Card hover onClick={onClick} style={{ flex: 1, minWidth: '200px', cursor: 'pointer' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing[3],
      }}>
        <Badge variant="primary">{stats.name}</Badge>
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
          {stats.totalControls} controls
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: theme.spacing[1],
        marginBottom: theme.spacing[2],
      }}>
        <span style={{
          fontSize: theme.typography.sizes['3xl'],
          fontWeight: theme.typography.weights.bold,
          color,
        }}>
          {rate}%
        </span>
        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Implemented
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '8px',
        backgroundColor: theme.colors.borderLight,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
        marginBottom: theme.spacing[3],
      }}>
        <div style={{
          height: '100%',
          width: `${rate}%`,
          backgroundColor: color,
          borderRadius: theme.borderRadius.full,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.text.secondary,
        display: 'flex',
        gap: theme.spacing[3],
      }}>
        <span>{stats.implemented} implemented</span>
        <span>{stats.inProgress} in progress</span>
        <span>{stats.controlsWithEvidence} with evidence</span>
      </div>
    </Card>
  );
}

// ============================================
// CONTROL MATRIX TABLE
// ============================================

function ControlMatrix({ controls, getFrameworkName }: {
  controls: DataProtectionControlMatrixRow[];
  getFrameworkName: (code: string) => string;
}) {
  const [filter, setFilter] = useState<string>('all');

  const filteredControls = controls.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <Card>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
      }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}>
          Privacy Control Matrix
        </h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
            fontSize: theme.typography.sizes.sm,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.background,
          }}
        >
          <option value="all">All Status</option>
          <option value="implemented">Implemented</option>
          <option value="in_progress">In Progress</option>
          <option value="not_implemented">Not Implemented</option>
          <option value="not_applicable">Not Applicable</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: theme.typography.sizes.sm,
        }}>
          <thead>
            <tr style={{ backgroundColor: theme.colors.surfaceHover }}>
              {['Control', 'Owner', 'Domain', 'Status', 'Frameworks', 'Evidence', 'Risks'].map(header => (
                <th key={header} style={{
                  textAlign: 'left',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  fontWeight: theme.typography.weights.semibold,
                  color: theme.colors.text.main,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredControls.length === 0 ? (
              <tr>
                <td colSpan={7} style={{
                  padding: theme.spacing[6],
                  textAlign: 'center',
                  color: theme.colors.text.muted,
                }}>
                  No controls found
                </td>
              </tr>
            ) : (
              filteredControls.map((control) => (
                <tr key={control.controlId} style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
                    <div style={{ fontWeight: theme.typography.weights.medium }}>{control.title}</div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                      {control.controlId}
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, color: theme.colors.text.secondary }}>
                    {control.owner}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, color: theme.colors.text.secondary }}>
                    {control.domain || '-'}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
                    <span style={{
                      padding: `2px 8px`,
                      fontSize: theme.typography.sizes.xs,
                      fontWeight: theme.typography.weights.medium,
                      backgroundColor: `${getStatusColor(control.status)}15`,
                      color: getStatusColor(control.status),
                      borderRadius: theme.borderRadius.md,
                    }}>
                      {getStatusLabel(control.status)}
                    </span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
                      {control.frameworks.map(fw => (
                        <Badge key={fw} variant="default" size="sm">{getFrameworkName(fw)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    color: control.evidenceCount > 0 ? theme.colors.semantic.success : theme.colors.text.muted,
                  }}>
                    {control.evidenceCount}
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    color: control.relatedRiskCount > 0 ? theme.colors.semantic.warning : theme.colors.text.muted,
                  }}>
                    {control.relatedRiskCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================
// AI ASSISTANT PANEL
// ============================================

function AIAssistantPanel() {
  const [summary, setSummary] = useState<AISummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [askingQuestion, setAskingQuestion] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load AI summary on mount
  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/reports/data-protection/ai/summary`);
        const json = await res.json();
        if (json.data) {
          setSummary(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch AI summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleAskQuestion = async () => {
    if (!question.trim() || askingQuestion) return;

    const userQuestion = question.trim();
    setQuestion('');
    setConversation(prev => [...prev, { role: 'user', content: userQuestion }]);
    setAskingQuestion(true);

    try {
      const res = await fetch(`${API_BASE}/reports/data-protection/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion }),
      });
      const json = await res.json();
      if (json.data) {
        const answer = json.data as AIQAResponse;
        setConversation(prev => [...prev, { role: 'assistant', content: answer.answer }]);
      } else {
        setConversation(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not answer that question.' }]);
      }
    } catch (err) {
      setConversation(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  return (
    <Card style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '500px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4],
        paddingBottom: theme.spacing[3],
        borderBottom: `1px solid ${theme.colors.borderLight}`,
      }}>
        <span style={{ fontSize: '20px' }}>&#129302;</span>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}>
          Privacy AI Assistant
        </h3>
      </div>

      {/* Summary Section */}
      {loading ? (
        <div style={{ color: theme.colors.text.muted, marginBottom: theme.spacing[4] }}>
          Analyzing your privacy posture...
        </div>
      ) : summary ? (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <p style={{
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.text.main,
            lineHeight: 1.6,
            marginBottom: theme.spacing[3],
          }}>
            {summary.narrative}
          </p>

          {summary.keyInsights.length > 0 && (
            <div style={{ marginBottom: theme.spacing[3] }}>
              <div style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text.muted,
                marginBottom: theme.spacing[2],
              }}>
                KEY INSIGHTS
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: theme.spacing[4],
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.text.secondary,
              }}>
                {summary.keyInsights.map((insight, i) => (
                  <li key={i} style={{ marginBottom: theme.spacing[1] }}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.recommendations.length > 0 && (
            <div>
              <div style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text.muted,
                marginBottom: theme.spacing[2],
              }}>
                RECOMMENDATIONS
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: theme.spacing[4],
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.primary,
              }}>
                {summary.recommendations.map((rec, i) => (
                  <li key={i} style={{ marginBottom: theme.spacing[1] }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Conversation Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: theme.spacing[3],
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[2],
      }}>
        {conversation.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.lg,
              backgroundColor: msg.role === 'user' ? theme.colors.primary : theme.colors.surfaceHover,
              color: msg.role === 'user' ? 'white' : theme.colors.text.main,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {msg.content}
          </div>
        ))}
        {askingQuestion && (
          <div style={{
            alignSelf: 'flex-start',
            color: theme.colors.text.muted,
            fontSize: theme.typography.sizes.sm,
          }}>
            Thinking...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Question Input */}
      <div style={{
        display: 'flex',
        gap: theme.spacing[2],
        borderTop: `1px solid ${theme.colors.borderLight}`,
        paddingTop: theme.spacing[3],
      }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
          placeholder="Ask about your privacy compliance..."
          style={{
            flex: 1,
            padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
            fontSize: theme.typography.sizes.sm,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.background,
            outline: 'none',
          }}
        />
        <Button
          variant="primary"
          onClick={handleAskQuestion}
          disabled={!question.trim() || askingQuestion}
        >
          Ask
        </Button>
      </div>

      {/* Suggested Questions */}
      <div style={{
        marginTop: theme.spacing[2],
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing[1],
      }}>
        {['What is our GDPR status?', 'Are we audit ready?', 'Where are the gaps?'].map(q => (
          <button
            key={q}
            onClick={() => setQuestion(q)}
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.primary,
              backgroundColor: theme.colors.primaryLight,
              border: 'none',
              borderRadius: theme.borderRadius.full,
              cursor: 'pointer',
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export function DataProtection() {
  const { getFrameworkName } = useFrameworks();
  const [report, setReport] = useState<DataProtectionOverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);

  // Fetch report data
  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/reports/data-protection/overview`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setReport(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  // Filter controls by framework if selected
  const filteredControls = report?.controlMatrix.filter(c => {
    if (!selectedFramework) return true;
    return c.frameworks.includes(selectedFramework);
  }) || [];

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Data Protection Compliance"
          description="Monitor privacy framework compliance and posture"
        />
        <Card>
          <div style={{ padding: theme.spacing[6], textAlign: 'center', color: theme.colors.text.muted }}>
            Loading data protection report...
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Data Protection Compliance"
          description="Monitor privacy framework compliance and posture"
        />
        <Card style={{ borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ color: theme.colors.semantic.danger }}>{error}</div>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  // Calculate totals for metrics
  const totalImplemented = report.frameworkStats.reduce((s, f) => s + f.implemented, 0);
  const implementationRate = report.totalRelevantControls > 0
    ? Math.round((totalImplemented / report.totalRelevantControls) * 100)
    : 0;
  const totalWithEvidence = report.frameworkStats.reduce((s, f) => s + f.controlsWithEvidence, 0);
  const evidenceCoverage = report.totalRelevantControls > 0
    ? Math.round((totalWithEvidence / report.totalRelevantControls) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Data Protection Compliance"
        description="Monitor privacy framework compliance and posture"
      />

      {/* Top Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
      }}>
        <MetricCard
          title="Privacy Frameworks"
          value={report.frameworkStats.length}
          subtitle="Active frameworks"
        />
        <MetricCard
          title="Relevant Controls"
          value={report.totalRelevantControls}
          subtitle={`${totalImplemented} implemented`}
        />
        <MetricCard
          title="Implementation Rate"
          value={`${implementationRate}%`}
          color={implementationRate >= 70 ? theme.colors.semantic.success : theme.colors.semantic.warning}
        />
        <MetricCard
          title="Evidence Coverage"
          value={`${evidenceCoverage}%`}
          color={evidenceCoverage >= 70 ? theme.colors.semantic.success : theme.colors.semantic.warning}
          subtitle={`${report.totalEvidenceItems} items`}
        />
        <MetricCard
          title="Related Risks"
          value={report.totalRelatedRisks}
          color={report.totalRelatedRisks > 0 ? theme.colors.semantic.warning : theme.colors.text.muted}
        />
      </div>

      {/* Framework Cards */}
      {report.frameworkStats.length > 0 && (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <h2 style={{
            margin: 0,
            marginBottom: theme.spacing[4],
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.text.main,
          }}>
            Framework Breakdown
          </h2>
          <div style={{
            display: 'flex',
            gap: theme.spacing[4],
            flexWrap: 'wrap',
          }}>
            {report.frameworkStats.map(stats => (
              <FrameworkCard
                key={stats.framework}
                stats={stats}
                onClick={() => setSelectedFramework(
                  selectedFramework === stats.framework ? null : stats.framework
                )}
              />
            ))}
          </div>
          {selectedFramework && (
            <div style={{
              marginTop: theme.spacing[3],
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
            }}>
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Filtering by: <strong>{getFrameworkName(selectedFramework)}</strong>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFramework(null)}>
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: theme.spacing[6],
        alignItems: 'start',
      }}>
        {/* Control Matrix */}
        <ControlMatrix
          controls={filteredControls}
          getFrameworkName={getFrameworkName}
        />

        {/* AI Assistant Panel */}
        <AIAssistantPanel />
      </div>
    </div>
  );
}
