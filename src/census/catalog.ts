export const CENSUS_YEAR = '2023';
export const BASELINE_YEAR = '2021';

export function defaultYearsForOperation(operation: 'compare' | 'growth' | 'change' | 'filter'): string[] {
  return operation === 'growth' || operation === 'change'
    ? [BASELINE_YEAR, CENSUS_YEAR]
    : [CENSUS_YEAR];
}

export const metricCatalog = {
  population: { label: 'Population', dataset: 'ACS 5-year estimates', variables: [{ id: 'B01003_001E', label: 'Total population', unit: 'people' }] },
  work_from_home: { label: 'Work from home', dataset: 'ACS 5-year estimates', variables: [{ id: 'B08301_021E', label: 'Worked from home', unit: 'people' }, { id: 'B08301_001E', label: 'Workers 16 years and over', unit: 'people' }] },
  median_household_income: { label: 'Median household income', dataset: 'ACS 5-year estimates', variables: [{ id: 'B19013_001E', label: 'Median household income', unit: 'USD' }] },
  poverty_rate: { label: 'Poverty rate', dataset: 'ACS 5-year estimates', variables: [
    { id: 'B17001_002E', label: 'Population below poverty level', unit: 'people' },
    { id: 'B17001_001E', label: 'Population for whom poverty status is determined', unit: 'people' },
  ] },
  aging_and_income: { label: 'Aging and income', dataset: 'ACS 5-year estimates', variables: [
    { id: 'B01001_001E', label: 'Total population', unit: 'people' },
    { id: 'B01001_020E', label: 'Male population 65 to 66 years', unit: 'people' },
    { id: 'B01001_021E', label: 'Male population 67 to 69 years', unit: 'people' },
    { id: 'B01001_022E', label: 'Male population 70 to 74 years', unit: 'people' },
    { id: 'B01001_023E', label: 'Male population 75 to 79 years', unit: 'people' },
    { id: 'B01001_024E', label: 'Male population 80 to 84 years', unit: 'people' },
    { id: 'B01001_025E', label: 'Male population 85 years and over', unit: 'people' },
    { id: 'B01001_044E', label: 'Female population 65 to 66 years', unit: 'people' },
    { id: 'B01001_045E', label: 'Female population 67 to 69 years', unit: 'people' },
    { id: 'B01001_046E', label: 'Female population 70 to 74 years', unit: 'people' },
    { id: 'B01001_047E', label: 'Female population 75 to 79 years', unit: 'people' },
    { id: 'B01001_048E', label: 'Female population 80 to 84 years', unit: 'people' },
    { id: 'B01001_049E', label: 'Female population 85 years and over', unit: 'people' },
    { id: 'B19013_001E', label: 'Median household income', unit: 'USD' },
  ] },
} as const;
