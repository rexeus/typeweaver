import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createPackageBuildConfig } from "./createPackageBuildConfig.mjs";

const tempDirectories: string[] = [];

function createPackageFixture(packageName: string): {
  readonly packageDir: string;
  readonly repositoryRoot: string;
} {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-build-config-")
  );
  const packageDir = path.join(repositoryRoot, "packages", packageName);

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(repositoryRoot, "LICENSE"), "license");
  fs.writeFileSync(path.join(repositoryRoot, "NOTICE"), "notice");

  tempDirectories.push(repositoryRoot);

  return { packageDir, repositoryRoot };
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
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
  test("copies shared post-build artifacts and runs custom post-build steps", async () => {
    const { packageDir } = createPackageFixture("example");

    writeFile(path.join(packageDir, "src/lib/runtime.js"), "runtime");
    writeFile(path.join(packageDir, "src/templates/index.ejs"), "template");

    const postBuildStep = vi.fn(async ({ distDir }) => {
      writeFile(path.join(distDir, "custom.txt"), "custom");
    });

    const config = createPackageBuildConfig({
      packageDir,
      postBuildSteps: [postBuildStep],
    });

    await config.onSuccess?.();

    expect(
      fs.readFileSync(path.join(packageDir, "dist/lib/runtime.js"), "utf8")
    ).toBe("runtime");
    expect(
      fs.readFileSync(path.join(packageDir, "dist/templates/index.ejs"), "utf8")
    ).toBe("template");
    expect(fs.readFileSync(path.join(packageDir, "dist/LICENSE"), "utf8")).toBe(
      "license"
    );
    expect(fs.readFileSync(path.join(packageDir, "dist/NOTICE"), "utf8")).toBe(
      "notice"
    );
    expect(
      fs.readFileSync(path.join(packageDir, "dist/custom.txt"), "utf8")
    ).toBe("custom");
    expect(postBuildStep).toHaveBeenCalledWith({
      distDir: path.join(packageDir, "dist"),
      packageDir,
    });
  });

  test("skips opted-out shared source directories", async () => {
    const { packageDir } = createPackageFixture("example-opt-out");

    writeFile(path.join(packageDir, "src/lib/runtime.js"), "runtime");
    writeFile(path.join(packageDir, "src/templates/index.ejs"), "template");

    const config = createPackageBuildConfig({
      packageDir,
      libSourceDir: false,
      templateSourceDir: false,
    });

    await config.onSuccess?.();

    expect(fs.existsSync(path.join(packageDir, "dist/lib"))).toBe(false);
    expect(fs.existsSync(path.join(packageDir, "dist/templates"))).toBe(false);
    expect(fs.readFileSync(path.join(packageDir, "dist/LICENSE"), "utf8")).toBe(
      "license"
    );
    expect(fs.readFileSync(path.join(packageDir, "dist/NOTICE"), "utf8")).toBe(
      "notice"
    );
  });

  test("omits shared post-build work when disabled", () => {
    const { packageDir } = createPackageFixture("example-disabled");

    const config = createPackageBuildConfig({
      packageDir,
      entry: ["src/index.ts"],
      format: ["esm"],
      runSharedPostBuild: false,
    });

    expect(config).toEqual(
      expect.objectContaining({
        clean: true,
        dts: true,
        entry: ["src/index.ts"],
        format: ["esm"],
        platform: "node",
        target: "esnext",
        treeshake: true,
      })
    );
    expect(config).not.toHaveProperty("onSuccess");
    expect(fs.existsSync(path.join(packageDir, "dist"))).toBe(false);
  });
});
