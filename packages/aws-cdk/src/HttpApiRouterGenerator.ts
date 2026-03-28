import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class HttpApiRouterGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(moduleDir, "templates", "HttpApiRouter.ejs");

    for (const resource of context.normalizedSpec.resources) {
      this.writeHttpApiRoutes(resource, templateFile, context);
    }
  }

  private static writeHttpApiRoutes(
    resource: NormalizedResource,
    templateFile: string,
    context: GeneratorContext
  ): void {
    const routes: Record<string, HttpMethod[]> = {};
    const pascalCaseEntityName = Case.pascal(resource.name);
    const outputDir = context.getResourceOutputDir(resource.name);
    const outputFile = path.join(
      outputDir,
      `${pascalCaseEntityName}HttpApiRoutes.ts`
    );

    for (const operation of resource.operations) {
      const path = this.createRoutePath(operation.path);

      if (!routes[path]) {
        routes[path] = [];
      }

      routes[path]!.push(operation.method);
    }

    const content = context.renderTemplate(templateFile, {
      entityName: resource.name,
      pascalCaseEntityName,
      routes,
      coreDir: context.coreDir,
    });

    const relativePath = path.relative(context.outputDir, outputFile);
    context.writeFile(relativePath, content);
  }

  private static createRoutePath(routePath: string): string {
    const parts = routePath.split("/").map(part => {
      if (part.startsWith(":")) {
        return `{${part.slice(1)}}`;
      }
      return part;
    });

    return parts.join("/");
  }
}
