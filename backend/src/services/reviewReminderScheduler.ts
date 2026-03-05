import * as nodeCron from 'node-cron';
import * as reviewTasksRepo from '../repositories/reviewTasksRepo.js';
import * as governanceDocumentsRepo from '../repositories/governanceDocumentsRepo.js';
import { sendReminderEmail } from './emailService.js';
import type { ReviewTask } from '../types/models.js';

// Configuration
const SCHEDULER_ENABLED = process.env.REVIEW_SCHEDULER_ENABLED !== 'false';
const CHECK_INTERVAL_CRON = process.env.REVIEW_CHECK_CRON || '0 8 * * *'; // Default: 8 AM daily

// Simple in-memory user email lookup (in production, use a user service)
function getUserEmail(assignee: string): string {
  // For demo purposes, convert assignee name to email format
  // In production, integrate with user management system
  const sanitized = assignee.toLowerCase().replace(/\s+/g, '.');
  return `${sanitized}@company.com`;
}

async function processReminders(): Promise<void> {
  console.log('[Scheduler] Starting review reminder check...');

  try {
    // Get all tasks due for reminder across all workspaces
    const tasks = await reviewTasksRepo.getAllTasksDueForReminder();

    console.log(`[Scheduler] Found ${tasks.length} tasks due for reminders`);

    for (const task of tasks) {
      await processTaskReminder(task);
    }

    console.log('[Scheduler] Review reminder check completed');
  } catch (error) {
    console.error('[Scheduler] Error processing reminders:', error);
  }
}

async function processTaskReminder(task: ReviewTask): Promise<void> {
  try {
    // Get the associated document
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(
      task.workspaceId,
      task.documentId
    );

    if (!document) {
      console.warn(`[Scheduler] Document ${task.documentId} not found for task ${task.id}`);
      return;
    }

    const now = new Date();
    const dueDate = new Date(task.dueAt);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;

    const assigneeEmail = getUserEmail(task.assignee);

    // Send the reminder email
    const sent = await sendReminderEmail({
      task,
      document,
      assigneeEmail,
      daysUntilDue: Math.abs(daysUntilDue),
      isOverdue,
    });

    if (sent) {
      // Update the task to record when reminder was sent
      const sentAt = new Date().toISOString();
      await reviewTasksRepo.markReminderSent(task.workspaceId, task.id, sentAt);
      console.log(`[Scheduler] Reminder sent for task ${task.id} to ${assigneeEmail}`);
    }

    // If task is overdue and status is not already 'overdue', update it
    if (isOverdue && task.status !== 'overdue' && task.status !== 'completed' && task.status !== 'cancelled') {
      await reviewTasksRepo.updateReviewTaskStatus(task.workspaceId, task.id, 'overdue');
      console.log(`[Scheduler] Task ${task.id} marked as overdue`);
    }
  } catch (error) {
    console.error(`[Scheduler] Error processing task ${task.id}:`, error);
  }
}

let scheduledJob: nodeCron.ScheduledTask | null = null;

export function startReminderScheduler(): void {
  if (!SCHEDULER_ENABLED) {
    console.log('[Scheduler] Review reminder scheduler is disabled');
    return;
  }

  if (scheduledJob) {
    console.log('[Scheduler] Scheduler already running');
    return;
  }

  // Validate cron expression
  if (!nodeCron.validate(CHECK_INTERVAL_CRON)) {
    console.error(`[Scheduler] Invalid cron expression: ${CHECK_INTERVAL_CRON}`);
    return;
  }

  scheduledJob = nodeCron.schedule(CHECK_INTERVAL_CRON, processReminders);

  console.log(`[Scheduler] Review reminder scheduler started with cron: ${CHECK_INTERVAL_CRON}`);
}

export function stopReminderScheduler(): void {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('[Scheduler] Review reminder scheduler stopped');
  }
}

export async function runRemindersNow(): Promise<void> {
  console.log('[Scheduler] Manual reminder check triggered');
  await processReminders();
}

export function getSchedulerStatus(): { enabled: boolean; running: boolean; cronExpression: string } {
  return {
    enabled: SCHEDULER_ENABLED,
    running: scheduledJob !== null,
    cronExpression: CHECK_INTERVAL_CRON,
  };
}
