export type PlacesRecord = {
  locationid: string;
  locationname: string;
  data_value: string | null;
  measureid: string;
  data_value_type?: string;
};

const requiredFields = ['locationid', 'locationname', 'data_value', 'measureid'];

export function parsePlacesRows(payload: unknown): PlacesRecord[] {
  if (!Array.isArray(payload)) throw new Error('CDC PLACES response was not an array of records.');
  return payload.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`CDC PLACES record at index ${index} was not an object.`);
    const record = entry as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!(field in record)) throw new Error(`CDC PLACES record at index ${index} is missing required field "${field}".`);
    }
    return {
      locationid: String(record.locationid),
      locationname: String(record.locationname),
      data_value: record.data_value === null || record.data_value === undefined ? null : String(record.data_value),
      measureid: String(record.measureid),
      data_value_type: record.data_value_type === undefined ? undefined : String(record.data_value_type),
    };
  });
}
