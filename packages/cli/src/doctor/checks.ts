import fs from "node:fs";
import path from "node:path";
import { createPluginRegistry, normalizeSpec } from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import {
  assertSupportedConfigPath,
  loadConfig,
} from "../configLoader.js";
import { isFormatterAvailable } from "../generators/formatter.js";
import { assertSafeCleanTarget } from "../generators/generator.js";
import { loadPlugins } from "../generators/pluginLoader.js";
import { bundle } from "../generators/spec/specBundler.js";
import { createSpecDependencyResolutionBridge } from "../generators/spec/specDependencyResolution.js";
import { importDefinition } from "../generators/spec/specImporter.js";
import { detectRuntime, getRuntimeDisplayName } from "../runtime.js";
import { resolveCommandPath } from "../commands/shared.js";
import type { DoctorCheck, DoctorCheckOutcome } from "./types.js";

const CONFIG_EXISTS_CHECK = "config-exists";
const CONFIG_EXTENSION_CHECK = "config-extension";
const CONFIG_EXPORT_CHECK = "config-export";
const INPUT_EXISTS_CHECK = "input-exists";
const OUTPUT_SAFETY_CHECK = "output-safety";
const SPEC_BUNDLE_CHECK = "spec-bundle";

export const createDoctorChecks = (isDeep: boolean): readonly DoctorCheck[] => {
  const checks: DoctorCheck[] = [
    {
      id: "runtime",
      label: "Runtime detection",
      phase: "standard",
      run: async () => {
        const runtime = detectRuntime();
        const runtimeVersion = typeof process !== "undefined" ? process.version : undefined;

        return pass("runtime", "Runtime detection", `${getRuntimeDisplayName(runtime)} detected${runtimeVersion ? ` (${runtimeVersion})` : ""}.`);
      },
    },
    {
      id: CONFIG_EXISTS_CHECK,
      label: "Config file",
      phase: "standard",
      run: async context => {
        if (!fs.existsSync(context.configPath)) {
          return fail(
            CONFIG_EXISTS_CHECK,
            "Config file",
            `Config file not found at '${context.configPath}'.`
          );
        }

        return pass(
          CONFIG_EXISTS_CHECK,
          "Config file",
          `Found config at '${context.configPath}'.`
        );
      },
    },
    {
      id: CONFIG_EXTENSION_CHECK,
      label: "Config extension",
      phase: "standard",
      dependsOn: [CONFIG_EXISTS_CHECK],
      run: async context => {
        assertSupportedConfigPath(context.configPath);

        return pass(
          CONFIG_EXTENSION_CHECK,
          "Config extension",
          `Supported config extension '${path.extname(context.configPath)}'.`
        );
      },
    },
    {
      id: CONFIG_EXPORT_CHECK,
      label: "Config export",
      phase: "standard",
      dependsOn: [CONFIG_EXTENSION_CHECK],
      run: async context => {
        const loadedConfig = await loadConfig(context.configPath);

        return {
          result: {
            id: CONFIG_EXPORT_CHECK,
            label: "Config export",
            phase: "standard",
            status: "pass",
            summary: "Configuration exports a valid config object.",
            details: [],
          },
          state: {
            loadedConfig,
          },
        } satisfies DoctorCheckOutcome;
      },
    },
    {
      id: INPUT_EXISTS_CHECK,
      label: "Input path",
      phase: "standard",
      dependsOn: [CONFIG_EXPORT_CHECK],
      run: async context => {
        const inputPath = context.state.loadedConfig?.input;

        if (!inputPath) {
          return fail(
            INPUT_EXISTS_CHECK,
            "Input path",
            "Config is missing an input spec entrypoint."
          );
        }

        const resolvedInputPath = resolveCommandPath(context.execDir, inputPath);
        if (!fs.existsSync(resolvedInputPath)) {
          return fail(
            INPUT_EXISTS_CHECK,
            "Input path",
            `Spec entrypoint not found at '${resolvedInputPath}'.`
          );
        }

        return {
          result: {
            id: INPUT_EXISTS_CHECK,
            label: "Input path",
            phase: "standard",
            status: "pass",
            summary: `Found spec entrypoint at '${resolvedInputPath}'.`,
            details: [],
          },
          state: {
            inputPath: resolvedInputPath,
          },
        } satisfies DoctorCheckOutcome;
      },
    },
    {
      id: OUTPUT_SAFETY_CHECK,
      label: "Output path safety",
      phase: "standard",
      dependsOn: [CONFIG_EXPORT_CHECK],
      run: async context => {
        const outputPath = context.state.loadedConfig?.output;

        if (!outputPath) {
          return fail(
            OUTPUT_SAFETY_CHECK,
            "Output path safety",
            "Config is missing an output directory."
          );
        }

        const resolvedOutputPath = resolveCommandPath(context.execDir, outputPath);
        if ((context.state.loadedConfig?.clean ?? true) === true) {
          assertSafeCleanTarget(resolvedOutputPath, context.execDir);
        }

        return {
          result: {
            id: OUTPUT_SAFETY_CHECK,
            label: "Output path safety",
            phase: "standard",
            status: "pass",
            summary:
              (context.state.loadedConfig?.clean ?? true) === true
                ? `Output directory '${resolvedOutputPath}' passed clean-path safety checks.`
                : `Output directory '${resolvedOutputPath}' configured with clean disabled.`,
            details: [],
          },
          state: {
            outputPath: resolvedOutputPath,
          },
        } satisfies DoctorCheckOutcome;
      },
    },
    {
      id: "plugin-resolution",
      label: "Plugin resolution",
      phase: "standard",
      dependsOn: [CONFIG_EXPORT_CHECK],
      run: async context => {
        const plugins = context.state.loadedConfig?.plugins ?? [];

        if (plugins.length === 0) {
          return pass(
            "plugin-resolution",
            "Plugin resolution",
            "No optional plugins configured."
          );
        }

        const registry = createPluginRegistry();
        await loadPlugins(
          registry,
          [new TypesPlugin()],
          ["npm", "local"],
          createQuietLogger(),
          {
            input: context.state.loadedConfig?.input ?? "",
            output: context.state.loadedConfig?.output ?? "",
            plugins,
          }
        );

        return pass(
          "plugin-resolution",
          "Plugin resolution",
          `Resolved ${plugins.length} optional plugin(s).`
        );
      },
    },
    {
      id: "formatter-availability",
      label: "Formatter availability",
      phase: "standard",
      dependsOn: [CONFIG_EXPORT_CHECK],
      run: async context => {
        if ((context.state.loadedConfig?.format ?? true) === false) {
          return pass(
            "formatter-availability",
            "Formatter availability",
            "Formatting is disabled in config."
          );
        }

        if (await isFormatterAvailable()) {
          return pass(
            "formatter-availability",
            "Formatter availability",
            "oxfmt is available."
          );
        }

        return {
          result: {
            id: "formatter-availability",
            label: "Formatter availability",
            phase: "standard",
            status: "warn",
            summary: "oxfmt is not installed; generated code will not be formatted.",
            details: ["Install it with: npm install -D oxfmt"],
          },
        } satisfies DoctorCheckOutcome;
      },
    },
  ];

  if (isDeep) {
    checks.push(
      {
        id: SPEC_BUNDLE_CHECK,
        label: "Spec bundle",
        phase: "deep",
        dependsOn: [INPUT_EXISTS_CHECK],
        run: async context => {
          if (!context.state.inputPath) {
            return fail(
              SPEC_BUNDLE_CHECK,
              "Spec bundle",
              "Cannot bundle the spec because the resolved input path is unavailable after prerequisite checks."
            );
          }

          const specOutputDir = path.join(context.temporaryDirectory, "spec-bundle");
          const bundledSpecFile = await bundle({
            inputFile: context.state.inputPath,
            specOutputDir,
          });

          return {
            result: {
              id: SPEC_BUNDLE_CHECK,
              label: "Spec bundle",
              phase: "deep",
              status: "pass",
              summary: "Spec entrypoint bundled successfully.",
              details: [bundledSpecFile],
            },
            state: {
              bundledSpecFile,
            },
          } satisfies DoctorCheckOutcome;
        },
      },
      {
        id: "spec-import-shape",
        label: "Spec import and shape",
        phase: "deep",
        dependsOn: [SPEC_BUNDLE_CHECK],
        run: async context => {
          if (!context.state.bundledSpecFile) {
            return fail(
              "spec-import-shape",
              "Spec import and shape",
              "Cannot import the bundled spec because the bundle output path is unavailable after prerequisite checks."
            );
          }

          const cleanupDependencyResolutionBridge =
            createSpecDependencyResolutionBridge({
              specExecutionDir: path.dirname(context.state.bundledSpecFile),
              inputFile: context.state.inputPath!,
            });
          const definition = await importDefinition(
            context.state.bundledSpecFile
          ).finally(() => {
            cleanupDependencyResolutionBridge();
          });
          const normalizedSpec = normalizeSpec(definition);
          const operationCount = normalizedSpec.resources.reduce(
            (count, resource) => count + resource.operations.length,
            0
          );

          return pass(
            "spec-import-shape",
            "Spec import and shape",
            `Imported a valid spec with ${normalizedSpec.resources.length} resource(s), ${operationCount} operation(s), and ${normalizedSpec.responses.length} response(s).`
          );
        },
      }
    );
  }

  return checks;
};

const createQuietLogger = () => {
  return {
    isVerbose: false,
    debug: () => {},
    info: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
    step: () => {},
    summary: () => {},
  } as const;
};

const pass = (
  id: string,
  label: string,
  summary: string,
  details: readonly string[] = []
): DoctorCheckOutcome => {
  return {
    result: {
      id,
      label,
      phase: id === SPEC_BUNDLE_CHECK || id === "spec-import-shape" ? "deep" : "standard",
      status: "pass",
      summary,
      details,
    },
  };
};

const fail = (
  id: string,
  label: string,
  summary: string,
  details: readonly string[] = []
): DoctorCheckOutcome => {
  return {
    result: {
      id,
      label,
      phase: id === SPEC_BUNDLE_CHECK || id === "spec-import-shape" ? "deep" : "standard",
      status: "fail",
      summary,
      details,
    },
  };
};
