import type { CensusAnswer, Message, QuestionIntent } from '../shared/contracts.js';
import { CENSUS_YEAR, BASELINE_YEAR, defaultYearsForOperation } from '../census/catalog.js';

export type OllamaClient = {
  generateIntent(input: { question: string; messages: Message[]; supportedMetrics: string[] }): Promise<QuestionIntent | null>;
  explainVerifiedAnswer(input: { question: string; answer: CensusAnswer; followUp?: string }): Promise<string>;
  getModel(): string;
  setModel(model: string): void;
  listModels(): Promise<string[]>;
};

export function createOllamaClient(baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'): OllamaClient {
  let activeModel = process.env.OLLAMA_MODEL ?? 'mistral-nemo:latest';
  return {
    async generateIntent({ question, messages, supportedMetrics }) {
      if (!baseUrl) return null;
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: activeModel,
          stream: false,
          format: 'json',
          options: { temperature: 0 },
          prompt: [
            'You interpret Census questions for a guarded data application.',
            'Return only one JSON object. Never return Census values, variable IDs, URLs, or formulas.',
            `The only approved metric keys are: ${supportedMetrics.join(', ')}.`,
            `Use county geography for county metrics and state geography for state metrics. If the question omits a year, use ${CENSUS_YEAR}; for growth or change, use ${BASELINE_YEAR} as the baseline and ${CENSUS_YEAR} as the later year. Extract the state or states from the question; never default to a particular state. Ask for clarification by returning null when metric, geography, state, or operation is ambiguous.`,
            'The JSON schema is: {"metric":"approved key","geography":"county|state","state":"state from question","states":["states for state comparison"],"counties":["names"],"limit":number,"years":["YYYY"],"operation":"compare|growth|change|filter","comparison":{"baselineYear":"YYYY","laterYear":"YYYY"},"filters":{"agingThreshold":number,"incomeThreshold":number}}.',
            `Question: ${question}`,
            `Recent conversation: ${messages.slice(-6).map((item) => `${item.role}: ${item.text}`).join('\n')}`,
          ].join('\n'),
        }),
      });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
      const payload = await response.json() as { response?: string };
      if (!payload.response) return null;
      const candidate = JSON.parse(payload.response) as Partial<QuestionIntent>;
      if (!supportedMetrics.includes(String(candidate.metric)) || !['county', 'state'].includes(String(candidate.geography)) || !candidate.operation) return null;
      const years = Array.isArray(candidate.years) && candidate.years.length
        ? candidate.years
        : defaultYearsForOperation(candidate.operation);
      return { ...candidate, years } as QuestionIntent;
    },
    async explainVerifiedAnswer({ answer }) { return answer.summary; },
    getModel() { return activeModel; },
    setModel(model) { activeModel = model; },
    async listModels() {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`Ollama returned ${response.status} listing models.`);
      const payload = await response.json() as { models?: Array<{ name: string }> };
      return (payload.models ?? []).map((entry) => entry.name);
    },
  };
}
