import type { QuestionIntent } from '../shared/contracts.js';
import { CENSUS_YEAR, defaultYearsForOperation } from '../census/catalog.js';
import { allStateNames, findAllStatesInQuestion, findStateInQuestion } from '../census/states.js';

export type ParseResult = { intent: QuestionIntent; text: string } | { clarification: string; pendingIntent?: QuestionIntent } | { unsupported: string };

function extractCounties(question: string): string[] {
  const explicitCounties = [...question.matchAll(/\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*\s+(?:County|Parish|Borough|city))\b/g)]
    .map((match) => match[1].trim());
  if (explicitCounties.length) return explicitCounties;

  const countiesIndex = question.toLowerCase().lastIndexOf('counties');
  if (countiesIndex < 0) return [];

  // A colon after "counties" (e.g. "... counties in Oregon state: Clatsop, ...") introduces the list there instead of before the keyword.
  const colonAfterKeyword = question.indexOf(':', countiesIndex);
  let list: string;
  if (colonAfterKeyword >= 0) {
    list = question.slice(colonAfterKeyword + 1).trim().replace(/[.?!]+$/, '');
  } else {
    list = question.slice(0, countiesIndex).trim().replace(/[.?!]+$/, '');
    const listIntroducers = [...list.matchAll(/\b(?:across|among|including|namely)\b|:/gi)];
    const lastIntroducer = listIntroducers.at(-1);
    if (lastIntroducer?.index !== undefined) list = list.slice(lastIntroducer.index + lastIntroducer[0].length).trim();
  }

  const names = list.split(/\s*,\s*|\s+(?:and|&)\s+/i)
    .map((name) => name.trim().replace(/^(?:and|&)\s+/i, ''))
    .filter(Boolean);
  const validName = /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,4}$/;
  if (names.length < 2 || names.some((name) => !validName.test(name))) return [];

  return names.map((name) => /\b(?:county|parish|borough|city)$/i.test(name) ? name : `${name} County`);
}

export function parseQuestion(question: string, pendingIntent?: QuestionIntent): ParseResult {
  const normalized = question.toLowerCase();
  const state = findStateInQuestion(question) ?? pendingIntent?.state;
  const counties = extractCounties(question);
  const years = [...question.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  const comparisonYears = years.length >= 2 ? [years[0], years[1]] : defaultYearsForOperation('change');
  const limitMatch = normalized.match(/\b(?:top|first|highest)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+)?counties?\b/);
  const limitWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const limitValue = limitMatch ? Number(limitMatch[1] ?? limitMatch[2]) || limitWords[limitMatch[1] ?? limitMatch[2]] : undefined;
  const clarification = (intent: QuestionIntent): ParseResult => {
    if (intent.metric === 'poverty_rate') {
      return intent.states && intent.states.length >= 2
        ? { intent, text: `I will compare the poverty rate across ${intent.states.join(', ')} using ${intent.years[0]} ACS data.` }
        : { clarification: 'Which states should I compare poverty rates across? Name at least two states.', pendingIntent: intent };
    }
    return state
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
  };

  if (pendingIntent) {
    const questionStates = findAllStatesInQuestion(question);
    return clarification({
      ...pendingIntent,
      state,
      states: questionStates.length ? questionStates : pendingIntent.states,
      counties: counties.length ? counties : pendingIntent.counties,
      limit: limitValue ?? pendingIntent.limit,
    });
  }
  if ((normalized.includes('population') && (normalized.includes('growth') || normalized.includes('grew'))) || normalized.includes('grew') || normalized.includes('increased')) {
    return clarification({ metric: 'population', geography: 'county', years: comparisonYears, operation: 'growth', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1], }, interpretationSource: 'fallback' });
  }
  if (normalized.includes('population') && (normalized.includes('total') || normalized.includes('how many') || normalized.includes('largest'))) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'population', geography: 'county', years: [year], operation: 'compare', interpretationSource: 'fallback' });
  }
  if (normalized.includes('work from home') || normalized.includes('working from home')) {
    return clarification({ metric: 'work_from_home', geography: 'county', counties: counties.length ? counties : undefined, years: comparisonYears, operation: 'change', comparison: { baselineYear: comparisonYears[0], laterYear: comparisonYears[1] }, interpretationSource: 'fallback' });
  }
  if (normalized.includes('poverty')) {
    const namedStates = findAllStatesInQuestion(question);
    const states = namedStates.length >= 2 || /\b(?:which|what(?:\s+are)?)\s+(?:the\s+)?states\b|\ball\s+states\b|\bnationwide\b/.test(normalized) ? (namedStates.length >= 2 ? namedStates : allStateNames()) : namedStates;
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'poverty_rate', geography: 'state', states: states.length ? states : undefined, years: [year], operation: 'compare', interpretationSource: 'fallback' });
  }
  if (normalized.includes('income') && (counties.length >= 1 || normalized.includes('county') || normalized.includes('counties'))) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'median_household_income', geography: 'county', counties: counties.length ? counties : undefined, limit: limitValue, years: [year], operation: 'compare', interpretationSource: 'fallback' });
  }
  if ((normalized.includes('aging') || normalized.includes('older')) && normalized.includes('income')) {
    const year = years[0] ?? CENSUS_YEAR;
    return clarification({ metric: 'aging_and_income', geography: 'county', years: [year], operation: 'filter', filters: { agingThreshold: 20, incomeThreshold: 60000 }, interpretationSource: 'fallback' });
  }
  if (!state) return { clarification: 'Which state or territory should I query?' };
  if (normalized.includes('income')) return { clarification: `Which ${state} county or counties should I query?` };
  return { unsupported: 'I could not map that request to an approved Census metric. Try naming a measure such as population, median household income, work from home, or aging population, plus the geography and years you want.' };
}
