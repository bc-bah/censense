import type { CensusVariableMetadata } from '../shared/contracts';

type CatalogNetworkProps = { activeTerm: string; onTermSelect: (term: string) => void; results: CensusVariableMetadata[]; busy: boolean };

type NetworkNode = { id: string; label: string; x: number; y: number; tone: 'core' | 'topic' | 'subtopic' };

const nodes: NetworkNode[] = [
  { id: 'population', label: 'Population', x: 170, y: 68, tone: 'core' },
  { id: 'income', label: 'Income', x: 70, y: 153, tone: 'topic' },
  { id: 'housing', label: 'Housing', x: 270, y: 153, tone: 'topic' },
  { id: 'work', label: 'Work', x: 65, y: 250, tone: 'topic' },
  { id: 'education', label: 'Education', x: 275, y: 250, tone: 'topic' },
  { id: 'age', label: 'Age', x: 115, y: 327, tone: 'subtopic' },
  { id: 'poverty', label: 'Poverty', x: 225, y: 327, tone: 'subtopic' },
];

const links: Array<[string, string]> = [['population', 'income'], ['population', 'housing'], ['population', 'work'], ['population', 'education'], ['income', 'poverty'], ['income', 'work'], ['population', 'age'], ['housing', 'education']];

export default function CatalogNetwork({ activeTerm, onTermSelect, results, busy }: CatalogNetworkProps) {
  const selected = nodes.find((node) => node.id === activeTerm);
  return <div className="network-browser"><div className="network-heading"><div><p className="micro-label">Browse the Census knowledge network</p><p className="network-help">Choose a topic to reveal matching official ACS variables.</p></div><span>{busy ? 'Searching…' : results.length ? `${results.length} matches` : 'Select a node'}</span></div><svg className="catalog-network" viewBox="0 0 340 370" role="img" aria-label="Clickable Census topic network">
    {links.map(([from, to]) => { const source = nodes.find((node) => node.id === from)!; const target = nodes.find((node) => node.id === to)!; return <line key={`${from}-${to}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className="network-link" />; })}
    {nodes.map((node) => <g key={node.id} className={`network-node ${node.tone} ${node.id === activeTerm ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Explore ${node.label} Census variables`} onClick={() => onTermSelect(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onTermSelect(node.id); }}><circle cx={node.x} cy={node.y} r={node.tone === 'core' ? 30 : node.tone === 'topic' ? 23 : 19} /><text x={node.x} y={node.y + 4} textAnchor="middle">{node.label}</text></g>)}
  </svg>{selected && <p className="network-selected">Exploring <strong>{selected.label}</strong>. Results below are discovery candidates and still require review before execution.</p>}</div>;
}
