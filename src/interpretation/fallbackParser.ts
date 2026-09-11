import type { QuestionIntent } from '../shared/contracts.js';
import { CENSUS_YEAR, defaultYearsForOperation } from '../census/catalog.js';
import { findStateInQuestion } from '../census/states.js';

export type ParseResult = { intent: QuestionIntent; text: string } | { clarification: string } | { unsupported: string };

export function parseQuestion(question: string): ParseResult {
  const normalized = question.toLowerCase();
  const state = findStateInQuestion(question);
  if (!state) return { clarification: 'Which state or territory should I query?' };
  const counties = [...question.matchAll(/\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*\s+(?:County|Parish|Borough|city))\b/g)].map((match) => match[1].trim());
  const years = [...question.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  const comparisonYears = years.length >= 2 ? [years[0], years[1]] : defaultYearsForOperation('change');
  if (normalized.includes('population') && (normalized.includes('growth') || normalized.includes('grew'))) {
    return { intent: { metric: 'population', geography: 'county', state, years: comparisonYears, operation: 'growth', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1], }, interpretationSource: 'fallback' }, text: `I will compare ${state} county population between ${comparisonYears[0]} and ${comparisonYears[1]}, then rank the percentage change.` };
  }
  if (normalized.includes('population') && (normalized.includes('total') || normalized.includes('how many') || normalized.includes('largest'))) {
    const year = years[0] ?? CENSUS_YEAR;
    return { intent: { metric: 'population', geography: 'county', state, years: [year], operation: 'compare', interpretationSource: 'fallback' }, text: `I will compare total population across ${state} counties using ${year} ACS data.` };
  }
  if (normalized.includes('work from home') || normalized.includes('working from home')) {
    return { intent: { metric: 'work_from_home', geography: 'county', state, counties: counties.length ? counties : undefined, years: comparisonYears, operation: 'change', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1] }, interpretationSource: 'fallback' }, text: `I will compare the work-from-home share across ${state} counties between ${comparisonYears[0]} and ${comparisonYears[1]}.` };
  }
  if (normalized.includes('income') && counties.length >= 2) {
    const year = years[0] ?? CENSUS_YEAR;
    return { intent: { metric: 'median_household_income', geography: 'county', state, counties, years: [year], operation: 'compare', interpretationSource: 'fallback' }, text: `I will compare median household income in ${counties.join(', ')} using ${year} ACS data.` };
  }
  if ((normalized.includes('aging') || normalized.includes('older')) && normalized.includes('income')) {
    const year = years[0] ?? CENSUS_YEAR;
    return { intent: { metric: 'aging_and_income', geography: 'county', state, years: [year], operation: 'filter', filters: { agingThreshold: 20, incomeThreshold: 60000 }, interpretationSource: 'fallback' }, text: `I will find ${state} counties with at least 20% older residents and median household income below $60,000 in ${year}.` };
  }
  if (normalized.includes('income')) return { clarification: `Which ${state} counties should I compare? Name at least two counties.` };
  return { unsupported: 'I could not map that request to an approved Census metric. Try naming a measure such as population, median household income, work from home, or aging population, plus the geography and years you want.' };
}
