export function appendRequestRecordValue(
  record: Record<string, string | string[]>,
  key: string,
  value: string,
): void {
  const existing = record[key];
  if (existing === undefined) record[key] = value;
  else if (Array.isArray(existing)) existing.push(value);
  else record[key] = [existing, value];
}
