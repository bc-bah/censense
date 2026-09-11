import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CensusAnswer } from '../shared/contracts';

export default function ResultChart({ answer }: { answer: CensusAnswer }) {
  const availableKeys = Object.keys(answer.rows[0]?.values ?? {});
  const preferredKeys = ['percentChange', 'percentagePointChange', 'povertyRate', 'medianHouseholdIncome', 'population', 'olderPopulationShare'];
  const metricKey = preferredKeys.find((key) => availableKeys.includes(key)) ?? availableKeys.find((key) => !['baseline', 'later', 'change'].includes(key));
  if (!metricKey || answer.rows.length < 2) return null;
  const chartRows = answer.rows.slice(0, 10).map((row) => ({ geography: row.geography, value: row.values[metricKey] })).filter((row): row is { geography: string; value: number } => typeof row.value === 'number');
  if (chartRows.length < 2) return null;
  const label = metricKey.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  return <section className="result-chart" aria-label={`${label} chart`}><div className="result-chart-heading"><span>Quick view</span><strong>{label}</strong></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={Math.max(180, chartRows.length * 28)}><BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}><CartesianGrid horizontal={false} stroke="#d7e4ea" /><XAxis type="number" tick={{ fontSize: 10, fill: '#6d8195' }} tickLine={false} axisLine={false} /><YAxis dataKey="geography" type="category" width={105} tick={{ fontSize: 10, fill: '#102a51' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })} cursor={{ fill: 'rgba(53,201,208,.1)' }} /><Bar dataKey="value" fill="#1478d4" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></section>;
}
