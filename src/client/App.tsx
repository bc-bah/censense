import { useEffect, useState } from 'react';
import type { CensusAnswer, Message, QuestionIntent } from '../shared/contracts';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildTranscriptMarkdown } from './transcript';
import StoryMap from './StoryMap';
import logoUrl from '../../assets/censussense-logo-lockup.png';
import iconUrl from '../../assets/censussense-app-icon.png';

const examples = [
  'What is the total population of New Hampshire counties?',
  'Which counties in Virginia have experienced the largest population growth?',
  'Compare median household income across five counties in Texas.',
  'Where in Virginia has the percentage of people working from home changed the most?',
];

type ApiMessage = { message: Message };

async function readApiMessage(response: Response): Promise<ApiMessage> {
  const payload = await response.json() as ApiMessage | { error?: { message?: string } };
  if (!response.ok || !('message' in payload)) throw new Error(payload.error?.message ?? 'The CensusSense request failed.');
  return payload;
}

export default function App() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingIntent, setPendingIntent] = useState<QuestionIntent>();
  const [busy, setBusy] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState<string>();
  const [expandedResults, setExpandedResults] = useState<string>();
  const [storyAnswer, setStoryAnswer] = useState<CensusAnswer>();

  useEffect(() => { void createConversation(); }, []);

  async function createConversation() {
    const response = await fetch('/api/conversations', { method: 'POST' });
    const data = await response.json() as { conversationId: string };
    setConversationId(data.conversationId);
  }

  async function ask(text = draft) {
    if (!conversationId || !text.trim() || busy) return;
    setBusy(true); setDraft('');
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await readApiMessage(response);
      setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', kind: 'question', text, createdAt: new Date().toISOString() }, data.message]);
      setPendingIntent(data.message.intent);
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', kind: 'error', text: error instanceof Error ? error.message : 'The CensusSense request failed.', createdAt: new Date().toISOString() }]);
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!conversationId || !pendingIntent || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: pendingIntent }) });
      const data = await readApiMessage(response);
      setMessages((current) => [...current, data.message]); setPendingIntent(undefined);
    } catch (error) {
      setPendingIntent(undefined);
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', kind: 'error', text: error instanceof Error ? `${error.message} Please ask the question again to refresh the interpretation.` : 'The interpretation expired. Please ask the question again.', createdAt: new Date().toISOString() }]);
    } finally { setBusy(false); }
  }

  function downloadTranscript() {
    const markdown = buildTranscriptMarkdown(messages);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url; link.download = `censussense-transcript-${stamp}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="CensusSense home"><img src={logoUrl} alt="CensusSense" /></a><div className="status"><span className="status-light" />Live Census connection</div></header>
    <section className="workspace">
      <aside className="intro-panel"><div className="hero-kicker"><span className="kicker-line" />Your questions, mapped to evidence</div><h1>Find the story in the numbers.</h1><p className="intro-copy">Ask about any state or territory in plain English. CensusSense translates your question, checks the official data, and lets you see exactly how the answer was made.</p><div className="signal-row"><span>01</span><span>Interpret</span><span>02</span><span>Verify</span><span>03</span><span>Decide</span></div><div className="rule" /><p className="micro-label">Start with an example</p><div className="example-list">{examples.map((example, index) => <button key={example} className="example" disabled={!conversationId || busy} onClick={() => void ask(example)}><span className="example-index">0{index + 1}</span><span>{example}</span><span className="example-arrow">↗</span></button>)}</div></aside>
      <section className="chat-panel"><div className="chat-heading"><div><p className="eyebrow">Research workspace</p><h2>Ask CensusSense</h2></div><div className="chat-heading-actions"><button className="download-transcript" onClick={downloadTranscript} disabled={!messages.length}>Download transcript ↓</button><span className="secure-label">Catalog-guarded · live data</span></div></div>
        <div className="transcript" aria-live="polite">
          {!messages.length && <div className="empty-state"><div className="empty-art"><img src={iconUrl} alt="" /></div><div className="empty-tag">Ready when you are</div><h3>What should we investigate?</h3><p>Ask about population, income, work, age, or another approved Census measure. We will show the interpretation before anything runs.</p></div>}
          {messages.map((item) => <MessageBubble key={item.id} item={item} evidenceOpen={evidenceOpen === item.id} resultsExpanded={expandedResults === item.id} onEvidence={() => setEvidenceOpen(evidenceOpen === item.id ? undefined : item.id)} onExpandResults={() => setExpandedResults(expandedResults === item.id ? undefined : item.id)} onTellStory={setStoryAnswer} />)}
          {busy && <div className="activity"><span className="pulse" /> Interpreting your question and checking Census data...</div>}
        </div>
        {pendingIntent && <div className="confirmation"><div><strong>Does this look right?</strong><span>{pendingIntent.metric.replaceAll('_', ' ')} · {pendingIntent.states?.join(', ') ?? pendingIntent.state ?? 'state or territory'} · {pendingIntent.years.join(' → ')}</span></div><button onClick={() => void confirm()}>Run analysis <span>→</span></button></div>}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything about Census data..." rows={2} disabled={busy} /><button aria-label="Send question" disabled={!draft.trim() || busy}>↑</button></form>
        <p className="composer-note">Plain English is welcome · You will review the interpretation first</p>
      </section>
    </section>
    {storyAnswer && <StoryMap answer={storyAnswer} onClose={() => setStoryAnswer(undefined)} />}
  </main>;
}

function MessageBubble({ item, evidenceOpen, resultsExpanded, onEvidence, onExpandResults, onTellStory }: { item: Message; evidenceOpen: boolean; resultsExpanded: boolean; onEvidence: () => void; onExpandResults: () => void; onTellStory: (answer: CensusAnswer) => void }) {
  const answer = item.answer as CensusAnswer | undefined;
  const visibleRows = resultsExpanded ? answer?.rows ?? [] : (answer?.rows ?? []).slice(0, 10);
  return <article className={`message ${item.role} ${item.kind}`}><div className="message-meta">{item.role === 'user' ? 'You' : item.kind === 'answer' ? 'CensusSense · verified result' : 'CensusSense'}</div><p>{item.text}</p>{item.kind === 'interpretation' && <div className="intent-chip">Interpretation ready <span>·</span> {item.intent?.operation} <small>{item.intent?.interpretationSource === 'ollama' ? 'AI interpretation' : 'Fallback interpretation'}</small></div>}{answer && <><button className="story-launch" onClick={() => onTellStory(answer)}>Tell me the story <span>↗</span></button><ResultChart answer={answer} /><div className="results" role="table" aria-label="Census results"><div className="results-head" role="row"><span>Rank</span><span>Community</span><span>Values</span></div>{visibleRows.map((row) => <div className="result-row" role="row" key={row.geography}><strong>{row.rank ?? '—'}</strong><span>{row.geography}</span><span>{Object.entries(row.values).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, ' $1')}: ${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`).join(' · ')}</span></div>)}</div>{answer.rows.length > 10 && <button className="show-results" onClick={onExpandResults}>{resultsExpanded ? 'Show top 10' : `Show all ${answer.rows.length} rows`} <span>{resultsExpanded ? '↑' : '↓'}</span></button>}{answer.warnings.length > 0 && <div className="warning">! {answer.warnings.join(' ')}</div>}<button className="evidence-toggle" onClick={onEvidence}>{evidenceOpen ? 'Hide evidence' : 'View evidence'} <span>{evidenceOpen ? '↑' : '↓'}</span></button>{evidenceOpen && <Evidence answer={answer} />}</>}</article>;
}

function ResultChart({ answer }: { answer: CensusAnswer }) {
  const availableKeys = Object.keys(answer.rows[0]?.values ?? {});
  const preferredKeys = ['percentChange', 'percentagePointChange', 'povertyRate', 'medianHouseholdIncome', 'population', 'olderPopulationShare'];
  const metricKey = preferredKeys.find((key) => availableKeys.includes(key)) ?? availableKeys.find((key) => !['baseline', 'later', 'change'].includes(key));
  if (!metricKey || answer.rows.length < 2) return null;
  const chartRows = answer.rows.slice(0, 10).map((row) => ({ geography: row.geography, value: row.values[metricKey] })).filter((row): row is { geography: string; value: number } => typeof row.value === 'number');
  if (chartRows.length < 2) return null;
  const label = metricKey.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  return <section className="result-chart" aria-label={`${label} chart`}><div className="result-chart-heading"><span>Quick view</span><strong>{label}</strong></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={Math.max(180, chartRows.length * 28)}><BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}><CartesianGrid horizontal={false} stroke="#d7e4ea" /><XAxis type="number" tick={{ fontSize: 10, fill: '#6d8195' }} tickLine={false} axisLine={false} /><YAxis dataKey="geography" type="category" width={105} tick={{ fontSize: 10, fill: '#102a51' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })} cursor={{ fill: 'rgba(53,201,208,.1)' }} /><Bar dataKey="value" fill="#1478d4" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></section>;
}

function Evidence({ answer }: { answer: CensusAnswer }) { return <div className="evidence"><div><span>Dataset</span><strong>{answer.evidence.dataset}</strong></div><div><span>Vintage</span><strong>{answer.evidence.vintage}</strong></div><div><span>Geography</span><strong>{answer.evidence.geography}</strong></div><div><span>Calculation</span><strong>{answer.evidence.calculation}</strong></div><div className="evidence-wide"><span>Filters</span><strong>{Object.entries(answer.evidence.filters).map(([key, value]) => `${key}: ${value}`).join(' · ')}</strong></div><div className="evidence-wide"><span>Variables</span><strong>{answer.evidence.variables.map((variable) => `${variable.id} · ${variable.label}`).join(' / ')}</strong></div><div className="evidence-wide"><span>Raw values</span><pre>{JSON.stringify(answer.evidence.rawValues.slice(0, 10), null, 2)}{answer.evidence.rawValues.length > 10 ? '\n... additional rows available in the result table' : ''}</pre></div><div className="evidence-wide source-links"><span>Source requests</span>{answer.evidence.requests.map((request) => <a key={request.vintage} href={request.url} target="_blank" rel="noreferrer">Open {request.vintage} ACS request ↗</a>)}</div></div>; }
