import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  TESTED_EFFECT_4_VERSION,
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

const messageOf = (facts: WorkspaceEffectCompatibilityFacts): string => {
  const check = classifyWorkspaceEffectCompatibility(facts);
  return `${check.name}: ${check.message}`;
};

describe("workspace Effect compatibility classifier", () => {
  test("skips when the project does not declare Effect", () => {
    expect(classify({ _tag: "NotDeclared" })).toMatchObject({
      code: "TW-DOCTOR-011",
      name: "workspace Effect compatibility",
      outcome: "skip",
    });
  });

  test("fails when the project declares Effect but it cannot be verified", () => {
    const check = classify({
      _tag: "Unresolved",
      detail:
        "the project declares effect@4.0.0-rc.115 but the resolved version 3.22.0 does not satisfy it",
    });
    expect(check).toMatchObject({
      code: "TW-DOCTOR-011",
      outcome: "fail",
    });
    expect(check.message).toContain("cannot verify");
    expect(check.message).toContain("does not satisfy it");
  });

  test("passes a supported Effect 3 workspace", () => {
    for (const version of ["3.22.0", "3.22.5", "3.23.1"]) {
      for (const plugins of [
        ["clients", "server"],
        ["server", "effect"],
        ["clients", "@acme/typeweaver-plugin"],
      ]) {
        const check = classify(resolved(version), plugins);
        expect(check, `${version}: ${plugins.join(", ")}`).toMatchObject({
          outcome: "pass",
        });
        expect(check.message).not.toContain("isolated");
      }
    }
  });

  test("does not pass Effect 3 prereleases under standard semver semantics", () => {
    for (const version of ["3.22.0-rc.1", "3.23.0-rc.1", "3.22.0-0"]) {
      const check = classify(resolved(version), ["clients"]);
      expect(check.outcome, version).not.toBe("pass");
      expect(check.outcome, version).toBe("warn");
      expect(check.message, version).not.toMatch(/can still run|isolated/iu);
    }
  });

  test("warns conditionally for the tested Effect 4 RC", () => {
    const check = classify(resolved(TESTED_EFFECT_4_VERSION), [
      "types",
      "clients",
      "server",
      "openapi",
    ]);
    expect(check).toMatchObject({
      code: "TW-DOCTOR-011",
      outcome: "warn",
    });
    expect(check.message).toContain(TESTED_EFFECT_4_VERSION);
    expect(check.message).toContain("isolated");
    expect(check.message).toContain("Effect-independent");
    expect(check.message).toContain("cannot verify");
    expect(check.message).toContain("Effect-neutral");
    expect(check.message).toContain("@rexeus/typeweaver-gen");
    expect(check.message).toContain("@rexeus/typeweaver-effect");
  });

  test("warns UNVERIFIED for any other Effect 4 version", () => {
    for (const version of ["4.0.0-rc.90", "4.0.0", "4.1.0"]) {
      const check = classify(resolved(version), ["clients"]);
      expect(check.outcome, version).toBe("warn");
      expect(check.message, version).toContain(version);
      expect(check.message, version).toContain("UNVERIFIED");
      expect(check.message, version).toContain(TESTED_EFFECT_4_VERSION);
      expect(check.message, version).toContain("does not claim");
      expect(check.message, version).not.toContain("can still run");
    }
  });
});

describe("undeclared Effect with native surfaces", () => {
  test("skips only when no native or custom plugin is configured", () => {
    const plainPluginLists: WorkspaceEffectCompatibilityFacts["configuredPlugins"][] =
      [[], ["types", "clients", "server", "openapi"]];
    for (const plugins of plainPluginLists) {
      expect(classify({ _tag: "NotDeclared" }, plugins)).toMatchObject({
        code: "TW-DOCTOR-011",
        outcome: "skip",
      });
    }
  });

  test("fails for an undeclared project that configures the Effect projection", () => {
    const check = classify({ _tag: "NotDeclared" }, ["server", "effect"]);
    expect(check).toMatchObject({
      code: "TW-DOCTOR-011",
      outcome: "fail",
    });
    expect(check.message).toContain("does not declare Effect");
    expect(check.message).toContain("project-owned Effect");
    expect(check.message).toContain("effect");
    expect(check.message).toContain(">=3.22.0 <4");
  });

  test("fails for an undeclared project that configures a custom plugin", () => {
    for (const external of [
      "@rexeus/typeweaver-effect",
      "./plugins/custom.mjs",
      "@acme/typeweaver-plugin",
    ]) {
      const check = classify({ _tag: "NotDeclared" }, ["clients", external]);
      expect(check.outcome, external).toBe("fail");
      expect(check.message, external).toContain(external);
    }
  });
});

describe("workspace Effect compatibility failures", () => {
  test("fails an Effect 4 workspace that configures the Effect projection", () => {
    for (const version of [TESTED_EFFECT_4_VERSION, "4.0.0"]) {
      const check = classify(resolved(version), ["server", "effect"]);
      expect(check).toMatchObject({
        outcome: "fail",
        code: "TW-DOCTOR-011",
      });
      expect(check.message).toContain("effect");
      expect(check.message).toContain("Effect-native");
      expect(check.message).toContain(">=3.22.0 <4");
    }
  });

  test("fails an Effect 4 workspace with a custom plugin specifier", () => {
    for (const external of [
      "./plugins/custom.mjs",
      "file:./plugins/custom.mjs",
      "/abs/plugins/custom.mjs",
      "@acme/typeweaver-plugin",
      "@rexeus/typeweaver-custom",
    ]) {
      const check = classify(resolved(TESTED_EFFECT_4_VERSION), [
        "clients",
        external,
      ]);
      expect(check.outcome, external).toBe("fail");
      expect(check.message, external).toContain(external);
    }
  });

  test("fails any unsupported newer major", () => {
    expect(classify(resolved("5.0.0"), ["clients"]).outcome).toBe("fail");
    expect(classify(resolved("5.0.0"), []).outcome).toBe("fail");
  });

  test("warns an older unsupported Effect with plain projections and fails native surfaces", () => {
    const older = classify(resolved("3.21.0"), ["clients"]);
    expect(older.outcome).toBe("warn");
    expect(older.message).not.toContain("can still run");
    expect(older.message).not.toContain("can run as an isolated");
    expect(classify(resolved("3.21.0"), ["effect"]).outcome).toBe("fail");
    expect(classify(resolved("2.4.0"), ["clients"]).outcome).toBe("warn");
    expect(classify(resolved("2.4.0"), ["./plugins/custom.mjs"]).outcome).toBe(
      "fail"
    );
  });
});

describe("workspace Effect compatibility wording", () => {
  test("never claims generic Effect 4 support or source purity", () => {
    const messages = [
      messageOf({
        workspaceEffect: { _tag: "NotDeclared" },
        configuredPlugins: [],
      }),
      messageOf({
        workspaceEffect: resolved(TESTED_EFFECT_4_VERSION),
        configuredPlugins: ["clients", "server"],
      }),
      messageOf({
        workspaceEffect: resolved("4.0.0"),
        configuredPlugins: ["clients", "server"],
      }),
      messageOf({
        workspaceEffect: resolved(TESTED_EFFECT_4_VERSION),
        configuredPlugins: ["effect"],
      }),
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/\bpure\b|\bpurity\b/iu);
      expect(message).not.toContain(">=3.22.0 <5");
      expect(message).not.toMatch(/supports Effect 4/iu);
    }
  });

  test("names a valid TW-DOCTOR code for every outcome", () => {
    for (const declaration of [
      { _tag: "NotDeclared" },
      { _tag: "Unresolved", detail: "x" },
      resolved("3.22.0"),
      resolved(TESTED_EFFECT_4_VERSION),
    ] satisfies WorkspaceEffectDeclaration[]) {
      expect(classify(declaration).code).toMatch(/^TW-DOCTOR-\d{3}$/u);
    }
  });
});

describe("configured plugin classification", () => {
  test("separates built-in plain, Effect-native, and custom plugins", () => {
    const classified = classifyConfiguredPlugins([
      "types",
      "clients",
      "@rexeus/typeweaver-server",
      ["command", {}],
      "effect",
      "@rexeus/typeweaver-effect",
      "./plugins/custom.mjs",
      "@acme/plugin",
    ]);
    expect(classified.plain).toEqual([
      "types",
      "clients",
      "@rexeus/typeweaver-server",
      "command",
    ]);
    expect(classified.effect).toEqual(["effect", "@rexeus/typeweaver-effect"]);
    expect(classified.external).toEqual([
      "./plugins/custom.mjs",
      "@acme/plugin",
    ]);
  });

  test("treats unknown @rexeus packages as custom rather than built-in", () => {
    expect(
      classifyConfiguredPlugins(["@rexeus/typeweaver-custom"]).external
    ).toEqual(["@rexeus/typeweaver-custom"]);
  });
});

const resolutionRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-resolution-")
);

afterAll(() => {
  rmSync(resolutionRoot, { recursive: true, force: true });
});

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
  test("does not inherit a parent Effect when the project does not declare one", () => {
    const projectRoot = writeProject("no-declaration", {
      dependencies: { "@rexeus/typeweaver": "0.12.0" },
    });
    expect(resolveWorkspaceEffect(projectRoot)).toEqual({
      _tag: "NotDeclared",
    });
    expect(
      classifyWorkspaceEffectCompatibility({
        workspaceEffect: resolveWorkspaceEffect(projectRoot),
        configuredPlugins: ["clients", "server"],
      }).outcome
    ).toBe("skip");
  });

  test.each([
    ["dependencies", "dependencies"],
    ["devDependencies", "devDependencies"],
    ["optionalDependencies", "optionalDependencies"],
    ["peerDependencies", "peerDependencies"],
  ])("resolves Effect declared in %s", (_label, section) => {
    const projectRoot = writeProject(
      `declared-${section}`,
      { [section]: { effect: "4.0.0-rc.115" } },
      TESTED_EFFECT_4_VERSION
    );
    expect(resolveWorkspaceEffect(projectRoot)).toEqual({
      _tag: "Resolved",
      version: TESTED_EFFECT_4_VERSION,
      declaredSpecifier: "4.0.0-rc.115",
    });
  });

  test("accepts a hoisted Effect only when it satisfies the declaration", () => {
    const projectRoot = writeProject(
      "satisfied-declaration",
      { dependencies: { effect: "^3.22.0" } },
      "3.22.5"
    );
    expect(resolveWorkspaceEffect(projectRoot)).toEqual({
      _tag: "Resolved",
      version: "3.22.5",
      declaredSpecifier: "^3.22.0",
    });
  });

  test("fails when the resolved version does not satisfy the declaration", () => {
    const projectRoot = writeProject(
      "mismatched-declaration",
      { dependencies: { effect: TESTED_EFFECT_4_VERSION } },
      "3.22.0"
    );
    expect(resolveWorkspaceEffect(projectRoot)).toMatchObject({
      _tag: "Unresolved",
      detail: expect.stringContaining("does not satisfy it"),
    });
    expect(
      classifyWorkspaceEffectCompatibility({
        workspaceEffect: resolveWorkspaceEffect(projectRoot),
        configuredPlugins: ["clients", "server"],
      }).outcome
    ).toBe("fail");
  });

  test("fails truthfully for a non-semver declaration", () => {
    const projectRoot = writeProject(
      "non-semver-declaration",
      { dependencies: { effect: "catalog:peers" } },
      "3.22.0"
    );
    expect(resolveWorkspaceEffect(projectRoot)).toMatchObject({
      _tag: "Unresolved",
      detail: expect.stringContaining("non-semver"),
    });
  });
});
