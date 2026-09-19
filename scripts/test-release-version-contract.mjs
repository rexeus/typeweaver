import assert from "node:assert/strict";
import {
  parseChangesetReleases,
  validateReleasePolicy,
  validateReleaseVersionContract,
} from "./lib/release-version-contract.mjs";

const packages = [
  {
    name: "@rexeus/typeweaver",
    version: "0.12.0",
  },
];
/**
 * @param {string} type
 * @param {string} [name]
 * @returns {{ fileName: string, releases: import("./lib/release-version-contract.mjs").ChangesetRelease[] }}
 */
const changeset = (type, name = "@rexeus/typeweaver") => ({
  fileName: "fixture.md",
  releases: parseChangesetReleases({
    fileName: "fixture.md",
    content: `---
"${name}": ${type}
---

Fixture release.
`,
  }),
});
/**
 * @param {string} version
 * @returns {string[]}
 */
const validatePackageVersion = version =>
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages: [
      {
        name: "@rexeus/typeweaver",
        version,
      },
    ],
    changesets: [],
  });

assert.deepEqual(
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages,
    changesets: [changeset("minor")],
  }),
  []
);

assert.match(
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages,
    changesets: [changeset("major")],
  }).join("\n"),
  /requests a major release/u
);

assert.match(
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages,
    changesets: [changeset("major", "@rexeus/missing")],
  }).join("\n"),
  /references unknown package @rexeus\/missing/u
);

// Private workspace packages such as the shared TypeScript profile package are
// excluded from the publishable inventory: their version never constrains the
// release line, and a changeset must not name them because they never publish.
const privatePackage = {
  name: "@rexeus/typeweaver-tsconfig",
  version: "1.0.0",
  private: true,
};

assert.deepEqual(
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages: [privatePackage],
    changesets: [],
  }),
  [],
  "a private package must not constrain the release major"
);

assert.match(
  validateReleaseVersionContract({
    maximumPublishedMajor: 0,
    packages: [...packages, privatePackage],
    changesets: [changeset("minor", "@rexeus/typeweaver-tsconfig")],
  }).join("\n"),
  /references unknown package @rexeus\/typeweaver-tsconfig/u
);

assert.match(
  validatePackageVersion("1.0.0").join("\n"),
  /exceeds the configured release line 0\.x/u
);

for (const invalidVersion of [
  "0.12.0-",
  "0.12.0+",
  "0.12.0-alpha..1",
  "0.12.0+build..1",
  "0.12.0+build_1",
  "0.12.0-01",
]) {
  assert.match(
    validatePackageVersion(invalidVersion).join("\n"),
    /has an invalid semantic version/u,
    `${invalidVersion} must be rejected`
  );
}

assert.deepEqual(validatePackageVersion("0.12.0-alpha.1+build.007"), []);

assert.deepEqual(
  validateReleaseVersionContract({
    maximumPublishedMajor: 1,
    packages,
    changesets: [changeset("major")],
  }),
  []
);

assert.match(
  validateReleasePolicy({
    maximumPublishedMajor: 0,
    breakingChangeBump: "major",
  }).join("\n"),
  /must remain minor/u
);

assert.deepEqual(
  validateReleasePolicy({
    maximumPublishedMajor: 1,
    breakingChangeBump: "major",
  }),
  []
);

process.stdout.write(
  "Release version contract rejected explicit and generated stable-major fixtures\n"
);
