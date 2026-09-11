import type { QuestionIntent } from '../shared/contracts.js';
import { BASELINE_YEAR, CENSUS_YEAR } from '../census/catalog.js';

export type ParseResult = { intent: QuestionIntent; text: string } | { clarification: string } | { unsupported: string };

export function parseQuestion(question: string): ParseResult {
  const normalized = question.toLowerCase();
  const counties = ['Fairfax County', 'Loudoun County', 'Henrico County', 'Chesterfield County', 'Arlington County', 'Alexandria city'].filter((county) => normalized.includes(county.toLowerCase()));
  if (normalized.includes('population') && (normalized.includes('growth') || normalized.includes('grew'))) {
    return { intent: { metric: 'population', geography: 'county', state: 'Virginia', years: [BASELINE_YEAR, CENSUS_YEAR], operation: 'growth', comparison: { baselineYear: BASELINE_YEAR, laterYear: CENSUS_YEAR } }, text: `I will compare Virginia county population between ${BASELINE_YEAR} and ${CENSUS_YEAR}, then rank the percentage change.` };
  }
  if (normalized.includes('work from home') || normalized.includes('working from home')) {
    return { intent: { metric: 'work_from_home', geography: 'county', state: 'Virginia', counties: counties.length ? counties : undefined, years: [BASELINE_YEAR, CENSUS_YEAR], operation: 'change', comparison: { baselineYear: BASELINE_YEAR, laterYear: CENSUS_YEAR } }, text: `I will compare the work-from-home share across Virginia counties between ${BASELINE_YEAR} and ${CENSUS_YEAR}.` };
  }
  if (normalized.includes('income') && counties.length >= 2) {
    return { intent: { metric: 'median_household_income', geography: 'county', state: 'Virginia', counties, years: [CENSUS_YEAR], operation: 'compare' }, text: `I will compare median household income in ${counties.join(', ')} using ${CENSUS_YEAR} ACS data.` };
  }
  if ((normalized.includes('aging') || normalized.includes('older')) && normalized.includes('income')) {
    return { intent: { metric: 'aging_and_income', geography: 'county', state: 'Virginia', years: [CENSUS_YEAR], operation: 'filter', filters: { agingThreshold: 20, incomeThreshold: 60000 } }, text: `I will find Virginia counties with at least 20% older residents and median household income below $60,000 in ${CENSUS_YEAR}.` };
  }
  if (normalized.includes('income')) return { clarification: 'Which Virginia counties should I compare? Name at least two counties.' };
  return { unsupported: 'I can answer four Census questions: population growth, work-from-home change, named-county income comparisons, and aging populations with lower income.' };
}
