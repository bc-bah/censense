import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { CensusAnswer } from '../shared/contracts';
import 'leaflet/dist/leaflet.css';

type MapPoint = { name: string; latitude: number; longitude: number; rank?: number; values: Record<string, number | null> };

type StoryMapProps = { answer: CensusAnswer; onClose: () => void };

const tileThemes = {
  light: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  dark: { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS community' },
} as const;

export default function StoryMap({ answer, onClose }: StoryMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [loading, setLoading] = useState(true);
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');
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
  const moveTo = (index: number) => { setDirection(index >= activeIndex ? 'forward' : 'backward'); setActiveIndex(index); };

  return <section className={`story-overlay ${mapTheme}`} aria-label="CensusSense story map">
    <div className="story-panel">
      <div className="story-header"><div><span className="story-kicker">Tell me the story</span><h2>{answer.evidence.geography}</h2></div><div className="story-header-actions"><button className="story-theme-toggle" onClick={() => setMapTheme(mapTheme === 'light' ? 'dark' : 'light')} aria-pressed={mapTheme === 'dark'}>{mapTheme === 'dark' ? '☀ Light map' : '☾ Dark map'}</button><button className="story-close" onClick={onClose} aria-label="Close story">×</button></div></div>
      <div className={`story-step ${direction}`} key={`${activeIndex}-${activeRow?.geography}`}><span className="story-step-count">{activeIndex + 1} / {rows.length}</span><span className="story-rank">Rank {activeRow?.rank ?? activeIndex + 1}</span><h3>{activeRow?.geography ?? 'No location'}</h3><p>{narrative}</p></div>
      <div className="story-controls"><button onClick={() => moveTo(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>← Previous</button><button onClick={() => moveTo(Math.min(rows.length - 1, activeIndex + 1))} disabled={activeIndex >= rows.length - 1}>Next →</button></div>
      <div className="story-list">{rows.map((row, index) => <button key={row.geography} className={index === activeIndex ? 'story-location active' : 'story-location'} onClick={() => moveTo(index)}><span>{row.rank ?? index + 1}</span>{row.geography}</button>)}</div>
      {loading && <div className="story-status">Locating returned Census geographies...</div>}
      {!loading && !points.length && <div className="story-status">The Census geocoder did not return map coordinates. The verified table remains available.</div>}
    </div>
    <div className="story-map"><MapContainer center={activePoint ? [activePoint.latitude, activePoint.longitude] : [38, -96]} zoom={activePoint ? 7 : 4} scrollWheelZoom={true} className="leaflet-map"><TileLayer attribution={tileThemes[mapTheme].attribution} url={tileThemes[mapTheme].url} /><MapViewport points={points} activePoint={activePoint} />{points.length > 1 && <Polyline positions={points.map((point) => [point.latitude, point.longitude] as [number, number])} pathOptions={{ color: '#35c9d0', weight: 2, opacity: .8, dashArray: '7 10', className: 'story-route' }} />}{points.map((point) => <CircleMarker key={point.name} center={[point.latitude, point.longitude]} radius={point.name === activeRow?.geography ? 10 : 6} pathOptions={{ color: point.name === activeRow?.geography ? '#ffbd26' : '#1478d4', fillColor: point.name === activeRow?.geography ? '#ffbd26' : '#35c9d0', fillOpacity: .9, weight: 3, className: point.name === activeRow?.geography ? 'story-marker-active' : '' }} eventHandlers={{ click: () => moveTo(rows.findIndex((row) => row.geography === point.name)) }}><Popup><strong>{point.name}</strong><br />Rank {point.rank ?? '—'}</Popup></CircleMarker>)}</MapContainer></div>
  </section>;
}

function MapViewport({ points, activePoint }: { points: MapPoint[]; activePoint?: MapPoint }) {
  const map = useMap();
  useEffect(() => { if (activePoint) map.flyTo([activePoint.latitude, activePoint.longitude], Math.max(map.getZoom(), 7), { duration: .95, easeLinearity: .15 }); else if (points.length) map.fitBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]), { padding: [35, 35], animate: true, duration: .8 }); }, [activePoint, map, points]);
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
