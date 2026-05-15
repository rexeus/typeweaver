import path from "node:path";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { buildOpenApiDocument } from "./buildOpenApiDocument.js";
import type {
  OpenApiBuildWarning,
  OpenApiInfoObject,
  OpenApiServerObject,
} from "./types.js";

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

type NormalizedOpenApiPluginOptions = {
  readonly info: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
  readonly outputPath: string;
};

export class OpenApiPlugin extends BasePlugin {
  public name = "openapi";

  private readonly options: NormalizedOpenApiPluginOptions;

  public constructor(options: OpenApiPluginOptions = {}) {
    super({});
    this.options = normalizeOptions(validateOptions(options));
  }

  public override generate(context: GeneratorContext): void {
    const result = buildOpenApiDocument(context.normalizedSpec, {
      info: this.options.info,
      servers: this.options.servers,
    });
    const json = `${JSON.stringify(result.document, null, 2)}\n`;

    context.writeFile(this.options.outputPath, json);

    if (result.warnings.length > 0) {
      console.warn(formatWarnings(result.warnings));
    }
  }
}

function validateOptions(options: unknown): OpenApiPluginOptions {
  if (!isPlainObject(options)) {
    throwConfigError("options must be an object");
  }

  return options;
}

function normalizeOptions(
  options: OpenApiPluginOptions
): NormalizedOpenApiPluginOptions {
  const outputPath =
    options.outputPath === undefined ? DEFAULT_OUTPUT_PATH : options.outputPath;

  return {
    info: normalizeInfo(options.info),
    ...(options.servers === undefined
      ? {}
      : { servers: normalizeServers(options.servers) }),
    outputPath: normalizeOutputPath(outputPath),
  };
}

function normalizeInfo(info: OpenApiPluginOptions["info"]): OpenApiInfoObject {
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
}

function normalizeServers(
  servers: OpenApiPluginOptions["servers"]
): readonly OpenApiServerObject[] {
  if (!Array.isArray(servers)) {
    throwConfigError("servers must be an array of objects with string url");
  }

  return servers.map((server, index) => {
    if (!isOpenApiServerObject(server)) {
      throwConfigError(`servers[${index}].url must be a string`);
    }

    return { ...server };
  });
}

function normalizeOutputPath(outputPath: unknown): string {
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
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpenApiServerObject(value: unknown): value is OpenApiServerObject {
  return isPlainObject(value) && typeof value.url === "string";
}

function throwConfigError(message: string): never {
  throw new Error(`OpenApiPlugin config error: ${message}`);
}

function formatWarnings(warnings: readonly OpenApiBuildWarning[]): string {
  const warningLines = warnings.map(
    warning => `- ${warning.code}: ${warning.message} (${warning.documentPath})`
  );

  return [
    `OpenAPI generation completed with ${warnings.length} warning(s).`,
    ...warningLines,
  ].join("\n");
}
