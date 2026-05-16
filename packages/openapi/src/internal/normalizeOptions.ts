import path from "node:path";
import type { OpenApiInfoObject, OpenApiServerObject } from "../types.js";

const DEFAULT_INFO: OpenApiInfoObject = {
  title: "Typeweaver API",
  version: "0.0.0",
};
const DEFAULT_OUTPUT_PATH = "openapi/openapi.json";

export type OpenApiPluginOptions = {
  readonly info?: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
  readonly outputPath?: string;
};

export type NormalizedOpenApiPluginOptions = {
  readonly info: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
  readonly outputPath: string;
};

export const normalizeOpenApiPluginOptions = (
  options: unknown
): NormalizedOpenApiPluginOptions => {
  const validated = validateOptions(options);
  return normalizeOptions(validated);
};

const validateOptions = (options: unknown): OpenApiPluginOptions => {
  if (!isPlainObject(options)) {
    throwConfigError("options must be an object");
  }

  return options;
};

const normalizeOptions = (
  options: OpenApiPluginOptions
): NormalizedOpenApiPluginOptions => {
  const outputPath =
    options.outputPath === undefined ? DEFAULT_OUTPUT_PATH : options.outputPath;

  return {
    info: normalizeInfo(options.info),
    ...(options.servers === undefined
      ? {}
      : { servers: normalizeServers(options.servers) }),
    outputPath: normalizeOutputPath(outputPath),
  };
};

const normalizeInfo = (
  info: OpenApiPluginOptions["info"]
): OpenApiInfoObject => {
  if (info === undefined) {
    return { ...DEFAULT_INFO };
  }

  if (!isPlainObject(info)) {
    throwConfigError("info must be an object with string title and version");
  }

  if (typeof info.title !== "string" || typeof info.version !== "string") {
    throwConfigError("info.title and info.version must be strings");
  }

  return { ...info };
};

const normalizeServers = (
  servers: OpenApiPluginOptions["servers"]
): readonly OpenApiServerObject[] => {
  if (!Array.isArray(servers)) {
    throwConfigError("servers must be an array of objects with string url");
  }

  return servers.map((server, index) => {
    if (!isOpenApiServerObject(server)) {
      throwConfigError(`servers[${index}].url must be a string`);
    }

    return { ...server };
  });
};

const normalizeOutputPath = (outputPath: unknown): string => {
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throwConfigError("outputPath must be a non-empty relative .json path");
  }

  if (!outputPath.endsWith(".json")) {
    throwConfigError("outputPath must end with .json");
  }

  if (outputPath.includes("\0")) {
    throwConfigError("outputPath must not contain null bytes");
  }

  if (path.isAbsolute(outputPath) || path.win32.isAbsolute(outputPath)) {
    throwConfigError("outputPath must be relative");
  }

  const pathSegments = outputPath.replace(/\\/g, "/").split("/");

  if (pathSegments.some(segment => segment === "..")) {
    throwConfigError("outputPath must not contain parent directory segments");
  }

  const normalizedPath = path.posix.normalize(pathSegments.join("/"));

  if (normalizedPath === "." || normalizedPath.startsWith("../")) {
    throwConfigError("outputPath must be a safe relative .json path");
  }

  return normalizedPath;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpenApiServerObject(value: unknown): value is OpenApiServerObject {
  return isPlainObject(value) && typeof value.url === "string";
}

function throwConfigError(message: string): never {
  throw new Error(`OpenApiPlugin config error: ${message}`);
}
