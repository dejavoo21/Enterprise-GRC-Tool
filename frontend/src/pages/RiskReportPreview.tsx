import { useMemo } from 'react';
import type { RiskReportPack } from '../types/riskIntelligence';

export function RiskReportPreview({ json }: { json: string }) {
  const report = useMemo(() => {
    try { return JSON.parse(json) as RiskReportPack; } catch { return null; }
  }, [json]);
  if (!report || !Array.isArray(report.sections)) return <p role="alert">Report preview is unavailable.</p>;
  return <details className="rdReportPreview"><summary>Preview report pack</summary>
    <h3>{report.title}</h3>
    <p><strong>Draft - not approved.</strong> Generated {report.generatedAt}</p>
    {report.metadata && <dl className="rdFacts">
      <div><dt>Organisation</dt><dd>{report.metadata.workspace}</dd></div>
      <div><dt>Reporting period</dt><dd>{report.metadata.period}</dd></div>
      <div><dt>Prepared by</dt><dd>{report.metadata.preparedBy}</dd></div>
      <div><dt>Classification / template</dt><dd>{report.metadata.classification} / {report.metadata.version}</dd></div>
    </dl>}
    {report.sections.map((section, index) => <details key={`${index}-${section.heading}`}>
      <summary>{section.heading}{section.table ? ` (${section.table.rows.length} records)` : ''}</summary>
      {section.bullets.map((bullet, i) => <p key={i}>{bullet}</p>)}
      {section.table && <div className="rdTableScroll" role="region" aria-label={section.heading} tabIndex={0}>
        <table><caption>{section.heading}</caption><thead><tr>{section.table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          <tbody>{section.table.rows.length ? section.table.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value}</td>)}</tr>) : <tr><td colSpan={section.table.columns.length}>No records available from this source.</td></tr>}</tbody>
        </table>
      </div>}
    </details>)}
  </details>;
}
