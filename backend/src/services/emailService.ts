import nodemailer from 'nodemailer';
import type { ReviewTask, GovernanceDocument } from '../types/models.js';

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'grc-system@company.com';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

export interface ReminderEmailData {
  task: ReviewTask;
  document: GovernanceDocument;
  assigneeEmail: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

export async function sendReminderEmail(data: ReminderEmailData): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    console.log(`[Email] Skipping email (disabled): Reminder for task ${data.task.id}`);
    return false;
  }

  const { task, document, assigneeEmail, daysUntilDue, isOverdue } = data;

  const subject = isOverdue
    ? `OVERDUE: Review required for "${document.title}"`
    : daysUntilDue === 0
    ? `TODAY: Review due for "${document.title}"`
    : `Reminder: Review due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} for "${document.title}"`;

  const urgencyText = isOverdue
    ? `This review task is OVERDUE. Please complete it as soon as possible.`
    : daysUntilDue === 0
    ? `This review task is due TODAY.`
    : `This review task is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isOverdue ? '#dc3545' : '#007bff'}; color: white; padding: 20px; border-radius: 4px 4px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; }
        .task-details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .action-button {
          display: inline-block;
          background: #28a745;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 15px;
        }
        .footer { font-size: 12px; color: #666; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">${isOverdue ? 'Overdue Review Task' : 'Review Task Reminder'}</h2>
        </div>
        <div class="content">
          <p>${urgencyText}</p>

          <div class="task-details">
            <p><span class="label">Task:</span> <span class="value">${task.title}</span></p>
            <p><span class="label">Document:</span> <span class="value">${document.title}</span></p>
            <p><span class="label">Document Type:</span> <span class="value">${document.docType}</span></p>
            <p><span class="label">Due Date:</span> <span class="value">${new Date(task.dueAt).toLocaleDateString()}</span></p>
            <p><span class="label">Assignee:</span> <span class="value">${task.assignee}</span></p>
            ${task.description ? `<p><span class="label">Description:</span> <span class="value">${task.description}</span></p>` : ''}
          </div>

          <p>Please review the document and complete the review task in the GRC system.</p>

          <div class="footer">
            <p>This is an automated reminder from the GRC Management System.</p>
            <p>Task ID: ${task.id} | Document ID: ${document.id}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${isOverdue ? 'OVERDUE REVIEW TASK' : 'REVIEW TASK REMINDER'}

${urgencyText}

Task: ${task.title}
Document: ${document.title}
Document Type: ${document.docType}
Due Date: ${new Date(task.dueAt).toLocaleDateString()}
Assignee: ${task.assignee}
${task.description ? `Description: ${task.description}` : ''}

Please review the document and complete the review task in the GRC system.

---
This is an automated reminder from the GRC Management System.
Task ID: ${task.id} | Document ID: ${document.id}
  `;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: assigneeEmail,
      subject,
      text,
      html,
    });

    console.log(`[Email] Sent reminder to ${assigneeEmail} for task ${task.id}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send reminder to ${assigneeEmail}:`, error);
    return false;
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    console.log('[Email] Email service is disabled');
    return false;
  }

  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    return false;
  }
}
