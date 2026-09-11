import type { PlacesRecord } from './placesResponseValidation.js';
import { parsePlacesRows } from './placesResponseValidation.js';
import { resolveStateFips } from './states.js';

const PLACES_API = 'https://data.cdc.gov/resource/swc5-untb.json';

export async function queryPlacesCounty(year: string, measureId: string, state: string | undefined): Promise<{ rows: PlacesRecord[]; requestUrl: string }> {
  const resolvedState = resolveStateFips(state);
  const where = `year='${year}' AND statedesc='${resolvedState.name}' AND measureid='${measureId}' AND data_value_type='Crude prevalence'`;
  const publicParams = new URLSearchParams({ $where: where, $limit: '5000' });
  const requestParams = new URLSearchParams(publicParams);
  const appToken = process.env.PLACES_APP_TOKEN;
  if (appToken) requestParams.set('$$app_token', appToken);
  const requestUrl = `${PLACES_API}?${publicParams.toString()}`;
  const response = await fetch(`${PLACES_API}?${requestParams.toString()}`);
  if (!response.ok) throw new Error(`CDC PLACES API returned ${response.status} for the ${year} diabetes prevalence request.`);
  const payload: unknown = await response.json();
  return { rows: parsePlacesRows(payload), requestUrl };
}
