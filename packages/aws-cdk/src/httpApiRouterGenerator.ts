import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { toPascalCase } from "@rexeus/typeweaver-gen";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function generate(context: GeneratorContext): void {
  const templateFile = path.join(moduleDir, "templates", "HttpApiRouter.ejs");

  for (const resource of context.normalizedSpec.resources) {
    writeHttpApiRoutes(resource, templateFile, context);
  }
}

function writeHttpApiRoutes(
  resource: NormalizedResource,
  templateFile: string,
  context: GeneratorContext
): void {
  const routes: Record<string, HttpMethod[]> = {};
  const pascalCaseEntityName = toPascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputFile = path.join(
    outputDir,
    `${pascalCaseEntityName}HttpApiRoutes.ts`
  );

  for (const operation of resource.operations) {
    const routePath = createRoutePath(operation.path);

    if (!routes[routePath]) {
      routes[routePath] = [];
    }

    routes[routePath]!.push(operation.method);
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

function createRoutePath(routePath: string): string {
  const parts = routePath.split("/").map(part => {
    if (part.startsWith(":")) {
      return `{${part.slice(1)}}`;
    }

    return part;
  });

  return parts.join("/");
}
