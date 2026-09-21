import fs from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import type { LoadedSpec } from "../src/services/SpecLoader.js";

const SPEC_DECLARATION = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

export const expectBundledArtifacts = (outputDir: string): void => {
  expect(fs.readdirSync(outputDir).sort()).toEqual(["spec.d.ts", "spec.js"]);
  expect(fs.readFileSync(path.join(outputDir, "spec.d.ts"), "utf8")).toBe(
    SPEC_DECLARATION
  );
};

export const expectSingleTodoResource = (loadedSpec: LoadedSpec): void => {
  expect(Object.keys(loadedSpec.definition.resources)).toEqual(["todos"]);
  expect(loadedSpec.definition.resources["todos"]?.operations).toHaveLength(1);
  expect(loadedSpec.normalizedSpec.resources).toEqual([
    expect.objectContaining({
      name: "todos",
      operations: [
        expect.objectContaining({
          operationId: "getTodo",
          path: "/todos/:todoId",
        }) as unknown,
      ],
    }) as unknown,
  ]);
};
