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
