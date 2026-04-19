import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.join(MODULE_DIR, "../package.json");

type CliPackageJson = {
  readonly version: string;
  readonly name: string;
  readonly description: string;
};

let cachedPackageJson: CliPackageJson | undefined;

const readPackageJson = (): CliPackageJson => {
  cachedPackageJson ??= JSON.parse(
    fs.readFileSync(PACKAGE_JSON_PATH, "utf-8")
  ) as CliPackageJson;

  return cachedPackageJson;
};

export const getCliVersion = (): string => {
  return readPackageJson().version;
};

export const getCliPackageJson = (): CliPackageJson => {
  return readPackageJson();
};
