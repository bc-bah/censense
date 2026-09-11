import type { QuestionIntent } from '../shared/contracts.js';
import { CENSUS_YEAR, defaultYearsForOperation } from '../census/catalog.js';
import { findStateInQuestion } from '../census/states.js';

export type ParseResult = { intent: QuestionIntent; text: string } | { clarification: string; pendingIntent?: QuestionIntent } | { unsupported: string };

export function parseQuestion(question: string, pendingIntent?: QuestionIntent): ParseResult {
  const normalized = question.toLowerCase();
  const state = findStateInQuestion(question) ?? pendingIntent?.state;
  const counties = [...question.matchAll(/\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*\s+(?:County|Parish|Borough|city))\b/g)].map((match) => match[1].trim());
  const years = [...question.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  const comparisonYears = years.length >= 2 ? [years[0], years[1]] : defaultYearsForOperation('change');
  const limitMatch = normalized.match(/\b(?:top|first|highest)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+counties?\b/);
  const limitWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const limitValue = limitMatch ? Number(limitMatch[1] ?? limitMatch[2]) || limitWords[limitMatch[1] ?? limitMatch[2]] : undefined;
  const clarification = (intent: QuestionIntent): ParseResult => state
    ? { intent: { ...intent, state }, text: intent.metric === 'population' && intent.operation === 'growth'
      ? `I will compare ${state} county population between ${intent.years[0]} and ${intent.years[1]}, then rank the percentage change.`
      : intent.metric === 'population'
        ? `I will compare total population across ${state} counties using ${intent.years[0]} ACS data.`
        : intent.metric === 'work_from_home'
          ? `I will compare the work-from-home share across ${state} counties between ${intent.years[0]} and ${intent.years[1]}.`
          : intent.metric === 'median_household_income'
            ? `I will compare ${intent.limit ? `the top ${intent.limit} ` : ''}median household income ${intent.counties?.length ? `in ${intent.counties.join(', ')}` : `across ${state} counties`} using ${intent.years[0]} ACS data.`
            : `I will find ${state} counties with at least 20% older residents and median household income below $60,000 in ${intent.years[0]}.` }
    : { clarification: 'Which state or territory should I query?', pendingIntent: intent };

  if (pendingIntent && state) {
    return clarification({ ...pendingIntent, limit: limitValue ?? pendingIntent.limit });
  }
  if (normalized.includes('population') && (normalized.includes('growth') || normalized.includes('grew'))) {
    return clarification({ metric: 'population', geography: 'county', years: comparisonYears, operation: 'growth', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1], }, interpretationSource: 'fallback' });
  }
  if (normalized.includes('population') && (normalized.includes('total') || normalized.includes('how many') || normalized.includes('largest'))) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'population', geography: 'county', years: [year], operation: 'compare', interpretationSource: 'fallback' });
  }
  if (normalized.includes('work from home') || normalized.includes('working from home')) {
    return clarification({ metric: 'work_from_home', geography: 'county', counties: counties.length ? counties : undefined, years: comparisonYears, operation: 'change', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1] }, interpretationSource: 'fallback' });
  }
  if (normalized.includes('income') && (counties.length >= 2 || normalized.includes('counties'))) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'median_household_income', geography: 'county', counties: counties.length ? counties : undefined, limit: limitValue, years: [year], operation: 'compare', interpretationSource: 'fallback' });
  }
  if ((normalized.includes('aging') || normalized.includes('older')) && normalized.includes('income')) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'aging_and_income', geography: 'county', years: [year], operation: 'filter', filters: { agingThreshold: 20, incomeThreshold: 60000 }, interpretationSource: 'fallback' });
  }
  if (!state) return { clarification: 'Which state or territory should I query?' };
  if (normalized.includes('income')) return { clarification: `Which ${state} counties should I compare? Name at least two counties.` };
  return { unsupported: 'I could not map that request to an approved Census metric. Try naming a measure such as population, median household income, work from home, or aging population, plus the geography and years you want.' };
}
