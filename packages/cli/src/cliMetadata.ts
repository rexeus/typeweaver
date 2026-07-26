import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageJson: unknown = JSON.parse(
  fs.readFileSync(path.join(moduleDirectory, "../package.json"), "utf-8")
);

const readPackageString = (
  key: string,
  source: unknown = packageJson
): string => {
  if (typeof source !== "object" || source === null) {
    throw new TypeError("CLI package manifest must contain an object.");
  }
  const value = Reflect.get(source, key);
  if (typeof value !== "string") {
    throw new TypeError(`CLI package manifest must declare '${key}'.`);
  }
  return value;
};

export const cliPackageVersion = readPackageString("version");
export const cliZodVersion =
  typeof packageJson === "object" && packageJson !== null
    ? readPackageString("zod", Reflect.get(packageJson, "dependencies"))
    : readPackageString("zod");
export const pluginScaffoldTemplateDirectory = path.join(
  moduleDirectory,
  "templates",
  "plugin-scaffold"
);
export const projectInitTemplateDirectory = path.join(
  moduleDirectory,
  "templates",
  "project-init"
);
