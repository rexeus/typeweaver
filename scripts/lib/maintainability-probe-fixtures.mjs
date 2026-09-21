import { writeFileSync } from "node:fs";
import path from "node:path";

/** @param {string[]} lines */
const withBlankLines = lines =>
  lines.flatMap((line, index) =>
    index > 0 && index % 50 === 0 ? [line, ""] : [line]
  );

/** @param {number} codeLineCount */
export const fileLines = codeLineCount =>
  withBlankLines(
    Array.from(
      { length: codeLineCount },
      (_, index) => `export const value${index} = ${index};`
    ).concat("// Comments count toward the max-lines budget.")
  ).join("\n");

/** @param {number} flatBranchCount */
export const cognitiveComplexity = flatBranchCount =>
  [
    "function cognitive(values: boolean[], consume: () => void) {",
    "  if (values[0]) {",
    "    if (values[1]) {",
    "      if (values[2]) {",
    "        if (values[3]) { consume(); }",
    "      }",
    "    }",
    "  }",
    ...Array.from(
      { length: flatBranchCount },
      (_, index) => `  if (values[${index + 4}]) { consume(); }`
    ),
    "}",
  ].join("\n");

/** @param {number} runtimeCount */
export const dependencySource = runtimeCount =>
  [
    ...Array.from(
      { length: runtimeCount },
      (_, index) =>
        `import { dependency${index} } from "./dependency${index}.js";`
    ),
    'import type { TypeDependency } from "./type-dependency.js";',
    `export const value: TypeDependency = ${runtimeCount > 0 ? "dependency0" : "undefined"};`,
  ].join("\n");

/** @param {string} directory */
export const writeDependencySources = directory => {
  for (let index = 0; index < 10; index += 1) {
    writeFileSync(
      path.join(directory, `dependency${index}.ts`),
      `export const dependency${index} = ${index};\n`
    );
  }
  writeFileSync(
    path.join(directory, "type-dependency.ts"),
    "export type TypeDependency = number;\n"
  );
};
