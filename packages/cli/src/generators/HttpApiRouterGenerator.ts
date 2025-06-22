import path from "path";
import { Generator } from "./Generator";
import fs from "fs";
import type { EntityResources, OperationResource } from "./Resource";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import ejs from "ejs";
import Case from "case";

export class HttpApiRouterGenerator {
  public static generate(entityResources: EntityResources): void {
    const templateFile = path.join(Generator.templateDir, "HttpApiRouter.ejs");
    const template = fs.readFileSync(templateFile, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      this.writeHttpApiRoutes(entityName, template, operationResources);
    }
  }

  private static writeHttpApiRoutes(
    entityName: string,
    template: string,
    operationResources: OperationResource[]
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

    const content = ejs.render(template, {
      entityName,
      pascalCaseEntityName,
      routes,
      coreDir: Generator.coreDir,
    });

    fs.writeFileSync(outputFile, content);
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
