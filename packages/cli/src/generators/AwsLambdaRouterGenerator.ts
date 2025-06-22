import path from "path";
import { Generator } from "./Generator";
import fs from "fs";
import type { EntityResources, OperationResource } from "./Resource";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import ejs from "ejs";
import Case from "case";
import { Path } from "./helpers/Path";

export class AwsLambdaRouterGenerator {
  public static generate(entityResources: EntityResources): void {
    const templateFile = path.join(
      Generator.templateDir,
      "AwsLambdaRouter.ejs"
    );
    const template = fs.readFileSync(templateFile, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      this.writeAwsLambdaRoutes(entityName, template, operationResources);
    }
  }

  private static writeAwsLambdaRoutes(
    entityName: string,
    template: string,
    operationResources: OperationResource[]
  ): void {
    const routes: {
      path: string;
      method: HttpMethod;
      camelCaseOperationId: string;
      pascalCaseOperationId: string;
      requestFile: string;
      responseFile: string;
      requestValidatorFile: string;
    }[] = [];
    const pascalCaseEntityName = Case.pascal(entityName);
    const outputDir = operationResources[0]!.outputDir;
    const outputFile = path.join(
      outputDir,
      `${pascalCaseEntityName}AwsLambdaRouter.ts`
    );

    for (const operation of operationResources) {
      routes.push({
        method: operation.definition.method,
        path: operation.definition.path,
        camelCaseOperationId: Case.camel(operation.definition.operationId),
        pascalCaseOperationId: Case.pascal(operation.definition.operationId),
        requestFile: Path.relative(
          outputDir,
          `${operation.outputDir}/${path.basename(operation.outputRequestFileName, ".ts")}`
        ),
        responseFile: Path.relative(
          outputDir,
          `${operation.outputDir}/${path.basename(operation.outputResponseFileName, ".ts")}`
        ),
        requestValidatorFile: Path.relative(
          outputDir,
          `${operation.outputDir}/${path.basename(
            operation.outputRequestValidationFileName,
            ".ts"
          )}`
        ),
      });
    }

    const content = ejs.render(template, {
      entityName,
      pascalCaseEntityName,
      routes,
      coreDir: Generator.coreDir,
    });

    fs.writeFileSync(outputFile, content);
  }
}
