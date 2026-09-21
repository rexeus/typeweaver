import { afterEach, describe, expect, test } from "vitest";
import { createPackageBuildConfig } from "./createPackageBuildConfig.mjs";
import {
  cleanupTempDirectories,
  createPackageFixture,
  packageFileExists,
  readPackageFile,
  writePackageFile,
} from "./createPackageBuildConfig.test-support";
import type { PackageFixtureOptions } from "./createPackageBuildConfig.test-support";

const tempDirectories: string[] = [];
const createSuiteFixture = (
  packageName: string,
  options: PackageFixtureOptions = {}
) =>
  createPackageFixture(packageName, {
    ...options,
    registerTempDirectory: directory => tempDirectories.push(directory),
  });

afterEach(() => cleanupTempDirectories(tempDirectories));

describe("createPackageBuildConfig", () => {
  test("copies default shared artifacts into dist", async () => {
    const { packageDir } = createSuiteFixture("example");
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    writePackageFile(packageDir, "src/templates/index.ejs", "template");
    const config = createPackageBuildConfig({ packageDir });
    await config.onSuccess?.();
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
    expect(readPackageFile(packageDir, "dist/templates/index.ejs")).toBe(
      "template"
    );
    expect(readPackageFile(packageDir, "dist/LICENSE")).toBe("license");
    expect(readPackageFile(packageDir, "dist/NOTICE")).toBe("notice");
  });

  test("runs custom post-build steps with the package and dist directories", async () => {
    const { packageDir } = createSuiteFixture("custom-post-build");
    let receivedPostBuildContext:
      | { distDir: string; packageDir: string }
      | undefined;
    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async context => {
          receivedPostBuildContext = context;
          writePackageFile(packageDir, "dist/custom.txt", "custom");
        },
      ],
    });
    await config.onSuccess?.();
    expect(readPackageFile(packageDir, "dist/custom.txt")).toBe("custom");
    expect(receivedPostBuildContext).toEqual({
      distDir: `${packageDir}/dist`,
      packageDir,
    });
  });

  test("skips disabled shared source directories", async () => {
    const { packageDir } = createSuiteFixture("example-opt-out");
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    writePackageFile(packageDir, "src/templates/index.ejs", "template");
    const config = createPackageBuildConfig({
      packageDir,
      libSourceDir: false,
      templateSourceDir: false,
    });
    await config.onSuccess?.();
    expect(packageFileExists(packageDir, "dist/lib")).toBe(false);
    expect(packageFileExists(packageDir, "dist/templates")).toBe(false);
    expect(readPackageFile(packageDir, "dist/LICENSE")).toBe("license");
    expect(readPackageFile(packageDir, "dist/NOTICE")).toBe("notice");
  });
});

describe("createPackageBuildConfig shared post-build disabling", () => {
  test("omits shared post-build work when disabled", () => {
    const { packageDir } = createSuiteFixture("example-disabled");
    const config = createPackageBuildConfig({
      packageDir,
      entry: ["src/index.ts"],
      format: ["esm"],
      clean: false,
      dts: false,
      runSharedPostBuild: false,
    });
    expect(config).toEqual(
      expect.objectContaining({
        clean: false,
        dts: false,
        entry: ["src/index.ts"],
        format: ["esm"],
        platform: "node",
        target: "esnext",
        treeshake: true,
      })
    );
    expect(config).not.toHaveProperty("onSuccess");
    expect(packageFileExists(packageDir, "dist")).toBe(false);
  });
});
