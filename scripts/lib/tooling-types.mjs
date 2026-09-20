/**
 * Shared JSDoc contracts for repository tooling that reads workspace JSON.
 * Declaring the shapes once keeps each script's boundary precise without
 * duplicating structural knowledge across the `.mjs` modules.
 *
 * @typedef {Record<string, string>} DependencyMap
 *
 * @typedef {object} PeerDependencyMeta
 * @property {boolean} [optional]
 */

/**
 * The subset of a `package.json` manifest the tooling reads. Unknown fields are
 * not part of the contract, so they are deliberately not declared.
 *
 * @typedef {object} PackageManifest
 * @property {string} [name]
 * @property {string} [version]
 * @property {boolean} [private]
 * @property {string} [packageManager]
 * @property {DependencyMap} [dependencies]
 * @property {DependencyMap} [devDependencies]
 * @property {DependencyMap} [optionalDependencies]
 * @property {DependencyMap} [peerDependencies]
 * @property {Record<string, PeerDependencyMeta>} [peerDependenciesMeta]
 * @property {DependencyMap} [scripts]
 * @property {{ node?: string }} [engines]
 */

/**
 * A publishable package discovered under `packages/*`.
 *
 * @typedef {object} PublicPackage
 * @property {string} directory
 * @property {PackageManifest} manifest
 * @property {string} name
 * @property {string} version
 */

/**
 * The pinned Effect baseline contract stored in `config/effect-baseline.json`.
 *
 * @typedef {object} EffectBaselineContract
 * @property {string} runtimeVersion
 * @property {string} peerRange
 * @property {string} languageServiceVersion
 * @property {string} referenceRepository
 * @property {string} referenceTag
 * @property {string} referenceCommit
 * @property {Record<string, string>} acceptedEffectDependencies
 * @property {Effect4EvidenceContract} [effect4Evidence]
 */

/**
 * The Effect 4 workspace evidence pins the exact, process-isolated release
 * candidate TypeWeaver has tested while the native surfaces stay on Effect 3.
 *
 * @typedef {object} Effect4EvidenceContract
 * @property {string} effectVersion
 * @property {string} scope
 * @property {string} stability
 * @property {string} nativeSurfaces
 */

export {};
