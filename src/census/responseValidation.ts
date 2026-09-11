export function parseCensusRows(rows: unknown, expectedHeaders: string[] = []): Array<Record<string, string | null>> {
  if (!Array.isArray(rows) || rows.length < 1 || !Array.isArray(rows[0])) throw new Error('Census response did not contain a valid header row.');
  const headers = rows[0].map(String);
  if (headers.length === 0 || headers.some((header) => !header)) throw new Error('Census response contained an empty header.');
  if (new Set(headers).size !== headers.length) throw new Error('Census response contained duplicate headers.');
  const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Census response was missing expected columns: ${missingHeaders.join(', ')}.`);
  const dataRows = rows.slice(1);
  if (dataRows.some((row) => !Array.isArray(row) || row.length !== headers.length)) throw new Error('Census response contained a row with the wrong number of columns.');
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] == null ? null : String(row[index])] )));
}
