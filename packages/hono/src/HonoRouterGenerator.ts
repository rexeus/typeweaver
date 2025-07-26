import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type GeneratorContext,
  type OperationResource,
} from "@rexeus/typeweaver-gen";
import Case from "case";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class HonoRouterGenerator {
  public static generate(context: GeneratorContext): void {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const templateFile = path.join(__dirname, "templates", "HonoRouter.ejs");

    for (const [entityName, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      this.writeHonoRouter(
        entityName,
        templateFile,
        entityResource.operations,
        context
      );
    }
  }

  private static writeHonoRouter(
    entityName: string,
    templateFile: string,
    operationResources: OperationResource[],
    context: GeneratorContext
  ): void {
    const pascalCaseEntityName = Case.pascal(entityName);
    const outputDir = path.join(context.outputDir, entityName);
    const outputPath = path.join(outputDir, `${pascalCaseEntityName}Hono.ts`);

    const operations = operationResources
      // Hono handles HEAD requests automatically, so we skip them
      .filter(resource => resource.definition.method !== HttpMethod.HEAD)
      .map(resource => this.createOperationData(resource));

    const content = context.renderTemplate(templateFile, {
      coreDir: path.relative(outputDir, context.outputDir),
      entityName,
      pascalCaseEntityName,
      operations,
    });

    const relativePath = path.relative(context.outputDir, outputPath);
    context.writeFile(relativePath, content);
  }

  private static createOperationData(resource: OperationResource) {
    const operationId = resource.definition.operationId;
    const className = Case.pascal(operationId);
    const handlerName = `handle${className}Request`;

    return {
      className,
      handlerName,
      method: resource.definition.method,
      path: resource.definition.path,
    };
  }
}
