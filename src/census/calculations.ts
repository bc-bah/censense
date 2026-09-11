import type { CensusAnswer } from '../shared/contracts.js';

export type RawValue = { geography: string; values: Record<string, number | null> };

export function rankGrowth(values: RawValue[], baselineYear: string, laterYear: string): CensusAnswer['rows'] {
  return values
    .map((row) => {
      const baseline = row.values[baselineYear];
      const later = row.values[laterYear];
      if (baseline === null || later === null || baseline === undefined || later === undefined || baseline === 0) return null;
      return { geography: row.geography, values: { baseline, later, change: later - baseline, percentChange: ((later - baseline) / baseline) * 100 } };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (b.values.percentChange ?? 0) - (a.values.percentChange ?? 0))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export type IncomeRow = { geography: string; geographyId?: { stateFips: string; countyFips?: string }; medianHouseholdIncome: number | null };
export type DiseaseRow = { locationid: string; dataValue: number | null };

// Matches counties by concatenated state+county FIPS; counties with no PLACES match are reported, not silently dropped.
export function joinIncomeAndDiseaseRows(
  incomeRows: IncomeRow[],
  diseaseRows: DiseaseRow[],
  incomeThreshold: number,
  diseaseThreshold: number,
): { rows: CensusAnswer['rows']; unmatched: string[] } {
  const diseaseByFips = new Map(diseaseRows.map((row) => [row.locationid, row.dataValue]));
  const unmatched: string[] = [];
  const rows = incomeRows.flatMap((row) => {
    const fips = row.geographyId?.countyFips ? `${row.geographyId.stateFips}${row.geographyId.countyFips}` : undefined;
    const diseasePrevalence = fips ? diseaseByFips.get(fips) : undefined;
    if (diseasePrevalence === undefined) {
      unmatched.push(row.geography);
      return [];
    }
    if ((row.medianHouseholdIncome ?? Infinity) >= incomeThreshold || (diseasePrevalence ?? 0) <= diseaseThreshold) return [];
    return [{ geography: row.geography, geographyId: row.geographyId, values: { medianHouseholdIncome: row.medianHouseholdIncome, diabetesPrevalence: diseasePrevalence } }];
  });
  return { rows, unmatched };
}
