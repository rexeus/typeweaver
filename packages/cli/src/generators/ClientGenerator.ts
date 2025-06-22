import type { OperationResource } from "./Resource";
import path from "path";
import { Generator } from "./Generator";
import fs from "fs";
import ejs from "ejs";
import Case from "case";
import type { GetResourcesResult } from "./ResourceReader";

export class ClientGenerator {
  public static generate(resources: GetResourcesResult): void {
    const templateFilePath = path.join(Generator.templateDir, "Client.ejs");

    const template = fs.readFileSync(templateFilePath, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      resources.entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      this.writeClient(template, operationResources);
    }
  }

  private static writeClient(
    template: string,
    operationResources: OperationResource[]
  ): void {
    const entityName = operationResources[0]!.entityName;
    const pascalCaseEntityName = Case.pascal(entityName);
    const outputDir = operationResources[0]!.outputDir;

    const operations: {
      operationId: string;
      pascalCaseOperationId: string;
      requestFile: string;
      responseValidatorFile: string;
      responseFile: string;
    }[] = [];
    for (const operationResource of operationResources) {
      const {
        definition,
        outputResponseFileName,
        outputResponseValidationFileName,
        outputRequestFileName,
      } = operationResource;
      const { operationId } = definition;

      const pascalCaseOperationId = Case.pascal(operationId);
      const requestFile = `./${path.basename(outputRequestFileName, ".ts")}`;
      const responseValidatorFile = `./${path.basename(outputResponseValidationFileName, ".ts")}`;
      const responseFile = `./${path.basename(outputResponseFileName, ".ts")}`;

      operations.push({
        operationId,
        pascalCaseOperationId,
        requestFile,
        responseValidatorFile,
        responseFile,
      });
    }

    const content = ejs.render(template, {
      coreDir: Generator.coreDir,
      pascalCaseEntityName,
      operations,
    });

    const outputClientFile = path.join(
      outputDir,
      `${pascalCaseEntityName}Client.ts`
    );
    fs.writeFileSync(outputClientFile, content);
  }
}
