import { describe, expect, it } from 'vitest';
import { parseCensusRows } from '../census/responseValidation';

describe('Census response validation', () => {
  it('maps header rows to records', () => {
    expect(parseCensusRows([['NAME', 'B01003_001E'], ['Fairfax County', '100']])).toEqual([{ NAME: 'Fairfax County', B01003_001E: '100' }]);
  });
  it('rejects malformed responses', () => {
    expect(() => parseCensusRows({})).toThrow();
  });
});
