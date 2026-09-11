import { describe, expect, it } from 'vitest';
import { CENSUS_YEAR } from '../census/catalog';
import { parseQuestion } from '../interpretation/fallbackParser';

describe('fallback parser', () => {
  it('recognizes the population growth judging question', () => {
    const result = parseQuestion('Which counties in Virginia have experienced the largest population growth?');
    expect('intent' in result && result.intent.metric).toBe('population');
  });
  it('asks for names when income comparison is incomplete', () => {
    const result = parseQuestion('How does income compare?');
    expect('clarification' in result).toBe(true);
  });
  it('preserves a non-Virginia state from the question', () => {
    const result = parseQuestion('What is the total population of New Hampshire counties?');
    expect('intent' in result && result.intent.state).toBe('new hampshire');
  });
  it('uses and discloses the default Census year when no year is requested', () => {
    const result = parseQuestion('What is the total population of Virginia counties?');
    expect('intent' in result && result.intent.years).toEqual([CENSUS_YEAR]);
    expect('text' in result && result.text).toContain(`${CENSUS_YEAR} ACS data`);
  });
  it('keeps a recognized work-from-home metric while asking for the missing state', () => {
    const result = parseQuestion('Where has the percentage of people working from home changed the most?');
    expect('clarification' in result && result.pendingIntent?.metric).toBe('work_from_home');
  });
  it('fills the pending metric when the user answers with a state', () => {
    const first = parseQuestion('Where has the percentage of people working from home changed the most?');
    const second = parseQuestion('Virginia', 'pendingIntent' in first ? first.pendingIntent : undefined);
    expect('intent' in second && second.intent.metric).toBe('work_from_home');
    expect('intent' in second && second.intent.state).toBe('virginia');
  });
  it('supports a top-five median-income comparison without named counties', () => {
    const result = parseQuestion('Compare median household income across five counties in Texas.');
    expect('intent' in result && result.intent.metric).toBe('median_household_income');
    expect('intent' in result && result.intent.state).toBe('texas');
    expect('intent' in result && result.intent.limit).toBe(5);
  });
  it('adds a top-five limit when the user clarifies a pending income comparison', () => {
    const first = parseQuestion('Compare median household income across counties.');
    const second = parseQuestion('The top five counties of Texas', 'pendingIntent' in first ? first.pendingIntent : undefined);
    expect('intent' in second && second.intent.limit).toBe(5);
  });
});
