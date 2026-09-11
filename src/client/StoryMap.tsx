import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { CensusAnswer } from '../shared/contracts';
import 'leaflet/dist/leaflet.css';

type MapPoint = { name: string; latitude: number; longitude: number; rank?: number; values: Record<string, number | null> };

type StoryMapProps = { answer: CensusAnswer; onClose: () => void };

export default function StoryMap({ answer, onClose }: StoryMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const rows = useMemo(() => answer.rows.slice(0, 10), [answer.rows]);
  const activeRow = rows[activeIndex];
  const state = answer.evidence.filters.state ?? answer.evidence.geography.replace(/ counties?$/i, '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/map-points', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: rows.map((row) => ({ name: row.geography, state, geographyId: row.geographyId, rank: row.rank, values: row.values })) }) })
      .then((response) => response.json() as Promise<{ points?: MapPoint[] }>)
      .then((data) => { if (!cancelled) setPoints(data.points ?? []); })
      .catch(() => { if (!cancelled) setPoints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [answer, rows, state]);

  const activePoint = points.find((point) => point.name === activeRow?.geography);
  const narrative = activeRow ? storyText(activeRow, answer) : 'No verified rows are available for this story.';

  return <section className="story-overlay" aria-label="CensusSense story map">
    <div className="story-panel">
      <div className="story-header"><div><span className="story-kicker">Tell me the story</span><h2>{answer.evidence.geography}</h2></div><button className="story-close" onClick={onClose} aria-label="Close story">×</button></div>
      <div className="story-step"><span className="story-step-count">{activeIndex + 1} / {rows.length}</span><span className="story-rank">Rank {activeRow?.rank ?? activeIndex + 1}</span><h3>{activeRow?.geography ?? 'No location'}</h3><p>{narrative}</p></div>
      <div className="story-controls"><button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}>← Previous</button><button onClick={() => setActiveIndex((index) => Math.min(rows.length - 1, index + 1))} disabled={activeIndex >= rows.length - 1}>Next →</button></div>
      <div className="story-list">{rows.map((row, index) => <button key={row.geography} className={index === activeIndex ? 'story-location active' : 'story-location'} onClick={() => setActiveIndex(index)}><span>{row.rank ?? index + 1}</span>{row.geography}</button>)}</div>
      {loading && <div className="story-status">Locating returned Census geographies...</div>}
      {!loading && !points.length && <div className="story-status">The Census geocoder did not return map coordinates. The verified table remains available.</div>}
    </div>
    <div className="story-map"><MapContainer center={activePoint ? [activePoint.latitude, activePoint.longitude] : [38, -96]} zoom={activePoint ? 7 : 4} scrollWheelZoom={true} className="leaflet-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapViewport points={points} activePoint={activePoint} />{points.map((point) => <CircleMarker key={point.name} center={[point.latitude, point.longitude]} radius={point.name === activeRow?.geography ? 10 : 6} pathOptions={{ color: point.name === activeRow?.geography ? '#ffbd26' : '#1478d4', fillColor: point.name === activeRow?.geography ? '#ffbd26' : '#35c9d0', fillOpacity: .9, weight: 3 }} eventHandlers={{ click: () => setActiveIndex(rows.findIndex((row) => row.geography === point.name)) }}><Popup><strong>{point.name}</strong><br />Rank {point.rank ?? '—'}</Popup></CircleMarker>)}</MapContainer></div>
  </section>;
}

function MapViewport({ points, activePoint }: { points: MapPoint[]; activePoint?: MapPoint }) {
  const map = useMap();
  useEffect(() => { if (activePoint) map.flyTo([activePoint.latitude, activePoint.longitude], Math.max(map.getZoom(), 7), { duration: .45 }); else if (points.length) map.fitBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]), { padding: [35, 35] }); }, [activePoint, map, points]);
  return null;
}

function storyText(row: CensusAnswer['rows'][number], answer: CensusAnswer): string {
  const values = Object.entries(row.values).filter((entry): entry is [string, number] => typeof entry[1] === 'number');
  const [key, value] = values.find(([name]) => ['percentChange', 'percentagePointChange', 'povertyRate', 'medianHouseholdIncome', 'population', 'olderPopulationShare'].includes(name)) ?? values[0] ?? ['value', null];
  if (value === null) return `This location is included in the verified ${answer.evidence.dataset} result set.`;
  const label = key.replaceAll(/([A-Z])/g, ' $1').toLowerCase();
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${row.geography} ranks ${row.rank ?? 'in this result set'} with ${formatted} ${label}. The result comes from the verified ${answer.evidence.vintage} Census data and the calculation shown in evidence.`;
}
