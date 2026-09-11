export type Geography = { name: string; stateFips: string; countyFips: string };

const virginiaCounties: Record<string, Geography> = {
  'fairfax county': { name: 'Fairfax County', stateFips: '51', countyFips: '059' },
  'loudoun county': { name: 'Loudoun County', stateFips: '51', countyFips: '107' },
  'henrico county': { name: 'Henrico County', stateFips: '51', countyFips: '087' },
  'chesterfield county': { name: 'Chesterfield County', stateFips: '51', countyFips: '041' },
  'arlington county': { name: 'Arlington County', stateFips: '51', countyFips: '013' },
  'alexandria city': { name: 'Alexandria city', stateFips: '51', countyFips: '510' },
};

export function resolveCounties(names: string[], state = 'Virginia'): Geography[] {
  if (state.toLowerCase() !== 'virginia') throw new Error(`Only Virginia counties are configured for the MVP.`);
  return names.map((name) => {
    const geography = virginiaCounties[name.toLowerCase().trim()];
    if (!geography) throw new Error(`Could not resolve ${name} in the geography catalog.`);
    return geography;
  });
}

export function allVirginiaCounties(): Geography[] { return Object.values(virginiaCounties); }
