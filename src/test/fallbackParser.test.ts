import { describe, expect, it } from 'vitest';
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
});
