import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  REQUIRED_EFFECT_VERSION,
  classifyConfiguredPlugins,
  classifyWorkspaceEffectCompatibility,
} from "../../src/services/effectCompatibility.js";
import { resolveWorkspaceEffect } from "../../src/services/effectWorkspaceResolution.js";
import type { WorkspaceEffectCompatibilityFacts } from "../../src/services/effectCompatibility.js";
import type { WorkspaceEffectDeclaration } from "../../src/services/effectWorkspaceResolution.js";

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
    const check = classify({ _tag: "NotDeclared" }, ["types", "clients"]);
    expect(check).toMatchObject({ outcome: "skip" });
    expect(check.message).not.toContain("CLI-hosted");
    expect(classify({ _tag: "NotDeclared" }, ["effect"])).toMatchObject({
      outcome: "fail",
    });
  });

  test("separates plain, CLI-hosted, Effect projection, and custom plugins", () => {
    expect(
      classifyConfiguredPlugins([
        "types",
        "@rexeus/typeweaver-server",
        "command",
        "@rexeus/typeweaver-command",
        "openapi",
        ["@rexeus/typeweaver-openapi", { target: "3.2.0" }],
        "hono",
        "@rexeus/typeweaver-hono",
        "effect",
        "@rexeus/typeweaver-effect",
        "@acme/plugin",
        "./plugins/custom.mjs",
      ])
    ).toEqual({
      plain: ["types", "@rexeus/typeweaver-server"],
      cliHosted: [
        "command",
        "@rexeus/typeweaver-command",
        "openapi",
        "@rexeus/typeweaver-openapi",
        "hono",
        "@rexeus/typeweaver-hono",
      ],
      effectProjection: ["effect", "@rexeus/typeweaver-effect"],
      external: ["@acme/plugin", "./plugins/custom.mjs"],
    });
  });

  test.each([
    "hono",
    "@rexeus/typeweaver-hono",
    "command",
    "@rexeus/typeweaver-command",
    "openapi",
    "@rexeus/typeweaver-openapi",
  ])("runs the CLI-hosted %s plugin on the CLI's own Effect", plugin => {
    const skipped = classify({ _tag: "NotDeclared" }, ["types", plugin]);
    expect(skipped).toMatchObject({ outcome: "skip" });
    expect(skipped.message).toContain(`CLI-hosted generators (${plugin})`);
    expect(skipped.message).not.toContain("no Effect-native");

    const warned = classify(resolved("4.0.0-rc.115"), [plugin]);
    expect(warned).toMatchObject({ outcome: "warn" });
    expect(warned.message).toContain(plugin);
    expect(warned.message).toContain("CLI's own Effect");

    expect(classify(resolved(REQUIRED_EFFECT_VERSION), [plugin])).toMatchObject(
      { outcome: "pass" }
    );
  });

  test.each([
    "effect",
    "@rexeus/typeweaver-effect",
    "@acme/plugin",
    "./plugins/custom.mjs",
  ])("requires a project-owned exact Effect for %s", plugin => {
    const undeclared = classify({ _tag: "NotDeclared" }, ["hono", plugin]);
    expect(undeclared).toMatchObject({ outcome: "fail" });
    expect(undeclared.message).toContain(`runtime: ${plugin}.`);

    const mismatched = classify(resolved("4.0.0-rc.115"), ["hono", plugin]);
    expect(mismatched).toMatchObject({ outcome: "fail" });
    expect(mismatched.message).toContain(
      `${REQUIRED_EFFECT_VERSION}: ${plugin}.`
    );

    expect(
      classify(resolved(REQUIRED_EFFECT_VERSION), ["hono", plugin])
    ).toMatchObject({ outcome: "pass" });
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
