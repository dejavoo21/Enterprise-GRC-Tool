import * as auditRepo from '../repositories/auditManagementRepo.js';
import type { AuditManagementState } from '../types/auditManagement.js';
import type { ReadinessArea, ReadinessItem, ReadinessSummary } from '../types/models.js';

export async function ensureAuditManagementWorkspaceState(workspaceId: string): Promise<AuditManagementState> {
  await auditRepo.seedAuditManagementData(workspaceId);
  return auditRepo.getAuditManagementState(workspaceId);
}

export async function getLegacyReadinessSummary(workspaceId: string): Promise<ReadinessSummary[]> {
  const state = await ensureAuditManagementWorkspaceState(workspaceId);
  return state.frameworkReadiness.map((item) => ({
    framework: item.framework,
    readinessPercent: item.readinessPercent,
    totalAreas: state.auditUniverse.filter((entity) => entity.framework === item.framework).length,
    readyAreas: state.auditUniverse.filter((entity) => entity.framework === item.framework && entity.readinessScore >= 75).length,
    openItems: item.openFindings,
  }));
}

export async function getLegacyReadinessAreas(workspaceId: string, framework?: string): Promise<ReadinessArea[]> {
  const state = await ensureAuditManagementWorkspaceState(workspaceId);
  return state.auditUniverse
    .filter((entity) => !framework || entity.framework === framework)
    .map((entity) => ({
      id: entity.id,
      workspaceId,
      framework: entity.framework,
      domain: entity.name,
      score: entity.readinessScore,
      status: entity.readinessScore >= 75 ? 'ready' : entity.readinessScore >= 55 ? 'in_progress' : 'not_started',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));
}

export async function getLegacyReadinessGaps(workspaceId: string, framework?: string): Promise<Array<ReadinessItem & { framework?: string; domain?: string }>> {
  const state = await ensureAuditManagementWorkspaceState(workspaceId);
  const areas = await getLegacyReadinessAreas(workspaceId, framework);
  const findings = state.findings.filter((finding) => finding.status !== 'closed');
  return findings.slice(0, 12).map((finding, index) => {
    const area = areas[index % Math.max(areas.length, 1)];
    return {
      id: finding.id,
      workspaceId,
      areaId: area?.id || 'general',
      controlId: undefined,
      riskId: undefined,
      question: finding.title,
      status: finding.status === 'in_progress' ? 'in_progress' : 'not_started',
      owner: finding.owner,
      dueDate: finding.targetDate,
      evidenceId: undefined,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
      framework: area?.framework,
      domain: area?.domain,
    };
  });
}
