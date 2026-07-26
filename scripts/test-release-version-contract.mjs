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
    packages: [
      {
        name: "@rexeus/typeweaver",
        version: "1.0.0",
      },
    ],
    changesets: [],
  }).join("\n"),
  /exceeds the configured release line 0\.x/u
);

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
