import { writeFileSync } from "node:fs";
import path from "node:path";
import { PLANNED_PLAIN_PLUGINS } from "./fixture-manifests.mjs";
import { writeJson } from "./runtime.mjs";

/** @param {string} fixtureRoot @returns {{ configPath: string, outputRoot: string }} */
export const writeRuntimeConfig = fixtureRoot => {
  const outputRoot = path.join(fixtureRoot, "generated");
  const configPath = path.join(fixtureRoot, "typeweaver.config.mjs");
  const pluginPath = path.join(
    fixtureRoot,
    "node_modules",
    "typeweaver-plugin-packed-compat",
    "index.mjs"
  );
  writeFileSync(
    configPath,
    [
      "export default {",
      `  input: ${JSON.stringify(path.join(fixtureRoot, "spec", "index.ts"))},`,
      `  output: ${JSON.stringify(outputRoot)},`,
      `  plugins: ["clients", "command", "server", "effect", [${JSON.stringify(pluginPath)}, {}]],`,
      "};",
      "",
    ].join("\n")
  );
  return { configPath, outputRoot };
};

/** @param {string} fixtureRoot @returns {{ configPath: string, outputRoot: string }} */
export const writePlainProjectionsConfig = fixtureRoot => {
  const outputRoot = path.join(fixtureRoot, "generated");
  const configPath = path.join(fixtureRoot, "typeweaver.config.mjs");
  writeFileSync(
    configPath,
    [
      "export default {",
      `  input: ${JSON.stringify(path.join(fixtureRoot, "spec", "index.ts"))},`,
      `  output: ${JSON.stringify(outputRoot)},`,
      `  plugins: ${JSON.stringify(PLANNED_PLAIN_PLUGINS)},`,
      "};",
      "",
    ].join("\n")
  );
  return { configPath, outputRoot };
};

/** @param {{ fixtureRoot: string, outputRoot: string }} options @returns {{ generatedTsconfig: string, generatedDist: string }} */
export const writeGeneratedCommandTsconfig = ({ fixtureRoot, outputRoot }) => {
  const generatedTsconfig = path.join(
    fixtureRoot,
    "generated-command.tsconfig.json"
  );
  const generatedDist = path.join(fixtureRoot, "generated-dist");
  writeJson(generatedTsconfig, {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: generatedDist,
      rootDir: outputRoot,
      skipLibCheck: false,
      strict: true,
      target: "ES2024",
      types: ["node"],
    },
    include: [
      path.join(outputRoot, "**/*.ts"),
      path.join(outputRoot, "**/*.mts"),
      path.join(outputRoot, "**/*.js"),
    ],
  });
  return { generatedTsconfig, generatedDist };
};
