import assert from "node:assert/strict";
import {
  parseChangesetReleases,
  validateReleaseVersionContract,
} from "./lib/release-version-contract.mjs";

const packages = [
  {
    name: "@rexeus/typeweaver",
    version: "0.12.0",
  },
];
const changeset = type => ({
  fileName: "fixture.md",
  releases: parseChangesetReleases({
    fileName: "fixture.md",
    content: `---
"@rexeus/typeweaver": ${type}
---

Fixture release.
`,
  }),
});
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

process.stdout.write(
  "Release version contract rejected explicit and generated stable-major fixtures\n"
);
