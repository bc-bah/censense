import { describe, expect, it } from 'vitest';
import type { CensusAnswer } from '../shared/contracts';
import { hasValidDistribution, selectVisualization } from '../client/visualization/selector';
import { bivariateCell, interval90, tertile } from '../client/visualization/preparation';

const evidence = { dataset: 'ACS 5-year estimates', vintage: '2023', variables: [], geography: 'Virginia counties', filters: {}, requests: [], rawValues: [], calculation: '', retrievedAt: '' };
function answer(overrides: Partial<CensusAnswer> = {}): CensusAnswer {
  return { summary: '', rows: [{ geography: 'A', values: { x: 1, y: 2 } }, { geography: 'B', values: { x: 2, y: 3 } }], evidence, warnings: [], ...overrides };
}

describe('visualization selection', () => {
  it('prioritizes bivariate spatial data over cartogram selection', () => {
    expect(selectVisualization(answer({ visualization: { spatial: true, geographyScale: 'county', continuousVariables: ['x', 'y'], landAreaDistortsInsight: true } }))).toBe('bivariate');
  });

  it('requires real distribution data before selecting a ridgeline', () => {
    expect(selectVisualization(answer({ visualization: { spatial: false, geographyScale: 'none', continuousVariables: [] } }))).toBe('dot-plot');
    expect(hasValidDistribution(answer({ distributions: [{ variable: 'income', label: 'Income', grouping: 'geography', source: 'acs-binned-table', profiles: [{ key: 'A', label: 'A', bins: [{ lower: 0, upper: 10, count: 3 }, { lower: 10, upper: 20, count: 5 }] }] }] }))).toBe(true);
  });
});

describe('visualization preparation', () => {
  it('assigns tertiles and bivariate cells deterministically', () => {
    expect(tertile(1, [1, 2, 3])).toBe('low');
    expect(tertile(3, [1, 2, 3])).toBe('high');
    expect(bivariateCell(1, 3, [1, 2, 3], [1, 2, 3])).toBe('low-high');
  });

  it('calculates a 90 percent interval from standard error', () => {
    expect(interval90(100, { standardError: 10 })).toEqual({ lower: 83.55, upper: 116.45 });
  });
});