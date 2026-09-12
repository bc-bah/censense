import type { CensusAnswer } from '../shared/contracts';
import { BivariateChoropleth, DotPlot, HexCartogram, Ridgeline } from './visualization/Archetypes';
import { selectVisualization } from './visualization/selector';

export default function ResultChart({ answer }: { answer: CensusAnswer }) {
  switch (selectVisualization(answer)) {
    case 'bivariate': return <BivariateChoropleth answer={answer} />;
    case 'hex-cartogram': return <HexCartogram answer={answer} />;
    case 'ridgeline': return <Ridgeline answer={answer} />;
    default: return <DotPlot answer={answer} />;
  }
}
