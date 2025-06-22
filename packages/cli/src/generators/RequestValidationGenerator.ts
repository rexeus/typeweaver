import type { EntityResources, OperationResource } from "./Resource";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import { Generator } from "./Generator";
import Case from "case";
import { Path } from "./helpers/Path";

export class RequestValidationGenerator {
  public static generate(entityDefinitions: EntityResources): void {
    const templateFilePath = path.join(
      Generator.templateDir,
      "RequestValidator.ejs"
    );

    const template = fs.readFileSync(templateFilePath, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      entityDefinitions
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      for (const definition of operationResources) {
        this.writeRequestValidator(template, definition);
      }
    }
  }

  private static writeRequestValidator(
    template: string,
    operationResource: OperationResource
  ): void {
    const { outputDir, definition, outputRequestFileName } = operationResource;
    const { operationId, request } = definition;
    const { body, query, param, header } = request;

    const pascalCaseOperationId = Case.pascal(operationId);

    const content = ejs.render(template, {
      pascalCaseOperationId,
      operationId,
      sourcePath: Path.relative(
        outputDir,
        `${operationResource.sourceDir}/${path.basename(operationResource.sourceFile, ".ts")}`
      ),
      corePath: Generator.coreDir,
      requestFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputRequestFileName, ".ts")}`
      ),
      body,
      query,
      param,
      header,
    });

    fs.writeFileSync(operationResource.outputRequestValidationFile, content);
  }
}
