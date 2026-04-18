export type TypeweaverConfigFormat = "mjs" | "cjs" | "js";

export type TypeweaverConfigTemplateOptions = {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly plugins?: readonly string[];
  readonly format?: TypeweaverConfigFormat;
};

export type TypeweaverConfigTemplateFile = {
  readonly relativePath: string;
  readonly content: string;
};

export const TYPEWEAVER_CONFIG_FILE = "typeweaver.config.mjs";
export const DEFAULT_CONFIG_FORMAT: TypeweaverConfigFormat = "mjs";
export const SUPPORTED_CONFIG_FORMATS: readonly TypeweaverConfigFormat[] = [
  "mjs",
  "cjs",
  "js",
];

export const createTypeweaverConfigFileContent = (
  options: TypeweaverConfigTemplateOptions
): string => {
  const format = options.format ?? DEFAULT_CONFIG_FORMAT;
  const inputPath = formatConfigPath(options.inputPath);
  const outputPath = formatConfigPath(options.outputPath);
  const plugins = options.plugins ?? [];
  const serializedPlugins =
    plugins.length === 0
      ? "[]"
      : `[${plugins.map(plugin => JSON.stringify(plugin)).join(", ")}]`;

  const body = [
    `  input: ${JSON.stringify(inputPath)},`,
    `  output: ${JSON.stringify(outputPath)},`,
    `  plugins: ${serializedPlugins},`,
    "  format: true,",
    "  clean: true,",
  ].join("\n");

  const opener = format === "cjs" ? "module.exports = {" : "export default {";

  return [opener, body, "};", ""].join("\n");
};

export const createTypeweaverConfigTemplateFile = (
  options: TypeweaverConfigTemplateOptions
): TypeweaverConfigTemplateFile => {
  const format = options.format ?? DEFAULT_CONFIG_FORMAT;

  return {
    relativePath: `typeweaver.config.${format}`,
    content: createTypeweaverConfigFileContent(options),
  };
};

const formatConfigPath = (filePath: string): string => {
  if (filePath.startsWith(".") || filePath.startsWith("/")) {
    return filePath;
  }

  return `./${filePath}`;
};
