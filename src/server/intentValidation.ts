import type { QuestionIntent } from '../shared/contracts.js';

export function sameIntent(left: QuestionIntent | undefined, right: QuestionIntent | undefined): boolean {
  if (!left || !right) return false;
  const canonicalize = (intent: QuestionIntent) => ({
    metric: intent.metric,
    geography: intent.geography,
    state: intent.state ?? null,
    states: [...(intent.states ?? [])].sort(),
    counties: [...(intent.counties ?? [])].sort(),
    limit: intent.limit ?? null,
    years: [...intent.years],
    operation: intent.operation,
    comparison: {
      baselineYear: intent.comparison?.baselineYear ?? null,
      laterYear: intent.comparison?.laterYear ?? null,
    },
    filters: {
      agingThreshold: intent.filters?.agingThreshold ?? null,
      incomeThreshold: intent.filters?.incomeThreshold ?? null,
    },
  });
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
