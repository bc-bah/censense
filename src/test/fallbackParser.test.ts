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
});
