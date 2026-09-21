/** @type {(value: unknown) => value is unknown[]} */
export const isArray = Array.isArray;

/** @param {unknown} value @returns {value is string} */
export const isNonEmptyString = value =>
  typeof value === "string" && value.length > 0;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isRecord = value =>
  typeof value === "object" && value !== null && !Array.isArray(value);
