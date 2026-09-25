import { Button } from '../components';
import { useEffect, useState } from 'react';
import { apiCall, API_BASE } from '../lib/api';
import { RiskReportPreview } from './RiskReportPreview';
import type { RiskWorkspaceViewProps } from './RiskWorkspaceViews';
import './RiskDecisionWorkspace.css';

const reportTypes = [
  ['risk_committee_report','Risk Committee Pack','Risk committee'],
  ['board_risk_report','Board Pack','Board'],
  ['executive_risk_summary','Operational Risk Summary','Executive management'],
  ['kri_report','KRI Report','Risk owners'],
  ['loss_event_report','Loss Event Report','Risk committee'],
] as const;

export function RiskReportsWorkspace(props: RiskWorkspaceViewProps) {
  const {state,reportType,setReportType,onExport,saving,treatmentSummary,onNavigate,preparedReport} = props;
  const selected = reportTypes.find(([key]) => key === reportType) || reportTypes[0];
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [emailOptions, setEmailOptions] = useState<{ workspaceId: string | null | undefined; enabled: boolean } | null>(null);
  const emailEnabled = Boolean(emailOptions && emailOptions.workspaceId === props.workspaceId && emailOptions.enabled);
  const consentKey = JSON.stringify([props.workspaceId, reportType, format]);
  const [consent, setConsent] = useState<string | null>(null);
  const confirmed = consent === consentKey;
  const setConfirmed = (value: boolean) => setConsent(value ? consentKey : null);
  const selectReport = (type: typeof reportTypes[number][0]) => { setConsent(null); setReportType(type); };
  useEffect(() => {
    let current = true;
    apiCall<{ data: { emailEnabled: boolean } }>(`${API_BASE}/risk-intelligence/reports/delivery-options`).then(result => {
      if (current) setEmailOptions({ workspaceId: props.workspaceId, enabled: result.data.emailEnabled });
    }).catch(() => { if (current) setEmailOptions({ workspaceId: props.workspaceId, enabled: false }); });
    return () => { current = false; };
  }, [props.workspaceId]);
  const metrics = [
    ['Reports generated','Not tracked','Persistent report history unavailable'],
    ['Outside appetite',state.risks.filter(risk => risk.appetiteStatus !== 'within_appetite').length,'Current register scope'],
    ['Critical risks',state.risks.filter(risk => risk.residualRating?.toLowerCase() === 'critical').length,'Recorded residual ratings only'],
    ['Open treatments',treatmentSummary.open,'Current treatment records'],
    ['Review overdue',state.risks.filter(risk => risk.reviewStatus === 'overdue').length,'Recorded overdue status'],
    ['Committee pack readiness','Not approved','Formal sign-off is not connected'],
  ];
  return <div className="rdWorkspace">
    <section className="rdMetrics rdMetrics--six" aria-label="Report summary">{metrics.map(([name,value,note]) => <article key={name}><span>{name}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <section className="rdToolbar rdReportControls" aria-label="Report controls">
      <label>Report type<select aria-label="Report type" value={reportType} onChange={event => selectReport(event.target.value as typeof reportTypes[number][0])}>{reportTypes.map(([value,title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label>Audience<input aria-label="Report audience" readOnly value={selected[2]}/></label>
      <label>Period<input aria-label="Report period" readOnly value="Current live snapshot"/></label>
      <label>Format<select aria-label="Report format" value={format} onChange={event => { setFormat(event.target.value as typeof format); setConfirmed(false); }}><option value="pdf">PDF document</option><option value="csv">CSV report summary</option><option value="json">JSON report data</option></select></label>
      <Button variant="primary" onClick={() => onExport(format)} disabled={saving}>{saving ? 'Preparing report...' : `Download ${format.toUpperCase()}`}</Button>
      <details className="rdExportScope"><summary>Export scope and formats</summary><p>Current snapshot only; historical period filtering is not available. Committee packs include structured tables and a full-register appendix. CSV uses section, record, field and value columns. Word and PowerPoint are not implemented.</p></details>
      <label className="rdReportEmailConsent"><input type="checkbox" checked={confirmed} disabled={!emailEnabled || saving} onChange={event => setConfirmed(event.target.checked)}/> Email this confidential report to my signed-in account address.</label>
      <Button variant="secondary" disabled={!emailEnabled || !confirmed || saving} onClick={() => { setConfirmed(false); onExport(format, 'email'); }}>Email me a copy</Button>
      {!emailEnabled && <p role="status">Email is unavailable: configured mail delivery and report-export access are required.</p>}
    </section>
    {preparedReport && <section className="rdCard" aria-label="Prepared report">
      <header><div><h2>Prepared report</h2><p>This session only. This is not a persisted or approved report.</p></div>
        <a className="rdTextButton" href={preparedReport.url} download={preparedReport.filename}>Download {preparedReport.filename}</a>
      </header>
      <RiskReportPreview json={preparedReport.json}/>
      <details><summary>Preview generated JSON</summary><pre style={{ maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preparedReport.json}</pre></details>
    </section>}
    <details className="rdCard" aria-label="Report readiness"><summary>Committee review readiness: Draft - not approved</summary><p>Generate a pack, then expand its preview to review tables and source limitations.</p>
      <dl className="rdFacts"><div><dt>Included in committee pack</dt><dd>Appetite, score paths, treatments, overdue reviews, forecasts, capacity, KRIs and appendices.</dd></div><div><dt>Sign-off</dt><dd>Prepared-by attribution available; reviewed-by and approved-by records not connected.</dd></div><div><dt>Distribution readiness</dt><dd>{emailEnabled ? 'Account-address email available with confirmation; inbox delivery requires verification.' : 'Downloads available. SMTP delivery unavailable or not authorized.'}</dd></div><div><dt>Scheduled reports</dt><dd>Not configured. Scheduling and automated distribution are not implemented.</dd></div></dl>
    </details>
    <div className="rdReportGrid">
      <section className="rdCard"><header><div><h2>Risk Committee Report</h2><p>Current snapshot, generated on demand. Review and approval remain manual.</p></div></header>
        <h3>Executive Summary / Key Insights</h3>{state.dashboard.executiveSummary.length ? state.dashboard.executiveSummary.map(item => <p key={item}>{item}</p>) : <p>No executive interpretation available for this scope.</p>}
        <dl className="rdFacts"><div><dt>Appetite position</dt><dd>{metrics[1][1]} outside appetite</dd></div><div><dt>Treatment progress</dt><dd>{treatmentSummary.total ? `${treatmentSummary.averageProgress}% average across ${treatmentSummary.total} plans` : 'No recorded treatments'}</dd></div><div><dt>Emerging risks</dt><dd>{state.emergingRisks.length} recorded</dd></div><div><dt>Readiness status</dt><dd>Data available; approval not assessed</dd></div></dl>
        <h3>Priority Risk References</h3><ul className="rdList">{state.dashboard.committeeView.topRisks.slice(0,4).map(risk => <li key={risk.id}><strong>{risk.riskRef || 'Reference not assigned'} · {risk.title}</strong><span>{risk.owner || 'Owner not assigned'}</span></li>)}</ul>
      </section>
      <section className="rdCard"><header><div><h2>Board View</h2><p>Material exposure and governance workload.</p></div></header><dl className="rdFacts">{[['High-risk vendors',state.dashboard.committeeView.highRiskVendors.length],['Critical assets',state.dashboard.committeeView.criticalAssets.length],['Open treatments',treatmentSummary.open],['Audit readiness areas not ready',state.dashboard.committeeView.auditFindings]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p className="rdNote">This is a reporting snapshot, not evidence of board approval or a signed committee pack.</p><Button variant="secondary" onClick={() => selectReport('board_risk_report')}>Select Board Pack</Button></section>
    </div>
    <section className="rdCard"><header><div><h2>Report Modules</h2><p>Select a supported report or review the live information for future appendices.</p></div></header><div className="rdReportModules">
      {reportTypes.slice(0,3).map(([key,title,audience]) => <article key={key}><h3>{title}</h3><p>{audience} · PDF, CSV or JSON export</p><button type="button" className="rdTextButton" aria-label={`Select ${title}`} onClick={() => selectReport(key)}>Select report</button></article>)}
      {([['Treatment Progress Appendix','treatments'],['Heatmap & Matrix Appendix','matrix'],['Trend & Forecast Report','intelligence']] as const).map(([title,tab]) => <article key={tab}><h3>{title}</h3><p>Review live data. Dedicated document export is not available.</p><button type="button" className="rdTextButton" aria-label={`Review source data for ${title}`} onClick={() => onNavigate(tab)}>Review source data</button></article>)}
    </div></section>
    <section className="rdCard"><header><div><h2>Recent Reports</h2><p>A persisted report-generation history is not connected to this module.</p></div></header><div className="rdTableScroll" role="region" aria-label="Recent reports" tabIndex={0}><table><thead><tr>{['Report name','Audience','Period','Format','Generated','Owner','Status','Actions'].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody><tr><td colSpan={8}>No report-history data is available. Downloads are not listed as persisted reports.</td></tr></tbody></table></div><footer><Button variant="outline" disabled>Word / PowerPoint · Future capability</Button></footer></section>
  </div>;
}
