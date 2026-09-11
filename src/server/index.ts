import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Conversation, Message, QuestionIntent } from '../shared/contracts.js';
import { parseQuestion } from '../interpretation/fallbackParser.js';
import { runCensusIntent } from '../census/client.js';
import { defaultYearsForOperation, metricCatalog } from '../census/catalog.js';
import { createOllamaClient } from './ollamaClient.js';
import { resolveStateFips } from '../census/states.js';

const app = express();
app.use(express.json());
const conversations = new Map<string, Conversation>();
const ollama = createOllamaClient();
const supportedMetrics = Object.keys(metricCatalog);

function validateIntent(intent: QuestionIntent): string | undefined {
  if (!supportedMetrics.includes(intent.metric)) return `The requested metric is not in the approved Census catalog. Available metrics: ${supportedMetrics.join(', ')}.`;
  if (intent.geography !== 'county') return 'Only county-level Census geography is configured for this application.';
  try { resolveStateFips(intent.state); } catch (error) { return error instanceof Error ? error.message : 'A valid state is required.'; }
  if (!Array.isArray(intent.years) || intent.years.length === 0 || intent.years.some((year) => !/^\d{4}$/.test(year))) return 'The Census years must be supplied as four-digit years.';
  if ((intent.operation === 'growth' || intent.operation === 'change') && intent.years.length < 2) return 'This comparison requires a baseline year and a later year.';
  if (intent.metric === 'median_household_income' && intent.operation === 'compare' && (!intent.counties || intent.counties.length < 2) && !intent.limit) return 'A named-county income comparison requires at least two counties.';
  return undefined;
}

function message(role: Message['role'], kind: Message['kind'], text: string, extra: Partial<Message> = {}): Message {
  return { id: randomUUID(), role, kind, text, createdAt: new Date().toISOString(), ...extra };
}

app.post('/api/conversations', (_request, response) => {
  const id = randomUUID();
  conversations.set(id, { id, messages: [] });
  response.json({ conversationId: id });
});

app.post('/api/conversations/:id/messages', async (request, response) => {
  const conversation = conversations.get(request.params.id);
  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
  if (!conversation || !text) return response.status(400).json({ error: { code: 'INVALID_INTENT', message: 'A conversation and question are required.' } });
  conversation.messages.push(message('user', 'question', text));
  let parsed: Awaited<ReturnType<typeof parseQuestion>>;
  const fallback = parseQuestion(text, conversation.pendingIntent);
  try {
    const modelIntent = await ollama.generateIntent({ question: text, messages: conversation.messages, supportedMetrics });
    const deterministicIncomeIntent = 'intent' in fallback && fallback.intent.metric === 'median_household_income' ? fallback : undefined;
    parsed = modelIntent
      ? deterministicIncomeIntent ?? {
        intent: { ...modelIntent, years: modelIntent.years.length ? modelIntent.years : defaultYearsForOperation(modelIntent.operation), interpretationSource: 'ollama' },
        text: `I mapped your question to approved Census metrics using ${modelIntent.years.join(' and ') || defaultYearsForOperation(modelIntent.operation).join(' and ')} ACS data. Review the interpretation before running it.`,
      }
      : fallback;
  } catch {
    parsed = fallback;
  }
  if ('clarification' in parsed) {
    conversation.pendingIntent = parsed.pendingIntent;
    const reply = message('assistant', 'clarification', parsed.clarification);
    conversation.messages.push(reply);
    return response.json({ message: reply });
  }
  if ('unsupported' in parsed) {
    const reply = message('assistant', 'error', parsed.unsupported);
    conversation.messages.push(reply);
    return response.json({ message: reply });
  }
  const intentError = validateIntent(parsed.intent);
  if (intentError) {
    const reply = message('assistant', 'clarification', intentError);
    conversation.messages.push(reply);
    return response.json({ message: reply });
  }
  conversation.pendingIntent = parsed.intent;
  const reply = message('assistant', 'interpretation', parsed.text, { intent: parsed.intent });
  conversation.messages.push(reply);
  return response.json({ message: reply });
});

app.post('/api/conversations/:id/confirm', async (request, response) => {
  const conversation = conversations.get(request.params.id);
  const intent = request.body?.intent as QuestionIntent | undefined;
  if (!conversation || !intent) return response.status(400).json({ error: { code: 'INVALID_INTENT', message: 'A valid intent is required.' } });
  const intentError = validateIntent(intent);
  if (intentError) return response.status(400).json({ error: { code: 'INVALID_INTENT', message: intentError } });
  try {
    const answer = await runCensusIntent(intent);
    const reply = message('assistant', 'answer', answer.summary, { answer });
    conversation.messages.push(reply);
    conversation.pendingIntent = undefined;
    return response.json({ message: reply });
  } catch (error) {
    const reply = message('assistant', 'error', error instanceof Error ? error.message : 'The Census request could not be completed.');
    conversation.messages.push(reply);
    return response.status(502).json({ message: reply });
  }
});

app.get('/api/conversations/:id', (request, response) => {
  const conversation = conversations.get(request.params.id);
  if (!conversation) return response.status(404).json({ error: 'Conversation not found' });
  response.json(conversation);
});

app.get('/api/health', (_request, response) => response.json({ ok: true, fallback: true, ollama: Boolean(process.env.OLLAMA_URL), model: process.env.OLLAMA_MODEL ?? 'mistral-nemo:latest', supportedMetrics }));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`CensusSense API listening on http://localhost:${port}`));
