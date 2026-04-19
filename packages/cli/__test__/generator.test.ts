import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertSafeCleanTarget,
  assertSafePluginOutputNamespaces,
} from "../src/generators/generator.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

describe("Generator clean safety", () => {
  const createTempDir = createTempDirFactory("typeweaver-generator-");

  test("rejects filesystem root clean targets", () => {
    expect(() =>
      assertSafeCleanTarget(path.parse(process.cwd()).root, process.cwd())
    ).toThrow(/filesystem root/);
  });

  test("rejects empty clean targets", () => {
    expect(() => assertSafeCleanTarget("", process.cwd())).toThrow(
      /empty output directory/
    );
  });

  test("rejects whitespace-only clean targets", () => {
    expect(() => assertSafeCleanTarget("   ", process.cwd())).toThrow(
      /empty output directory/
    );
  });

  test("rejects current working directory clean targets", () => {
    const currentWorkingDirectory = createTempDir();

    expect(() =>
      assertSafeCleanTarget(currentWorkingDirectory, currentWorkingDirectory)
    ).toThrow(/current working directory/);
  });

  test("rejects inferred workspace root clean targets", () => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");

    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    expect(() =>
      assertSafeCleanTarget(workspaceRoot, packageDirectory)
    ).toThrow(/inferred workspace root/);
  });

  test("allows nested generated output directories", () => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");
    const outputDirectory = path.join(workspaceRoot, "generated", "types");

    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    expect(() =>
      assertSafeCleanTarget(outputDirectory, packageDirectory)
    ).not.toThrow();
  });

  test("resolves relative clean targets from the provided working directory", () => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");

    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    expect(() => assertSafeCleanTarget("../../", packageDirectory)).toThrow(
      /inferred workspace root/
    );
  });

  test("rejects plugin names that collide with reserved top-level output directories", () => {
    expect(() =>
      assertSafePluginOutputNamespaces(["types", "responses"], "/tmp/generated")
    ).toThrow(/Reserved entity name 'responses'/);
  });
});
