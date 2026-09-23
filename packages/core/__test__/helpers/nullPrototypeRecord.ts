/** Copies properties onto a record whose prototype is `null`. */
export const aNullPrototypeRecordWith = (
  properties: Record<string, unknown>
): Record<string, unknown> => {
  const record: Record<string, unknown> = { ...properties };
  if (!Reflect.setPrototypeOf(record, null)) {
    throw new TypeError("Expected the record prototype to be replaceable");
  }

  return record;
};
