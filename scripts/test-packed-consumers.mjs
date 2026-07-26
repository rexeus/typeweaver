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

const writeConsumerSources = fixtureRoot => {
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
      "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
      "@rexeus/typeweaver-gen": packedDependencies["@rexeus/typeweaver-gen"],
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

const assertSingleEffectIdentity = ({
  effectVersion,
  fixtureRoot,
  packages,
}) => {
  const anchors = [
    path.join(fixtureRoot, "package.json"),
    installedPackageJsonPath(fixtureRoot, "typeweaver-plugin-packed-compat"),
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
      `  plugins: [[${JSON.stringify(pluginPath)}, {}]],`,
      "};",
      "",
    ].join("\n")
  );
  return { configPath, outputRoot };
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
  assert.match(output, /Successfully loaded 1 plugin/);
  assert.equal(
    readFileSync(path.join(outputRoot, "packed-compat", "result.txt"), "utf8"),
    "packed-consumer-ok\n"
  );
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
    process.stdout.write(
      `Packed consumer matrix verified for Effect ${Array.from(supportedVersions).join(", ")}; duplicate identity rejected\n`
    );
  } finally {
    rmSync(matrixRoot, { recursive: true });
  }
};

main();
