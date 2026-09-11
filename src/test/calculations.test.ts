import { describe, expect, it } from 'vitest';
import { rankGrowth } from '../census/calculations';

describe('rankGrowth', () => {
  it('ranks valid rows by percentage change and ignores missing baselines', () => {
    const rows = rankGrowth([{ geography: 'A', values: { '2021': 100, '2023': 120 } }, { geography: 'B', values: { '2021': null, '2023': 140 } }, { geography: 'C', values: { '2021': 100, '2023': 105 } }], '2021', '2023');
    expect(rows.map((row) => row.geography)).toEqual(['A', 'C']);
    expect(rows[0].values.percentChange).toBe(20);
  });
});
