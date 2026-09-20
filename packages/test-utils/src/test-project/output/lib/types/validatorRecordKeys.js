import { z } from "zod";
import { getContainerSchema } from "./validatorSchemaAnalysis.js";
const reservedRecordKey = "__proto__";
/**
 * Reports record keys that the record's key schema does not preserve
 * exactly.
 *
 * Zod record parsing does not preserve `__proto__`, and opaque Zod string
 * overwrites (`.trim()`, `.toLowerCase()`, `.toUpperCase()`) can change key
 * identity or emit a reserved key. Each own raw key is parsed with the
 * record's key schema before the container parse: a key that fails parsing,
 * produces a non-string, changes identity, or resolves to `__proto__` is
 * reported instead of being silently dropped. `constructor` and `toString`
 * are ordinary supported keys and are not reported.
 */
export function findRecordKeyIdentityIssues(data, schema) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const container = getContainerSchema(schema);
  if (!(container instanceof z.ZodRecord)) {
    return [];
  }
  const issues = [];
  const keySchema = container.keyType;
  if (!(keySchema instanceof z.ZodType)) {
    return issues;
  }
  for (const rawKey of Object.keys(data)) {
    const issue = classifyRecordKeyIssue(rawKey, keySchema);
    if (issue !== undefined) {
      issues.push(issue);
    }
  }
  return issues;
}
function classifyRecordKeyIssue(rawKey, keySchema) {
  const parsedKey = keySchema.safeParse(rawKey);
  if (!parsedKey.success) {
    return createRecordKeyIssue(
      rawKey,
      `Record key '${rawKey}' is rejected by the record key schema`,
    );
  }
  const parsedOutput = parsedKey.data;
  if (typeof parsedOutput !== "string") {
    return createRecordKeyIssue(rawKey, `Record key '${rawKey}' must produce a string`);
  }
  if (parsedOutput !== rawKey) {
    return createRecordKeyIssue(
      rawKey,
      `Record key '${rawKey}' is not preserved by the record key schema`,
    );
  }
  if (rawKey === reservedRecordKey) {
    return createRecordKeyIssue(
      rawKey,
      `Reserved HTTP record key '${reservedRecordKey}' is not supported`,
    );
  }
  return undefined;
}
function createRecordKeyIssue(rawKey, message) {
  return {
    code: "custom",
    input: rawKey,
    path: [rawKey],
    message,
  };
}
