export type CensusVariableMetadata = {
  id: string;
  label: string;
  concept?: string;
  predicateType?: string;
  group?: string;
  attributes?: string;
  limit?: number;
};

type CensusVariablesResponse = { variables?: Record<string, Omit<CensusVariableMetadata, 'id'>> };

const metadataCache = new Map<string, CensusVariableMetadata[]>();

export async function searchCensusVariables(query: string, year = '2023'): Promise<CensusVariableMetadata[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];
  const cacheKey = `${year}:acs5`;
  let variables = metadataCache.get(cacheKey);
  if (!variables) {
    const response = await fetch(`https://api.census.gov/data/${year}/acs/acs5/variables.json`);
    if (!response.ok) throw new Error(`Census metadata returned ${response.status}.`);
    const payload = await response.json() as CensusVariablesResponse;
    variables = Object.entries(payload.variables ?? {}).map(([id, definition]) => ({ id, ...definition }));
    metadataCache.set(cacheKey, variables);
  }
  return variables
    .filter((variable) => `${variable.id} ${variable.label} ${variable.concept ?? ''} ${variable.group ?? ''}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 25);
}

export async function getCensusVariable(id: string, year = '2023'): Promise<CensusVariableMetadata | undefined> {
  const results = await searchCensusVariables(id, year);
  return results.find((variable) => variable.id === id);
}
