import { describe, expect, it } from 'vitest';
import { parseCensusRows } from '../census/responseValidation';

describe('Census response validation', () => {
  it('maps header rows to records', () => {
    expect(parseCensusRows([['NAME', 'B01003_001E'], ['Fairfax County', '100']])).toEqual([{ NAME: 'Fairfax County', B01003_001E: '100' }]);
  });
  it('rejects malformed responses', () => {
    expect(() => parseCensusRows({})).toThrow();
  });
  it('requires expected columns and complete rows', () => {
    expect(() => parseCensusRows([['NAME'], ['Fairfax County']], ['NAME', 'B01003_001E'])).toThrow(/missing expected columns/);
    expect(() => parseCensusRows([['NAME', 'B01003_001E'], ['Fairfax County']], ['NAME', 'B01003_001E'])).toThrow(/wrong number/);
  });
  it('rejects duplicate headers', () => {
    expect(() => parseCensusRows([['NAME', 'NAME'], ['Fairfax County', '51']], ['NAME'])).toThrow(/duplicate headers/);
  });
});
