import type { RiskReportPack } from '../types/riskIntelligence.js';
import type { ReportStatus } from './riskReportWorkflow.js';

export interface ArchivedReportEvent {
  action: string;
  actor_email: string;
  comment: string | null;
  created_at: string;
}

export interface ArchivedReportExportSource {
  id: string;
  status: ReportStatus;
  prepared_email: string;
  pack: RiskReportPack;
  events: ArchivedReportEvent[];
}

const statusLabel = (status: ReportStatus) => status.replaceAll('_', ' ');

export function buildArchivedReportExport(source: ArchivedReportExportSource): RiskReportPack {
  const pack = structuredClone(source.pack);
  pack.reviewStatus = source.status;
  const reviewed = [...source.events].reverse().find(event => event.action === 'review');
  const approved = [...source.events].reverse().find(event => event.action === 'approve');
  const decisionComments = source.events.filter(event => ['review', 'approve', 'reject'].includes(event.action) && event.comment?.trim()).map(event => `${event.action}: ${event.comment!.trim()}`);
  const signOff = pack.sections.find(section => section.heading === '11. Approval and Sign-off');
  if (signOff) {
    signOff.bullets = [`Application report workflow status: ${statusLabel(source.status)}. Recorded review and approval events are governance history, not a digital signature.`];
    signOff.table = {
      columns: ['Field', 'Value'],
      rows: [
        ['Report status', statusLabel(source.status)],
        ['Prepared by', pack.metadata?.preparedBy || source.prepared_email || 'Not recorded'],
        ['Reviewed by', reviewed?.actor_email || 'Not recorded'],
        ['Approved by', approved?.actor_email || 'Not recorded'],
        ['Approval date', approved?.created_at ? new Date(approved.created_at).toISOString() : 'Not recorded'],
        ['Comments', decisionComments.join('\n') || 'No review or approval comments recorded'],
        ['Report template version', pack.metadata?.version || 'Not recorded'],
      ],
    };
  }
  pack.sections.push({
    heading: 'Recorded review and approval trail',
    bullets: [`Snapshot ${source.id}; workflow status: ${source.status}. Original generated content is preserved except the sign-off summary above, which reflects this recorded workflow trail. This is not a digital signature.`],
    table: { columns: ['Action', 'User', 'Comment', 'Date'], rows: source.events.map(event => [event.action, event.actor_email, event.comment || '', new Date(event.created_at).toISOString()]) },
  });
  return pack;
}
