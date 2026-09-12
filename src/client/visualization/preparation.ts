import type { CensusAnswer, DistributionBin } from '../../shared/contracts';

export type Tertile = 'low' | 'mid' | 'high';

export function tertile(value: number, values: number[]): Tertile {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 'mid';
  const lowBoundary = sorted[Math.max(0, Math.ceil(sorted.length / 3) - 1)];
  const highBoundary = sorted[Math.max(0, Math.ceil((sorted.length * 2) / 3) - 1)];
  if (value <= lowBoundary) return 'low';
  if (value >= highBoundary) return 'high';
  return 'mid';
}

export function bivariateCell(x: number, y: number, xValues: number[], yValues: number[]): `${Tertile}-${Tertile}` {
  return `${tertile(x, xValues)}-${tertile(y, yValues)}`;
}

export function interval90(estimate: number, uncertainty?: { marginOfError?: number | null; standardError?: number | null }): { lower: number; upper: number } | undefined {
  if (uncertainty?.marginOfError !== undefined && uncertainty.marginOfError !== null) {
    return { lower: estimate - uncertainty.marginOfError, upper: estimate + uncertainty.marginOfError };
  }
  if (uncertainty?.standardError !== undefined && uncertainty.standardError !== null) {
    const margin = 1.645 * uncertainty.standardError;
    return { lower: estimate - margin, upper: estimate + margin };
  }
  return undefined;
}

export function distributionPoints(bins: DistributionBin[]): Array<{ value: number; weight: number; uncertainty?: number | null }> {
  return bins
    .filter((bin) => Number.isFinite(bin.lower) && Number.isFinite(bin.count) && bin.count >= 0)
    .map((bin) => ({ value: bin.upper === undefined ? bin.lower : (bin.lower + bin.upper) / 2, weight: bin.count, uncertainty: bin.marginOfError }));
}

export function sourceCaption(answer: CensusAnswer): string {
  return `Source: ${answer.evidence.dataset}, ${answer.evidence.vintage}`;
}