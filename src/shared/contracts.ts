export type Metric = 'population' | 'work_from_home' | 'median_household_income' | 'aging_and_income';
export type Operation = 'compare' | 'growth' | 'change' | 'filter';
export type InterpretationSource = 'ollama' | 'fallback';

export type QuestionIntent = {
  metric: Metric;
  geography: 'county';
  state?: string;
  counties?: string[];
  years: string[];
  operation: Operation;
  comparison?: { baselineYear?: string; laterYear?: string };
  filters?: { agingThreshold?: number; incomeThreshold?: number };
  interpretationSource?: InterpretationSource;
};

export type EvidenceRequest = { vintage: string; url: string };

export type Evidence = {
  dataset: string;
  vintage: string;
  variables: Array<{ id: string; label: string; universe?: string; unit?: string }>;
  geography: string;
  filters: Record<string, string>;
  requests: EvidenceRequest[];
  rawValues: Array<Record<string, unknown>>;
  calculation: string;
  retrievedAt: string;
};

export type CensusAnswer = {
  summary: string;
  rows: Array<{ geography: string; values: Record<string, number | null>; rank?: number }>;
  evidence: Evidence;
  warnings: string[];
};

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  kind: 'question' | 'interpretation' | 'clarification' | 'activity' | 'answer' | 'error';
  text: string;
  intent?: QuestionIntent;
  answer?: CensusAnswer;
  createdAt: string;
};

export type Conversation = { id: string; messages: Message[]; pendingIntent?: QuestionIntent };
