import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { compareRoutes } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import Case from "case";

export class HonoRouterGenerator {
  public static generate(context: GeneratorContext): void {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const templateFile = path.join(moduleDir, "templates", "HonoRouter.ejs");

    for (const resource of context.normalizedSpec.resources) {
      this.writeHonoRouter(resource, templateFile, context);
    }
  }

  private static writeHonoRouter(
    resource: NormalizedResource,
    templateFile: string,
    context: GeneratorContext
  ): void {
    const pascalCaseEntityName = Case.pascal(resource.name);
    const outputDir = context.getResourceOutputDir(resource.name);
    const outputPath = path.join(outputDir, `${pascalCaseEntityName}Hono.ts`);

    const operations = resource.operations
      // Hono handles HEAD requests automatically, so we skip them
      .filter(operation => operation.method !== HttpMethod.HEAD)
      .map(operation => this.createOperationData(operation))
      .sort((a, b) => compareRoutes(a, b));

    const content = context.renderTemplate(templateFile, {
      coreDir: path.relative(outputDir, context.outputDir),
      entityName: resource.name,
      pascalCaseEntityName,
      operations,
    });

    const relativePath = path.relative(context.outputDir, outputPath);
    context.writeFile(relativePath, content);
  }

  private static createOperationData(operation: NormalizedOperation) {
    const operationId = operation.operationId;
    const className = Case.pascal(operationId);
    const handlerName = `handle${className}Request`;

    return {
      operationId,
      className,
      handlerName,
      method: operation.method,
      path: operation.path,
    };
  }
}
