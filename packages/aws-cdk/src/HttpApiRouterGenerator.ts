import path from "path";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import Case from "case";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class HttpApiRouterGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(__dirname, "templates", "HttpApiRouter.ejs");

    for (const [entityName, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      this.writeHttpApiRoutes(entityName, templateFile, entityResource.operations, context);
    }
  }

  private static writeHttpApiRoutes(
    entityName: string,
    templateFile: string,
    operationResources: OperationResource[],
    context: GeneratorContext
  ): void {
    const routes: Record<string, HttpMethod[]> = {};
    const pascalCaseEntityName = Case.pascal(entityName);
    const outputDir = operationResources[0]!.outputDir;
    const outputFile = path.join(
      outputDir,
      `${pascalCaseEntityName}HttpApiRouter.ts`
    );

    for (const operation of operationResources) {
      const path = this.createRoutePath(operation.definition.path);

      if (!routes[path]) {
        routes[path] = [];
      }

      routes[path]!.push(operation.definition.method);
    }

    const content = context.renderTemplate(templateFile, {
      entityName,
      pascalCaseEntityName,
      routes,
      coreDir: context.coreDir,
    });

    const relativePath = path.relative(context.outputDir, outputFile);
    context.writeFile(relativePath, content);
  }

  private static createRoutePath(path: string): string {
    const parts = path.split("/").map(part => {
      if (part.startsWith(":")) {
        return `{${part.slice(1)}}`;
      }
      return part;
    });

    return parts.join("/");
  }
}
