/**
 * Board Report Export Service
 *
 * Generates Markdown, HTML, and PDF exports of board report data
 * for executive stakeholders.
 */

import { Marked } from 'marked';
import PDFDocument from 'pdfkit';
import type { BoardReportData, BoardReportAudience } from '../types/boardReport.js';

// ============================================
// TYPES
// ============================================

export interface BoardReportExport {
  markdown: string;
  html: string;
}

// ============================================
// MARKDOWN GENERATION
// ============================================

/**
 * Build a Markdown document from BoardReportData and AI narrative
 */
export function buildBoardReportMarkdown(
  data: BoardReportData,
  narrative: string,
  audience: BoardReportAudience
): string {
  const audienceLabel = {
    board: 'Board of Directors',
    audit_committee: 'Audit Committee',
    regulator: 'Regulatory Submission',
  }[audience];

  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate aggregate metrics
  const totalControls = data.frameworks.reduce((sum, f) => sum + f.totalControls, 0);
  const totalImplemented = data.frameworks.reduce((sum, f) => sum + f.implemented, 0);
  const totalWithEvidence = data.frameworks.reduce((sum, f) => sum + f.controlsWithEvidence, 0);
  const totalWithPolicy = data.frameworks.reduce((sum, f) => sum + f.controlsWithPolicy, 0);
  const totalWithTraining = data.frameworks.reduce((sum, f) => sum + f.controlsWithTraining, 0);
  const overallImplRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;
  const evidenceCoverage = totalControls > 0 ? Math.round((totalWithEvidence / totalControls) * 100) : 0;
  const policyCoverage = totalControls > 0 ? Math.round((totalWithPolicy / totalControls) * 100) : 0;
  const trainingCoverage = totalControls > 0 ? Math.round((totalWithTraining / totalControls) * 100) : 0;

  let md = `# Executive Security & Compliance Report\n\n`;
  md += `**Workspace:** ${data.workspaceName || data.workspaceId}\n`;
  md += `**Generated:** ${generatedDate}\n`;
  md += `**Audience:** ${audienceLabel}\n\n`;
  md += `---\n\n`;

  // 1. Executive Narrative (AI-generated)
  md += `## 1. Executive Narrative\n\n`;
  if (narrative && narrative.trim()) {
    md += `${narrative}\n\n`;
  } else {
    md += `*No AI narrative available.*\n\n`;
  }
  md += `---\n\n`;

  // 2. Risk Posture
  md += `## 2. Risk Posture\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Risks | ${data.riskSummary.totalRisks} |\n`;
  md += `| High Severity | ${data.riskSummary.highRisks} |\n`;
  md += `| Medium Severity | ${data.riskSummary.mediumRisks} |\n`;
  md += `| Low Severity | ${data.riskSummary.lowRisks} |\n`;
  md += `| Open | ${data.riskSummary.openRisks} |\n`;
  md += `| Closed | ${data.riskSummary.closedRisks} |\n\n`;

  if (data.riskSummary.topRisks.length > 0) {
    md += `### Top Risks\n\n`;
    for (const risk of data.riskSummary.topRisks) {
      md += `- **${risk.id}**: ${risk.title} (Score: ${risk.severityScore}, Status: ${risk.status}, Linked Controls: ${risk.linkedControlsCount})\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;

  // 3. Controls & Framework Coverage
  md += `## 3. Controls & Framework Coverage\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Controls | ${totalControls} |\n`;
  md += `| Implemented | ${overallImplRate}% (${totalImplemented}/${totalControls}) |\n`;
  md += `| Evidence Coverage | ${evidenceCoverage}% |\n`;
  md += `| Policy Coverage | ${policyCoverage}% |\n`;
  md += `| Training Coverage | ${trainingCoverage}% |\n\n`;

  if (data.frameworks.length > 0) {
    md += `### Framework Breakdown\n\n`;
    md += `| Framework | Total | Implemented | In Progress | Not Impl. | N/A | Evidence | Policy | Training |\n`;
    md += `|-----------|-------|-------------|-------------|-----------|-----|----------|--------|----------|\n`;
    for (const fw of data.frameworks) {
      const implRate = fw.totalControls > 0 ? Math.round((fw.implemented / fw.totalControls) * 100) : 0;
      md += `| ${fw.frameworkName} (${fw.frameworkCode}) | ${fw.totalControls} | ${fw.implemented} (${implRate}%) | ${fw.inProgress} | ${fw.notImplemented} | ${fw.notApplicable} | ${fw.controlsWithEvidence} | ${fw.controlsWithPolicy} | ${fw.controlsWithTraining} |\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;

  // 4. Policy & Governance
  md += `## 4. Policy & Governance\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Documents | ${data.policySummary.totalDocuments} |\n`;
  md += `| Approved | ${data.policySummary.approved} |\n`;
  md += `| In Review | ${data.policySummary.inReview} |\n`;
  md += `| Overdue Reviews | ${data.policySummary.overdueReviews} |\n`;
  md += `| Due in Next 30 Days | ${data.policySummary.dueNext30Days} |\n\n`;

  if (data.policySummary.overdueReviews > 0) {
    md += `> **⚠️ Attention Required:** ${data.policySummary.overdueReviews} document(s) are overdue for review.\n\n`;
  }
  md += `---\n\n`;

  // 5. Training & Awareness
  md += `## 5. Training & Awareness\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Overall Completion Rate | ${data.trainingSummary.overallCompletionRate}% |\n`;
  md += `| Overdue Assignments | ${data.trainingSummary.overdueAssignments} |\n`;
  md += `| Active Campaigns | ${data.trainingSummary.activeCampaigns} |\n`;
  if (data.trainingSummary.lastPhishClickRate !== undefined) {
    md += `| Last Phishing Click Rate | ${data.trainingSummary.lastPhishClickRate}% |\n`;
  }
  md += `\n`;

  if (data.trainingSummary.overdueAssignments > 0) {
    md += `> **⚠️ Attention Required:** ${data.trainingSummary.overdueAssignments} training assignment(s) are overdue.\n\n`;
  }
  md += `---\n\n`;

  // 6. AI & Data Protection
  md += `## 6. AI & Data Protection\n\n`;

  const aiFrameworks = data.aiPrivacySummary.aiHealthcareSummary?.frameworks || [];
  const privacyFrameworks = data.aiPrivacySummary.dataProtectionSummary?.frameworks || [];

  if (aiFrameworks.length > 0 || privacyFrameworks.length > 0) {
    if (aiFrameworks.length > 0) {
      md += `**AI/Healthcare Frameworks:** ${aiFrameworks.join(', ')}\n`;
      if (data.aiPrivacySummary.aiHealthcareSummary?.overallScore !== undefined && data.aiPrivacySummary.aiHealthcareSummary?.overallScore !== null) {
        md += `- Overall Score: ${data.aiPrivacySummary.aiHealthcareSummary.overallScore}%\n`;
      }
      md += `\n`;
    }

    if (privacyFrameworks.length > 0) {
      md += `**Data Protection Frameworks:** ${privacyFrameworks.join(', ')}\n`;
      if (data.aiPrivacySummary.dataProtectionSummary?.overallScore !== undefined && data.aiPrivacySummary.dataProtectionSummary?.overallScore !== null) {
        md += `- Overall Score: ${data.aiPrivacySummary.dataProtectionSummary.overallScore}%\n`;
      }
      md += `\n`;
    }
  } else {
    md += `*No AI/Healthcare or Data Protection frameworks configured.*\n\n`;
  }

  md += `---\n\n`;
  md += `*Report generated on ${generatedDate}. This document is confidential and intended for ${audienceLabel.toLowerCase()} use only.*\n`;

  return md;
}

// ============================================
// HTML GENERATION
// ============================================

/**
 * Convert Markdown to HTML and wrap with styling
 */
export function buildBoardReportHtml(
  data: BoardReportData,
  markdown: string
): string {
  const marked = new Marked();
  const htmlContent = marked.parse(markdown);

  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Security & Compliance Report - ${data.workspaceName || data.workspaceId}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background-color: #f9fafb;
    }
    h1 {
      color: #1a365d;
      border-bottom: 3px solid #3182ce;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    h2 {
      color: #2c5282;
      margin-top: 32px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    h3 {
      color: #4a5568;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background-color: #edf2f7;
      font-weight: 600;
      color: #2d3748;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background-color: #f7fafc;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    blockquote {
      margin: 16px 0;
      padding: 12px 16px;
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
    }
    blockquote p {
      margin: 0;
      color: #92400e;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 24px 0;
    }
    strong {
      color: #1a202c;
    }
    code {
      background-color: #edf2f7;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .header-meta {
      color: #718096;
      font-size: 0.9em;
    }
    @media print {
      body {
        background-color: white;
        max-width: 100%;
        padding: 20px;
      }
      table {
        box-shadow: none;
        border: 1px solid #e2e8f0;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 0.85em;">
    <p>Generated by GRC Tool on ${generatedDate}</p>
  </footer>
</body>
</html>`;

  return html;
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Build a PDF buffer from the markdown content
 * Uses PDFKit for simple text-based PDF generation
 */
export async function buildBoardReportPdfBuffer(
  markdown: string,
  data: BoardReportData,
  audience: BoardReportAudience
): Promise<Buffer> {
  const audienceLabel = {
    board: 'Board of Directors',
    audit_committee: 'Audit Committee',
    regulator: 'Regulatory Submission',
  }[audience];

  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    info: {
      Title: 'Executive Security & Compliance Report',
      Author: 'GRC Tool',
      Subject: `Board Report for ${data.workspaceName || data.workspaceId}`,
      Creator: 'GRC Tool Export Service',
    }
  });

  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(20)
       .fillColor('#1a365d')
       .text('Executive Security & Compliance Report', { underline: true });

    doc.moveDown(0.5);

    // Metadata
    doc.fontSize(10)
       .fillColor('#666666')
       .text(`Workspace: ${data.workspaceName || data.workspaceId}`)
       .text(`Generated: ${generatedDate}`)
       .text(`Audience: ${audienceLabel}`);

    doc.moveDown(1);

    // Horizontal line
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.moveDown(1);

    // Parse and render markdown content
    // Simple approach: render as formatted text with basic styling
    const lines = markdown.split('\n');

    for (const line of lines) {
      // Skip empty lines but add spacing
      if (!line.trim()) {
        doc.moveDown(0.3);
        continue;
      }

      // Handle horizontal rules
      if (line.trim() === '---') {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .strokeColor('#e2e8f0')
           .stroke();
        doc.moveDown(0.5);
        continue;
      }

      // Handle headings
      if (line.startsWith('# ')) {
        doc.moveDown(0.5);
        doc.fontSize(18)
           .fillColor('#1a365d')
           .text(line.substring(2).trim());
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        doc.fontSize(14)
           .fillColor('#2c5282')
           .text(line.substring(3).trim());
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        doc.fontSize(12)
           .fillColor('#4a5568')
           .text(line.substring(4).trim());
        doc.moveDown(0.2);
        continue;
      }

      // Handle bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.fontSize(10)
           .fillColor('#333333')
           .text(`  • ${line.substring(2).trim()}`, { indent: 10 });
        continue;
      }

      // Handle numbered lists
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        doc.fontSize(10)
           .fillColor('#333333')
           .text(`  ${numberedMatch[1]}. ${numberedMatch[2]}`, { indent: 10 });
        continue;
      }

      // Handle blockquotes (warnings)
      if (line.startsWith('>')) {
        doc.fontSize(10)
           .fillColor('#92400e')
           .text(line.substring(1).trim(), { indent: 15 });
        continue;
      }

      // Handle table headers and rows (simplified - just render as text)
      if (line.startsWith('|')) {
        // Skip separator rows
        if (line.includes('---')) continue;

        const cells = line.split('|').filter(c => c.trim());
        const rowText = cells.map(c => c.trim()).join('  |  ');
        doc.fontSize(9)
           .fillColor('#333333')
           .text(rowText, { indent: 5 });
        continue;
      }

      // Handle bold text indicators
      if (line.startsWith('**') && line.includes(':**')) {
        doc.fontSize(10)
           .fillColor('#1a202c')
           .text(line.replace(/\*\*/g, ''));
        continue;
      }

      // Regular paragraph text
      doc.fontSize(10)
         .fillColor('#333333')
         .text(line.replace(/\*\*/g, '').replace(/\*/g, ''), { align: 'left' });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8)
       .fillColor('#999999')
       .text(`Generated by GRC Tool on ${generatedDate}`, { align: 'center' });

    doc.end();
  });
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Build complete export package (Markdown + HTML)
 */
export function buildBoardReportExport(
  data: BoardReportData,
  narrative: string,
  audience: BoardReportAudience
): BoardReportExport {
  const markdown = buildBoardReportMarkdown(data, narrative, audience);
  const html = buildBoardReportHtml(data, markdown);
  return { markdown, html };
}
