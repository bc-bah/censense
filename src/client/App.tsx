import { useEffect, useState } from 'react';
import type { CensusAnswer, Message, QuestionIntent } from '../shared/contracts';

const examples = [
  'Which counties in Virginia have experienced the largest population growth?',
  'Where has the percentage of people working from home changed the most?',
  'Compare median household income across Fairfax County, Loudoun County, Henrico County, Chesterfield County, and Arlington County.',
  'Which communities have both an aging population and relatively low household income?',
];

type ApiMessage = { message: Message };

export default function App() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingIntent, setPendingIntent] = useState<QuestionIntent>();
  const [busy, setBusy] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState<string>();

  useEffect(() => { void createConversation(); }, []);

  async function createConversation() {
    const response = await fetch('/api/conversations', { method: 'POST' });
    const data = await response.json() as { conversationId: string };
    setConversationId(data.conversationId);
  }

  async function ask(text = draft) {
    if (!conversationId || !text.trim() || busy) return;
    setBusy(true); setDraft('');
    const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const data = await response.json() as ApiMessage;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', kind: 'question', text, createdAt: new Date().toISOString() }, data.message]);
    setPendingIntent(data.message.intent);
    setBusy(false);
  }

  async function confirm() {
    if (!conversationId || !pendingIntent || busy) return;
    setBusy(true);
    const response = await fetch(`/api/conversations/${conversationId}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: pendingIntent }) });
    const data = await response.json() as ApiMessage;
    setMessages((current) => [...current, data.message]); setPendingIntent(undefined); setBusy(false);
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark"><span className="brand-dot" />CensusSense</div><div className="status"><span className="status-light" />Local fallback active</div></header>
    <section className="workspace">
      <aside className="intro-panel"><p className="eyebrow">Evidence-backed Census research</p><h1>Ask a sharper question.</h1><p className="intro-copy">Ask about an approved Census metric in your own words, for any state or territory. CensusSense interprets the request, shows its plan, and keeps the source, formula, and caveats in view.</p><div className="rule" /><p className="micro-label">Example questions</p><div className="example-list">{examples.map((example) => <button key={example} className="example" onClick={() => void ask(example)}>{example}<span>↗</span></button>)}</div></aside>
      <section className="chat-panel"><div className="chat-heading"><div><p className="eyebrow">Research workspace</p><h2>Conversation</h2></div><span className="secure-label">Deterministic tools · v0.1</span></div>
        <div className="transcript" aria-live="polite">
          {!messages.length && <div className="empty-state"><div className="empty-icon">⌁</div><h3>What should we investigate?</h3><p>Start with a Virginia county comparison. CensusSense will show its interpretation before any data is calculated.</p></div>}
          {messages.map((item) => <MessageBubble key={item.id} item={item} evidenceOpen={evidenceOpen === item.id} onEvidence={() => setEvidenceOpen(evidenceOpen === item.id ? undefined : item.id)} />)}
          {busy && <div className="activity"><span className="pulse" /> Checking the approved Census catalog and calculating...</div>}
        </div>
        {pendingIntent && <div className="confirmation"><div><strong>Ready to run this interpretation?</strong><span>{pendingIntent.metric.replaceAll('_', ' ')} · {pendingIntent.years.join(' → ')}</span></div><button onClick={() => void confirm()}>Run analysis <span>→</span></button></div>}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about Census data..." rows={2} disabled={busy} /><button aria-label="Send question" disabled={!draft.trim() || busy}>↑</button></form>
        <p className="composer-note">Ask in plain English · The local model can interpret questions beyond these examples</p>
      </section>
    </section>
  </main>;
}

function MessageBubble({ item, evidenceOpen, onEvidence }: { item: Message; evidenceOpen: boolean; onEvidence: () => void }) {
  const answer = item.answer as CensusAnswer | undefined;
  return <article className={`message ${item.role} ${item.kind}`}><div className="message-meta">{item.role === 'user' ? 'You' : item.kind === 'answer' ? 'CensusSense · verified result' : 'CensusSense'}</div><p>{item.text}</p>{item.kind === 'interpretation' && <div className="intent-chip">Interpretation ready <span>·</span> {item.intent?.operation}</div>}{answer && <><div className="results"><div className="results-head"><span>Rank</span><span>Community</span><span>Values</span></div>{answer.rows.map((row) => <div className="result-row" key={row.geography}><strong>{row.rank ?? '—'}</strong><span>{row.geography}</span><span>{Object.entries(row.values).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, ' $1')}: ${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`).join(' · ')}</span></div>)}</div>{answer.warnings.length > 0 && <div className="warning">! {answer.warnings.join(' ')}</div>}<button className="evidence-toggle" onClick={onEvidence}>{evidenceOpen ? 'Hide evidence' : 'View evidence'} <span>{evidenceOpen ? '↑' : '↓'}</span></button>{evidenceOpen && <Evidence answer={answer} />}</>}</article>;
}

function Evidence({ answer }: { answer: CensusAnswer }) { return <div className="evidence"><div><span>Dataset</span><strong>{answer.evidence.dataset}</strong></div><div><span>Vintage</span><strong>{answer.evidence.vintage}</strong></div><div><span>Geography</span><strong>{answer.evidence.geography}</strong></div><div><span>Calculation</span><strong>{answer.evidence.calculation}</strong></div><div className="evidence-wide"><span>Variables</span><strong>{answer.evidence.variables.map((variable) => `${variable.id} · ${variable.label}`).join(' / ')}</strong></div><a href={answer.evidence.requestUrl} target="_blank" rel="noreferrer">Open source request ↗</a></div>; }
