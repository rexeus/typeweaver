/**
 * @typedef {object} RuleCase
 * @property {string} name
 * @property {string} rule
 * @property {string} diagnostic
 * @property {unknown} options
 * @property {string} valid
 * @property {string} invalid
 */

/**
 * @param {number} caseCount
 * @returns {string}
 */
export const switchComplexity = caseCount =>
  [
    "function switchComplexity(value: number) {",
    "  switch (value) {",
    ...Array.from({ length: caseCount }, (_, index) => `    case ${index}:`),
    "      return true;",
    "    default:",
    "      return false;",
    "  }",
    "}",
  ].join("\n");

/**
 * @param {number} depth
 * @returns {string}
 */
export const nestedIfs = depth => {
  const opening = Array.from(
    { length: depth },
    (_, index) => `${"  ".repeat(index + 1)}if (values[${index}]) {`
  );
  const closing = Array.from(
    { length: depth },
    (_, index) => `${"  ".repeat(depth - index)}}`
  );
  return [
    "function nested(values: boolean[]) {",
    ...opening,
    `${"  ".repeat(depth + 1)}return true;`,
    ...closing,
    "  return false;",
    "}",
  ].join("\n");
};

/**
 * @param {number} valueLines
 * @returns {string}
 */
export const functionLines = valueLines =>
  [
    "function lines(): readonly number[] {",
    "",
    "  // Blank and comment-only lines must not count.",
    "  /* This comment-only line must not count either. */",
    "  return [",
    ...Array.from({ length: valueLines }, () => "    0,"),
    "  ];",
    "}",
  ].join("\n");

/**
 * @param {number} codeLines
 * @returns {string}
 */
export const fileLines = codeLines =>
  Array.from(
    { length: codeLines },
    (_, index) => `export const value${index} = ${index};`
  ).join("\n");

/**
 * @param {number} depth
 * @returns {string}
 */
export const nestedCallbacks = depth => {
  let body = "return value;";
  for (let index = 0; index < depth; index += 1) {
    body = `run(() => { ${body} });`;
  }
  return `function callbacks(run: (fn: () => unknown) => unknown, value: unknown) { ${body} }`;
};

/**
 * @param {number} count
 * @returns {string}
 */
export const statements = count =>
  [
    "function statements(value: (index: number) => void) {",
    ...Array.from({ length: count }, (_, index) => `  value(${index});`),
    "}",
  ].join("\n");

/**
 * @param {number} start
 * @returns {string[]}
 */
const nestedChain = start => [
  `  if (values[${start}]) {`,
  `    if (values[${start + 1}]) {`,
  `      if (values[${start + 2}]) {`,
  "        consume();",
  "      }",
  "    }",
  "  }",
];

/**
 * @param {boolean} withElse
 * @returns {string}
 */
export const cognitiveComplexity = withElse => {
  const lastFlat = withElse
    ? "  if (values[8]) { consume(); } else { consume(); }"
    : "  if (values[8]) { consume(); }";
  return [
    "function cognitive(values: boolean[], consume: () => void) {",
    ...nestedChain(0),
    ...nestedChain(3),
    "  if (values[6]) { consume(); }",
    "  if (values[7]) { consume(); }",
    lastFlat,
    "}",
  ].join("\n");
};

/**
 * @param {number} start
 * @param {number} operatorCount
 * @returns {string}
 */
const logicalChain = (start, operatorCount) =>
  Array.from(
    { length: operatorCount + 1 },
    (_, index) => `values[${start + index}]`
  ).join(" && ");

/**
 * @param {number} secondOperatorCount
 * @returns {string}
 */
export const expressionComplexity = secondOperatorCount =>
  [
    `function firstExpression(values: boolean[]) { return ${logicalChain(0, 6)}; }`,
    `function secondExpression(values: boolean[]) { return ${logicalChain(
      7,
      secondOperatorCount
    )}; }`,
  ].join("\n");

/** @type {RuleCase[]} */
export const ruleCases = [
  {
    name: "complexity",
    rule: "eslint/complexity",
    diagnostic: "eslint(complexity)",
    options: ["error", { max: 10, variant: "classic" }],
    valid: switchComplexity(9),
    invalid: switchComplexity(10),
  },
  {
    name: "max-depth",
    rule: "eslint/max-depth",
    diagnostic: "eslint(max-depth)",
    options: ["error", { max: 3 }],
    valid: nestedIfs(3),
    invalid: nestedIfs(4),
  },
  {
    name: "max-lines",
    rule: "eslint/max-lines",
    diagnostic: "eslint(max-lines)",
    options: ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    valid: fileLines(400),
    invalid: fileLines(401),
  },
  {
    name: "max-lines-per-function",
    rule: "eslint/max-lines-per-function",
    diagnostic: "eslint(max-lines-per-function)",
    options: ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    valid: functionLines(56),
    invalid: functionLines(57),
  },
  {
    name: "max-nested-callbacks",
    rule: "eslint/max-nested-callbacks",
    diagnostic: "eslint(max-nested-callbacks)",
    options: ["error", { max: 3 }],
    valid: nestedCallbacks(3),
    invalid: nestedCallbacks(4),
  },
  {
    name: "max-params",
    rule: "eslint/max-params",
    diagnostic: "eslint(max-params)",
    options: ["error", { max: 4, countThis: "except-void" }],
    valid:
      "function parameters(this: void, a: number, b: number, c: number, d: number) { return [a, b, c, d]; }",
    invalid:
      "function parameters(this: unknown, a: number, b: number, c: number, d: number) { return [a, b, c, d]; }",
  },
  {
    name: "max-statements",
    rule: "eslint/max-statements",
    diagnostic: "eslint(max-statements)",
    options: ["error", { max: 30 }],
    valid: statements(30),
    invalid: statements(31),
  },
  {
    name: "cognitive-complexity",
    rule: "sonarjs/cognitive-complexity",
    diagnostic: "sonarjs(cognitive-complexity)",
    options: ["error", 15],
    valid: cognitiveComplexity(false),
    invalid: cognitiveComplexity(true),
  },
  {
    name: "expression-complexity",
    rule: "sonarjs/expression-complexity",
    diagnostic: "sonarjs(expression-complexity)",
    options: ["error", { max: 6 }],
    valid: expressionComplexity(6),
    invalid: expressionComplexity(7),
  },
  {
    name: "no-nested-switch",
    rule: "sonarjs/no-nested-switch",
    diagnostic: "sonarjs(no-nested-switch)",
    options: "error",
    valid:
      "function switches(a: number, b: number) { switch (a) { case 1: return true; } switch (b) { case 2: return true; } return false; }",
    invalid:
      "function nestedSwitch(a: number, b: number) { switch (a) { case 1: switch (b) { case 2: return true; } } return false; }",
  },
];
