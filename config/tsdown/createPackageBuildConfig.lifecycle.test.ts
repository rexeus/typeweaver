import { afterEach, describe, expect, test } from "vitest";
import { createPackageBuildConfig } from "./createPackageBuildConfig.mjs";
import {
  cleanupTempDirectories,
  createNodeOnSuccessCommand,
  createPackageFixture,
  packageFileExists,
  readPackageFile,
  TestBuildConfigError,
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

describe("createPackageBuildConfig callback composition", () => {
  test("preserves caller onSuccess when shared post-build work is disabled", async () => {
    const { packageDir } = createSuiteFixture("disabled-caller-on-success");
    const resolvedConfig = { cwd: packageDir };
    const signal = new AbortController().signal;
    let receivedConfig: unknown;
    let receivedSignal: AbortSignal | undefined;
    const config = createPackageBuildConfig({
      packageDir,
      runSharedPostBuild: false,
      onSuccess: async (nextConfig: unknown, nextSignal: AbortSignal) => {
        receivedConfig = nextConfig;
        receivedSignal = nextSignal;
      },
    });
    await config.onSuccess?.(resolvedConfig, signal);
    expect(config.onSuccess).toBeDefined();
    expect(receivedConfig).toBe(resolvedConfig);
    expect(receivedSignal).toBe(signal);
    expect(packageFileExists(packageDir, "dist")).toBe(false);
  });

  test("copies configured source directories into conventional dist locations", async () => {
    const { packageDir } = createSuiteFixture("custom-source-dirs");
    writePackageFile(packageDir, "custom/lib/runtime.js", "runtime");
    writePackageFile(packageDir, "custom/templates/index.ejs", "template");
    const config = createPackageBuildConfig({
      packageDir,
      libSourceDir: "custom/lib",
      templateSourceDir: "custom/templates",
    });
    await config.onSuccess?.();
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
    expect(readPackageFile(packageDir, "dist/templates/index.ejs")).toBe(
      "template"
    );
  });

  test("ignores missing shared source directories", async () => {
    const { packageDir } = createSuiteFixture("missing-source-dirs");
    const config = createPackageBuildConfig({ packageDir });
    await config.onSuccess?.();
    expect(packageFileExists(packageDir, "dist")).toBe(true);
    expect(readPackageFile(packageDir, "dist/LICENSE")).toBe("license");
    expect(readPackageFile(packageDir, "dist/NOTICE")).toBe("notice");
    expect(packageFileExists(packageDir, "dist/lib")).toBe(false);
    expect(packageFileExists(packageDir, "dist/templates")).toBe(false);
  });
});

describe("createPackageBuildConfig license artifact composition", () => {
  test("omits repository artifacts when license copy is disabled", async () => {
    const { packageDir } = createSuiteFixture("no-license-copy", {
      createRepositoryArtifacts: false,
    });
    const config = createPackageBuildConfig({
      packageDir,
      includeLicenseArtifacts: false,
    });
    await config.onSuccess?.();
    expect(packageFileExists(packageDir, "dist/LICENSE")).toBe(false);
    expect(packageFileExists(packageDir, "dist/NOTICE")).toBe(false);
  });
  test("propagates missing repository artifact errors when license copy is enabled", async () => {
    const { packageDir } = createSuiteFixture("strict-license-copy", {
      createRepositoryArtifacts: false,
    });
    const config = createPackageBuildConfig({ packageDir });
    await expect(config.onSuccess?.()).rejects.toThrow("LICENSE");
  });
});

describe("createPackageBuildConfig execution order", () => {
  test("runs shared work, post-build steps, and caller onSuccess in order", async () => {
    const { packageDir } = createSuiteFixture("execution-order");
    const order: string[] = [];
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async () => {
          if (packageFileExists(packageDir, "dist/lib/runtime.js"))
            order.push("shared-before-first-step");
          writePackageFile(packageDir, "dist/first.txt", "first");
        },
        async () => {
          if (packageFileExists(packageDir, "dist/first.txt"))
            order.push("first-before-second-step");
          writePackageFile(packageDir, "dist/second.txt", "second");
        },
      ],
      onSuccess: async () => {
        if (packageFileExists(packageDir, "dist/second.txt"))
          order.push("steps-before-caller");
      },
    });
    await config.onSuccess?.();
    expect(order).toEqual([
      "shared-before-first-step",
      "first-before-second-step",
      "steps-before-caller",
    ]);
  });
});

describe("createPackageBuildConfig onSuccess forwarding", () => {
  test("forwards tsdown onSuccess config and signal to caller onSuccess", async () => {
    const { packageDir } = createSuiteFixture("forwarded-args");
    const resolvedConfig = { name: "resolved" };
    const signal = new AbortController().signal;
    let receivedConfig: unknown;
    let receivedSignal: AbortSignal | undefined;
    const config = createPackageBuildConfig({
      packageDir,
      onSuccess: async (nextConfig: unknown, nextSignal: AbortSignal) => {
        receivedConfig = nextConfig;
        receivedSignal = nextSignal;
      },
    });
    await config.onSuccess?.(resolvedConfig, signal);
    expect(receivedConfig).toBe(resolvedConfig);
    expect(receivedSignal).toBe(signal);
  });
  test("executes string onSuccess from the resolved config cwd after shared post-build work", async () => {
    const { packageDir } = createSuiteFixture("string-on-success");
    const onSuccess = createNodeOnSuccessCommand(
      packageDir,
      "on-success.cjs",
      `const fs = require("node:fs");\nconst path = require("node:path");\nif (!fs.existsSync(path.join("dist", "lib", "runtime.js"))) throw new Error("missing shared artifact");\nfs.writeFileSync(path.join("dist", "string-on-success.txt"), "after-shared");\n`
    );
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    const config = createPackageBuildConfig({ packageDir, onSuccess });
    await config.onSuccess?.({ cwd: packageDir });
    expect(readPackageFile(packageDir, "dist/string-on-success.txt")).toBe(
      "after-shared"
    );
  });
});

describe("createPackageBuildConfig failure handling", () => {
  test("rejects when string onSuccess exits non-zero after shared work completes", async () => {
    const { packageDir } = createSuiteFixture("string-on-success-failure");
    const onSuccess = [process.execPath, "-e", "process.exit(1)"]
      .map(commandPart => JSON.stringify(commandPart))
      .join(" ");
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    const config = createPackageBuildConfig({ packageDir, onSuccess });
    await expect(config.onSuccess?.({ cwd: packageDir })).rejects.toThrow();
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
  });
  test("rejects and stops before caller on post-build step failure", async () => {
    const { packageDir } = createSuiteFixture("post-build-failure");
    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async () => {
          throw new TestBuildConfigError("post-build failed");
        },
      ],
      onSuccess: async () => {
        writePackageFile(packageDir, "dist/caller.txt", "caller");
      },
    });
    await expect(config.onSuccess?.()).rejects.toThrow("post-build failed");
    expect(packageFileExists(packageDir, "dist/caller.txt")).toBe(false);
  });
  test("rejects when caller onSuccess fails after shared work completes", async () => {
    const { packageDir } = createSuiteFixture("caller-failure");
    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");
    const config = createPackageBuildConfig({
      packageDir,
      onSuccess: async () => {
        throw new TestBuildConfigError("caller failed");
      },
    });
    await expect(config.onSuccess?.()).rejects.toThrow("caller failed");
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
  });
  test("returns independent default format arrays", () => {
    const first = createPackageBuildConfig({
      packageDir: createSuiteFixture("first-default-format").packageDir,
    });
    const second = createPackageBuildConfig({
      packageDir: createSuiteFixture("second-default-format").packageDir,
    });
    first.format.push("iife");
    expect(second.format).toEqual(["esm", "cjs"]);
  });
});
