import { scaleLinear, scaleSequential } from 'd3-scale';
import { interpolateViridis } from 'd3-scale-chromatic';
import type { CensusAnswer, DistributionProfile } from '../../shared/contracts';
import { bivariateCell, distributionPoints, interval90, sourceCaption, tertile } from './preparation';

const width = 720;
const palette: Record<string, string> = {
  'low-low': '#e8f3e8', 'mid-low': '#b7d8bd', 'high-low': '#75b798',
  'low-mid': '#d2e8e5', 'mid-mid': '#8bc6ba', 'high-mid': '#4c9f91',
  'low-high': '#b3d8db', 'mid-high': '#69b5bf', 'high-high': '#287d8e',
};

function metricKey(answer: CensusAnswer, index = 0): string | undefined {
  const keys = Object.keys(answer.rows[0]?.values ?? {});
  return keys.filter((key) => !['baseline', 'later', 'change'].includes(key))[index];
}

function labelFor(key: string): string {
  return key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function Caption({ answer, detail }: { answer: CensusAnswer; detail?: string }) {
  return <p className="visualization-caption">{sourceCaption(answer)}{detail ? ` · ${detail}` : ''}</p>;
}

export function BivariateChoropleth({ answer }: { answer: CensusAnswer }) {
  const xKey = answer.visualization?.continuousVariables[0] ?? metricKey(answer);
  const yKey = answer.visualization?.continuousVariables[1] ?? metricKey(answer, 1);
  if (!xKey || !yKey) return <DotPlot answer={answer} />;
  const rows = answer.rows.slice(0, 24).filter((row) => typeof row.values[xKey] === 'number' && typeof row.values[yKey] === 'number');
  const xValues = rows.map((row) => row.values[xKey] as number);
  const yValues = rows.map((row) => row.values[yKey] as number);
  return <section className="advanced-visualization" aria-label="Bivariate choropleth comparison"><div className="visualization-heading"><span>Bivariate map</span><strong>{labelFor(xKey)} × {labelFor(yKey)}</strong></div><svg viewBox="0 0 720 360" role="img" aria-label={`${labelFor(xKey)} and ${labelFor(yKey)} bivariate comparison`} className="visualization-svg"><line x1="70" y1="300" x2="660" y2="300" className="viz-axis" /><line x1="70" y1="300" x2="70" y2="35" className="viz-axis" /><text x="365" y="340" textAnchor="middle" className="viz-axis-label">{labelFor(xKey)}: low → high</text><text x="18" y="170" transform="rotate(-90 18 170)" textAnchor="middle" className="viz-axis-label">{labelFor(yKey)}: low → high</text>{rows.map((row, index) => { const x = 90 + (index % 8) * 78; const y = 260 - Math.floor(index / 8) * 78; const cell = bivariateCell(row.values[xKey] as number, row.values[yKey] as number, xValues, yValues); return <g key={row.geography}><circle cx={x} cy={y} r="19" fill={palette[cell]} stroke="#fff" strokeWidth="2" /><text x={x} y={y + 3} textAnchor="middle" className="viz-mark-label">{row.geography.slice(0, 4)}</text></g>; })}</svg><div className="bivariate-legend" aria-label="Bivariate legend"><span className="legend-y">High Y</span><div className="legend-grid">{(['high-low', 'high-mid', 'high-high', 'mid-low', 'mid-mid', 'mid-high', 'low-low', 'low-mid', 'low-high'] as const).map((cell) => <span key={cell} title={cell} style={{ background: palette[cell] }} />)}</div><span className="legend-x">Low X → High X</span></div><Caption answer /></section>;
}

export function HexCartogram({ answer }: { answer: CensusAnswer }) {
  const key = metricKey(answer);
  if (!key) return null;
  const rows = answer.rows.slice(0, 50).filter((row) => typeof row.values[key] === 'number');
  const values = rows.map((row) => row.values[key] as number);
  const color = scaleSequential(interpolateViridis).domain([Math.min(...values), Math.max(...values) || 1]);
  return <section className="advanced-visualization" aria-label="Equal area hexagonal cartogram"><div className="visualization-heading"><span>Equal-area comparison</span><strong>{labelFor(key)}</strong></div><svg viewBox="0 0 720 400" role="img" aria-label={`${labelFor(key)} equal-area hexagon comparison`} className="visualization-svg hex-svg">{rows.map((row, index) => { const column = index % 8; const line = Math.floor(index / 8); const x = 70 + column * 82 + (line % 2 ? 41 : 0); const y = 52 + line * 62; const value = row.values[key] as number; const points = [[x, y - 25], [x + 22, y - 12], [x + 22, y + 13], [x, y + 26], [x - 22, y + 13], [x - 22, y - 12]].map((point) => point.join(',')).join(' '); return <g key={row.geography}><polygon points={points} fill={color(value)} className="hex-tile" /><text x={x} y={y + 4} textAnchor="middle" className="viz-mark-label">{row.geography.replace(/ county$/i, '').slice(0, 4)}</text></g>; })}</svg><div className="continuous-legend"><span>Low</span><i /><span>High</span></div><Caption answer /></section>;
}

export function DotPlot({ answer }: { answer: CensusAnswer }) {
  const key = metricKey(answer);
  if (!key) return null;
  const rows = answer.rows.slice(0, 14).filter((row) => typeof row.values[key] === 'number');
  const values = rows.map((row) => row.values[key] as number);
  const domain = [Math.min(...values), Math.max(...values)] as [number, number];
  const x = scaleLinear().domain(domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain).range([180, 680]);
  return <section className="advanced-visualization" aria-label="Faceted error bar dot plot"><div className="visualization-heading"><span>Estimate comparison</span><strong>{labelFor(key)}</strong></div><svg viewBox={`0 0 ${width} ${Math.max(180, rows.length * 30 + 45)}`} role="img" aria-label={`${labelFor(key)} dot plot`} className="visualization-svg">{rows.map((row, index) => { const estimate = row.values[key] as number; const interval = interval90(estimate, row.uncertainty?.[key]); const y = 35 + index * 30; const lower = interval ? x(interval.lower) : x(estimate); const upper = interval ? x(interval.upper) : x(estimate); return <g key={row.geography}><text x="168" y={y + 4} textAnchor="end" className="viz-row-label">{row.geography}</text><line x1="180" y1={y} x2="680" y2={y} className="viz-grid" /><line x1={lower} y1={y} x2={upper} y2={y} className="viz-whisker" /><circle cx={x(estimate)} cy={y} r="5" className="viz-dot" />{interval && <line x1={lower} y1={y - 5} x2={lower} y2={y + 5} className="viz-whisker" />}{interval && <line x1={upper} y1={y - 5} x2={upper} y2={y + 5} className="viz-whisker" />}</g>; })}<text x="430" y={rows.length * 30 + 35} textAnchor="middle" className="viz-axis-label">{labelFor(key)} estimate{rows.some((row) => row.uncertainty?.[key]) ? ' with 90% interval' : ' · estimate only'}</text></svg><Caption answer detail={rows.some((row) => row.uncertainty?.[key]) ? '90% intervals shown where available' : 'Estimate-only; ACS uncertainty not provided'} /></section>;
}

function profilePoints(profile: DistributionProfile['profiles'][number]) {
  if (profile.samples?.length) return profile.samples.map((value) => ({ value, weight: 1 }));
  return distributionPoints(profile.bins ?? []);
}

export function Ridgeline({ answer }: { answer: CensusAnswer }) {
  const distribution = answer.distributions?.find((item) => item.profiles.some((profile) => profilePoints(profile).length >= 2));
  if (!distribution) return <DotPlot answer={answer} />;
  const allValues = distribution.profiles.flatMap(profilePoints).map((point) => point.value);
  const x = scaleLinear().domain([Math.min(...allValues), Math.max(...allValues)]).range([170, 680]);
  return <section className="advanced-visualization" aria-label="Ridgeline distribution profile"><div className="visualization-heading"><span>Distribution profile</span><strong>{distribution.label}</strong></div><svg viewBox={`0 0 720 ${Math.max(190, distribution.profiles.length * 52 + 50)}`} role="img" aria-label={`${distribution.label} ridgeline`} className="visualization-svg">{distribution.profiles.map((profile, index) => { const points = profilePoints(profile); const maxWeight = Math.max(...points.map((point) => point.weight), 1); const y = 42 + index * 48; return <g key={profile.key}><text x="160" y={y + 4} textAnchor="end" className="viz-row-label">{profile.label}</text><line x1="170" y1={y} x2="680" y2={y} className="viz-grid" />{points.map((point) => <circle key={`${profile.key}-${point.value}`} cx={x(point.value)} cy={y - (point.weight / maxWeight) * 28} r="3" fill="#287d8e" opacity={point.uncertainty ? Math.max(.2, 1 - point.uncertainty / Math.max(point.weight, 1)) : .85} />)}<path d={`M ${points.map((point) => `${x(point.value)},${y - (point.weight / maxWeight) * 28}`).join(' L ')}`} fill="none" stroke="#287d8e" strokeWidth="2" /></g>; })}</svg><Caption answer detail={distribution.approximationLabel ?? (distribution.source === 'acs-binned-table' ? 'Approximate reconstruction from ACS bins' : 'Distribution of geography-level estimates')} /></section>;
}