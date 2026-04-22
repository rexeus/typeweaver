export type PackageJsonTemplateOptions = {
  readonly typeweaverVersion: string;
  readonly zodVersion: string;
};

export type PackageJsonTemplateFile = {
  readonly relativePath: string;
  readonly content: string;
};

export const PACKAGE_JSON_FILE = "package.json";

const DEFAULT_PROJECT_NAME = "typeweaver-project";

export const createPackageJsonFileContent = (
  options: PackageJsonTemplateOptions
): string => {
  const packageJson = {
    name: DEFAULT_PROJECT_NAME,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      validate: "typeweaver validate",
      generate: "typeweaver generate",
    },
    dependencies: {
      "@rexeus/typeweaver-core": `^${options.typeweaverVersion}`,
      zod: options.zodVersion,
    },
    devDependencies: {
      "@rexeus/typeweaver": `^${options.typeweaverVersion}`,
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
};

export const createPackageJsonTemplateFile = (
  options: PackageJsonTemplateOptions
): PackageJsonTemplateFile => {
  return {
    relativePath: PACKAGE_JSON_FILE,
    content: createPackageJsonFileContent(options),
  };
};
