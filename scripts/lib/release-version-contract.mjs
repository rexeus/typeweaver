const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const changesetFrontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const releaseLinePattern =
  /^\s*(?:"([^"]+)"|'([^']+)'|([^:\s]+))\s*:\s*(patch|minor|major)\s*$/u;

const parseMajor = version => {
  const match = semanticVersionPattern.exec(version);
  return match === null ? undefined : Number(match[1]);
};

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

export const validateReleasePolicy = ({
  maximumPublishedMajor,
  breakingChangeBump,
}) =>
  maximumPublishedMajor === 0 && breakingChangeBump !== "minor"
    ? [
        "breakingChangeBump must remain minor while TypeWeaver follows a pre-1.0 release line",
      ]
    : [];

export const parseChangesetReleases = ({ fileName, content }) => {
  const frontmatter = changesetFrontmatterPattern.exec(content);
  if (frontmatter === null) {
    throw new Error(`${fileName} does not contain Changesets frontmatter`);
  }

  return frontmatter[1]
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
        name: release[1] ?? release[2] ?? release[3],
        type: release[4],
      };
    });
};

export const validateReleaseVersionContract = ({
  maximumPublishedMajor,
  packages,
  changesets,
}) => {
  const failures = [];
  const packageMajors = new Map();

  if (!Number.isInteger(maximumPublishedMajor) || maximumPublishedMajor < 0) {
    return ["maximumPublishedMajor must be a non-negative integer"];
  }

  for (const packageManifest of packages) {
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
