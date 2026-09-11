export function parseCensusRows(rows: unknown): Array<Record<string, string | null>> {
  if (!Array.isArray(rows) || rows.length < 1 || !Array.isArray(rows[0])) throw new Error('Census response did not contain a valid header row.');
  const headers = rows[0].map(String);
  return rows.slice(1).filter(Array.isArray).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] == null ? null : String(row[index])] )));
}
