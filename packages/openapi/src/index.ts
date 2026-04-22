import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { buildOpenApiDocument } from "./openApiBuilder.js";
import type { OpenApiPluginConfig } from "./types.js";

export * from "./types.js";
export {
  buildOpenApiDocument,
  MERGED_DUPLICATE_STATUS_RESPONSE,
  toOpenApiPath,
} from "./openApiBuilder.js";

export class OpenApiPlugin extends BasePlugin {
  public readonly name = "openapi";

  public override generate(context: GeneratorContext): void {
    const config = this.config as OpenApiPluginConfig;
    const result = buildOpenApiDocument({
      normalizedSpec: context.normalizedSpec,
      config,
    });

    for (const warning of result.warnings) {
      process.emitWarning(`[openapi] ${warning.location}: ${warning.message}`);
    }

    const outputFile =
      typeof config.outputFile === "string" && config.outputFile.length > 0
        ? config.outputFile
        : `${this.name}/openapi.json`;

    context.writeFile(
      outputFile,
      `${JSON.stringify(result.document, null, 2)}\n`
    );
  }
}
