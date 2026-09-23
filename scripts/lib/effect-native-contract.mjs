/** @typedef {import("./tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {Record<string, PackageManifest | undefined>} PackageManifestMap */
/** @typedef {{ contract: EffectBaselineContract, manifests: PackageManifestMap, documents: Record<string, string | undefined> }} NativeContractOptions */

export const NATIVE_EFFECT_DOCUMENT_TOKENS = {
  "docs/adr/0008-effect-4-baseline.md": [
    "4.0.0-rc.116",
    "d62dd0d65252e5d3635538f0e41adc7c08aa9beb",
    "Context.Service",
    "Result",
    "Cause",
    "Schema",
    "pnpm effect:diagnostics",
    "optional",
  ],
  "docs/adr/0010-effect-4-workspace-compatibility.md": [
    "0008-effect-4-baseline",
    "Superseded",
    "4.0.0-rc.116",
    "native",
  ],
  "README.md": ["4.0.0-rc.116", "native", "optional"],
  "docs/README.md": ["0008-effect-4-baseline", "4.0.0-rc.116", "optional"],
  "docs/getting-started.md": ["4.0.0-rc.116", "native", "optional"],
  "packages/cli/README.md": ["4.0.0-rc.116", "programmatic", "optional"],
  "packages/gen/README.md": ["4.0.0-rc.116", "Context.Service", "Result"],
  "packages/effect/README.md": ["4.0.0-rc.116", "ManagedRuntime", "Cause"],
  "docs/plugin-authoring.md": ["4.0.0-rc.116", "Context.Service", "Result"],
  "MIGRATION.md": ["4.0.0-rc.116", "Context.Service", "Result", "Cause"],
};

export const NATIVE_EFFECT_FORBIDDEN_PHRASES = [
  "Effect 3-only",
  "Effect 3 only",
  ">=3.22.0 <4",
  "process-isolated Effect 4",
  "binary CLI evidence only",
];

/** @param {PackageManifest | undefined} manifest @param {string} packageName @param {string} runtimeVersion @returns {string[]} */
const validateNativePeer = (manifest, packageName, runtimeVersion) => {
  const failures = [];
  if (manifest?.peerDependencies?.["effect"] !== "catalog:peers") {
    failures.push(
      `packages/${packageName}/package.json peerDependencies.effect must be catalog:peers; found ${String(manifest?.peerDependencies?.["effect"])} `
    );
  }
  if (manifest?.dependencies?.["effect"] !== undefined) {
    failures.push(
      `packages/${packageName}/package.json must keep effect as a peer, not a dependency (native peer ${runtimeVersion})`
    );
  }
  return failures;
};

/** @param {PackageManifest | undefined} manifest @returns {string[]} */
const validateNativeCliManifest = manifest => {
  const failures = [];
  if (manifest?.dependencies?.["effect"] !== "4.0.0-rc.116") {
    failures.push(
      "packages/cli/package.json dependencies.effect must be 4.0.0-rc.116; found " +
        String(manifest?.dependencies?.["effect"])
    );
  }
  if (manifest?.peerDependencies?.["effect"] !== undefined) {
    failures.push(
      "packages/cli/package.json must not declare an Effect peer; the CLI owns its exact runtime dependency"
    );
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateNativeManifests = manifests => [
  ...validateNativeCliManifest(manifests["cli"]),
  ...["gen", "effect", "command", "openapi", "hono"].flatMap(packageName =>
    validateNativePeer(manifests[packageName], packageName, "4.0.0-rc.116")
  ),
  ...validateOptionalPeers(manifests),
  ...validatePeerMetadata(manifests),
];

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateOptionalPeers = manifests => {
  const failures = [];
  if (manifests["core"]?.peerDependencies?.["effect"] !== undefined) {
    failures.push(
      "packages/core/package.json must remain Effect-optional; core has no Effect peer"
    );
  }
  for (const packageName of ["clients", "types", "server", "aws-cdk"]) {
    if (manifests[packageName]?.peerDependencies?.["effect"] !== undefined) {
      failures.push(
        `packages/${packageName}/package.json must keep Effect optional; it has no runtime Effect peer`
      );
    }
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
/** @param {string} packageName @param {PackageManifest | undefined} manifest @returns {string[]} */
const validateOptionalSensitivePeers = (packageName, manifest) =>
  ["effect", "@rexeus/typeweaver-gen"].flatMap(peer =>
    manifest?.peerDependenciesMeta?.[peer]?.optional === true
      ? [`packages/${packageName}/package.json must not mark ${peer} optional`]
      : []
  );

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validatePeerMetadata = manifests => {
  const failures = [];
  for (const [packageName, manifest] of Object.entries(manifests)) {
    failures.push(...validateOptionalSensitivePeers(packageName, manifest));
  }
  if (manifests["hono"]?.peerDependenciesMeta?.["hono"]?.optional !== true) {
    failures.push(
      "packages/hono/package.json must mark its Hono peer optional"
    );
  }
  return failures;
};

/** @param {EffectBaselineContract} contract @returns {string[]} */
const validateNativeVersions = contract => {
  const failures = [];
  if (contract.runtimeVersion !== "4.0.0-rc.116") {
    failures.push(
      `config/effect-baseline.json runtimeVersion must be 4.0.0-rc.116; found ${contract.runtimeVersion}`
    );
  }
  if (contract.peerRange !== "4.0.0-rc.116") {
    failures.push(
      `config/effect-baseline.json peerRange must be the exact native pin 4.0.0-rc.116; found ${contract.peerRange}`
    );
  }
  if ("effect4Evidence" in contract) {
    failures.push(
      "config/effect-baseline.json must not contain the obsolete effect4Evidence contract"
    );
  }
  return failures;
};

/** @param {string} document @param {string} content @param {readonly string[]} tokens @returns {string[]} */
const validateDocumentTokens = (document, content, tokens) =>
  tokens
    .filter(token => !content.includes(token))
    .map(token => `${document} is missing native Effect statement: ${token}`);

/** @param {string} document @param {string} content @returns {string[]} */
const validateForbiddenPhrases = (document, content) =>
  NATIVE_EFFECT_FORBIDDEN_PHRASES.filter(phrase =>
    content.toLowerCase().includes(phrase.toLowerCase())
  ).map(phrase => `${document} contains obsolete Effect guidance: "${phrase}"`);

/** @param {Record<string, string | undefined>} documents @returns {string[]} */
const validateNativeDocuments = documents =>
  Object.entries(NATIVE_EFFECT_DOCUMENT_TOKENS).flatMap(
    ([document, tokens]) => {
      const content = documents[document];
      if (typeof content !== "string") {
        return [`${document} is required by the native Effect contract`];
      }
      return [
        ...validateDocumentTokens(document, content, tokens),
        ...validateForbiddenPhrases(document, content),
      ];
    }
  );

/** @param {NativeContractOptions} options @returns {string[]} */
export const validateNativeEffectWorkspaceContract = ({
  contract,
  manifests,
  documents,
}) => [
  ...validateNativeVersions(contract),
  ...validateNativeManifests(manifests),
  ...validateNativeDocuments(documents),
];
