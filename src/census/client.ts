import type { CensusAnswer, EvidenceRequest, QuestionIntent } from '../shared/contracts.js';
import { BASELINE_YEAR, CENSUS_YEAR, defaultYearsForOperation, metricCatalog } from './catalog.js';
import { rankGrowth } from './calculations.js';
import { parseCensusRows } from './responseValidation.js';
import { resolveStateFips, resolveStateFipsList } from './states.js';

const CENSUS_API = 'https://api.census.gov/data';
type CensusRecord = Record<string, string | null>;

function censusName(record: CensusRecord): string {
  return (record.NAME ?? 'Unknown county').split(',')[0].trim();
}

function geographyId(record: CensusRecord): { stateFips: string; countyFips?: string } | undefined {
  if (!record.state) return undefined;
  return record.county ? { stateFips: record.state, countyFips: record.county } : { stateFips: record.state };
}

function numericValue(record: CensusRecord, variable: string): number | null {
  const value = record[variable];
  if (value === null || value === undefined || value === '' || value === '-666666666') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function queryCensus(year: string, variableIds: string[], state: string | undefined): Promise<{ rows: CensusRecord[]; requestUrl: string }> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) throw new Error('CENSUS_API_KEY is not configured on the server. Add it to the server environment and restart.');
  const resolvedState = resolveStateFips(state);
  const publicParams = new URLSearchParams({ get: ['NAME', ...variableIds].join(','), for: 'county:*', in: `state:${resolvedState.fips}` });
  const requestParams = new URLSearchParams(publicParams);
  requestParams.set('key', apiKey);
  const requestUrl = `${CENSUS_API}/${year}/acs/acs5?${publicParams.toString()}`;
  const response = await fetch(`${CENSUS_API}/${year}/acs/acs5?${requestParams.toString()}`);
  if (!response.ok) throw new Error(`Census API returned ${response.status} for the ${year} ACS request.`);
  const payload: unknown = await response.json();
  return { rows: parseCensusRows(payload, ['NAME', ...variableIds]), requestUrl };
}

async function queryCensusStates(year: string, variableIds: string[], states: string[]): Promise<{ rows: CensusRecord[]; requestUrl: string }> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) throw new Error('CENSUS_API_KEY is not configured on the server. Add it to the server environment and restart.');
  const fipsList = resolveStateFipsList(states).map((resolved) => resolved.fips);
  const publicParams = new URLSearchParams({ get: ['NAME', ...variableIds].join(','), for: `state:${fipsList.join(',')}` });
  const requestParams = new URLSearchParams(publicParams);
  requestParams.set('key', apiKey);
  const requestUrl = `${CENSUS_API}/${year}/acs/acs5?${publicParams.toString()}`;
  const response = await fetch(`${CENSUS_API}/${year}/acs/acs5?${requestParams.toString()}`);
  if (!response.ok) throw new Error(`Census API returned ${response.status} for the ${year} ACS request.`);
  const payload: unknown = await response.json();
  return { rows: parseCensusRows(payload, ['NAME', ...variableIds]), requestUrl };
}

function selectedRows(rows: CensusRecord[], intent: QuestionIntent): CensusRecord[] {
  if (!intent.counties?.length) return rows;
  const requested = new Set(intent.counties.map((county) => county.toLowerCase()));
  return rows.filter((row) => requested.has(censusName(row).toLowerCase()));
}

function unmatchedCounties(rows: CensusRecord[], intent: QuestionIntent): string[] {
  if (!intent.counties?.length) return [];
  const available = new Set(rows.map((row) => censusName(row).toLowerCase()));
  return intent.counties.filter((county) => !available.has(county.toLowerCase()));
}

export async function runCensusIntent(intent: QuestionIntent): Promise<CensusAnswer> {
  const definition = metricCatalog[intent.metric];
  const requestedYears = intent.years.length ? intent.years : defaultYearsForOperation(intent.operation);
  const requestedYear = requestedYears[0] ?? CENSUS_YEAR;
  const baselineYear = intent.comparison?.baselineYear ?? requestedYears[0] ?? BASELINE_YEAR;
  const laterYear = intent.comparison?.laterYear ?? requestedYears[1] ?? CENSUS_YEAR;
  let rows: CensusAnswer['rows'];
  let calculation = 'Values retrieved from the approved ACS catalog.';
  let requests: EvidenceRequest[] = [];
  const warnings: string[] = [];

  if (intent.geography === 'state') {
    if (intent.metric !== 'poverty_rate') throw new Error('State-level comparison is only configured for the poverty rate metric right now.');
    const states = intent.states ?? [];
    const result = await queryCensusStates(requestedYear, ['B17001_002E', 'B17001_001E'], states);
    requests = [{ vintage: requestedYear, url: result.requestUrl }];
    rows = result.rows.map((row) => {
      const below = numericValue(row, 'B17001_002E');
      const universe = numericValue(row, 'B17001_001E');
      return { geography: censusName(row), geographyId: geographyId(row), values: { povertyRate: universe ? ((below ?? 0) / universe) * 100 : null } };
    }).sort((a, b) => (b.values.povertyRate ?? 0) - (a.values.povertyRate ?? 0));
    calculation = 'poverty rate = population below poverty level / population for whom poverty status is determined * 100';
    const stateNames = resolveStateFipsList(states).map((resolved) => resolved.name);
    const filters = { states: stateNames.join(', '), metric: intent.metric };
    return {
      summary: buildSummary(intent, rows, requests),
      rows,
      evidence: {
        dataset: definition.dataset,
        vintage: requests.map((request) => request.vintage).join(', '),
        variables: definition.variables.map((item) => ({ ...item })),
        geography: stateNames.join(', '),
        filters,
        requests,
        rawValues: rows.map((row) => ({ geography: row.geography, ...row.values })),
        calculation,
        retrievedAt: new Date().toISOString(),
      },
      warnings,
    };
  }

  if (intent.metric === 'population') {
    if (intent.operation === 'compare') {
      const result = await queryCensus(requestedYear, ['B01003_001E'], intent.state);
      requests = [{ vintage: requestedYear, url: result.requestUrl }];
      rows = selectedRows(result.rows, intent).map((row) => ({ geography: censusName(row), geographyId: geographyId(row), values: { population: numericValue(row, 'B01003_001E') } })).sort((a, b) => (b.values.population ?? 0) - (a.values.population ?? 0));
      calculation = `Compare total population values from the ${requestedYear} ACS vintage.`;
    } else {
      const baseline = await queryCensus(baselineYear, ['B01003_001E'], intent.state);
      const later = await queryCensus(laterYear, ['B01003_001E'], intent.state);
      requests = [{ vintage: baselineYear, url: baseline.requestUrl }, { vintage: laterYear, url: later.requestUrl }];
      const laterByCounty = new Map(selectedRows(later.rows, intent).map((row) => [censusName(row), numericValue(row, 'B01003_001E')]));
      rows = rankGrowth(selectedRows(baseline.rows, intent).map((row) => ({ geography: censusName(row), values: { [baselineYear]: numericValue(row, 'B01003_001E'), [laterYear]: laterByCounty.get(censusName(row)) ?? null } })), baselineYear, laterYear).map((resultRow) => ({ ...resultRow, geographyId: selectedRows(baseline.rows, intent).find((row) => censusName(row) === resultRow.geography) ? geographyId(selectedRows(baseline.rows, intent).find((row) => censusName(row) === resultRow.geography)!) : undefined }));
      calculation = `percentage change = (later - baseline) / baseline * 100; baseline=${baselineYear}, later=${laterYear}`;
    }
  } else if (intent.metric === 'median_household_income') {
    const result = await queryCensus(requestedYear, ['B19013_001E'], intent.state);
    requests = [{ vintage: requestedYear, url: result.requestUrl }];
    const missingCounties = unmatchedCounties(result.rows, intent);
    if (missingCounties.length) warnings.push(`No Census rows matched: ${missingCounties.join(', ')}.`);
    rows = selectedRows(result.rows, intent).map((row) => ({ geography: censusName(row), geographyId: geographyId(row), values: { medianHouseholdIncome: numericValue(row, 'B19013_001E') } })).sort((a, b) => (b.values.medianHouseholdIncome ?? 0) - (a.values.medianHouseholdIncome ?? 0)).slice(0, intent.limit);
  } else if (intent.metric === 'work_from_home') {
    const variableIds = ['B08301_021E', 'B08301_001E'];
    const baseline = await queryCensus(baselineYear, variableIds, intent.state);
    const later = await queryCensus(laterYear, variableIds, intent.state);
    requests = [{ vintage: baselineYear, url: baseline.requestUrl }, { vintage: laterYear, url: later.requestUrl }];
    const laterByCounty = new Map(selectedRows(later.rows, intent).map((row) => [censusName(row), row]));
    let droppedRows = 0;
    rows = selectedRows(baseline.rows, intent).flatMap((row) => {
      const laterRow = laterByCounty.get(censusName(row));
      const baselineWorkers = numericValue(row, 'B08301_001E');
      const laterWorkers = laterRow ? numericValue(laterRow, 'B08301_001E') : null;
      const baselineAtHome = numericValue(row, 'B08301_021E');
      const laterAtHome = laterRow ? numericValue(laterRow, 'B08301_021E') : null;
      if (!baselineWorkers || !laterWorkers || baselineAtHome === null || laterAtHome === null) { droppedRows += 1; return []; }
      const baselineShare = (baselineAtHome / baselineWorkers) * 100;
      const laterShare = (laterAtHome / laterWorkers) * 100;
      return [{ geography: censusName(row), geographyId: geographyId(row), values: { baselineShare, laterShare, percentagePointChange: laterShare - baselineShare } }];
    }).sort((a, b) => (b.values.percentagePointChange ?? 0) - (a.values.percentagePointChange ?? 0));
    if (droppedRows) warnings.push(`${droppedRows} counties were excluded because one or more work-from-home values were missing or invalid.`);
    calculation = 'percentage-point change = later work-from-home share - baseline share';
  } else {
    const result = await queryCensus(requestedYear, definition.variables.map((item) => item.id), intent.state);
    requests = [{ vintage: requestedYear, url: result.requestUrl }];
    const olderVariables = definition.variables.filter((item) => item.id.startsWith('B01001_0') && item.id !== 'B01001_001E').map((item) => item.id);
    const agingThreshold = intent.filters?.agingThreshold ?? 20;
    const incomeThreshold = intent.filters?.incomeThreshold ?? 60000;
    rows = selectedRows(result.rows, intent).map((row) => {
      const total = numericValue(row, 'B01001_001E');
      const older = olderVariables.reduce((sum, variable) => sum + (numericValue(row, variable) ?? 0), 0);
      return { geography: censusName(row), geographyId: geographyId(row), values: { olderPopulationShare: total ? (older / total) * 100 : null, medianHouseholdIncome: numericValue(row, 'B19013_001E') } };
    }).filter((row) => (row.values.olderPopulationShare ?? 0) >= agingThreshold && (row.values.medianHouseholdIncome ?? Infinity) < incomeThreshold);
    calculation = `Match rows where older population share is at least ${agingThreshold}% and median household income is below $${incomeThreshold.toLocaleString()}.`;
  }

  const stateName = resolveStateFips(intent.state).name;
  const filters = { state: stateName, metric: intent.metric, ...(intent.metric === 'aging_and_income' ? { agingThreshold: String(intent.filters?.agingThreshold ?? 20), incomeThreshold: String(intent.filters?.incomeThreshold ?? 60000) } : {}) };
  return { summary: buildSummary(intent, rows, requests), rows, evidence: { dataset: definition.dataset, vintage: requests.map((request) => request.vintage).join(', '), variables: definition.variables.map((item) => ({ ...item })), geography: `${stateName} counties`, filters, requests, rawValues: rows.map((row) => ({ geography: row.geography, ...row.values })), calculation, retrievedAt: new Date().toISOString() }, warnings };
}

function buildSummary(intent: QuestionIntent, rows: CensusAnswer['rows'], requests: EvidenceRequest[]): string {
  const state = intent.state ?? 'the requested state';
  const vintage = requests.map((request) => request.vintage).join(' to ');
  if (intent.metric === 'poverty_rate') return rows.length ? `${rows[0].geography} has the highest poverty rate among ${(intent.states ?? []).join(', ')} using ${vintage} ACS data.` : `No valid poverty rate rows were available for ${vintage}.`;
  if (intent.metric === 'population') return rows.length ? `${rows[0].geography} has the largest ${intent.operation === 'growth' ? 'population growth' : 'population'} in the ${state} county comparison using ${vintage} ACS data.` : `No valid population rows were available for ${vintage}.`;
  if (intent.metric === 'median_household_income') return rows.length ? `${rows[0].geography} has the highest median household income among the selected ${state} counties using ${vintage} ACS data.` : `No matching counties were available for ${vintage}.`;
  if (intent.metric === 'work_from_home') return rows.length ? `${rows[0].geography} has the largest percentage-point change in work-from-home share using ${vintage} ACS data.` : `No valid work-from-home rows were available for ${vintage}.`;
  const agingThreshold = intent.filters?.agingThreshold ?? 20;
  const incomeThreshold = intent.filters?.incomeThreshold ?? 60000;
  return rows.length ? `${rows.length} communities have at least ${agingThreshold}% older residents and median household income below $${incomeThreshold.toLocaleString()} using ${vintage} ACS data.` : `No communities met the ${agingThreshold}% older-resident and $${incomeThreshold.toLocaleString()} income thresholds using ${vintage} ACS data.`;
}
