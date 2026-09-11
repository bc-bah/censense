import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Conversation, Message, QuestionIntent } from '../shared/contracts.js';
import { parseQuestion } from '../interpretation/fallbackParser.js';
import { runCensusIntent } from '../census/client.js';
import { defaultYearsForOperation } from '../census/catalog.js';
import { createOllamaClient } from './ollamaClient.js';
import { sameIntent } from './intentValidation.js';
import { findAllStatesInQuestion, findStateInQuestion, resolveStateFips, resolveStateFipsList } from '../census/states.js';
import { searchCensusVariables } from '../census/metadata.js';
import { getCensusVariable } from '../census/metadata.js';
import { getMetricDefinition, getReviewedMetric, getReviewedMetrics, getSupportedMetricKeys, registerReviewedMetric } from '../census/reviewedCatalog.js';

const app = express();
app.use(express.json());
const conversations = new Map<string, Conversation>();
const ollama = createOllamaClient();

function validateIntent(intent: QuestionIntent): string | undefined {
  if (!getMetricDefinition(intent.metric)) return `The requested metric is not in the approved Census catalog. Available metrics: ${getSupportedMetricKeys().join(', ')}.`;
  if (intent.geography !== 'county' && intent.geography !== 'state') return 'Only county- or state-level Census geography is configured for this application.';
  if (intent.geography === 'state') {
    if (!intent.states || intent.states.length < 2) return 'A state-level comparison requires naming at least two states.';
    try { resolveStateFipsList(intent.states); } catch (error) { return error instanceof Error ? error.message : 'A valid state is required.'; }
  } else {
    try { resolveStateFips(intent.state); } catch (error) { return error instanceof Error ? error.message : 'A valid state is required.'; }
  }
  if (!Array.isArray(intent.years) || intent.years.length === 0 || intent.years.some((year) => !/^\d{4}$/.test(year))) return 'The Census years must be supplied as four-digit years.';
  if ((intent.operation === 'growth' || intent.operation === 'change') && intent.years.length < 2) return 'This comparison requires a baseline year and a later year.';
  if (intent.metric === 'median_household_income' && intent.operation === 'compare' && (!intent.counties || intent.counties.length < 1) && !intent.limit) return 'Name at least one county for a median household income lookup.';
  return undefined;
}

function message(role: Message['role'], kind: Message['kind'], text: string, extra: Partial<Message> = {}): Message {
  return { id: randomUUID(), role, kind, text, createdAt: new Date().toISOString(), ...extra };
}

function reviewedMetricIntent(text: string): QuestionIntent | undefined {
  const normalized = text.toLowerCase();
  const reviewed = getReviewedMetrics().find((metric) => normalized.includes(metric.label.toLowerCase()) || normalized.includes(metric.key.toLowerCase()));
  if (!reviewed) return undefined;
  if (reviewed.geography === 'county') {
    const state = findStateInQuestion(text);
    if (!state) return undefined;
    return { metric: reviewed.key, geography: 'county', state, years: [defaultYearsForOperation('compare')[0]], operation: 'compare', interpretationSource: 'fallback' };
  }
  const states = findAllStatesInQuestion(text);
  if (states.length < 2) return undefined;
  return { metric: reviewed.key, geography: 'state', states, years: [defaultYearsForOperation('compare')[0]], operation: 'compare', interpretationSource: 'fallback' };
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
  const reviewedIntent = reviewedMetricIntent(text);
  if (reviewedIntent) {
    parsed = { intent: reviewedIntent, text: `I will compare the reviewed ${getReviewedMetric(reviewedIntent.metric)?.label ?? reviewedIntent.metric} metric using approved ACS data. Review the interpretation before running it.` };
  } else {
  try {
    const modelIntent = await ollama.generateIntent({ question: text, messages: conversation.messages, supportedMetrics: getSupportedMetricKeys() });
    const deterministicMetrics = new Set(['median_household_income', 'low_income_high_disease_prevalence']);
    const deterministicIncomeIntent = 'intent' in fallback && deterministicMetrics.has(fallback.intent.metric) ? fallback : undefined;
    parsed = modelIntent
      ? deterministicIncomeIntent ?? {
        intent: { ...modelIntent, years: modelIntent.years.length ? modelIntent.years : defaultYearsForOperation(modelIntent.operation), interpretationSource: 'ollama' },
        text: `I mapped your question to approved Census metrics using ${modelIntent.years.join(' and ') || defaultYearsForOperation(modelIntent.operation).join(' and ')} ACS data. Review the interpretation before running it.`,
      }
      : fallback;
  } catch {
    parsed = fallback;
  }
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
    conversation.pendingIntent = parsed.intent;
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
  if (!sameIntent(conversation.pendingIntent, intent)) return response.status(409).json({ error: { code: 'INVALID_INTENT', message: 'The confirmed interpretation does not match the latest interpretation. Ask the question again and confirm the current plan.' } });
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

app.get('/api/catalog/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q : '';
  const year = typeof request.query.year === 'string' && /^20\d{2}$/.test(request.query.year) ? request.query.year : '2023';
  if (query.trim().length < 2) return response.status(400).json({ error: 'Search for at least two characters.' });
  try {
    const variables = await searchCensusVariables(query, year);
    response.json({ year, dataset: 'ACS 5-year estimates', reviewRequired: true, variables });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'The Census metadata service could not be reached.' });
  }
});

app.post('/api/catalog/approve', async (request, response) => {
  const { id, key, label, geography, unit, year = '2023' } = request.body ?? {};
  if (typeof id !== 'string' || typeof key !== 'string' || typeof label !== 'string' || !['county', 'state'].includes(geography) || typeof unit !== 'string' || !/^20\d{2}$/.test(year)) {
    return response.status(400).json({ error: 'Provide a variable id, metric key, label, geography, unit, and four-digit year.' });
  }
  if (!/^[a-z][a-z0-9_]{2,48}$/.test(key) || getMetricDefinition(key)) return response.status(400).json({ error: 'Metric key must be new and use lowercase letters, numbers, and underscores.' });
  try {
    const sourceVariable = await getCensusVariable(id, year);
    if (!sourceVariable || !['int', 'float'].includes(sourceVariable.predicateType ?? '')) return response.status(400).json({ error: 'Only numeric ACS estimate variables can be approved as direct metrics.' });
    const reviewed = registerReviewedMetric({ key, label, dataset: 'ACS 5-year estimates', geography, variables: [{ id, label: sourceVariable.label, unit }], review: { reviewedAt: new Date().toISOString(), sourceVariable } });
    response.status(201).json({ metric: reviewed, message: `Reviewed metric approved. Ask for "${reviewed.label}" or use metric key "${reviewed.key}". Derived formulas still require a separate calculation definition.` });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'The Census metadata service could not be reached.' });
  }
});

app.post('/api/map-points', async (request, response) => {
  const locations = Array.isArray(request.body?.locations) ? request.body.locations : [];
  if (!locations.length || locations.some((location: unknown) => !location || typeof location !== 'object' || typeof (location as { name?: unknown }).name !== 'string')) {
    return response.status(400).json({ error: 'Map locations must include named Census geographies.' });
  }
  try {
    const points = await Promise.all(locations.slice(0, 10).map(async (location: { name: string; state?: string; geographyId?: { stateFips: string; countyFips?: string } }) => {
      const stateFips = location.geographyId?.stateFips;
      const countyFips = location.geographyId?.countyFips;
      const where = stateFips && countyFips ? `STATE='${stateFips}' AND COUNTY='${countyFips}'` : undefined;
      const url = where
        ? `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=${encodeURIComponent(where)}&outFields=NAME%2CINTPTLAT%2CINTPTLON&returnGeometry=false&f=json`
        : `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent([location.name, location.state].filter(Boolean).join(', '))}&benchmark=Public_AR_Current&format=json`;
      const geocoderResponse = await fetch(url);
      if (!geocoderResponse.ok) return null;
      const payload = await geocoderResponse.json() as { features?: Array<{ attributes?: { INTPTLAT?: string; INTPTLON?: string } }>; result?: { addressMatches?: Array<{ coordinates?: { x: number; y: number } }> } };
      const tigerPoint = payload.features?.[0]?.attributes;
      if (tigerPoint?.INTPTLAT && tigerPoint.INTPTLON) return { ...location, latitude: Number(tigerPoint.INTPTLAT), longitude: Number(tigerPoint.INTPTLON) };
      const coordinates = payload.result?.addressMatches?.[0]?.coordinates;
      return coordinates ? { ...location, latitude: coordinates.y, longitude: coordinates.x } : null;
    }));
    response.json({ points: points.filter(Boolean) });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'The Census geocoder could not be reached.' });
  }
});

app.get('/api/health', (_request, response) => response.json({ ok: true, fallback: true, ollama: Boolean(process.env.OLLAMA_URL), model: process.env.OLLAMA_MODEL ?? 'mistral-nemo:latest', supportedMetrics: getSupportedMetricKeys() }));

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' } });
  }
  return next(error);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`CensusSense API listening on http://localhost:${port}`));
