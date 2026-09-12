import type { CensusAnswer } from '../../shared/contracts';

export type VisualizationArchetype = 'bivariate' | 'ridgeline' | 'hex-cartogram' | 'dot-plot';

export function selectVisualization(answer: CensusAnswer): VisualizationArchetype {
  const metadata = answer.visualization;
  if (metadata?.spatial && metadata.continuousVariables.length === 2) return 'bivariate';
  if (metadata?.spatial && metadata.landAreaDistortsInsight) return 'hex-cartogram';
  if (hasValidDistribution(answer)) return 'ridgeline';
  return 'dot-plot';
}

export function hasValidDistribution(answer: CensusAnswer): boolean {
  return Boolean(answer.distributions?.some((distribution) => distribution.profiles.some((profile) => (
    (profile.bins?.length ?? 0) >= 2 || (profile.samples?.length ?? 0) >= 3
  ))));
}