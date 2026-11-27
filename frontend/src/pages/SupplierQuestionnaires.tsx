import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiCall, fetchVendorQuestionnaire, fetchVendorQuestionnaireResponses, fetchVendorQuestionnaires } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Modal } from '../components/Modal';
import type { Vendor } from '../types/vendor';
import type { QuestionnaireStatus, VendorQuestionnaire, VendorQuestionnaireQuestion, VendorQuestionnaireResponse } from '../types/tprm';
import './SupplierQuestionnaires.css';

type Detail = VendorQuestionnaire & { questions: VendorQuestionnaireQuestion[] };
type Api<T> = { data: T; error: null };
const nextStatus: Partial<Record<QuestionnaireStatus, QuestionnaireStatus[]>> = {
  draft: ['sent'], sent: ['in_progress'], in_progress: ['submitted'], submitted: ['reviewed', 'in_progress'], reviewed: [],
};
const clean = (value: string) => value.replace(/_/g, ' ');
const message = (error: unknown) => error instanceof Error ? error.message : 'The questionnaire operation could not be completed.';

export function SupplierQuestionnaires() {
  const { workspaceId } = useWorkspace();
  const [records, setRecords] = useState<VendorQuestionnaire[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [responses, setResponses] = useState<Record<string, VendorQuestionnaireResponse>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'all' | 'instances' | 'templates'>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const workspaceRef = useRef(workspaceId); workspaceRef.current = workspaceId;
  const loadSequence = useRef(0), detailSequence = useRef(0), actionSequence = useRef(0), actionLock = useRef(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const sequence = ++loadSequence.current, capturedWorkspace = workspaceId;
    setLoading(true); setError('');
    try {
      const [questionnaires, vendorResult] = await Promise.all([
        fetchVendorQuestionnaires(),
        apiCall<Api<Vendor[]>>(`${API_BASE}/vendors`),
      ]);
      if (sequence !== loadSequence.current || capturedWorkspace !== workspaceRef.current) return;
      setRecords(questionnaires); setVendors(vendorResult.data.filter(vendor => !vendor.archivedAt));
    } catch (cause) {
      if (sequence === loadSequence.current && capturedWorkspace === workspaceRef.current) setError(message(cause));
    } finally {
      if (sequence === loadSequence.current && capturedWorkspace === workspaceRef.current) setLoading(false);
    }
  }, [workspaceId]);

  const openDetail = useCallback(async (record: VendorQuestionnaire, refreshAfterAction = false) => {
    if ((actionLock.current && !refreshAfterAction) || !workspaceId) return;
    const sequence = ++detailSequence.current, capturedWorkspace = workspaceId, capturedId = record.id;
    setSelected(null); setResponses({}); setDraftAnswers({}); setError('');
    try {
      const [detail, responseList] = await Promise.all([fetchVendorQuestionnaire(capturedId), fetchVendorQuestionnaireResponses(capturedId)]);
      if (sequence !== detailSequence.current || capturedWorkspace !== workspaceRef.current) return;
      setSelected(detail);
      setResponses(Object.fromEntries(responseList.map(response => [response.questionId, response])));
      setDraftAnswers(Object.fromEntries(responseList.map(response => [response.questionId, response.responseText || ''])));
    } catch (cause) {
      if (sequence === detailSequence.current && capturedWorkspace === workspaceRef.current) setError(message(cause));
    }
  }, [workspaceId]);

  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  useEffect(() => {
    detailSequence.current += 1; actionSequence.current += 1; actionLock.current = false;
    setSelected(null); setResponses({}); setDraftAnswers({}); setCreateOpen(false); setQuestionOpen(false); setBusy(false); setError('');
  }, [workspaceId]);

  const runAction = async (work: () => Promise<void>) => {
    if (actionLock.current || !workspaceId) return;
    const sequence = ++actionSequence.current, capturedWorkspace = workspaceId;
    actionLock.current = true; setBusy(true); setError('');
    try { await work(); }
    catch (cause) { if (sequence === actionSequence.current && capturedWorkspace === workspaceRef.current) setError(message(cause)); }
    finally { if (sequence === actionSequence.current) { actionLock.current = false; setBusy(false); } }
  };

  const refreshSelected = async (id: string) => {
    await load();
    if (workspaceRef.current === workspaceId) await openDetail({ id } as VendorQuestionnaire, true);
  };

  const transition = (next: QuestionnaireStatus) => runAction(async () => {
    const id = selected?.id; if (!id) return;
    await apiCall(`${API_BASE}/tprm/questionnaires/${encodeURIComponent(id)}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    await refreshSelected(id);
  });

  const saveResponse = (question: VendorQuestionnaireQuestion) => runAction(async () => {
    const id = selected?.id; if (!id) return;
    const responseText = (draftAnswers[question.id] || '').trim();
    if (question.isRequired && !responseText) throw new Error('A response is required before saving this question.');
    await apiCall(`${API_BASE}/tprm/questions/${encodeURIComponent(question.id)}/response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responseText }) });
    await refreshSelected(id);
  });

  const filtered = useMemo(() => records.filter(record => {
    const scopeMatches = scope === 'all' || (scope === 'templates' ? record.isTemplate : !record.isTemplate);
    const text = `${record.name} ${record.vendorName || ''} ${record.questionnaireType}`.toLowerCase();
    return scopeMatches && (!status || record.status === status) && (!search || text.includes(search.toLowerCase()));
  }), [records, scope, search, status]);
  const metrics = useMemo(() => ({ total: records.length, active: records.filter(record => !record.isTemplate && ['sent', 'in_progress'].includes(record.status)).length, review: records.filter(record => record.status === 'submitted').length, overdue: records.filter(record => record.dueDate && new Date(record.dueDate) < new Date() && !['submitted', 'reviewed'].includes(record.status)).length }), [records]);

  return <div className="questionnairePage">
    <header className="questionnaireHero"><div><span>SUPPLIER & CONTRACT MANAGEMENT / ASSURANCE</span><h1>Supplier Questionnaires</h1><p>Build reviewed due-diligence questionnaires, record supplier responses and preserve an independently approved outcome.</p></div><button className="questionnaireButton primary" disabled={busy} onClick={() => setCreateOpen(true)}>New questionnaire</button></header>
    <section className="questionnaireMetrics">
      <button onClick={() => { setScope('all'); setStatus(''); }}><span>Total questionnaires</span><strong>{metrics.total}</strong><small>Templates and supplier instances</small></button>
      <button onClick={() => { setScope('instances'); setStatus('in_progress'); }}><span>In progress</span><strong>{metrics.active}</strong><small>Open supplier response work</small></button>
      <button onClick={() => { setScope('instances'); setStatus('submitted'); }}><span>Awaiting review</span><strong>{metrics.review}</strong><small>Independent decision required</small></button>
      <button onClick={() => { setScope('instances'); setStatus(''); }}><span>Past due</span><strong>{metrics.overdue}</strong><small>Open records beyond due date</small></button>
    </section>
    {error ? <div className="questionnaireError" role="alert">{error}</div> : null}
    <section className="questionnaireToolbar">
      <input aria-label="Search supplier questionnaires" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questionnaire, supplier or type..." />
      <select aria-label="Questionnaire scope" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="all">All records</option><option value="instances">Supplier questionnaires</option><option value="templates">Templates</option></select>
      <select aria-label="Questionnaire status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['draft', 'sent', 'in_progress', 'submitted', 'reviewed'].map(value => <option key={value} value={value}>{clean(value)}</option>)}</select>
      <button className="questionnaireButton" onClick={() => { setSearch(''); setStatus(''); setScope('all'); }}>Clear filters</button>
    </section>
    <div className="questionnaireWorkspace">
      <section className="questionnaireTable" aria-busy={loading}>{loading ? <div className="questionnaireEmpty">Loading persisted questionnaires...</div> : filtered.length ? <table><thead><tr><th>Questionnaire</th><th>Supplier</th><th>Type</th><th>Progress</th><th>Due</th><th>Status</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id} tabIndex={0} className={selected?.id === record.id ? 'selected' : ''} onClick={() => void openDetail(record)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openDetail(record); } }}><td><strong>{record.name}</strong><small>{record.isTemplate ? 'Reusable template' : `${record.questionCount || 0} questions`}</small></td><td>{record.vendorName || (record.isTemplate ? 'Not applicable' : 'Not recorded')}</td><td>{clean(record.questionnaireType)}</td><td>{record.completionPercentage || 0}%</td><td>{record.dueDate || 'Not set'}</td><td><span className={`questionnaireBadge ${record.status}`}>{clean(record.status)}</span></td></tr>)}</tbody></table> : <div className="questionnaireEmpty">No persisted questionnaires match the selected filters.</div>}</section>
      {selected ? <aside className="questionnaireDetail" aria-busy={busy}><button className="questionnaireClose" aria-label="Close questionnaire detail" disabled={busy} onClick={() => setSelected(null)}>×</button><span>{selected.isTemplate ? 'TEMPLATE' : selected.vendorName || 'SUPPLIER QUESTIONNAIRE'}</span><h2>{selected.name}</h2><p>{selected.description || 'No description recorded.'}</p><div className="questionnaireFacts"><div><span>Status</span><strong>{clean(selected.status)}</strong></div><div><span>Completion</span><strong>{selected.completionPercentage || 0}%</strong></div><div><span>Questions</span><strong>{selected.questions.length}</strong></div><div><span>Due date</span><strong>{selected.dueDate || 'Not set'}</strong></div></div>
        {selected.status === 'draft' ? <button className="questionnaireButton" disabled={busy} onClick={() => setQuestionOpen(true)}>Add question</button> : null}
        <div className="questionList">{selected.questions.length ? selected.questions.map((question, index) => <article key={question.id}><header><span>{question.category}</span><strong>{index + 1}. {question.questionText}</strong>{question.guidance ? <small>{question.guidance}</small> : null}</header>{!selected.isTemplate && ['sent', 'in_progress'].includes(selected.status) ? <div className="answerRow">{question.questionType === 'yes_no' ? <select aria-label={`Response to ${question.questionText}`} value={draftAnswers[question.id] || ''} onChange={event => setDraftAnswers(current => ({ ...current, [question.id]: event.target.value }))}><option value="">Select response</option><option>Yes</option><option>No</option><option>Not applicable</option></select> : <textarea aria-label={`Response to ${question.questionText}`} value={draftAnswers[question.id] || ''} onChange={event => setDraftAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Record the supplier response" />}<button className="questionnaireButton" disabled={busy} onClick={() => void saveResponse(question)}>{responses[question.id] ? 'Update response' : 'Save response'}</button></div> : <p>{responses[question.id]?.responseText || 'No response recorded.'}</p>}</article>) : <div className="questionnaireEmpty compact">No questions have been added.</div>}</div>
        <div className="questionnaireActions">{(nextStatus[selected.status] || []).map(next => <button key={next} className="questionnaireButton primary" disabled={busy || (next === 'sent' && selected.questions.length === 0)} onClick={() => void transition(next)}>{busy ? 'Saving...' : next === 'reviewed' ? 'Approve independent review' : `Move to ${clean(next)}`}</button>)}</div>
      </aside> : <aside className="questionnaireDetail questionnaireEmpty">Select a questionnaire to review its questions, responses and governed lifecycle.</aside>}
    </div>
    {createOpen ? <QuestionnaireForm vendors={vendors} busy={busy} onClose={() => { if (!busy) setCreateOpen(false); }} onSubmit={data => runAction(async () => { await apiCall(`${API_BASE}/tprm/questionnaires`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (workspaceRef.current === workspaceId) { setCreateOpen(false); await load(); } })} /> : null}
    {questionOpen && selected ? <QuestionForm busy={busy} onClose={() => { if (!busy) setQuestionOpen(false); }} onSubmit={data => runAction(async () => { await apiCall(`${API_BASE}/tprm/questionnaires/${encodeURIComponent(selected.id)}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (workspaceRef.current === workspaceId) { setQuestionOpen(false); await refreshSelected(selected.id); } })} /> : null}
  </div>;
}

function QuestionnaireForm({ vendors, busy, onClose, onSubmit }: { vendors: Vendor[]; busy: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => Promise<void> | void }) {
  return <Modal accessibleDialog isOpen onClose={onClose} title="Create supplier questionnaire" width="680px"><form className="questionnaireForm" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const isTemplate = data.get('isTemplate') === 'on'; void onSubmit({ name: data.get('name'), description: data.get('description'), vendorId: isTemplate ? undefined : data.get('vendorId') || undefined, questionnaireType: data.get('questionnaireType'), dueDate: isTemplate ? undefined : data.get('dueDate') || undefined, isTemplate }); }}><fieldset disabled={busy}><label>Name<input name="name" required maxLength={160} /></label><label>Supplier<select name="vendorId"><option value="">No supplier (template only)</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label>Type<select name="questionnaireType">{['security', 'privacy', 'compliance', 'financial', 'operational'].map(value => <option key={value}>{value}</option>)}</select></label><label>Due date<input name="dueDate" type="date" /></label><label className="wide">Description<textarea name="description" maxLength={1000} /></label><label className="check wide"><input name="isTemplate" type="checkbox" /> Save as a reusable template (supplier and due date are ignored)</label><div className="questionnaireActions wide"><button type="button" className="questionnaireButton" onClick={onClose}>Cancel</button><button className="questionnaireButton primary" type="submit">{busy ? 'Saving...' : 'Create questionnaire'}</button></div></fieldset></form></Modal>;
}

function QuestionForm({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => Promise<void> | void }) {
  return <Modal accessibleDialog isOpen onClose={onClose} title="Add questionnaire question" width="680px"><form className="questionnaireForm" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSubmit({ category: data.get('category'), questionText: data.get('questionText'), questionType: data.get('questionType'), guidance: data.get('guidance'), isRequired: data.get('isRequired') === 'on', riskIfNegative: data.get('riskIfNegative') }); }}><fieldset disabled={busy}><label>Category<input name="category" required maxLength={100} /></label><label>Response type<select name="questionType"><option value="text">Text</option><option value="yes_no">Yes / No</option><option value="rating">Rating</option></select></label><label className="wide">Question<textarea name="questionText" required maxLength={1000} /></label><label className="wide">Guidance<textarea name="guidance" maxLength={1000} /></label><label>Risk if negative<select name="riskIfNegative"><option>low</option><option>medium</option><option>high</option></select></label><label className="check"><input name="isRequired" type="checkbox" defaultChecked /> Response required</label><div className="questionnaireActions wide"><button type="button" className="questionnaireButton" onClick={onClose}>Cancel</button><button className="questionnaireButton primary" type="submit">{busy ? 'Saving...' : 'Add question'}</button></div></fieldset></form></Modal>;
}
