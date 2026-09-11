import type { CensusAnswer, Message, QuestionIntent } from '../shared/contracts.js';

export type OllamaClient = {
  generateIntent(input: { question: string; messages: Message[]; supportedMetrics: string[] }): Promise<QuestionIntent | null>;
  explainVerifiedAnswer(input: { question: string; answer: CensusAnswer; followUp?: string }): Promise<string>;
};

export function createOllamaClient(baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'): OllamaClient {
  return {
    async generateIntent({ question, messages, supportedMetrics }) {
      if (!baseUrl) return null;
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? 'mistral-nemo:latest',
          stream: false,
          format: 'json',
          options: { temperature: 0 },
          prompt: [
            'You interpret Census questions for a guarded data application.',
            'Return only one JSON object. Never return Census values, variable IDs, URLs, or formulas.',
            `The only approved metric keys are: ${supportedMetrics.join(', ')}.`,
            'Use geography county. Ask for clarification by returning null when metric, geography, years, or operation is ambiguous.',
            'The JSON schema is: {"metric":"approved key","geography":"county","state":"Virginia","counties":["names"],"years":["YYYY"],"operation":"compare|growth|change|filter","comparison":{"baselineYear":"YYYY","laterYear":"YYYY"},"filters":{"agingThreshold":number,"incomeThreshold":number}}.',
            `Question: ${question}`,
            `Recent conversation: ${messages.slice(-6).map((item) => `${item.role}: ${item.text}`).join('\n')}`,
          ].join('\n'),
        }),
      });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
      const payload = await response.json() as { response?: string };
      if (!payload.response) return null;
      const candidate = JSON.parse(payload.response) as Partial<QuestionIntent>;
      if (!supportedMetrics.includes(String(candidate.metric)) || candidate.geography !== 'county' || !Array.isArray(candidate.years) || !candidate.operation) return null;
      return candidate as QuestionIntent;
    },
    async explainVerifiedAnswer({ answer }) { return answer.summary; },
  };
}
