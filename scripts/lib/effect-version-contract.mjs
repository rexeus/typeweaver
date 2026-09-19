import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
];

const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

const findEffectSections = packageJson =>
  dependencySections.filter(
    section => packageJson[section]?.effect !== undefined
  );

const formatPackagePath = (workspaceRoot, packagePath) =>
  path.relative(workspaceRoot, packagePath).split(path.sep).join("/");

const validateDeclaredVersions = ({
  packageJson,
  packagePath,
  effectSections,
  runtimeRange,
}) => {
  const failures = [];
  for (const section of effectSections) {
    const actual = packageJson[section].effect;
    const expected =
      section === "peerDependencies" ? "catalog:peers" : runtimeRange;
    if (actual !== expected) {
      failures.push(
        `${packagePath} ${section}.effect must be ${expected}; found ${actual}`
      );
    }
  }
  return failures;
};

const validatePublishedEffectDependencies = ({
  packageJson,
  packagePath,
  acceptedEffectDependencies,
}) => {
  const failures = [];
  for (const [name, specifier] of Object.entries(
    packageJson.dependencies ?? {}
  )) {
    if (!name.startsWith("@effect/")) {
      continue;
    }
    const accepted = acceptedEffectDependencies[name];
    if (accepted === undefined) {
      failures.push(
        `${packagePath} declares unaccepted Effect dependency ${name}@${specifier}`
      );
      continue;
    }
    if (specifier !== accepted) {
      failures.push(
        `${packagePath} ${name} must be pinned to ${accepted}; found ${specifier}`
      );
    }
  }
  return failures;
};

const validateResolvedVersion = ({
  manifestPath,
  packagePath,
  runtimeVersion,
}) => {
  try {
    const packageRequire = createRequire(manifestPath);
    const resolvedPackagePath = packageRequire.resolve("effect/package.json");
    const resolvedVersion = readJson(resolvedPackagePath).version;
    return resolvedVersion === runtimeVersion
      ? []
      : [
          `${packagePath} resolves Effect ${resolvedVersion}; expected ${runtimeVersion}`,
        ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      `${packagePath} cannot resolve Effect ${runtimeVersion}: ${message}`,
    ];
  }
};

const validatePackage = ({
  workspaceRoot,
  manifestPath,
  runtimeVersion,
  runtimeRange,
  acceptedEffectDependencies,
}) => {
  let packageJson;
  try {
    packageJson = readJson(manifestPath);
  } catch {
    return [];
  }

  const packagePath = formatPackagePath(workspaceRoot, manifestPath);
  const failures = validatePublishedEffectDependencies({
    packageJson,
    packagePath,
    acceptedEffectDependencies,
  });
  const effectSections = findEffectSections(packageJson);
  if (effectSections.length === 0) {
    return failures;
  }

  return [
    ...failures,
    ...validateDeclaredVersions({
      packageJson,
      packagePath,
      effectSections,
      runtimeRange,
    }),
    ...validateResolvedVersion({
      manifestPath,
      packagePath,
      runtimeVersion,
    }),
  ];
};

export const validateEffectPackageVersions = ({
  workspaceRoot,
  runtimeVersion,
  acceptedEffectDependencies = {},
}) => {
  const failures = [];
  const packagesRoot = path.join(workspaceRoot, "packages");
  const runtimeRange = `^${runtimeVersion}`;

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(packagesRoot, entry.name, "package.json");
    failures.push(
      ...validatePackage({
        workspaceRoot,
        manifestPath,
        runtimeVersion,
        runtimeRange,
        acceptedEffectDependencies,
      })
    );
  }

  return failures;
};

/**
 * Stable statements each public document must keep for the Effect 4 workspace
 * contract. Exact sentences stay flexible; the load-bearing exact pin,
 * binary/process boundary, and surface names are asserted so no document
 * drifts into a generic "supports Effect 4" claim.
 */
export const EFFECT_4_DOCUMENT_TOKENS = {
  "docs/adr/0010-effect-4-workspace-compatibility.md": [
    "0008",
    "4.0.0-rc.115",
    "process-isolated",
    ">=3.22.0 <4",
    "Core authoring",
    "Binary CLI",
    "CLI programmatic API",
    "plugin authoring",
    "plain generated",
    "first-party",
    "Effect adapter",
    "UNVERIFIED",
  ],
  "docs/adr/0008-effect-v3-baseline.md": ["0010"],
  "README.md": ["4.0.0-rc.115", "binary CLI", ">=3.22.0 <4"],
  "docs/README.md": ["0010", "4.0.0-rc.115", "binary CLI"],
  "docs/getting-started.md": ["4.0.0-rc.115", "isolated"],
  "packages/cli/README.md": ["4.0.0-rc.115", "binary CLI", ">=3.22.0 <4"],
  "packages/gen/README.md": ["4.0.0-rc.115", "binary CLI", ">=3.22.0 <4"],
  "packages/effect/README.md": ["4.0.0-rc.115", "binary CLI", ">=3.22.0 <4"],
  "docs/plugin-authoring.md": ["4.0.0-rc.115", "Effect 4"],
  "MIGRATION.md": ["4.0.0-rc.115", "process-isolated", "binary CLI"],
};

/**
 * Phrasings that overstate isolated CLI evidence. They must not appear in any
 * public document that states the compatibility contract.
 */
export const EFFECT_4_FORBIDDEN_PHRASES = [
  "supports Effect 4",
  "Effect 4 is supported",
  ">=3.22.0 <5",
];

const OPTIONAL_SENSITIVE_PEERS = [
  "effect",
  "@rexeus/typeweaver-gen",
  "@rexeus/typeweaver-core",
];

const validateEffect4EvidenceVersions = contract => {
  const failures = [];
  if (contract.runtimeVersion !== "3.22.0") {
    failures.push(
      `config/effect-baseline.json runtimeVersion must remain 3.22.0; found ${contract.runtimeVersion}`
    );
  }
  if (contract.peerRange !== ">=3.22.0 <4") {
    failures.push(
      `config/effect-baseline.json peerRange must remain >=3.22.0 <4; found ${contract.peerRange}`
    );
  }
  const effect4Evidence = contract.effect4Evidence ?? {};
  if (effect4Evidence.effectVersion !== "4.0.0-rc.115") {
    failures.push(
      `config/effect-baseline.json effect4Evidence.effectVersion must be the exact evidence pin 4.0.0-rc.115; found ${effect4Evidence.effectVersion}`
    );
  }
  if (effect4Evidence.scope !== "process-isolated-cli-only") {
    failures.push(
      `config/effect-baseline.json effect4Evidence.scope must be process-isolated-cli-only; found ${effect4Evidence.scope}`
    );
  }
  if (effect4Evidence.stability !== "release-candidate") {
    failures.push(
      `config/effect-baseline.json effect4Evidence.stability must be release-candidate; found ${effect4Evidence.stability}`
    );
  }
  if (effect4Evidence.nativeSurfaces !== "effect-3-only") {
    failures.push(
      `config/effect-baseline.json effect4Evidence.nativeSurfaces must be effect-3-only; found ${effect4Evidence.nativeSurfaces}`
    );
  }
  return failures;
};

const validateEffectPeerManifest = (packageName, manifest) => {
  const failures = [];
  if (manifest?.peerDependencies?.effect !== "catalog:peers") {
    failures.push(
      `packages/${packageName}/package.json peerDependencies.effect must remain catalog:peers for @rexeus/typeweaver-${packageName}; found ${manifest?.peerDependencies?.effect}`
    );
  }
  if (manifest?.dependencies?.effect !== undefined) {
    failures.push(
      `packages/${packageName}/package.json must keep effect as a peer, not a dependency`
    );
  }
  return failures;
};

const validateHonoOptionalPeer = manifests => {
  const failures = [];
  const hono = manifests.hono;
  if (hono?.peerDependencies?.hono !== "catalog:peers") {
    failures.push(
      `packages/hono/package.json peerDependencies.hono must remain catalog:peers; found ${hono?.peerDependencies?.hono}`
    );
  }
  if (hono?.peerDependenciesMeta?.hono?.optional !== true) {
    failures.push(
      "packages/hono/package.json must mark its hono peer optional via peerDependenciesMeta.hono.optional; the generator does not require Hono to execute"
    );
  }
  return failures;
};

const validateSensitivePeersStayRequired = manifests => {
  const failures = [];
  for (const [packageName, manifest] of Object.entries(manifests)) {
    const meta = manifest?.peerDependenciesMeta;
    if (meta === undefined) {
      continue;
    }
    for (const peer of OPTIONAL_SENSITIVE_PEERS) {
      if (meta[peer]?.optional === true) {
        failures.push(
          `packages/${packageName}/package.json must not mark ${peer} optional`
        );
      }
    }
  }
  return failures;
};

const validateEffect4EvidenceManifests = manifests => {
  const failures = [];
  if (manifests.cli?.dependencies?.effect !== "^3.22.0") {
    failures.push(
      `packages/cli/package.json dependencies.effect must remain ^3.22.0; found ${manifests.cli?.dependencies?.effect}`
    );
  }
  if (manifests.cli?.peerDependencies?.effect !== undefined) {
    failures.push(
      "packages/cli/package.json must not declare an Effect peer; the CLI owns its Effect runtime as a dependency"
    );
  }
  return [
    ...failures,
    ...["gen", "effect", "hono"].flatMap(packageName =>
      validateEffectPeerManifest(packageName, manifests[packageName])
    ),
    ...validateHonoOptionalPeer(manifests),
    ...validateSensitivePeersStayRequired(manifests),
  ];
};

const validateEffect4EvidenceDocuments = documents => {
  const failures = [];
  for (const [document, tokens] of Object.entries(EFFECT_4_DOCUMENT_TOKENS)) {
    const content = documents[document];
    if (typeof content !== "string") {
      failures.push(
        `${document} is required by the Effect 4 workspace compatibility contract`
      );
      continue;
    }
    for (const token of tokens) {
      if (!content.includes(token)) {
        failures.push(
          `${document} is missing Effect 4 workspace statement: ${token}`
        );
      }
    }
    const lowered = content.toLowerCase();
    for (const phrase of EFFECT_4_FORBIDDEN_PHRASES) {
      if (lowered.includes(phrase.toLowerCase())) {
        failures.push(
          `${document} contains a generic Effect 4 promise: "${phrase}"`
        );
      }
    }
  }
  return failures;
};

/**
 * Enforces the Effect 4 workspace contract: the runtime and peer range stay on
 * Effect 3, the evidence pin stays exact/process-scoped/Effect-3-native, the
 * CLI keeps Effect as its own dependency rather than a peer, the required
 * Effect/gen/core peers stay required, the Hono peer is optional because the
 * generator runs without it, and every public document keeps the exact-pin
 * binary-only wording without a generic Effect 4 promise.
 */
export const validateEffect4WorkspaceContract = ({
  contract,
  manifests,
  documents,
}) => [
  ...validateEffect4EvidenceVersions(contract),
  ...validateEffect4EvidenceManifests(manifests),
  ...validateEffect4EvidenceDocuments(documents),
];
