const stateFips: Record<string, string> = {
  alabama: '01', alaska: '02', arizona: '04', arkansas: '05', california: '06', colorado: '08', connecticut: '09', delaware: '10', florida: '12', georgia: '13', hawaii: '15', idaho: '16', illinois: '17', indiana: '18', iowa: '19', kansas: '20', kentucky: '21', louisiana: '22', maine: '23', maryland: '24', massachusetts: '25', michigan: '26', minnesota: '27', mississippi: '28', missouri: '29', montana: '30', nebraska: '31', nevada: '32', 'new hampshire': '33', 'new jersey': '34', 'new mexico': '35', 'new york': '36', 'north carolina': '37', 'north dakota': '38', ohio: '39', oklahoma: '40', oregon: '41', pennsylvania: '42', 'rhode island': '44', 'south carolina': '45', 'south dakota': '46', tennessee: '47', texas: '48', utah: '49', vermont: '50', virginia: '51', washington: '53', 'west virginia': '54', wisconsin: '55', wyoming: '56', 'district of columbia': '11', 'puerto rico': '72',
};

export function resolveStateFips(state: string | undefined): { name: string; fips: string } {
  if (!state) throw new Error('Name a state or territory so the Census geography can be resolved.');
  const key = state.trim().toLowerCase();
  const fips = stateFips[key];
  if (!fips) throw new Error(`The Census geography catalog could not resolve "${state}".`);
  return { name: state.trim().replace(/\b\w/g, (letter) => letter.toUpperCase()), fips };
}

export function resolveStateFipsList(states: string[]): { name: string; fips: string }[] {
  return states.map((state) => resolveStateFips(state));
}

export function findStateInQuestion(question: string): string | undefined {
  const normalized = question.toLowerCase();
  return Object.keys(stateFips).sort((a, b) => b.length - a.length).find((state) => normalized.includes(state));
}

export function findAllStatesInQuestion(question: string): string[] {
  const normalized = question.toLowerCase();
  const matches: Array<{ index: number; state: string }> = [];
  for (const state of Object.keys(stateFips).sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    for (const match of normalized.matchAll(pattern)) {
      if (matches.some((existing) => match.index! < existing.index + existing.state.length && match.index! + state.length > existing.index)) continue;
      matches.push({ index: match.index!, state });
    }
  }
  return matches.sort((a, b) => a.index - b.index).map((match) => match.state);
}
