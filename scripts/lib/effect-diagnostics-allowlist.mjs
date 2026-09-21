import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isExcludedEffectPath,
  toWorkspacePath,
  workspaceRoot,
} from "./effect-diagnostics-projects.mjs";

/** @typedef {{ file: string, rules: Record<string, number> }} EffectDirectiveAllowlistEntry */
/** @typedef {{ version: number, total: number, rationales: Record<string, string>, exceptions: EffectDirectiveAllowlistEntry[] }} EffectDirectiveAllowlist */

const sourceExtensions = new Set([".ts", ".tsx"]);
const allowlistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../config/effect-diagnostics-allowlist.json"
);
/** @type {EffectDirectiveAllowlist} */
const directiveAllowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

/** @param {string} comment @returns {string} */
const parseDirectiveRule = comment => {
  const matches = [
    ...comment.matchAll(
      /@effect-diagnostics-next-line ([a-z][a-zA-Z0-9]*):off/gu
    ),
  ];
  const normalized = comment.trim();
  const valid =
    /^\/\/\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off$/u.test(
      normalized
    ) ||
    /^\?\s+\/\/\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off$/u.test(
      normalized
    ) ||
    /^\/\*\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off\s*\*\/$/u.test(
      normalized
    );
  if (matches.length === 0 || !valid) {
    throw new Error(
      "Effect diagnostic exceptions must be exact @effect-diagnostics-next-line <rule>:off comments"
    );
  }
  const rule = matches[0]?.[1];
  if (matches.length !== 1 || rule === undefined) {
    throw new Error("Effect diagnostic exceptions must name exactly one rule");
  }
  return rule;
};

/** @param {string} comment @param {Record<string, "error" | "warning">} severityMap @returns {string} */
export const validateEffectDirective = (comment, severityMap) => {
  const rule = parseDirectiveRule(comment);
  if (
    severityMap[rule] === undefined ||
    directiveAllowlist.rationales[rule] === undefined
  ) {
    throw new Error(
      `Effect diagnostic exception is not in the retained exception allowlist: ${rule}`
    );
  }
  return rule;
};

const authoredTypeScriptFiles = () => {
  /** @param {string} directory @returns {string[]} */
  const collect = directory => {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      if (
        entry.isDirectory() &&
        ["dist", "node_modules", "output", "outputs"].includes(entry.name)
      ) {
        return [];
      }
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? collect(target) : [target];
    });
  };
  return collect(path.join(workspaceRoot, "packages")).filter(
    /** @param {string} filePath */
    filePath =>
      sourceExtensions.has(path.extname(filePath)) &&
      !isExcludedEffectPath(toWorkspacePath(filePath))
  );
};

/** @param {Record<string, number>} counts @param {string} file @param {string} rule @returns {void} */
const addDirective = (counts, file, rule) => {
  const key = `${file}|${rule}`;
  counts[key] = (counts[key] ?? 0) + 1;
};

/** @param {Record<string, "error" | "warning">} severityMap @returns {Record<string, number>} */
const collectDirectiveCounts = severityMap => {
  const counts = {};
  for (const filePath of authoredTypeScriptFiles()) {
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      if (line.includes("@effect-diagnostics")) {
        addDirective(
          counts,
          toWorkspacePath(filePath),
          validateEffectDirective(line, severityMap)
        );
      }
    }
  }
  return counts;
};

/** @param {Record<string, "error" | "warning">} severityMap @returns {Record<string, number>} */
const expectedDirectiveCounts = severityMap => {
  const expected = Object.assign(
    {},
    ...directiveAllowlist.exceptions.map(entry => {
      if (entry.file.endsWith("/") || isExcludedEffectPath(entry.file)) {
        throw new Error(
          `Effect diagnostic allowlist contains an excluded file: ${entry.file}`
        );
      }
      return Object.fromEntries(
        Object.entries(entry.rules).map(([rule, count]) => {
          if (
            !Number.isInteger(count) ||
            count < 1 ||
            severityMap[rule] === undefined ||
            directiveAllowlist.rationales[rule]?.trim() === ""
          ) {
            throw new Error(
              `Effect diagnostic allowlist rule is invalid: ${entry.file} ${rule}`
            );
          }
          return [`${entry.file}|${rule}`, count];
        })
      );
    })
  );
  if (
    directiveAllowlist.total !==
    Object.values(expected).reduce((sum, count) => sum + count, 0)
  ) {
    throw new Error(
      "Effect diagnostic allowlist total does not match its entries"
    );
  }
  return expected;
};

/** @param {Record<string, number>} values @returns {Record<string, number>} */
const normalizeCounts = values =>
  Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
  );

/** @param {Record<string, "error" | "warning">} severityMap @returns {void} */
export const assertEffectDirectiveAllowlist = severityMap => {
  const actual = collectDirectiveCounts(severityMap);
  const expected = expectedDirectiveCounts(severityMap);
  if (
    JSON.stringify(normalizeCounts(actual)) !==
    JSON.stringify(normalizeCounts(expected))
  ) {
    throw new Error(
      `Effect diagnostic allowlist mismatch:\nexpected ${JSON.stringify(expected)}\nactual ${JSON.stringify(actual)}`
    );
  }
};
