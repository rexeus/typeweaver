import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const packageRoot = path.join(workspaceRoot, "packages");
const contract = JSON.parse(
  readFileSync(path.join(workspaceRoot, "config/effect-baseline.json"), "utf8")
);
const rootPackage = JSON.parse(
  readFileSync(path.join(workspaceRoot, "package.json"), "utf8")
);
const archiveName = ({ name, version }) =>
  `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;
const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));
const writeJson = (filePath, value) =>
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

const run = ({ args, cwd }) => {
  const result = spawnPnpmSync({
    args,
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `pnpm ${args.join(" ")} failed with exit code ${String(result.status)}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result.stdout;
};

const runNode = ({ args, cwd }) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    [
      `node ${args.join(" ")} failed with exit code ${String(result.status)}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ]
      .filter(Boolean)
      .join("\n")
  );
  assert.equal(result.stderr, "");
  return result.stdout;
};

const collectPublishablePackages = () =>
  readdirSync(packageRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const packageJsonPath = path.join(
        packageRoot,
        entry.name,
        "package.json"
      );
      if (!existsSync(packageJsonPath)) {
        return [];
      }
      const packageJson = readJson(packageJsonPath);
      if (
        packageJson.private === true ||
        typeof packageJson.name !== "string" ||
        typeof packageJson.version !== "string"
      ) {
        return [];
      }
      return [
        {
          directory: path.dirname(packageJsonPath),
          manifest: packageJson,
          name: packageJson.name,
          version: packageJson.version,
        },
      ];
    });

const packWorkspace = ({ archiveRoot, packages }) => {
  run({
    args: [
      "-r",
      "--filter",
      "./packages/**",
      "pack",
      "--config.ignore-scripts=true",
      "--pack-destination",
      archiveRoot,
    ],
    cwd: workspaceRoot,
  });

  return new Map(
    packages.map(packageRecord => {
      const archivePath = path.join(archiveRoot, archiveName(packageRecord));
      assert(existsSync(archivePath), `missing packed archive ${archivePath}`);
      return [packageRecord.name, archivePath];
    })
  );
};

const writePluginPackage = ({
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

const writeConsumerSpec = fixtureRoot => {
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

const writeConsumerSources = fixtureRoot => {
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

const writeConsumerManifest = ({
  archives,
  effectVersion,
  fixtureRoot,
  packages,
  pluginEffectVersion,
}) => {
  const packedDependencies = Object.fromEntries(
    packages.map(packageRecord => [
      packageRecord.name,
      `file:${archives.get(packageRecord.name)}`,
    ])
  );
  const generatorVersion = packages.find(
    packageRecord => packageRecord.name === "@rexeus/typeweaver-gen"
  )?.version;
  assert(generatorVersion, "missing @rexeus/typeweaver-gen package");
  writeJson(path.join(fixtureRoot, "package.json"), {
    name: `typeweaver-packed-consumer-${effectVersion}`,
    private: true,
    type: "module",
    packageManager: rootPackage.packageManager,
    dependencies: {
      "@rexeus/typeweaver": packedDependencies["@rexeus/typeweaver"],
      "@rexeus/typeweaver-clients":
        packedDependencies["@rexeus/typeweaver-clients"],
      "@rexeus/typeweaver-command":
        packedDependencies["@rexeus/typeweaver-command"],
      "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
      "@rexeus/typeweaver-effect":
        packedDependencies["@rexeus/typeweaver-effect"],
      "@rexeus/typeweaver-gen": packedDependencies["@rexeus/typeweaver-gen"],
      "@rexeus/typeweaver-server":
        packedDependencies["@rexeus/typeweaver-server"],
      "@types/node": "26.1.1",
      effect: effectVersion,
      hono: "4.12.32",
      "typeweaver-plugin-packed-compat": "file:./plugin",
      typescript: "npm:@typescript/typescript6@6.0.2",
      zod: "4.4.3",
    },
    pnpm: {
      overrides: packedDependencies,
    },
  });
  writeFileSync(
    path.join(fixtureRoot, ".npmrc"),
    [
      "@rexeus:registry=http://127.0.0.1:9/",
      "auto-install-peers=false",
      "strict-peer-dependencies=true",
      "",
    ].join("\n")
  );
  writePluginPackage({
    dependencyVersion: pluginEffectVersion,
    fixtureRoot,
    generatorVersion,
    peerRange: contract.peerRange,
  });
  writeConsumerSources(fixtureRoot);
};

const installedPackageJsonPath = (fixtureRoot, packageName) => {
  const relativePackagePath = path.join(
    "node_modules",
    ...packageName.split("/"),
    "package.json"
  );
  const directPath = path.join(fixtureRoot, relativePackagePath);
  const virtualStoreRoot = path.join(fixtureRoot, "node_modules", ".pnpm");
  const candidates = [
    ...(existsSync(directPath) ? [directPath] : []),
    ...readdirSync(virtualStoreRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry =>
        path.join(virtualStoreRoot, entry.name, relativePackagePath)
      )
      .filter(existsSync),
  ];
  const realCandidates = Array.from(
    new Set(candidates.map(candidate => realpathSync(candidate)))
  );
  assert.equal(
    realCandidates.length,
    1,
    `${packageName} has ${realCandidates.length} installed package identities`
  );
  return realCandidates[0];
};

const effectIdentityFrom = anchorPath => {
  const anchorRequire = createRequire(realpathSync(anchorPath));
  const packageJsonPath = realpathSync(
    anchorRequire.resolve("effect/package.json")
  );
  return {
    packageJsonPath,
    version: readJson(packageJsonPath).version,
  };
};

const physicalEffectIdentities = fixtureRoot => {
  const virtualStoreRoot = path.join(fixtureRoot, "node_modules", ".pnpm");
  return readdirSync(virtualStoreRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("effect@"))
    .map(entry =>
      path.join(
        virtualStoreRoot,
        entry.name,
        "node_modules",
        "effect",
        "package.json"
      )
    )
    .filter(existsSync)
    .map(packageJsonPath => {
      const realPackageJsonPath = realpathSync(packageJsonPath);
      return {
        packageJsonPath: realPackageJsonPath,
        version: readJson(realPackageJsonPath).version,
      };
    });
};

const assertPackedPackages = ({ fixtureRoot, packages }) => {
  const lockfile = readFileSync(
    path.join(fixtureRoot, "pnpm-lock.yaml"),
    "utf8"
  );
  for (const packageRecord of packages) {
    const installedPath = realpathSync(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    assert(
      !installedPath.startsWith(`${workspaceRoot}${path.sep}`),
      `${packageRecord.name} resolved to the workspace instead of its tarball`
    );
    const installedManifest = readJson(installedPath);
    assert.equal(installedManifest.version, packageRecord.version);
    assert(
      !/workspace:|catalog:/.test(JSON.stringify(installedManifest)),
      `${packageRecord.name} retained a workspace-only dependency specifier`
    );
    assert(
      lockfile.includes(archiveName(packageRecord)),
      `${packageRecord.name} is not locked to its packed tarball`
    );
  }
};

const assertGeneratorEffectPeerContract = fixtureRoot => {
  const generatorManifest = readJson(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver-gen")
  );
  assert.equal(generatorManifest.peerDependencies?.effect, contract.peerRange);
  assert.equal(generatorManifest.dependencies?.effect, undefined);
};

// A real consumer never receives the workspace's pnpm overrides, so the pinned
// transitive `@effect/platform-node-shared` version must survive into the packed
// graph and be the single copy that `@effect/platform-node` actually loads.
const assertPlatformNodeSharedIdentity = ({ fixtureRoot }) => {
  const cliManifest = readJson(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver")
  );
  const expectedVersion =
    cliManifest.dependencies["@effect/platform-node-shared"];
  assert.match(
    expectedVersion,
    /^\d+\.\d+\.\d+$/,
    "packed CLI must pin @effect/platform-node-shared to an exact version"
  );
  const installedSharedPath = installedPackageJsonPath(
    fixtureRoot,
    "@effect/platform-node-shared"
  );
  const platformNodeRequire = createRequire(
    realpathSync(installedPackageJsonPath(fixtureRoot, "@effect/platform-node"))
  );
  const loadedSharedPath = realpathSync(
    platformNodeRequire.resolve("@effect/platform-node-shared/package.json")
  );
  assert.equal(
    loadedSharedPath,
    installedSharedPath,
    "@effect/platform-node loads a different @effect/platform-node-shared copy than the pinned identity"
  );
  const loadedVersion = readJson(loadedSharedPath).version;
  assert.equal(
    loadedVersion,
    expectedVersion,
    `@effect/platform-node-shared resolved to ${loadedVersion}; expected ${expectedVersion}`
  );
};

const assertSingleEffectIdentity = ({
  effectVersion,
  fixtureRoot,
  includeCompatPlugin = true,
  packages,
}) => {
  const anchors = [
    path.join(fixtureRoot, "package.json"),
    ...(includeCompatPlugin
      ? [
          installedPackageJsonPath(
            fixtureRoot,
            "typeweaver-plugin-packed-compat"
          ),
        ]
      : []),
    ...packages
      .filter(packageRecord =>
        ["dependencies", "devDependencies", "peerDependencies"].some(
          section => packageRecord.manifest[section]?.effect !== undefined
        )
      )
      .map(packageRecord =>
        installedPackageJsonPath(fixtureRoot, packageRecord.name)
      ),
  ];
  const identities = [
    ...anchors.map(effectIdentityFrom),
    ...physicalEffectIdentities(fixtureRoot),
  ];
  const resolvedPaths = new Set(
    identities.map(identity => identity.packageJsonPath)
  );
  assert.equal(
    resolvedPaths.size,
    1,
    `multiple Effect identities detected:\n${Array.from(resolvedPaths).join("\n")}`
  );
  assert.deepEqual(
    new Set(identities.map(identity => identity.version)),
    new Set([effectVersion])
  );
};

const installFixture = fixtureRoot => {
  run({
    args: ["install", "--ignore-scripts"],
    cwd: fixtureRoot,
  });
};

const verifyScaffoldedPlugin = ({
  archives,
  effectVersion,
  fixtureRoot,
  packages,
}) => {
  const scaffoldRoot = path.join(fixtureRoot, "scaffolded-plugin");
  run({
    args: [
      "exec",
      "typeweaver",
      "add",
      "plugin",
      "--name",
      "packed-starter",
      "--target",
      scaffoldRoot,
    ],
    cwd: fixtureRoot,
  });

  const scaffoldManifestPath = path.join(scaffoldRoot, "package.json");
  const scaffoldManifest = readJson(scaffoldManifestPath);
  const packedDependencies = Object.fromEntries(
    packages.map(packageRecord => [
      packageRecord.name,
      `file:${archives.get(packageRecord.name)}`,
    ])
  );
  assert.equal(scaffoldManifest.peerDependencies?.effect, contract.peerRange);
  assert(
    !/workspace:|catalog:/.test(JSON.stringify(scaffoldManifest)),
    "plugin scaffold retained a workspace-only dependency specifier"
  );
  writeJson(scaffoldManifestPath, {
    ...scaffoldManifest,
    packageManager: rootPackage.packageManager,
    pnpm: {
      overrides: packedDependencies,
    },
  });
  writeFileSync(
    path.join(scaffoldRoot, ".npmrc"),
    [
      "@rexeus:registry=http://127.0.0.1:9/",
      "auto-install-peers=false",
      "strict-peer-dependencies=true",
      "",
    ].join("\n")
  );

  installFixture(scaffoldRoot);
  assertPackedPackages({ fixtureRoot: scaffoldRoot, packages });
  assertGeneratorEffectPeerContract(scaffoldRoot);
  assertSingleEffectIdentity({
    effectVersion,
    fixtureRoot: scaffoldRoot,
    includeCompatPlugin: false,
    packages,
  });
  run({ args: ["run", "check"], cwd: scaffoldRoot });
  assert.equal(
    readFileSync(
      path.join(
        scaffoldRoot,
        "test",
        "fixture",
        "generated",
        "packed-starter",
        "generated.txt"
      ),
      "utf8"
    ),
    "generated by packed-starter\n"
  );
};

const writeRuntimeConfig = fixtureRoot => {
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

const verifyGeneratedCommandConsumer = ({ fixtureRoot, outputRoot }) => {
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
  run({
    args: ["exec", "tsc", "--project", generatedTsconfig],
    cwd: fixtureRoot,
  });
  assert.equal(
    runNode({
      args: [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(path.join(generatedDist, "index.js"))}); if (process.exitCode !== undefined) throw new Error("generated barrel executed the command CLI"); process.stdout.write("generated-import-ok\\\\n");`,
      ],
      cwd: fixtureRoot,
    }),
    "generated-import-ok\\n"
  );
  assert.match(
    runNode({
      args: [path.join(generatedDist, "command", "cli.mjs"), "--help"],
      cwd: fixtureRoot,
    }),
    /ping\s+Ping/
  );
  assert.equal(
    runNode({
      args: [path.join(generatedDist, "effect-consumer.js")],
      cwd: fixtureRoot,
    }),
    "effect-adapter-ok\\n"
  );
};

const verifySupportedConsumer = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, `effect-${effectVersion}`);
  mkdirSync(fixtureRoot, { recursive: true });
  writeConsumerManifest({
    archives,
    effectVersion,
    fixtureRoot,
    packages,
  });
  installFixture(fixtureRoot);
  assertPackedPackages({ fixtureRoot, packages });
  assertGeneratorEffectPeerContract(fixtureRoot);
  assertPlatformNodeSharedIdentity({ fixtureRoot });
  assertSingleEffectIdentity({ effectVersion, fixtureRoot, packages });
  run({
    args: ["exec", "tsc", "--project", "tsconfig.json"],
    cwd: fixtureRoot,
  });
  assert.equal(
    runNode({
      args: [
        "--input-type=module",
        "--eval",
        'const api = await import("@rexeus/typeweaver"); if (typeof api.Generator?.generate !== "function" || typeof api.effectRuntime?.runPromise !== "function") throw new Error("missing programmatic API"); if (process.exitCode !== undefined) throw new Error("package import changed process.exitCode"); process.stdout.write("import-ok\\n");',
      ],
      cwd: fixtureRoot,
    }),
    "import-ok\n"
  );
  assert.equal(
    runNode({
      args: [
        "--eval",
        'const api = require("@rexeus/typeweaver"); if (typeof api.Generator?.generate !== "function" || typeof api.effectRuntime?.runPromise !== "function") throw new Error("missing programmatic API"); if (process.exitCode !== undefined) throw new Error("package require changed process.exitCode"); process.stdout.write("require-ok\\n");',
      ],
      cwd: fixtureRoot,
    }),
    "require-ok\n"
  );

  const { configPath, outputRoot } = writeRuntimeConfig(fixtureRoot);
  const output = run({
    args: [
      "exec",
      "typeweaver",
      "generate",
      "--config",
      configPath,
      "--no-format",
    ],
    cwd: fixtureRoot,
  });
  assert.match(output, /Successfully loaded 5 plugin/);
  assert.equal(
    readFileSync(path.join(outputRoot, "packed-compat", "result.txt"), "utf8"),
    "packed-consumer-ok\n"
  );
  verifyGeneratedCommandConsumer({ fixtureRoot, outputRoot });
  verifyScaffoldedPlugin({
    archives,
    effectVersion,
    fixtureRoot,
    packages,
  });
};

const verifyDuplicateGuard = ({ archives, matrixRoot, packages }) => {
  const fixtureRoot = path.join(matrixRoot, "duplicate-effect");
  mkdirSync(fixtureRoot, { recursive: true });
  writeConsumerManifest({
    archives,
    effectVersion: contract.runtimeVersion,
    fixtureRoot,
    packages,
    pluginEffectVersion: "3.21.2",
  });
  installFixture(fixtureRoot);
  assert.throws(
    () =>
      assertSingleEffectIdentity({
        effectVersion: contract.runtimeVersion,
        fixtureRoot,
        packages,
      }),
    /multiple Effect identities detected/
  );
};

const packedDependenciesFor = ({ archives, packages }) =>
  Object.fromEntries(
    packages.map(packageRecord => [
      packageRecord.name,
      `file:${archives.get(packageRecord.name)}`,
    ])
  );

const writeStrictNpmrc = fixtureRoot => {
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

const TYPESCRIPT_SPECIFIER = "npm:@typescript/typescript6@6.0.2";
const ZOD_VERSION = "4.4.3";
const NODE_TYPES_VERSION = "26.1.1";
const HONO_VERSION = "4.12.32";

// The built-in plain projections exercised by the packed fixture. The
// Effect-native `effect` projection is deliberately excluded.
const PLANNED_PLAIN_PLUGINS = [
  "types",
  "clients",
  "server",
  "hono",
  "command",
  "openapi",
  "aws-cdk",
];

const writeFixtureManifest = ({
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

const writePlainProjectionsConfig = fixtureRoot => {
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

const collectGeneratedFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectGeneratedFiles(entryPath) : [entryPath];
  });

const GENERATED_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
]);
const FORBIDDEN_GENERATED_PACKAGES = [
  "effect",
  "@rexeus/typeweaver-gen",
  "@rexeus/typeweaver-effect",
];

// Reject the exact package name and every subpath of it, so
// `effect/experimental`, `@rexeus/typeweaver-gen/foo`, and
// `@rexeus/typeweaver-effect/runtime` are all caught. Unrelated packages like
// `effectively` or `zod` are not.
const isForbiddenGeneratedSpecifier = specifier =>
  FORBIDDEN_GENERATED_PACKAGES.some(
    packageName =>
      specifier === packageName || specifier.startsWith(`${packageName}/`)
  );

// `preProcessFile` records static imports, side-effect imports, import/export
// re-exports, dynamic `import(...)`, and CommonJS `require(...)` alike, so the
// scan does not depend on how a generated module was written.
const collectBareModuleSpecifiers = source =>
  ts
    .preProcessFile(source, true, true)
    .importedFiles.map(imported => imported.fileName)
    .filter(
      specifier => !specifier.startsWith(".") && !specifier.startsWith("node:")
    );

const SCANNER_CHARACTERIZATION_SOURCE = [
  'import "effect";',
  'import "effect/experimental";',
  'import { Effect } from "@rexeus/typeweaver-gen";',
  'import { helper } from "@rexeus/typeweaver-gen/internal";',
  'export * from "@rexeus/typeweaver-effect";',
  'export { runtime } from "@rexeus/typeweaver-effect/runtime";',
  'const dynamicRoot = await import("effect");',
  'const dynamicSubpath = await import("effect/Effect");',
  'const requireSubpath = require("@rexeus/typeweaver-effect/adapter");',
  'import "zod";',
].join("\n");

const verifyGeneratedImportScanner = () => {
  const collected = collectBareModuleSpecifiers(
    SCANNER_CHARACTERIZATION_SOURCE
  );
  for (const specifier of [
    "effect",
    "effect/experimental",
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-gen/internal",
    "@rexeus/typeweaver-effect",
    "@rexeus/typeweaver-effect/runtime",
    "effect/Effect",
    "@rexeus/typeweaver-effect/adapter",
    "zod",
  ]) {
    assert(
      collected.includes(specifier),
      `module-specifier collector missed ${specifier}; collected ${collected.join(", ")}`
    );
  }
  const forbidden = collected.filter(isForbiddenGeneratedSpecifier);
  assert(
    forbidden.length >= 7,
    `forbidden classifier should flag the root and subpath forms; flagged ${forbidden.join(", ")}`
  );
  for (const specifier of [
    "effect",
    "effect/experimental",
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-gen/internal",
    "@rexeus/typeweaver-effect",
    "@rexeus/typeweaver-effect/runtime",
    "effect/Effect",
    "@rexeus/typeweaver-effect/adapter",
  ]) {
    assert(
      isForbiddenGeneratedSpecifier(specifier),
      `forbidden classifier missed ${specifier}`
    );
  }
  assert(
    !forbidden.includes("zod"),
    "forbidden classifier incorrectly flagged zod"
  );
  assert(
    !isForbiddenGeneratedSpecifier("effectively") &&
      !isForbiddenGeneratedSpecifier("@rexeus/typeweaver-generation"),
    "forbidden classifier matched an unrelated package name"
  );
};

const assertNoForbiddenModuleSpecifiers = outputRoot => {
  const offenders = [];
  for (const filePath of collectGeneratedFiles(outputRoot)) {
    if (!GENERATED_SOURCE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    for (const specifier of collectBareModuleSpecifiers(source)) {
      if (isForbiddenGeneratedSpecifier(specifier)) {
        offenders.push(
          `${path.relative(outputRoot, filePath)} -> ${specifier}`
        );
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `generated output imports Effect-native packages:\n${offenders.join("\n")}`
  );
};

const PROJECTION_OUTPUT_FILES = {
  types: ["responses/OkResponse.ts", "lib/types"],
  clients: ["health/HealthClient.ts", "lib/clients"],
  server: ["health/HealthRouter.ts", "lib/server"],
  hono: ["health/HealthHono.ts", "lib/hono"],
  command: ["command/cli.mts", "command/index.ts", "lib/command"],
  openapi: ["openapi/openapi.json"],
  "aws-cdk": ["health/HealthHttpApiRoutes.ts", "lib/aws-cdk"],
};

const assertProjectionOutputsExist = outputRoot => {
  for (const [projection, files] of Object.entries(PROJECTION_OUTPUT_FILES)) {
    for (const file of files) {
      assert(
        existsSync(path.join(outputRoot, file)),
        `missing ${projection} projection output ${file}`
      );
    }
  }
};

const runNodeExpectFailure = ({ args, cwd }) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.notEqual(
    result.status,
    0,
    `node ${args.join(" ")} unexpectedly succeeded`
  );
  return `${result.stdout}\n${result.stderr}`;
};

const runExpectFailure = ({ args, cwd }) => {
  const result = spawnPnpmSync({
    args,
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.notEqual(
    result.status,
    0,
    `pnpm ${args.join(" ")} unexpectedly succeeded`
  );
  return `${result.stdout}\n${result.stderr}`;
};

const declaresEffectDependency = manifest =>
  [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ].some(section => manifest?.[section]?.effect !== undefined);

const assertSupportedEffect3 = version => {
  const [major = Number.NaN, minor = Number.NaN] = version
    .split(".")
    .map(part => Number.parseInt(part, 10));
  assert(
    major === 3 && minor >= 22,
    `CLI subtree resolved unsupported Effect ${version}`
  );
};

// The application resolves the exact RC. Every installed TypeWeaver package in
// the CLI subtree that declares an Effect dependency or peer must resolve the
// same single Effect 3 realpath, and the graph must still contain exactly two
// physical Effect identities (the RC and that Effect 3).
const assertIsolatedEffectIdentities = ({
  effectVersion,
  fixtureRoot,
  packages,
}) => {
  const appIdentity = effectIdentityFrom(
    path.join(fixtureRoot, "package.json")
  );
  assert.equal(appIdentity.version, effectVersion);
  const cliIdentity = effectIdentityFrom(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver")
  );
  assertSupportedEffect3(cliIdentity.version);
  assert.notEqual(
    cliIdentity.packageJsonPath,
    appIdentity.packageJsonPath,
    "the CLI resolved the application's Effect identity"
  );
  const checkedAnchors = [];
  for (const packageRecord of packages) {
    const installedManifest = readJson(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    if (!declaresEffectDependency(installedManifest)) {
      continue;
    }
    const identity = effectIdentityFrom(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    assert.equal(
      identity.packageJsonPath,
      cliIdentity.packageJsonPath,
      `${packageRecord.name} resolved a different Effect identity`
    );
    assert.equal(identity.version, cliIdentity.version);
    checkedAnchors.push(packageRecord.name);
  }
  assert(
    checkedAnchors.length >= 2,
    `expected multiple Effect-declaring CLI subtree anchors; found ${checkedAnchors.join(", ")}`
  );
  const physical = physicalEffectIdentities(fixtureRoot);
  assert.equal(
    physical.length,
    2,
    `expected exactly two Effect physical identities; found:\n${physical
      .map(identity => `${identity.version} ${identity.packageJsonPath}`)
      .join("\n")}`
  );
  assert.deepEqual(
    new Set(physical.map(identity => identity.version)),
    new Set([effectVersion, cliIdentity.version])
  );
};

const assertPhantomImportsUnavailable = fixtureRoot => {
  for (const packageName of [
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-effect",
  ]) {
    const output = runNodeExpectFailure({
      args: [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(packageName)});`,
      ],
      cwd: fixtureRoot,
    });
    assert.match(output, /ERR_MODULE_NOT_FOUND|Cannot find package/u);
  }
};

const writeAppModule = fixtureRoot => {
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

const typecheckAndRunApp = ({ fixtureRoot, outputRoot }) => {
  const tsconfigPath = path.join(fixtureRoot, "app.tsconfig.json");
  const appDist = path.join(fixtureRoot, "app-dist");
  writeJson(tsconfigPath, {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: appDist,
      rootDir: fixtureRoot,
      skipLibCheck: false,
      strict: true,
      target: "ES2024",
      types: ["node"],
    },
    include: [
      path.join(fixtureRoot, "app.ts"),
      path.join(outputRoot, "**/*.ts"),
      path.join(outputRoot, "**/*.mts"),
      path.join(outputRoot, "**/*.js"),
    ],
  });
  run({ args: ["exec", "tsc", "--project", tsconfigPath], cwd: fixtureRoot });
  assert.equal(
    runNode({ args: [path.join(appDist, "app.js")], cwd: fixtureRoot }),
    "effect-app-ok\n"
  );
};

const assertDoctorInFixture = fixtureRoot => {
  const output = run({
    args: [
      "exec",
      "typeweaver",
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ],
    cwd: fixtureRoot,
  });
  const report = JSON.parse(output);
  const checks = new Map(report.checks.map(check => [check.code, check]));
  assert.equal(
    checks.get("TW-DOCTOR-008")?.outcome,
    "pass",
    "the CLI's bundled Effect runtime check did not pass"
  );
  const workspaceCheck = checks.get("TW-DOCTOR-011");
  assert.equal(workspaceCheck?.outcome, "warn");
  assert.match(workspaceCheck.message, /4\.0\.0-rc\.115/u);
  assert.match(workspaceCheck.message, /cannot verify|Effect-neutral/u);
};

const minimalDependencies = ({ archives, effectVersion, packages }) => {
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

// Direct deps are only the packed CLI and core, the exact RC, and the tooling
// and third-party runtime deps the fixture truthfully needs. Hono is absent to
// prove its peer is optional for a CLI-only consumer under strict peers.
const verifyMinimalStrictInstall = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, "effect-4-minimal-strict");
  mkdirSync(fixtureRoot, { recursive: true });
  writeFixtureManifest({
    dependencies: minimalDependencies({ archives, effectVersion, packages }),
    fixtureRoot,
    name: "typeweaver-effect-4-minimal-strict",
    overrides: packedDependenciesFor({ archives, packages }),
  });
  writeStrictNpmrc(fixtureRoot);
  installFixture(fixtureRoot);
  assertPackedPackages({ fixtureRoot, packages });
  assert(
    !existsSync(path.join(fixtureRoot, "node_modules", "hono")),
    "the minimal strict fixture unexpectedly installed hono"
  );
  assertIsolatedEffectIdentities({ effectVersion, fixtureRoot, packages });
};

// Direct deps add hono because all advertised plain projections are exercised
// here; the generated Hono output imports it, so it is a truthful runtime dep.
const allProjectionDependencies = ({ archives, effectVersion, packages }) => ({
  ...minimalDependencies({ archives, effectVersion, packages }),
  hono: HONO_VERSION,
});

const verifyAllPlainProjectionsConsumer = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, "effect-4-all-plain");
  mkdirSync(fixtureRoot, { recursive: true });
  writeFixtureManifest({
    dependencies: allProjectionDependencies({
      archives,
      effectVersion,
      packages,
    }),
    fixtureRoot,
    name: "typeweaver-effect-4-all-plain",
    overrides: packedDependenciesFor({ archives, packages }),
  });
  writeStrictNpmrc(fixtureRoot);
  writeConsumerSpec(fixtureRoot);
  installFixture(fixtureRoot);
  assertPackedPackages({ fixtureRoot, packages });
  assertGeneratorEffectPeerContract(fixtureRoot);
  assertIsolatedEffectIdentities({ effectVersion, fixtureRoot, packages });
  assertPhantomImportsUnavailable(fixtureRoot);
  const { configPath, outputRoot } = writePlainProjectionsConfig(fixtureRoot);
  const generated = run({
    args: [
      "exec",
      "typeweaver",
      "generate",
      "--config",
      configPath,
      "--no-format",
    ],
    cwd: fixtureRoot,
  });
  assert.match(generated, /Successfully loaded/u);
  assertProjectionOutputsExist(outputRoot);
  assertNoForbiddenModuleSpecifiers(outputRoot);
  writeAppModule(fixtureRoot);
  typecheckAndRunApp({ fixtureRoot, outputRoot });
  assertDoctorInFixture(fixtureRoot);
};

const verifyEffect4StrictPeerNegative = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, "effect-4-strict-peer-negative");
  mkdirSync(fixtureRoot, { recursive: true });
  const packedDependencies = packedDependenciesFor({ archives, packages });
  writeFixtureManifest({
    fixtureRoot,
    name: "typeweaver-effect-4-strict-peer-negative",
    overrides: packedDependencies,
    dependencies: {
      "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
      "@rexeus/typeweaver-effect":
        packedDependencies["@rexeus/typeweaver-effect"],
      "@rexeus/typeweaver-gen": packedDependencies["@rexeus/typeweaver-gen"],
      "@rexeus/typeweaver-server":
        packedDependencies["@rexeus/typeweaver-server"],
      effect: effectVersion,
      zod: ZOD_VERSION,
    },
  });
  writeStrictNpmrc(fixtureRoot);
  const output = runExpectFailure({
    args: ["install", "--ignore-scripts"],
    cwd: fixtureRoot,
  });
  assert.match(
    output,
    />=3\.22\.0 <4/u,
    `strict-peer install did not fail on the Effect 3 peer range:\n${output}`
  );
  assert.match(
    output,
    /unmet peer|PEER_DEP_ISSUES/iu,
    `strict-peer install did not fail as a peer conflict:\n${output}`
  );
};

const peerLowerBound = peerRange => {
  const match = /^>=([^\s]+)\s+</.exec(peerRange);
  assert(match, `unsupported Effect peer range format: ${peerRange}`);
  return match[1];
};

const main = () => {
  const matrixRoot = mkdtempSync(
    path.join(tmpdir(), "typeweaver-packed-consumers-")
  );
  try {
    const archiveRoot = path.join(matrixRoot, "archives");
    mkdirSync(archiveRoot);
    verifyGeneratedImportScanner();
    const packages = collectPublishablePackages();
    const archives = packWorkspace({ archiveRoot, packages });
    const supportedVersions = new Set([
      contract.runtimeVersion,
      peerLowerBound(contract.peerRange),
    ]);

    for (const effectVersion of supportedVersions) {
      verifySupportedConsumer({
        archives,
        effectVersion,
        matrixRoot,
        packages,
      });
    }
    verifyDuplicateGuard({ archives, matrixRoot, packages });
    const phaseAEffectVersion = contract.phaseA?.effectVersion;
    assert(
      typeof phaseAEffectVersion === "string",
      "config/effect-baseline.json must pin phaseA.effectVersion"
    );
    verifyMinimalStrictInstall({
      archives,
      effectVersion: phaseAEffectVersion,
      matrixRoot,
      packages,
    });
    verifyAllPlainProjectionsConsumer({
      archives,
      effectVersion: phaseAEffectVersion,
      matrixRoot,
      packages,
    });
    verifyEffect4StrictPeerNegative({
      archives,
      effectVersion: phaseAEffectVersion,
      matrixRoot,
      packages,
    });
    process.stdout.write(
      `Packed consumer and plugin scaffold matrix verified for Effect ${Array.from(supportedVersions).join(", ")}; duplicate identity rejected; Effect ${phaseAEffectVersion} minimal strict install, all plain projections, and strict-peer negative verified\n`
    );
  } finally {
    rmSync(matrixRoot, { recursive: true });
  }
};

main();
