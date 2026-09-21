import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** @param {string} fixtureRoot @returns {void} */
export const writeConsumerSpec = fixtureRoot => {
  const specRoot = path.join(fixtureRoot, "spec");
  mkdirSync(specRoot, { recursive: true });
  writeFileSync(
    path.join(specRoot, "index.ts"),
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      "",
      "const ok = defineResponse({",
      '  name: "Ok",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "OK",',
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Health API", version: "1.0.0" },',
      "  resources: {",
      "    health: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "ping",',
      '          path: "/ping",',
      "          method: HttpMethod.GET,",
      '          summary: "Ping",',
      "          request: {},",
      "          responses: [ok],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
};

/** @param {string} fixtureRoot @returns {void} */
export const writeConsumerSources = fixtureRoot => {
  writeConsumerSpec(fixtureRoot);
  writeFileSync(
    path.join(fixtureRoot, "programmatic.ts"),
    [
      'import { Generator, effectRuntime } from "@rexeus/typeweaver";',
      'import type { GenerateFailure, GenerateParams } from "@rexeus/typeweaver";',
      'import type { Error as EffectError } from "effect/Effect";',
      "",
      "const params = {",
      '  inputFile: "./spec/index.ts",',
      '  outputDir: "./generated",',
      "} satisfies GenerateParams;",
      "",
      "const program = Generator.generate(params);",
      "type ProgramFailure = EffectError<typeof program>;",
      "type ExactFailure =",
      "  [ProgramFailure] extends [GenerateFailure]",
      "    ? [GenerateFailure] extends [ProgramFailure]",
      "      ? true",
      "      : false",
      "    : false;",
      "const exactFailure: ExactFailure = true;",
      "void exactFailure;",
      "void effectRuntime;",
      "",
    ].join("\n")
  );
  writeJson(path.join(fixtureRoot, "tsconfig.json"), {
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: "ES2024",
      types: ["node"],
    },
    include: ["plugin/index.mjs", "programmatic.ts", "spec/index.ts"],
  });
};

/** @param {string} outputRoot @returns {void} */
export const writeEffectConsumerSource = outputRoot => {
  writeFileSync(
    path.join(outputRoot, "effect-consumer.ts"),
    [
      'import { createEffectHandlerRuntime } from "@rexeus/typeweaver-effect";',
      'import { Effect, Layer } from "effect";',
      'import { adaptHealthEffectHandlers } from "./health/EffectHealthApiHandler.js";',
      'import type { EffectHealthApiHandler, EffectHealthErrorMappers } from "./health/EffectHealthApiHandler.js";',
      'import { createOkResponse } from "./responses/OkResponse.js";',
      "",
      "const runtime = createEffectHandlerRuntime(Layer.empty);",
      "const handlers = {",
      "  handlePingRequest: () => Effect.succeed(createOkResponse()),",
      "} satisfies EffectHealthApiHandler<never, never>;",
      "const errorMappers = {",
      "  handlePingRequest: () => createOkResponse(),",
      "} satisfies EffectHealthErrorMappers<never>;",
      "const adapted = adaptHealthEffectHandlers(runtime, handlers, errorMappers);",
      'if (typeof adapted.handlePingRequest !== "function") throw new Error("missing Effect adapter");',
      "await runtime.dispose();",
      'process.stdout.write("effect-adapter-ok\\n");',
      "",
    ].join("\n")
  );
};

/** @param {string} fixtureRoot @returns {void} */
export const writeAppModule = fixtureRoot => {
  writeFileSync(
    path.join(fixtureRoot, "app.ts"),
    [
      'import { Effect } from "effect";',
      'import { createOkResponse } from "./generated/index.js";',
      "",
      "const response = createOkResponse();",
      "const value = await Effect.runPromise(Effect.succeed(response));",
      'if (value === undefined) throw new Error("missing generated response");',
      'process.stdout.write("effect-app-ok\\n");',
      "",
    ].join("\n")
  );
};

/** @param {string} filePath @param {unknown} value @returns {void} */
const writeJson = (filePath, value) =>
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
