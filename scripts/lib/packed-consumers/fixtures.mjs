import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contract, rootPackage, writeJson } from "./runtime.mjs";

/** @typedef {import("../tooling-types.mjs").PublicPackage} PublicPackage */

export const TYPESCRIPT_SPECIFIER = "npm:@typescript/typescript6@6.0.2";
export const ZOD_VERSION = "4.4.3";
export const NODE_TYPES_VERSION = "26.1.1";
export const HONO_VERSION = "4.12.32";

// The built-in plain projections exercised by the packed fixture. The
// Effect-native `effect` projection is deliberately excluded.
export const PLANNED_PLAIN_PLUGINS = [
  "types",
  "clients",
  "server",
  "hono",
  "command",
  "openapi",
  "aws-cdk",
];

/**
 * @param {{
 *   archives: ReadonlyMap<string, string>,
 *   packages: readonly PublicPackage[],
 * }} options
 * @returns {Record<string, string>}
 */
export const packedDependenciesFor = ({ archives, packages }) =>
  Object.fromEntries(
    packages.map(packageRecord => [
      packageRecord.name,
      `file:${String(archives.get(packageRecord.name))}`,
    ])
  );

/**
 * @param {{
 *   archives: ReadonlyMap<string, string>,
 *   effectVersion: string,
 *   packages: readonly PublicPackage[],
 * }} options
 * @returns {Record<string, string | undefined>}
 */
export const minimalDependencies = ({ archives, effectVersion, packages }) => {
  const packedDependencies = packedDependenciesFor({ archives, packages });
  return {
    "@rexeus/typeweaver": packedDependencies["@rexeus/typeweaver"],
    "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
    "@types/node": NODE_TYPES_VERSION,
    effect: effectVersion,
    typescript: TYPESCRIPT_SPECIFIER,
    zod: ZOD_VERSION,
  };
};

// Direct deps add hono because all advertised plain projections are exercised
// here; the generated Hono output imports it, so it is a truthful runtime dep.
/**
 * @param {{
 *   archives: ReadonlyMap<string, string>,
 *   effectVersion: string,
 *   packages: readonly PublicPackage[],
 * }} options
 * @returns {Record<string, string | undefined>}
 */
export const allProjectionDependencies = ({
  archives,
  effectVersion,
  packages,
}) => ({
  ...minimalDependencies({ archives, effectVersion, packages }),
  hono: HONO_VERSION,
});

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const writeStrictNpmrc = fixtureRoot => {
  writeFileSync(
    path.join(fixtureRoot, ".npmrc"),
    [
      "@rexeus:registry=http://127.0.0.1:9/",
      "auto-install-peers=false",
      "strict-peer-dependencies=true",
      "",
    ].join("\n")
  );
};

/**
 * @param {{
 *   dependencyVersion: string | undefined,
 *   fixtureRoot: string,
 *   generatorVersion: string,
 *   peerRange: string,
 * }} options
 * @returns {void}
 */
export const writePluginPackage = ({
  dependencyVersion,
  fixtureRoot,
  generatorVersion,
  peerRange,
}) => {
  const pluginRoot = path.join(fixtureRoot, "plugin");
  mkdirSync(pluginRoot, { recursive: true });
  writeJson(path.join(pluginRoot, "package.json"), {
    name: "typeweaver-plugin-packed-compat",
    version: "1.0.0",
    type: "module",
    exports: "./index.mjs",
    peerDependencies: {
      "@rexeus/typeweaver-gen": generatorVersion,
      ...(dependencyVersion === undefined ? { effect: peerRange } : {}),
    },
    ...(dependencyVersion === undefined
      ? {}
      : { dependencies: { effect: dependencyVersion } }),
  });
  writeFileSync(
    path.join(pluginRoot, "index.mjs"),
    [
      'import { PluginExecutionError, definePlugin } from "@rexeus/typeweaver-gen";',
      'import { Effect } from "effect";',
      "",
      '/** @type {import("@rexeus/typeweaver-gen").Plugin} */',
      "const packedCompatPlugin = definePlugin({",
      '  name: "packed-compat",',
      "  generate: context =>",
      '    Effect.succeed("packed-consumer-ok\\n").pipe(',
      "      Effect.flatMap(content =>",
      '        context.writeFileEffect("packed-compat/result.txt", content)',
      "      ),",
      "      Effect.mapError(",
      "        cause =>",
      "          new PluginExecutionError({",
      '            pluginName: "packed-compat",',
      '            phase: "generate",',
      "            cause,",
      "          })",
      "      )",
      "    ),",
      "});",
      "",
      "export default packedCompatPlugin;",
      "",
    ].join("\n")
  );
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
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

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const writeConsumerSources = fixtureRoot => {
  writeConsumerSpec(fixtureRoot);
  writeFileSync(
    path.join(fixtureRoot, "programmatic.ts"),
    [
      'import { Generator, effectRuntime } from "@rexeus/typeweaver";',
      'import type { GenerateFailure, GenerateParams } from "@rexeus/typeweaver";',
      'import type { Effect } from "effect";',
      "",
      "const params = {",
      '  inputFile: "./spec/index.ts",',
      '  outputDir: "./generated",',
      "} satisfies GenerateParams;",
      "",
      "const program = Generator.generate(params);",
      "type ProgramFailure = Effect.Effect.Error<typeof program>;",
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

/**
 * @param {Record<string, string>} packedDependencies
 * @param {string} effectVersion
 * @returns {Record<string, string | undefined>}
 */
const packedConsumerDependencies = (packedDependencies, effectVersion) => ({
  "@rexeus/typeweaver": packedDependencies["@rexeus/typeweaver"],
  "@rexeus/typeweaver-clients":
    packedDependencies["@rexeus/typeweaver-clients"],
  "@rexeus/typeweaver-command":
    packedDependencies["@rexeus/typeweaver-command"],
  "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
  "@rexeus/typeweaver-effect": packedDependencies["@rexeus/typeweaver-effect"],
  "@rexeus/typeweaver-gen": packedDependencies["@rexeus/typeweaver-gen"],
  "@rexeus/typeweaver-server": packedDependencies["@rexeus/typeweaver-server"],
  "@types/node": NODE_TYPES_VERSION,
  effect: effectVersion,
  hono: HONO_VERSION,
  "typeweaver-plugin-packed-compat": "file:./plugin",
  typescript: TYPESCRIPT_SPECIFIER,
  zod: ZOD_VERSION,
});

/**
 * @param {{
 *   archives: ReadonlyMap<string, string>,
 *   effectVersion: string,
 *   fixtureRoot: string,
 *   packages: readonly PublicPackage[],
 *   pluginEffectVersion?: string,
 * }} options
 * @returns {void}
 */
export const writeConsumerManifest = ({
  archives,
  effectVersion,
  fixtureRoot,
  packages,
  pluginEffectVersion,
}) => {
  const packedDependencies = packedDependenciesFor({ archives, packages });
  const generatorVersion = packages.find(
    packageRecord => packageRecord.name === "@rexeus/typeweaver-gen"
  )?.version;
  assert(generatorVersion, "missing @rexeus/typeweaver-gen package");
  writeJson(path.join(fixtureRoot, "package.json"), {
    name: `typeweaver-packed-consumer-${effectVersion}`,
    private: true,
    type: "module",
    packageManager: rootPackage.packageManager,
    dependencies: packedConsumerDependencies(packedDependencies, effectVersion),
    pnpm: { overrides: packedDependencies },
  });
  writeStrictNpmrc(fixtureRoot);
  writePluginPackage({
    dependencyVersion: pluginEffectVersion,
    fixtureRoot,
    generatorVersion,
    peerRange: contract.peerRange,
  });
  writeConsumerSources(fixtureRoot);
};

/**
 * @param {{
 *   dependencies: Readonly<Record<string, unknown>>,
 *   fixtureRoot: string,
 *   name: string,
 *   overrides: Readonly<Record<string, unknown>>,
 * }} options
 * @returns {void}
 */
export const writeFixtureManifest = ({
  dependencies,
  fixtureRoot,
  name,
  overrides,
}) => {
  writeJson(path.join(fixtureRoot, "package.json"), {
    name,
    private: true,
    type: "module",
    packageManager: rootPackage.packageManager,
    dependencies,
    pnpm: { overrides },
  });
};

/**
 * @param {string} fixtureRoot
 * @returns {{ configPath: string, outputRoot: string }}
 */
export const writeRuntimeConfig = fixtureRoot => {
  const outputRoot = path.join(fixtureRoot, "generated");
  const configPath = path.join(fixtureRoot, "typeweaver.config.mjs");
  const pluginPath = path.join(
    fixtureRoot,
    "node_modules",
    "typeweaver-plugin-packed-compat",
    "index.mjs"
  );
  writeFileSync(
    configPath,
    [
      "export default {",
      `  input: ${JSON.stringify(path.join(fixtureRoot, "spec", "index.ts"))},`,
      `  output: ${JSON.stringify(outputRoot)},`,
      `  plugins: ["clients", "command", "server", "effect", [${JSON.stringify(pluginPath)}, {}]],`,
      "};",
      "",
    ].join("\n")
  );
  return { configPath, outputRoot };
};

/**
 * @param {string} fixtureRoot
 * @returns {{ configPath: string, outputRoot: string }}
 */
export const writePlainProjectionsConfig = fixtureRoot => {
  const outputRoot = path.join(fixtureRoot, "generated");
  const configPath = path.join(fixtureRoot, "typeweaver.config.mjs");
  writeFileSync(
    configPath,
    [
      "export default {",
      `  input: ${JSON.stringify(path.join(fixtureRoot, "spec", "index.ts"))},`,
      `  output: ${JSON.stringify(outputRoot)},`,
      `  plugins: ${JSON.stringify(PLANNED_PLAIN_PLUGINS)},`,
      "};",
      "",
    ].join("\n")
  );
  return { configPath, outputRoot };
};

/**
 * @param {string} outputRoot
 * @returns {void}
 */
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
      'process.stdout.write("effect-adapter-ok\\\\n");',
      "",
    ].join("\n")
  );
};

/**
 * @param {{ fixtureRoot: string, outputRoot: string }} options
 * @returns {{ generatedTsconfig: string, generatedDist: string }}
 */
export const writeGeneratedCommandTsconfig = ({ fixtureRoot, outputRoot }) => {
  const generatedTsconfig = path.join(
    fixtureRoot,
    "generated-command.tsconfig.json"
  );
  const generatedDist = path.join(fixtureRoot, "generated-dist");
  writeJson(generatedTsconfig, {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: generatedDist,
      rootDir: outputRoot,
      skipLibCheck: false,
      strict: true,
      target: "ES2024",
      types: ["node"],
    },
    include: [
      path.join(outputRoot, "**/*.ts"),
      path.join(outputRoot, "**/*.mts"),
      path.join(outputRoot, "**/*.js"),
    ],
  });
  return { generatedTsconfig, generatedDist };
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
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
