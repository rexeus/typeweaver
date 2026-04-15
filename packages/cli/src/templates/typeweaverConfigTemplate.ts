export type TypeweaverConfigTemplateOptions = {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly plugins?: readonly string[];
};

export type TypeweaverConfigTemplateFile = {
  readonly relativePath: string;
  readonly content: string;
};

export const TYPEWEAVER_CONFIG_FILE = "typeweaver.config.mjs";

export const createTypeweaverConfigFileContent = (
  options: TypeweaverConfigTemplateOptions
): string => {
  const inputPath = formatConfigPath(options.inputPath);
  const outputPath = formatConfigPath(options.outputPath);
  const plugins = options.plugins ?? [];
  const serializedPlugins =
    plugins.length === 0
      ? "[]"
      : `[${plugins.map(plugin => JSON.stringify(plugin)).join(", ")}]`;

  return [
    "export default {",
    `  input: ${JSON.stringify(inputPath)},`,
    `  output: ${JSON.stringify(outputPath)},`,
    `  plugins: ${serializedPlugins},`,
    "  format: true,",
    "  clean: true,",
    "};",
    "",
  ].join("\n");
};

export const createTypeweaverConfigTemplateFile = (
  options: TypeweaverConfigTemplateOptions
): TypeweaverConfigTemplateFile => {
  return {
    relativePath: TYPEWEAVER_CONFIG_FILE,
    content: createTypeweaverConfigFileContent(options),
  };
};

const formatConfigPath = (filePath: string): string => {
  if (filePath.startsWith(".") || filePath.startsWith("/")) {
    return filePath;
  }

  return `./${filePath}`;
};
