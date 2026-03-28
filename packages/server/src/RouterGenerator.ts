import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { Path } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import Case from "case";

type OperationData = {
  readonly operationId: string;
  readonly className: string;
  readonly handlerName: string;
  readonly method: string;
  readonly path: string;
};

/**
 * Generates TypeweaverRouter subclasses from API definitions.
 *
 * For each resource (e.g., `Todo`, `Account`), produces a `<ResourceName>Router.ts`
 * file that extends `TypeweaverRouter` and registers all operations as routes.
 */
export class RouterGenerator {
  /**
   * Generates router files for all resources in the given context.
   *
   * @param context - The generator context containing resources, templates, and output configuration
   */
  public static generate(context: GeneratorContext): void {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const templateFile = path.join(moduleDir, "templates", "Router.ejs");

    for (const resource of context.normalizedSpec.resources) {
      this.writeRouter(resource, templateFile, context);
    }
  }

  private static writeRouter(
    resource: NormalizedResource,
    templateFile: string,
    context: GeneratorContext
  ): void {
    const pascalCaseEntityName = Case.pascal(resource.name);
    const outputDir = context.getResourceOutputDir(resource.name);
    const outputPath = path.join(outputDir, `${pascalCaseEntityName}Router.ts`);

    const operations = resource.operations
      .filter(operation => operation.method !== HttpMethod.HEAD)
      .map(operation => this.createOperationData(operation))
      .sort((a, b) => this.compareRoutes(a, b));

    const content = context.renderTemplate(templateFile, {
      coreDir: Path.relative(outputDir, context.outputDir),
      entityName: resource.name,
      pascalCaseEntityName,
      operations,
    });

    const relativePath = path.relative(context.outputDir, outputPath);
    context.writeFile(relativePath, content);
  }

  private static createOperationData(
    operation: NormalizedOperation
  ): OperationData {
    const operationId = operation.operationId;
    const className = Case.pascal(operationId);

    return {
      operationId,
      className,
      handlerName: `handle${className}Request`,
      method: operation.method,
      path: operation.path,
    };
  }

  private static compareRoutes(a: OperationData, b: OperationData): number {
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

  private static readonly METHOD_PRIORITY: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    OPTIONS: 6,
    HEAD: 7,
  };

  private static getMethodPriority(method: string): number {
    return this.METHOD_PRIORITY[method] ?? 999;
  }
}
