import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  REQUIRED_EFFECT_VERSION,
  classifyConfiguredPlugins,
  classifyWorkspaceEffectCompatibility,
  resolveWorkspaceEffect,
} from "../../src/services/effectCompatibility.js";
import type {
  WorkspaceEffectCompatibilityFacts,
  WorkspaceEffectDeclaration,
} from "../../src/services/effectCompatibility.js";

const resolved = (
  version: string,
  declaredSpecifier: string = version
): WorkspaceEffectDeclaration => ({
  _tag: "Resolved",
  version,
  declaredSpecifier,
});

const classify = (
  declaration: WorkspaceEffectDeclaration,
  configuredPlugins: WorkspaceEffectCompatibilityFacts["configuredPlugins"] = []
) =>
  classifyWorkspaceEffectCompatibility({
    workspaceEffect: declaration,
    configuredPlugins,
  });

describe("native workspace Effect compatibility", () => {
  test("passes the exact RC for every configured surface", () => {
    expect(
      classify(resolved(REQUIRED_EFFECT_VERSION), ["clients", "effect"])
    ).toMatchObject({ outcome: "pass", code: "TW-DOCTOR-011" });
  });

  test("warns for a non-native version with plain projections", () => {
    const check = classify(resolved("4.0.0-rc.115"), ["clients"]);
    expect(check).toMatchObject({ outcome: "warn", code: "TW-DOCTOR-011" });
    expect(check.message).toContain(REQUIRED_EFFECT_VERSION);
    expect(check.message).not.toContain("isolated");
  });

  test("fails for a non-native version with Effect surfaces", () => {
    const check = classify(resolved("4.0.0"), ["server", "effect"]);
    expect(check).toMatchObject({ outcome: "fail", code: "TW-DOCTOR-011" });
    expect(check.message).toContain(REQUIRED_EFFECT_VERSION);
    expect(check.message).toContain("exact native TypeWeaver runtime");
  });

  test("skips only an undeclared project with plain projections", () => {
    expect(
      classify({ _tag: "NotDeclared" }, ["types", "clients"])
    ).toMatchObject({
      outcome: "skip",
    });
    expect(classify({ _tag: "NotDeclared" }, ["effect"])).toMatchObject({
      outcome: "fail",
    });
  });

  test("separates plain, native, and custom plugins", () => {
    expect(
      classifyConfiguredPlugins([
        "types",
        "@rexeus/typeweaver-server",
        "command",
        "@rexeus/typeweaver-command",
        "openapi",
        "@rexeus/typeweaver-openapi",
        "hono",
        "effect",
        "@rexeus/typeweaver-effect",
        "@acme/plugin",
      ])
    ).toEqual({
      plain: ["types", "@rexeus/typeweaver-server"],
      effect: [
        "command",
        "@rexeus/typeweaver-command",
        "openapi",
        "@rexeus/typeweaver-openapi",
        "hono",
        "effect",
        "@rexeus/typeweaver-effect",
      ],
      external: ["@acme/plugin"],
    });
  });

  test.each([
    "command",
    "@rexeus/typeweaver-command",
    "openapi",
    "@rexeus/typeweaver-openapi",
  ])("requires Effect for the native %s plugin spelling", plugin => {
    expect(classify({ _tag: "NotDeclared" }, [plugin])).toMatchObject({
      outcome: "fail",
    });
    expect(classify(resolved("4.0.0-rc.115"), [plugin])).toMatchObject({
      outcome: "fail",
    });
  });
});

const resolutionRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-resolution-")
);
afterAll(() => rmSync(resolutionRoot, { recursive: true, force: true }));

const writeProject = (
  name: string,
  manifest: Record<string, unknown>,
  installedEffectVersion?: string
): string => {
  const projectRoot = path.join(resolutionRoot, name);
  mkdirSync(projectRoot, { recursive: true });
  writeFileSync(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name, version: "1.0.0", ...manifest }, null, 2)}\n`
  );
  if (installedEffectVersion !== undefined) {
    const effectRoot = path.join(projectRoot, "node_modules", "effect");
    mkdirSync(effectRoot, { recursive: true });
    writeFileSync(
      path.join(effectRoot, "package.json"),
      `${JSON.stringify({ name: "effect", version: installedEffectVersion }, null, 2)}\n`
    );
  }
  return projectRoot;
};

describe("project-owned Effect resolution", () => {
  test("does not inherit an undeclared parent runtime", () => {
    expect(
      resolveWorkspaceEffect(
        writeProject("not-declared", { dependencies: { zod: "4.0.0" } })
      )
    ).toEqual({ _tag: "NotDeclared" });
  });

  test("requires the resolved runtime to satisfy the exact declaration", () => {
    const projectRoot = writeProject(
      "declared",
      { dependencies: { effect: REQUIRED_EFFECT_VERSION } },
      REQUIRED_EFFECT_VERSION
    );
    expect(resolveWorkspaceEffect(projectRoot)).toEqual({
      _tag: "Resolved",
      version: REQUIRED_EFFECT_VERSION,
      declaredSpecifier: REQUIRED_EFFECT_VERSION,
    });
  });

  test("fails truthfully when the installed runtime disagrees", () => {
    const projectRoot = writeProject(
      "mismatch",
      { dependencies: { effect: REQUIRED_EFFECT_VERSION } },
      "4.0.0-rc.115"
    );
    const resolution = resolveWorkspaceEffect(projectRoot);
    expect(resolution._tag).toBe("Unresolved");
    if (resolution._tag === "Unresolved") {
      expect(resolution.detail).toContain("does not satisfy it");
    }
  });
});
