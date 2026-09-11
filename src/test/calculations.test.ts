import { describe, expect, it } from 'vitest';
import { joinIncomeAndDiseaseRows, rankGrowth } from '../census/calculations';

describe('rankGrowth', () => {
  it('ranks valid rows by percentage change and ignores missing baselines', () => {
    const rows = rankGrowth([{ geography: 'A', values: { '2021': 100, '2023': 120 } }, { geography: 'B', values: { '2021': null, '2023': 140 } }, { geography: 'C', values: { '2021': 100, '2023': 105 } }], '2021', '2023');
    expect(rows.map((row) => row.geography)).toEqual(['A', 'C']);
    expect(rows[0].values.percentChange).toBe(20);
  });
});

describe('joinIncomeAndDiseaseRows', () => {
  const incomeRows = [
    { geography: 'Poor County', geographyId: { stateFips: '51', countyFips: '001' }, medianHouseholdIncome: 40000 },
    { geography: 'Rich County', geographyId: { stateFips: '51', countyFips: '002' }, medianHouseholdIncome: 90000 },
    { geography: 'Unmatched County', geographyId: { stateFips: '51', countyFips: '003' }, medianHouseholdIncome: 30000 },
  ];
  const diseaseRows = [
    { locationid: '51001', dataValue: 15 },
    { locationid: '51002', dataValue: 5 },
  ];

  it('joins on FIPS and filters by income and disease thresholds', () => {
    const result = joinIncomeAndDiseaseRows(incomeRows, diseaseRows, 60000, 12);
    expect(result.rows).toEqual([{ geography: 'Poor County', geographyId: { stateFips: '51', countyFips: '001' }, values: { medianHouseholdIncome: 40000, diabetesPrevalence: 15 } }]);
  });

  it('reports counties with no PLACES match instead of silently dropping them', () => {
    const result = joinIncomeAndDiseaseRows(incomeRows, diseaseRows, 60000, 12);
    expect(result.unmatched).toEqual(['Unmatched County']);
  });
});
