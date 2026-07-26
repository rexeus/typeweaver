import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  parseChangesetReleases,
  validateReleasePolicy,
  validateReleaseVersionContract,
} from "./lib/release-version-contract.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const read = relativePath =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");
const readJson = relativePath => JSON.parse(read(relativePath));
const policy = readJson("config/release-policy.json");

const packages = readdirSync(path.join(workspaceRoot, "packages"), {
  withFileTypes: true,
}).flatMap(entry => {
  if (!entry.isDirectory()) {
    return [];
  }
  const manifestPath = `packages/${entry.name}/package.json`;
  if (!existsSync(path.join(workspaceRoot, manifestPath))) {
    return [];
  }
  const manifest = readJson(manifestPath);
  return typeof manifest.name === "string" &&
    manifest.name.startsWith("@rexeus/") &&
    typeof manifest.version === "string"
    ? [
        {
          name: manifest.name,
          version: manifest.version,
        },
      ]
    : [];
});

const changesets = readdirSync(path.join(workspaceRoot, ".changeset"), {
  withFileTypes: true,
})
  .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
  .map(entry => ({
    fileName: `.changeset/${entry.name}`,
    releases: parseChangesetReleases({
      fileName: `.changeset/${entry.name}`,
      content: read(`.changeset/${entry.name}`),
    }),
  }));

const failures = validateReleaseVersionContract({
  maximumPublishedMajor: policy.maximumPublishedMajor,
  packages,
  changesets,
});

failures.push(...validateReleasePolicy(policy));

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Release version contract verified: ${String(packages.length)} packages remain on major ${String(policy.maximumPublishedMajor)}\n`
);
