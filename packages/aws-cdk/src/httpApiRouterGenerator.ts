import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import { createJSDocComment } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";

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
  const routes: Record<
    string,
    {
      readonly methods: HttpMethod[];
      readonly methodSummaries: string[];
    }
  > = {};
  const pascalCaseEntityName = pascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputFile = path.join(
    outputDir,
    `${pascalCaseEntityName}HttpApiRoutes.ts`
  );

  for (const operation of resource.operations) {
    const routePath = createRoutePath(operation.path);

    if (!routes[routePath]) {
      routes[routePath] = {
        methods: [],
        methodSummaries: [],
      };
    }

    routes[routePath]!.methods.push(operation.method);
    routes[routePath]!.methodSummaries.push(
      operation.summary
        ? `${operation.method}: ${operation.summary}`
        : operation.method
    );
  }

  const routesWithDocs = Object.fromEntries(
    Object.entries(routes).map(([routePath, route]) => [
      routePath,
      {
        methods: route.methods,
        jsDoc: createJSDocComment(route.methodSummaries.join("\n"), {
          indentation: "      ",
        }),
      },
    ])
  );

  const content = context.renderTemplate(templateFile, {
    entityName: resource.name,
    pascalCaseEntityName,
    routes: routesWithDocs,
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
