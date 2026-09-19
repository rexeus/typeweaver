/**
 * @typedef {object} ReleasePackage
 * @property {string} name
 * @property {string} version
 * @property {boolean} [private] Private packages are outside the publishable
 *   release inventory and may not be targeted by a Changeset.
 *
 * @typedef {object} ChangesetRelease
 * @property {string} name
 * @property {string} type
 *
 * @typedef {object} Changeset
 * @property {string} fileName
 * @property {ChangesetRelease[]} releases
 */

const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const changesetFrontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const releaseLinePattern =
  /^\s*(?:"([^"]+)"|'([^']+)'|([^:\s]+))\s*:\s*(patch|minor|major)\s*$/u;

/**
 * @param {string} version
 * @returns {number | undefined}
 */
const parseMajor = version => {
  const match = semanticVersionPattern.exec(version);
  return match === null ? undefined : Number(match[1]);
};

/**
 * @param {{
 *   packageManifest: ReleasePackage,
 *   packageMajors: Map<string, number>,
 *   maximumPublishedMajor: number,
 * }} options
 * @returns {string[]}
 */
const registerPackageMajor = ({
  packageManifest,
  packageMajors,
  maximumPublishedMajor,
}) => {
  const major = parseMajor(packageManifest.version);
  if (major === undefined) {
    return [
      `${packageManifest.name} has an invalid semantic version: ${packageManifest.version}`,
    ];
  }
  if (packageMajors.has(packageManifest.name)) {
    return [`duplicate package manifest: ${packageManifest.name}`];
  }

  packageMajors.set(packageManifest.name, major);
  return major > maximumPublishedMajor
    ? [
        `${packageManifest.name}@${packageManifest.version} exceeds the configured release line ${String(maximumPublishedMajor)}.x`,
      ]
    : [];
};

/**
 * @param {{
 *   changeset: Changeset,
 *   packageMajors: Map<string, number>,
 *   maximumPublishedMajor: number,
 * }} options
 * @returns {string[]}
 */
const validateChangeset = ({
  changeset,
  packageMajors,
  maximumPublishedMajor,
}) =>
  changeset.releases.flatMap(release => {
    const currentMajor = packageMajors.get(release.name);
    if (currentMajor === undefined) {
      return [
        `${changeset.fileName} references unknown package ${release.name}`,
      ];
    }
    return release.type === "major" && currentMajor + 1 > maximumPublishedMajor
      ? [
          `${changeset.fileName} requests a major release for ${release.name}; use a minor changeset while the release line is capped at ${String(maximumPublishedMajor)}.x`,
        ]
      : [];
  });

/**
 * @param {{ maximumPublishedMajor: number, breakingChangeBump: string }} options
 * @returns {string[]}
 */
export const validateReleasePolicy = ({
  maximumPublishedMajor,
  breakingChangeBump,
}) =>
  maximumPublishedMajor === 0 && breakingChangeBump !== "minor"
    ? [
        "breakingChangeBump must remain minor while TypeWeaver follows a pre-1.0 release line",
      ]
    : [];

/**
 * @param {{ fileName: string, content: string }} options
 * @returns {ChangesetRelease[]}
 */
export const parseChangesetReleases = ({ fileName, content }) => {
  const frontmatter = changesetFrontmatterPattern.exec(content);
  if (frontmatter === null) {
    throw new Error(`${fileName} does not contain Changesets frontmatter`);
  }

  return (frontmatter[1] ?? "")
    .split(/\r?\n/u)
    .filter(line => line.trim() !== "")
    .map(line => {
      const release = releaseLinePattern.exec(line);
      if (release === null) {
        throw new Error(
          `${fileName} contains an invalid release entry: ${line}`
        );
      }
      return {
        name: release[1] ?? release[2] ?? release[3] ?? "",
        type: release[4] ?? "",
      };
    });
};

/**
 * @param {{
 *   maximumPublishedMajor: number,
 *   packages: readonly ReleasePackage[],
 *   changesets: readonly Changeset[],
 * }} options
 * @returns {string[]}
 */
export const validateReleaseVersionContract = ({
  maximumPublishedMajor,
  packages,
  changesets,
}) => {
  const failures = [];
  /** @type {Map<string, number>} */
  const packageMajors = new Map();

  if (!Number.isInteger(maximumPublishedMajor) || maximumPublishedMajor < 0) {
    return ["maximumPublishedMajor must be a non-negative integer"];
  }

  for (const packageManifest of packages) {
    // Private workspace packages are never published, so their version and
    // major are outside the release contract. Excluding them also makes a
    // changeset that names one fail as an unknown package below.
    if (packageManifest.private === true) {
      continue;
    }
    failures.push(
      ...registerPackageMajor({
        packageManifest,
        packageMajors,
        maximumPublishedMajor,
      })
    );
  }

  for (const changeset of changesets) {
    failures.push(
      ...validateChangeset({
        changeset,
        packageMajors,
        maximumPublishedMajor,
      })
    );
  }

  return failures;
};
