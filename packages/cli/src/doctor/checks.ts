import fs from "node:fs";
import path from "node:path";
import { resolveCommandPath } from "../commands/shared.js";
import { assertSupportedConfigPath, loadConfig } from "../configLoader.js";
import { isFormatterAvailable } from "../generators/formatter.js";
import {
  fail as baseFail,
  pass as basePass,
  warn as baseWarn,
} from "../pipeline/helpers.js";
import { detectRuntime, getRuntimeDisplayName } from "../runtime.js";
import {
  assertOutputPathSafety,
  bundleInputSpec,
  inspectBundledSpec,
  resolveOptionalPlugins,
} from "./checkSupport.js";
import type { OutcomeOptions, ResultTemplate } from "../pipeline/helpers.js";
import type {
  DoctorCheck,
  DoctorCheckOutcome,
  DoctorCheckResult,
  DoctorState,
} from "./types.js";

type CheckTemplate = ResultTemplate<DoctorCheckResult>;

const RUNTIME: CheckTemplate = {
  id: "runtime",
  label: "Runtime detection",
  phase: "standard",
};

const CONFIG_EXISTS: CheckTemplate = {
  id: "config-exists",
  label: "Config file",
  phase: "standard",
};

const CONFIG_EXTENSION: CheckTemplate = {
  id: "config-extension",
  label: "Config extension",
  phase: "standard",
};

const CONFIG_EXPORT: CheckTemplate = {
  id: "config-export",
  label: "Config export",
  phase: "standard",
};

const INPUT_EXISTS: CheckTemplate = {
  id: "input-exists",
  label: "Input path",
  phase: "standard",
};

const OUTPUT_SAFETY: CheckTemplate = {
  id: "output-safety",
  label: "Output path safety",
  phase: "standard",
};

const PLUGIN_RESOLUTION: CheckTemplate = {
  id: "plugin-resolution",
  label: "Plugin resolution",
  phase: "standard",
};

const FORMATTER_AVAILABILITY: CheckTemplate = {
  id: "formatter-availability",
  label: "Formatter availability",
  phase: "standard",
};

const SPEC_BUNDLE: CheckTemplate = {
  id: "spec-bundle",
  label: "Spec bundle",
  phase: "deep",
};

const SPEC_IMPORT_SHAPE: CheckTemplate = {
  id: "spec-import-shape",
  label: "Spec import and shape",
  phase: "deep",
};

const STANDARD_CHECKS: readonly DoctorCheck[] = [
  {
    ...RUNTIME,
    run: async () => {
      const runtime = detectRuntime();
      const runtimeVersion =
        typeof process !== "undefined" ? process.version : undefined;

      return pass(
        RUNTIME,
        `${getRuntimeDisplayName(runtime)} detected${runtimeVersion ? ` (${runtimeVersion})` : ""}.`
      );
    },
  },
  {
    ...CONFIG_EXISTS,
    run: async context => {
      if (!fs.existsSync(context.configPath)) {
        return fail(
          CONFIG_EXISTS,
          `Config file not found at '${context.configPath}'.`
        );
      }

      return pass(CONFIG_EXISTS, `Found config at '${context.configPath}'.`);
    },
  },
  {
    ...CONFIG_EXTENSION,
    dependsOn: [CONFIG_EXISTS.id],
    run: async context => {
      assertSupportedConfigPath(context.configPath);

      return pass(
        CONFIG_EXTENSION,
        `Supported config extension '${path.extname(context.configPath)}'.`
      );
    },
  },
  {
    ...CONFIG_EXPORT,
    dependsOn: [CONFIG_EXTENSION.id],
    run: async context => {
      const loadedConfig = await loadConfig(context.configPath);

      return pass(
        CONFIG_EXPORT,
        "Configuration exports a valid config object.",
        { state: { loadedConfig } }
      );
    },
  },
  {
    ...INPUT_EXISTS,
    dependsOn: [CONFIG_EXPORT.id],
    run: async context => {
      const inputPath = context.state.loadedConfig?.input;

      if (!inputPath) {
        return fail(
          INPUT_EXISTS,
          "Config is missing an input spec entrypoint."
        );
      }

      const resolvedInputPath = resolveCommandPath(context.execDir, inputPath);
      if (!fs.existsSync(resolvedInputPath)) {
        return fail(
          INPUT_EXISTS,
          `Spec entrypoint not found at '${resolvedInputPath}'.`
        );
      }

      return pass(
        INPUT_EXISTS,
        `Found spec entrypoint at '${resolvedInputPath}'.`,
        { state: { inputPath: resolvedInputPath } }
      );
    },
  },
  {
    ...OUTPUT_SAFETY,
    dependsOn: [CONFIG_EXPORT.id],
    run: async context => {
      const outputPath = context.state.loadedConfig?.output;

      if (!outputPath) {
        return fail(OUTPUT_SAFETY, "Config is missing an output directory.");
      }

      const { resolvedOutputPath, cleanEnabled } = assertOutputPathSafety({
        execDir: context.execDir,
        outputPath,
        loadedConfig: context.state.loadedConfig,
      });

      return pass(
        OUTPUT_SAFETY,
        cleanEnabled
          ? `Output directory '${resolvedOutputPath}' passed clean-path safety checks.`
          : `Output directory '${resolvedOutputPath}' configured with clean disabled.`,
        { state: { outputPath: resolvedOutputPath } }
      );
    },
  },
  {
    ...PLUGIN_RESOLUTION,
    dependsOn: [CONFIG_EXPORT.id],
    run: async context => {
      const plugins = context.state.loadedConfig?.plugins ?? [];

      if (plugins.length === 0) {
        return pass(PLUGIN_RESOLUTION, "No optional plugins configured.");
      }

      await resolveOptionalPlugins({
        input: context.state.loadedConfig?.input ?? "",
        output: context.state.loadedConfig?.output ?? "",
        plugins,
      });

      return pass(
        PLUGIN_RESOLUTION,
        `Resolved ${plugins.length} optional plugin(s).`
      );
    },
  },
  {
    ...FORMATTER_AVAILABILITY,
    dependsOn: [CONFIG_EXPORT.id],
    run: async context => {
      if ((context.state.loadedConfig?.format ?? true) === false) {
        return pass(
          FORMATTER_AVAILABILITY,
          "Formatting is disabled in config."
        );
      }

      if (await isFormatterAvailable()) {
        return pass(FORMATTER_AVAILABILITY, "oxfmt is available.");
      }

      return warn(
        FORMATTER_AVAILABILITY,
        "oxfmt is not installed; generated code will not be formatted.",
        { details: ["Install it with: npm install -D oxfmt"] }
      );
    },
  },
];

const DEEP_CHECKS: readonly DoctorCheck[] = [
  {
    ...SPEC_BUNDLE,
    dependsOn: [INPUT_EXISTS.id],
    run: async context => {
      if (!context.state.inputPath) {
        return fail(
          SPEC_BUNDLE,
          "Cannot bundle the spec because the resolved input path is unavailable after prerequisite checks."
        );
      }

      const bundledSpecFile = await bundleInputSpec({
        inputFile: context.state.inputPath,
        temporaryDirectory: context.temporaryDirectory,
      });

      return pass(SPEC_BUNDLE, "Spec entrypoint bundled successfully.", {
        details: [bundledSpecFile],
        state: { bundledSpecFile },
      });
    },
  },
  {
    ...SPEC_IMPORT_SHAPE,
    dependsOn: [SPEC_BUNDLE.id],
    run: async context => {
      const { bundledSpecFile, inputPath } = context.state;

      if (!bundledSpecFile || !inputPath) {
        return fail(
          SPEC_IMPORT_SHAPE,
          "Cannot import the bundled spec because prerequisite check state is unavailable."
        );
      }

      const specShape = await inspectBundledSpec({
        bundledSpecFile,
        inputFile: inputPath,
      });

      return pass(
        SPEC_IMPORT_SHAPE,
        `Imported a valid spec with ${specShape.resourceCount} resource(s), ${specShape.operationCount} operation(s), and ${specShape.responseCount} response(s).`
      );
    },
  },
];

export const createDoctorChecks = (isDeep: boolean): readonly DoctorCheck[] => {
  return isDeep ? [...STANDARD_CHECKS, ...DEEP_CHECKS] : STANDARD_CHECKS;
};

const pass = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<DoctorState> = {}
): DoctorCheckOutcome => {
  return basePass<DoctorState, DoctorCheckResult>(template, summary, options);
};

const warn = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<DoctorState> = {}
): DoctorCheckOutcome => {
  return baseWarn<DoctorState, DoctorCheckResult>(template, summary, options);
};

const fail = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<DoctorState> = {}
): DoctorCheckOutcome => {
  return baseFail<DoctorState, DoctorCheckResult>(template, summary, options);
};
