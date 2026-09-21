import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writeConsumerSources } from "./fixture-sources.mjs";
import { contract, rootPackage, writeJson } from "./runtime.mjs";

/** @typedef {import("../tooling-types.mjs").PublicPackage} PublicPackage */
/** @typedef {{ archives: ReadonlyMap<string, string>, packages: readonly PublicPackage[] }} PackageOptions */

export const TYPESCRIPT_SPECIFIER = "npm:@typescript/typescript6@6.0.2";
export const ZOD_VERSION = "4.4.3";
export const NODE_TYPES_VERSION = "26.1.1";
export const HONO_VERSION = "4.12.32";
export const PLANNED_PLAIN_PLUGINS = [
  "types",
  "clients",
  "server",
  "hono",
  "command",
  "openapi",
  "aws-cdk",
];

/** @param {{ archives: ReadonlyMap<string, string>, packages: readonly PublicPackage[] }} options @returns {Record<string, string>} */
export const packedDependenciesFor = ({ archives, packages }) =>
  Object.fromEntries(
    packages.map(packageRecord => [
      packageRecord.name,
      `file:${String(archives.get(packageRecord.name))}`,
    ])
  );

/** @param {{ archives: ReadonlyMap<string, string>, effectVersion: string, packages: readonly PublicPackage[] }} options @returns {Record<string, string | undefined>} */
export const minimalDependencies = ({ archives, effectVersion, packages }) => ({
  "@rexeus/typeweaver": packedDependenciesFor({ archives, packages })[
    "@rexeus/typeweaver"
  ],
  "@rexeus/typeweaver-core": packedDependenciesFor({ archives, packages })[
    "@rexeus/typeweaver-core"
  ],
  "@types/node": NODE_TYPES_VERSION,
  effect: effectVersion,
  typescript: TYPESCRIPT_SPECIFIER,
  zod: ZOD_VERSION,
});

/** @param {{ archives: ReadonlyMap<string, string>, effectVersion: string, packages: readonly PublicPackage[] }} options @returns {Record<string, string | undefined>} */
export const allProjectionDependencies = options => ({
  ...minimalDependencies(options),
  hono: HONO_VERSION,
});

/** @param {string} fixtureRoot @returns {void} */
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

/** @param {{ dependencyVersion: string | undefined, fixtureRoot: string, generatorVersion: string, peerRange: string }} options @returns {void} */
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

/** @param {Record<string, string>} packedDependencies @param {string} effectVersion @returns {Record<string, string | undefined>} */
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

/** @param {PackageOptions & { effectVersion: string, fixtureRoot: string, pluginEffectVersion?: string }} options @returns {void} */
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

/** @param {{ dependencies: Readonly<Record<string, unknown>>, fixtureRoot: string, name: string, overrides: Readonly<Record<string, unknown>> }} options @returns {void} */
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
