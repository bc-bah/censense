export type Metric = 'population' | 'work_from_home' | 'median_household_income' | 'aging_and_income' | 'poverty_rate' | 'low_income_high_disease_prevalence' | (string & {});
export type Operation = 'compare' | 'growth' | 'change' | 'filter';
export type InterpretationSource = 'ollama' | 'fallback';

export type CensusVariableMetadata = {
  id: string;
  label: string;
  concept?: string;
  predicateType?: string;
  group?: string;
  attributes?: string;
  limit?: number;
};

export type QuestionIntent = {
  metric: Metric;
  geography: 'county' | 'state';
  state?: string;
  states?: string[];
  counties?: string[];
  limit?: number;
  years: string[];
  operation: Operation;
  comparison?: { baselineYear?: string; laterYear?: string };
  filters?: { agingThreshold?: number; incomeThreshold?: number; diseasePrevalenceThreshold?: number };
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

export type Uncertainty = {
  marginOfError?: number | null;
  standardError?: number | null;
  lower90?: number | null;
  upper90?: number | null;
};

export type DistributionBin = {
  lower: number;
  upper?: number;
  count: number;
  marginOfError?: number | null;
};

export type DistributionProfile = {
  variable: string;
  label: string;
  unit?: string;
  grouping: 'geography' | 'time';
  source: 'acs-binned-table' | 'observed-values';
  approximationLabel?: string;
  profiles: Array<{
    key: string;
    label: string;
    bins?: DistributionBin[];
    samples?: number[];
  }>;
};

export type VisualizationMetadata = {
  spatial: boolean;
  geographyScale: 'county' | 'state' | 'mixed' | 'none';
  continuousVariables: string[];
  primaryCategory?: string;
  grouping?: 'geography' | 'time' | 'category';
  landAreaDistortsInsight?: boolean;
  distributionsAvailable?: boolean;
};

export type CensusAnswer = {
  summary: string;
  rows: Array<{ geography: string; geographyId?: { stateFips: string; countyFips?: string }; values: Record<string, number | null>; uncertainty?: Record<string, Uncertainty>; rank?: number }>;
  visualization?: VisualizationMetadata;
  distributions?: DistributionProfile[];
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
