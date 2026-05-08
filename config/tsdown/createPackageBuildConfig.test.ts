import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createPackageBuildConfig } from "./createPackageBuildConfig.mjs";

type PackageFixtureOptions = {
  readonly createRepositoryArtifacts?: boolean;
};

type PackageFixture = {
  readonly packageDir: string;
  readonly repositoryRoot: string;
};

type PostBuildContext = {
  readonly distDir: string;
  readonly packageDir: string;
};

const tempDirectories: string[] = [];

function createPackageFixture(
  packageName: string,
  options: PackageFixtureOptions = {}
): PackageFixture {
  const { createRepositoryArtifacts = true } = options;
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-build-config-")
  );
  const packageDir = path.join(repositoryRoot, "packages", packageName);

  fs.mkdirSync(packageDir, { recursive: true });

  if (createRepositoryArtifacts) {
    fs.writeFileSync(path.join(repositoryRoot, "LICENSE"), "license");
    fs.writeFileSync(path.join(repositoryRoot, "NOTICE"), "notice");
  }

  tempDirectories.push(repositoryRoot);

  return { packageDir, repositoryRoot };
}

function writePackageFile(
  packageDir: string,
  relativePath: string,
  content: string
): void {
  const filePath = path.join(packageDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function readPackageFile(packageDir: string, relativePath: string): string {
  return fs.readFileSync(path.join(packageDir, relativePath), "utf8");
}

function packageFileExists(packageDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(packageDir, relativePath));
}

function createNodeOnSuccessCommand(
  packageDir: string,
  scriptName: string,
  scriptContent: string
): string {
  writePackageFile(packageDir, path.join("scripts", scriptName), scriptContent);

  return [process.execPath, `./scripts/${scriptName}`]
    .map(commandPart => JSON.stringify(commandPart))
    .join(" ");
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop();
    if (tempDirectory !== undefined) {
      fs.rmSync(tempDirectory, { force: true, recursive: true });
    }
  }
});

describe("createPackageBuildConfig", () => {
  test("copies default shared artifacts into dist", async () => {
    const { packageDir } = createPackageFixture("example");

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
    const { packageDir } = createPackageFixture("custom-post-build");
    let receivedPostBuildContext: PostBuildContext | undefined;

    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async (context: PostBuildContext) => {
          receivedPostBuildContext = context;
          writePackageFile(packageDir, "dist/custom.txt", "custom");
        },
      ],
    });

    await config.onSuccess?.();

    expect(readPackageFile(packageDir, "dist/custom.txt")).toBe("custom");
    expect(receivedPostBuildContext).toEqual({
      distDir: path.join(packageDir, "dist"),
      packageDir,
    });
  });

  test("skips disabled shared source directories", async () => {
    const { packageDir } = createPackageFixture("example-opt-out");

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

  test("omits shared post-build work when disabled", () => {
    const { packageDir } = createPackageFixture("example-disabled");

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

  test("preserves caller onSuccess when shared post-build work is disabled", async () => {
    const { packageDir } = createPackageFixture("disabled-caller-on-success");
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
    const { packageDir } = createPackageFixture("custom-source-dirs");

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
    const { packageDir } = createPackageFixture("missing-source-dirs");

    const config = createPackageBuildConfig({ packageDir });

    await config.onSuccess?.();

    expect(packageFileExists(packageDir, "dist")).toBe(true);
    expect(readPackageFile(packageDir, "dist/LICENSE")).toBe("license");
    expect(readPackageFile(packageDir, "dist/NOTICE")).toBe("notice");
    expect(packageFileExists(packageDir, "dist/lib")).toBe(false);
    expect(packageFileExists(packageDir, "dist/templates")).toBe(false);
  });

  test("omits repository artifacts when license copy is disabled", async () => {
    const { packageDir } = createPackageFixture("no-license-copy", {
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
    const { packageDir } = createPackageFixture("strict-license-copy", {
      createRepositoryArtifacts: false,
    });

    const config = createPackageBuildConfig({ packageDir });

    await expect(config.onSuccess?.()).rejects.toThrow("LICENSE");
  });

  test("runs shared work, post-build steps, and caller onSuccess in order", async () => {
    const { packageDir } = createPackageFixture("execution-order");
    const order: string[] = [];

    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");

    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async () => {
          if (packageFileExists(packageDir, "dist/lib/runtime.js")) {
            order.push("shared-before-first-step");
          }

          writePackageFile(packageDir, "dist/first.txt", "first");
        },
        async () => {
          if (packageFileExists(packageDir, "dist/first.txt")) {
            order.push("first-before-second-step");
          }

          writePackageFile(packageDir, "dist/second.txt", "second");
        },
      ],
      onSuccess: async () => {
        if (packageFileExists(packageDir, "dist/second.txt")) {
          order.push("steps-before-caller");
        }
      },
    });

    await config.onSuccess?.();

    expect(order).toEqual([
      "shared-before-first-step",
      "first-before-second-step",
      "steps-before-caller",
    ]);
  });

  test("forwards tsdown onSuccess config and signal to caller onSuccess", async () => {
    const { packageDir } = createPackageFixture("forwarded-args");
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
    const { packageDir } = createPackageFixture("string-on-success");
    const onSuccess = createNodeOnSuccessCommand(
      packageDir,
      "on-success.cjs",
      `const fs = require("node:fs");
const path = require("node:path");

const hasSharedArtifact = fs.existsSync(
  path.join("dist", "lib", "runtime.js")
);

if (!hasSharedArtifact) {
  throw new Error("missing shared artifact");
}

fs.writeFileSync(
  path.join("dist", "string-on-success.txt"),
  "after-shared"
);
`
    );

    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");

    const config = createPackageBuildConfig({ packageDir, onSuccess });

    await config.onSuccess?.({ cwd: packageDir });

    expect(readPackageFile(packageDir, "dist/string-on-success.txt")).toBe(
      "after-shared"
    );
  });

  test("rejects when string onSuccess exits non-zero after shared work completes", async () => {
    const { packageDir } = createPackageFixture("string-on-success-failure");
    const onSuccess = [process.execPath, "-e", "process.exit(1)"]
      .map(commandPart => JSON.stringify(commandPart))
      .join(" ");

    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");

    const config = createPackageBuildConfig({ packageDir, onSuccess });

    await expect(config.onSuccess?.({ cwd: packageDir })).rejects.toThrow();
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
  });

  test("rejects and stops before caller on post-build step failure", async () => {
    const { packageDir } = createPackageFixture("post-build-failure");

    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [
        async () => {
          throw new Error("post-build failed");
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
    const { packageDir } = createPackageFixture("caller-failure");

    writePackageFile(packageDir, "src/lib/runtime.js", "runtime");

    const config = createPackageBuildConfig({
      packageDir,
      onSuccess: async () => {
        throw new Error("caller failed");
      },
    });

    await expect(config.onSuccess?.()).rejects.toThrow("caller failed");
    expect(readPackageFile(packageDir, "dist/lib/runtime.js")).toBe("runtime");
  });

  test("returns independent default format arrays", () => {
    const { packageDir: firstPackageDir } = createPackageFixture(
      "first-default-format"
    );
    const { packageDir: secondPackageDir } = createPackageFixture(
      "second-default-format"
    );
    const firstConfig = createPackageBuildConfig({
      packageDir: firstPackageDir,
    });
    const secondConfig = createPackageBuildConfig({
      packageDir: secondPackageDir,
    });

    firstConfig.format.push("iife");

    expect(secondConfig.format).toEqual(["esm", "cjs"]);
  });
});
