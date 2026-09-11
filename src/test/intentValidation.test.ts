import { describe, expect, it } from 'vitest';
import { sameIntent } from '../server/intentValidation';
import type { QuestionIntent } from '../shared/contracts';

const baseIntent: QuestionIntent = { metric: 'population', geography: 'county', state: 'New Hampshire', years: ['2023'], operation: 'compare', counties: ['Hillsborough County', 'Belknap County'] };

describe('intent confirmation binding', () => {
  it('accepts the same intent when list ordering differs', () => {
    expect(sameIntent(baseIntent, { ...baseIntent, counties: ['Belknap County', 'Hillsborough County'] })).toBe(true);
  });

  it('accepts equivalent intents with omitted optional fields', () => {
    expect(sameIntent(baseIntent, { metric: 'population', geography: 'county', state: 'New Hampshire', years: ['2023'], operation: 'compare', counties: ['Hillsborough County', 'Belknap County'] })).toBe(true);
  });

  it('rejects a substituted metric or geography', () => {
    expect(sameIntent(baseIntent, { ...baseIntent, metric: 'poverty_rate', geography: 'state', state: undefined, states: ['New Hampshire', 'Vermont'], counties: undefined })).toBe(false);
  });

  it('rejects confirmation when no pending intent exists', () => {
    expect(sameIntent(undefined, baseIntent)).toBe(false);
  });
});