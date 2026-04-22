import path from "node:path";
import { createPluginRegistry } from "@rexeus/typeweaver-gen";
import type {
  Issue,
  PluginConfig,
  PluginValidationContext,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { PluginLoadingFailure } from "../../generators/errors/pluginLoadingFailure.js";
import { loadPlugins } from "../../generators/pluginLoader.js";
import { NOOP_LOGGER } from "../../logger.js";
import { LOAD_SPEC_ID } from "./loadSpec.js";
import { createCheckHelpers } from "./support.js";
import type { ValidateCheck } from "../types.js";

export const PLUGIN_VALIDATORS_ID = "plugin/validators";

const IDENTITY = {
  id: PLUGIN_VALIDATORS_ID,
  label: "Plugin validators",
} as const;

const normalizePluginEntry = (
  entry: string | readonly [string, ...unknown[]]
): string | [string, PluginConfig] => {
  if (typeof entry === "string") {
    return entry;
  }

  const [name, maybeConfig] = entry;
  return [name, (maybeConfig ?? {}) as PluginConfig];
};

const buildPluginLoadIssue = (error: unknown): Issue => {
  if (error instanceof PluginLoadingFailure) {
    const attemptsDetail = error.attempts
      .map(attempt => `${attempt.path}: ${attempt.error}`)
      .join("; ");
    return {
      code: "TW-PLUGIN-LOAD-001",
      severity: "error",
      message: `Failed to load plugin '${error.pluginName}'${
        attemptsDetail.length > 0 ? ` — ${attemptsDetail}` : ""
      }`,
      hint: "Install the plugin package or fix the module's plugin export.",
    };
  }

  return {
    code: "TW-PLUGIN-LOAD-001",
    severity: "error",
    message: `Plugin load failed: ${error instanceof Error ? error.message : String(error)}`,
    hint: "Install the plugin package or fix the module's plugin export.",
  };
};

export const createPluginValidatorsCheck = (): ValidateCheck => {
  const helpers = createCheckHelpers(IDENTITY);

  return {
    ...IDENTITY,
    dependsOn: [LOAD_SPEC_ID],
    run: async context => {
      if (!context.pluginsEnabled) {
        return helpers.pass("Plugin validation disabled.");
      }

      const spec = context.state.spec;
      if (!spec) {
        return helpers.pass("No spec loaded; nothing to validate.");
      }

      const loadedConfig = context.state.loadedConfig;
      const declaredPlugins = loadedConfig?.plugins ?? [];

      if (declaredPlugins.length === 0) {
        return helpers.pass("No plugins declared in config.");
      }

      // Invariant: `dependsOn: [LOAD_SPEC_ID]` ensures we only run after
      // loadSpec passed, which guarantees `state.inputPath` is set.
      const inputPath = context.state.inputPath;
      if (!inputPath) {
        return helpers.pass(
          "Plugin validation skipped: spec input path not resolved."
        );
      }

      const inputDir = path.dirname(inputPath);
      const registry = createPluginRegistry();
      const loaderConfig: TypeweaverConfig = {
        input: inputPath,
        output: loadedConfig?.output ?? "",
        plugins: declaredPlugins.map(normalizePluginEntry),
      };

      const issues: Issue[] = [];

      try {
        await loadPlugins(
          registry,
          [new TypesPlugin()],
          ["npm", "local"],
          NOOP_LOGGER,
          loaderConfig
        );
      } catch (error) {
        const loadIssue = buildPluginLoadIssue(error);
        issues.push(loadIssue);
        context.emitIssue(loadIssue);

        return helpers.finalize(issues, context.ruleResolver, {
          pass: "Plugins skipped.",
          warn: count => `Plugin load surfaced ${count} warning(s).`,
          fail: count => `Plugin load surfaced ${count} error(s).`,
          info: count => `Plugin load surfaced ${count} note(s).`,
        });
      }

      for (const registration of registry.getAll()) {
        const plugin = registration.plugin;
        if (plugin.validate === undefined) {
          continue;
        }

        const pluginContext: PluginValidationContext = {
          pluginName: registration.name,
          inputDir,
          config: (registration.config ?? {}) as PluginConfig,
        };

        try {
          const emitted = await plugin.validate(spec, pluginContext);
          for (const issue of emitted) {
            issues.push(issue);
            context.emitIssue(issue);
          }
        } catch (error) {
          const crashIssue: Issue = {
            code: "TW-PLUGIN-CRASH-001",
            severity: "error",
            message: `Plugin '${registration.name}' validator threw: ${
              error instanceof Error ? error.message : String(error)
            }`,
            hint: "The plugin's validate() hook crashed. Report this to the plugin author.",
          };
          issues.push(crashIssue);
          context.emitIssue(crashIssue);
        }
      }

      const pluginCount = registry.getAll().length;
      const validatorCount = registry
        .getAll()
        .filter(
          registration => registration.plugin.validate !== undefined
        ).length;

      return helpers.finalize(issues, context.ruleResolver, {
        pass: `${validatorCount}/${pluginCount} plugin(s) contributed no issues.`,
        warn: count =>
          `${validatorCount} plugin validator(s) surfaced ${count} warning(s).`,
        fail: count =>
          `${validatorCount} plugin validator(s) surfaced ${count} error(s).`,
        info: count =>
          `${validatorCount} plugin validator(s) surfaced ${count} note(s).`,
      });
    },
  };
};
