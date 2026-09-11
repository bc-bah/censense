import type { CensusAnswer, Message, QuestionIntent } from '../shared/contracts.js';

export type OllamaClient = {
  generateIntent(input: { question: string; messages: Message[]; supportedMetrics: string[] }): Promise<QuestionIntent | null>;
  explainVerifiedAnswer(input: { question: string; answer: CensusAnswer; followUp?: string }): Promise<string>;
};

export function createOllamaClient(baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'): OllamaClient {
  return {
    async generateIntent() { if (!baseUrl) return null; return null; },
    async explainVerifiedAnswer({ answer }) { return answer.summary; },
  };
}
