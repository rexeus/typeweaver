import fs from "node:fs";

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads a JSON file and fails the test unless it holds a JSON object. */
export const readJsonObject = (filePath: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!isJsonObject(parsed)) {
    throw new TypeError(`Expected ${filePath} to contain a JSON object`);
  }

  return parsed;
};
