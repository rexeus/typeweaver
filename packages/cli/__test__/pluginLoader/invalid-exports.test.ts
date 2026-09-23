import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { PluginLoadError } from "../../src/errors/PluginLoadError.js";
import {
  aModuleImportFailure,
  createPluginFixtureWorkspace,
} from "../helpers/index.js";
import {
  anIncompletePluginConfigTag,
  capturePluginLoadError,
  configWithPlugin,
  requiredTypesPlugin,
  runLoadPlugins,
  runLoadPluginsExit,
} from "./support.js";
import type { ModuleFixture } from "../helpers/index.js";
import type { RegisteredPlugin } from "./support.js";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

const fixtures = createPluginFixtureWorkspace();

afterEach(() => {
  fixtures.cleanup();
});

describe("pluginLoader invalid plugin exports", () => {
  test("continues to npm fallback when module evaluation throws an incomplete configuration tag", async () => {
    let fallbackAttempted = false;
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local", "npm"],
      modules: new Map<string, ModuleFixture>([
        [
          "misconfigured-plugin",
          aModuleImportFailure(
            anIncompletePluginConfigTag("misconfigured-plugin")
          ),
        ],
        [
          "@rexeus/typeweaver-misconfigured-plugin",
          {
            misconfiguredPlugin: () => {
              fallbackAttempted = true;
              return { name: "misconfigured-plugin" };
            },
          },
        ],
      ]),
      config: configWithPlugin("misconfigured-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "misconfigured-plugin",
    ]);
    expect(fallbackAttempted).toBe(true);
  });
  test("rejects exports without a plugin name", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins,
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "nameless-plugin",
            {
              namelessPlugin: { generate: () => undefined },
            },
          ],
        ]),
        config: configWithPlugin("nameless-plugin"),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: "nameless-plugin",
        error:
          "Export 'namelessPlugin' has invalid plugin field 'name': expected a non-empty string, received undefined",
      },
    ]);
    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
  });
});

describe("pluginLoader plugin shape validation", () => {
  test.each(
    [
      { field: "name", invalidValue: undefined, omitField: true },
      { field: "name", invalidValue: "", omitField: false },
      { field: "name", invalidValue: "   ", omitField: false },
      { field: "name", invalidValue: 42, omitField: false },
      { field: "depends", invalidValue: "valid-dependency", omitField: false },
      {
        field: "depends",
        invalidValue: ["valid-dependency", 42],
        omitField: false,
      },
      { field: "initialize", invalidValue: 42, omitField: false },
      { field: "validate", invalidValue: 42, omitField: false },
      { field: "collectResources", invalidValue: 42, omitField: false },
      { field: "generate", invalidValue: 42, omitField: false },
      { field: "finalize", invalidValue: 42, omitField: false },
      { field: "acquire", invalidValue: 42, omitField: false },
    ].flatMap(invalidField => [
      { ...invalidField, exportKind: "record" },
      { ...invalidField, exportKind: "factory result" },
    ]) satisfies readonly InvalidPluginShapeCase[]
  )(
    "rejects invalid $field on a plugin $exportKind before registration",
    testInvalidPluginShape
  );

  test("registers a scoped plugin whose lifecycle hooks come from acquire", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];
    const acquire = Effect.die("scoped acquisition must not run on load");

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [],
      strategies: ["local"],
      modules: new Map([
        ["scoped-plugin", { default: { name: "scoped-plugin", acquire } }],
      ]),
      config: configWithPlugin("scoped-plugin"),
    });

    expect(registeredPlugins.map(({ plugin }) => plugin)).toEqual([
      { name: "scoped-plugin", acquire },
    ]);
  });

  test("rejects a top-level lifecycle hook beside acquire", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];
    const exit = await runLoadPluginsExit({
      registeredPlugins,
      requiredPlugins: [],
      strategies: ["local"],
      modules: new Map([
        [
          "invalid-plugin",
          {
            default: {
              name: "invalid-plugin",
              acquire: Effect.die("scoped acquisition must not run on load"),
              generate: () => Effect.die("generate must not run on load"),
            },
          },
        ],
      ]),
      config: configWithPlugin("invalid-plugin"),
    });

    assertInvalidPluginLoadFailure(exit, "generate");
    expect(registeredPlugins).toEqual([]);
  });
});

type InvalidPluginShapeCase = {
  readonly exportKind: "record" | "factory result";
  readonly field: string;
  readonly invalidValue: unknown;
  readonly omitField?: boolean;
};

type InvalidPluginProbe = {
  readonly plugin: Record<string, unknown>;
  readonly getFactoryInvocations: () => number;
  readonly getLifecycleInvocations: () => number;
  readonly factory: () => Record<string, unknown>;
};

const createInvalidPluginProbe = ({
  field,
  invalidValue,
  omitField = false,
}: InvalidPluginShapeCase): InvalidPluginProbe => {
  let factoryInvocations = 0;
  let lifecycleInvocations = 0;
  const lifecycleTripwire = () => {
    lifecycleInvocations += 1;
    return Effect.die("invalid plugin lifecycle must never run");
  };
  const plugin: Record<string, unknown> = {
    name: "invalid-plugin",
    initialize: lifecycleTripwire,
    validate: lifecycleTripwire,
    collectResources: lifecycleTripwire,
    generate: lifecycleTripwire,
    finalize: lifecycleTripwire,
  };

  if (omitField) {
    delete plugin[field];
  } else {
    plugin[field] = invalidValue;
  }

  return {
    plugin,
    getFactoryInvocations: () => factoryInvocations,
    getLifecycleInvocations: () => lifecycleInvocations,
    factory: () => {
      factoryInvocations += 1;
      return plugin;
    },
  };
};

const assertInvalidPluginLoadFailure = (
  exit: Awaited<ReturnType<typeof runLoadPluginsExit>>,
  field: string
): void => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) {
    return;
  }

  expect(causeDefects(exit.cause)).toHaveLength(0);
  const failure = Cause.findErrorOption(exit.cause);
  expect(Option.isSome(failure)).toBe(true);
  if (!Option.isSome(failure)) {
    return;
  }

  expect(failure.value).toBeInstanceOf(PluginLoadError);
  if (!(failure.value instanceof PluginLoadError)) {
    return;
  }

  expect(failure.value.attempts).toEqual([
    {
      path: "invalid-plugin",
      error: expect.stringContaining(`field '${field}'`) as unknown,
    },
  ]);
};

async function testInvalidPluginShape({
  exportKind,
  field,
  invalidValue,
  omitField = false,
}: InvalidPluginShapeCase): Promise<void> {
  const probe = createInvalidPluginProbe({
    exportKind,
    field,
    invalidValue,
    omitField,
  });
  const exportedValue = exportKind === "record" ? probe.plugin : probe.factory;
  const registeredPlugins: RegisteredPlugin[] = [];
  const exit = await runLoadPluginsExit({
    registeredPlugins,
    requiredPlugins: [],
    strategies: ["local"],
    modules: new Map([["invalid-plugin", { default: exportedValue }]]),
    config: configWithPlugin("invalid-plugin"),
  });

  assertInvalidPluginLoadFailure(exit, field);
  expect(registeredPlugins).toEqual([]);
  expect(probe.getLifecycleInvocations()).toBe(0);
  expect(probe.getFactoryInvocations()).toBe(exportKind === "record" ? 0 : 1);
}
