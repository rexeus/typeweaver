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
      .map(resource => this.createOperationData(resource))
      .sort((a, b) => this.compareRoutes(a, b));

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

  private static compareRoutes(
    a: ReturnType<typeof HonoRouterGenerator.createOperationData>,
    b: ReturnType<typeof HonoRouterGenerator.createOperationData>
  ): number {
    const aSegments = a.path.split("/").filter(s => s);
    const bSegments = b.path.split("/").filter(s => s);

    // 1. Compare by depth first (shallow to deep)
    if (aSegments.length !== bSegments.length) {
      return aSegments.length - bSegments.length;
    }

    // 2. Compare segment by segment
    for (let i = 0; i < aSegments.length; i++) {
      const aSegment = aSegments[i]!;
      const bSegment = bSegments[i]!;

      const aIsParam = aSegment.startsWith(":");
      const bIsParam = bSegment.startsWith(":");

      // Static segments before parameters
      if (aIsParam !== bIsParam) {
        return aIsParam ? 1 : -1;
      }

      // Within same type, alphabetical order
      if (aSegment !== bSegment) {
        return aSegment.localeCompare(bSegment);
      }
    }

    // 3. Same path = sort by HTTP method priority
    return this.getMethodPriority(a.method) - this.getMethodPriority(b.method);
  }

  private static getMethodPriority(method: string): number {
    const priorities: Record<string, number> = {
      GET: 1,
      POST: 2,
      PUT: 3,
      PATCH: 4,
      DELETE: 5,
      OPTIONS: 6,
      HEAD: 7,
    };
    return priorities[method] ?? 999;
  }
}
