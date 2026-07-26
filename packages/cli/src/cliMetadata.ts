import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(moduleDirectory, "../package.json"), "utf-8")
) as { readonly version: string };

export const cliPackageVersion = packageJson.version;
export const pluginScaffoldTemplateDirectory = path.join(
  moduleDirectory,
  "templates",
  "plugin-scaffold"
);
