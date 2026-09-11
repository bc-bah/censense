import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Conversation, Message, QuestionIntent } from '../shared/contracts.js';
import { parseQuestion } from '../interpretation/fallbackParser.js';
import { runCensusIntent } from '../census/client.js';

const app = express();
app.use(express.json());
const conversations = new Map<string, Conversation>();

function message(role: Message['role'], kind: Message['kind'], text: string, extra: Partial<Message> = {}): Message {
  return { id: randomUUID(), role, kind, text, createdAt: new Date().toISOString(), ...extra };
}

app.post('/api/conversations', (_request, response) => {
  const id = randomUUID();
  conversations.set(id, { id, messages: [] });
  response.json({ conversationId: id });
});

app.post('/api/conversations/:id/messages', (request, response) => {
  const conversation = conversations.get(request.params.id);
  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
  if (!conversation || !text) return response.status(400).json({ error: { code: 'INVALID_INTENT', message: 'A conversation and question are required.' } });
  conversation.messages.push(message('user', 'question', text));
  const parsed = parseQuestion(text);
  if ('clarification' in parsed) {
    const reply = message('assistant', 'clarification', parsed.clarification);
    conversation.messages.push(reply);
    return response.json({ message: reply });
  }
  if ('unsupported' in parsed) {
    const reply = message('assistant', 'error', parsed.unsupported);
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

app.get('/api/health', (_request, response) => response.json({ ok: true, fallback: true, ollama: Boolean(process.env.OLLAMA_URL) }));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`CensusSense API listening on http://localhost:${port}`));
