import PDFDocument from 'pdfkit';
import type { RiskReportPack } from '../types/riskIntelligence.js';

export const riskReportTypes = ['risk_committee_report', 'board_risk_report', 'executive_risk_summary', 'kri_report', 'loss_event_report'] as const;
export type RiskExportFormat = 'json' | 'csv' | 'pdf';
export const isRiskExportFormat = (value: unknown): value is RiskExportFormat => value === 'json' || value === 'csv' || value === 'pdf';

function csvCell(value: string) {
  // Prevent spreadsheet formula execution, including leading control characters.
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportRiskReport(pack: RiskReportPack, format: RiskExportFormat) {
  const filename = `${pack.reportType.replaceAll('_', '-')}.${format}`;
  if (format === 'json') return { filename, contentType: 'application/json', content: Buffer.from(JSON.stringify(pack, null, 2)) };
  if (format === 'csv') {
    const prefix = [pack.title, pack.generatedAt, pack.metadata?.period || 'Current snapshot'];
    const rows = [['Report', 'Generated at', 'Period', 'Section', 'Record', 'Field', 'Value'],
      ...Object.entries(pack.metadata || {}).map(([field, value]) => [...prefix, 'Report metadata', '', field, value]),
      ...pack.sections.flatMap(section => [
        ...section.bullets.map(detail => [...prefix, section.heading, '', 'Narrative', detail]),
        ...(section.table ? section.table.rows.flatMap((row, index) => row.map((value, column) => [...prefix, section.heading, String(index + 1), section.table!.columns[column], value])) : []),
        ...(!section.bullets.length && !section.table?.rows.length ? [[...prefix, section.heading, '', 'Availability', 'No records available']] : []),
      ])];
    return { filename, contentType: 'text/csv; charset=utf-8', content: Buffer.from('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')) };
  }
  const content = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: pack.metadata ? 'landscape' : 'portrait', margin: 48, bufferPages: true, info: { Title: pack.title, Author: 'LAFLO Enterprise GRC' } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fillColor('#2454a6').fontSize(10).text('LAFLO / RISK MANAGEMENT');
    doc.moveDown().fillColor('#14233d').fontSize(22).text(pack.title);
    doc.moveDown(0.5).fillColor('#52627a').fontSize(9).text(`Generated: ${pack.generatedAt}\nPeriod: ${pack.metadata?.period || 'current snapshot'}. Draft - not approved.`);
    if (pack.metadata) doc.moveDown(0.5).text(`Organisation: ${pack.metadata.workspace}\nPrepared by: ${pack.metadata.preparedBy}\nClassification: ${pack.metadata.classification} | Template version: ${pack.metadata.version}`);
    const width = doc.page.width - 96;
    const bottom = doc.page.height - 65;
    let currentHeading = '';
    const newPage = () => {
      doc.addPage(); doc.x = 48;
      doc.fillColor('#52627a').fontSize(8).text(`${pack.title} | ${currentHeading}`, 48, 28, { lineBreak: false });
      doc.x = 48; doc.y = 48;
    };
    // Split wide tables into keyed column groups rather than shrinking committee text.
    const drawTable = (table: NonNullable<RiskReportPack['sections'][number]['table']>) => {
      const groups: number[][] = [];
      for (let start = 1; start < table.columns.length; start += 6) groups.push([0, ...table.columns.slice(start, start + 6).map((_, i) => start + i)]);
      if (table.columns.length === 1) groups.push([0]);
      for (const [part, group] of groups.entries()) {
        if (doc.y + 115 > bottom) newPage();
        if (part) { doc.y += 14; doc.fontSize(9).fillColor('#52627a').text(`Continued columns - ${table.columns[0]} repeated for reference`, 48, doc.y); }
        const cellWidth = width / group.length;
        const lines = (value: string): string[] => {
          doc.fontSize(9);
          const output: string[] = [];
          for (const paragraph of value.split('\n')) {
            let line = '';
            for (const word of paragraph.split(/\s+/)) {
              if (line && doc.widthOfString(`${line} ${word}`) > cellWidth - 14) { output.push(line); line = ''; }
              if (doc.widthOfString(word) > cellWidth - 14) {
                for (const character of word) {
                  if (line && doc.widthOfString(line + character) > cellWidth - 14) { output.push(line); line = ''; }
                  line += character;
                }
              } else line = line ? `${line} ${word}` : word;
            }
            output.push(line);
          }
          return output;
        };
        const draw = (cells: string[][], header = false, stripe = false) => {
          const height = Math.max(...cells.map(cell => cell.length), 1) * 12 + 12;
          const y = doc.y;
          doc.rect(48, y, width, height).fill(header ? '#eaf0fa' : stripe ? '#f6f8fc' : '#ffffff');
          cells.forEach((cell, i) => cell.forEach((line, j) => doc.fillColor(header ? '#244b85' : '#14233d').fontSize(9).text(line, 55 + i * cellWidth, y + 6 + j * 12, { lineBreak: false })));
          doc.moveTo(48, y + height).lineTo(48 + width, y + height).lineWidth(0.4).strokeColor('#dce4ef').stroke();
          doc.x = 48; doc.y = y + height;
        };
        const header = group.map(index => lines(table.columns[index]));
        if (doc.y + 90 > bottom) newPage();
        draw(header, true);
        if (!table.rows.length) { doc.y += 8; doc.fillColor('#52627a').fontSize(9).text('No records available from this report source.', 48, doc.y); }
        table.rows.forEach((row, rowIndex) => {
          const cells = group.map(index => lines(row[index] || 'Not set'));
          const count = Math.max(...cells.map(cell => cell.length));
          for (let offset = 0; offset < count; offset += 20) {
            const chunk = cells.map((cell, i) => i === 0 && offset ? lines(`${row[0]} (continued)`).slice(0, 20) : cell.slice(offset, offset + 20));
            const height = Math.max(...chunk.map(cell => cell.length), 1) * 12 + 12;
            if (doc.y + height > bottom) { newPage(); draw(header, true); }
            draw(chunk, false, rowIndex % 2 === 1);
          }
        });
        doc.y += 12;
      }
    };
    let appendixStarted = false;
    for (const section of pack.sections) {
      currentHeading = section.heading;
      if (section.appendix && !appendixStarted) { newPage(); appendixStarted = true; }
      const tableLead = section.table && section.table.columns.length <= 7 && section.table.rows.length <= 8
        ? Math.max(115, 48 + section.table.rows.reduce((height, row) => height + Math.max(...row.map(value => doc.fontSize(9).heightOfString(value, { width: width / section.table!.columns.length - 14 })), 12) + 12, 0))
        : section.table ? 110 : 20;
      const introHeight = doc.fontSize(13).heightOfString(section.heading, { width }) + section.bullets.reduce((height, bullet) => height + doc.fontSize(10).heightOfString(bullet, { width }) + 8, 0) + tableLead + 30;
      if (doc.y + Math.min(introHeight, bottom - 48) > bottom) newPage();
      doc.moveDown().fillColor('#2454a6').fontSize(13).text(section.heading);
      doc.moveDown(0.4).fillColor('#14233d').fontSize(10);
      for (const bullet of section.bullets) doc.text(bullet, { paragraphGap: 8 });
      if (section.table) drawTable(section.table);
    }
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#52627a').fontSize(8).text(`Confidential | Draft - not approved | Page ${i + 1} of ${pages.count}`, 48, doc.page.height - 30, { lineBreak: false });
    }
    doc.end();
  });
  return { filename, contentType: 'application/pdf', content };
}
