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

/**
 * Creates an empty record without a prototype, so dynamic keys never resolve
 * inherited members such as `constructor` or `__proto__`.
 */
export function createNullPrototypeRecord<TValue>(): Record<string, TValue> {
  const record: Record<string, TValue> = {};
  Object.setPrototypeOf(record, null);
  return record;
}
