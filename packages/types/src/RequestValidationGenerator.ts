import path from "node:path";
import { fileURLToPath } from "node:url";
import { Path } from "@rexeus/typeweaver-gen";
import Case from "case";
import { z } from "zod";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class RequestValidationGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(
      moduleDir,
      "templates",
      "RequestValidator.ejs"
    );

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      for (const definition of entityResource.operations) {
        this.writeRequestValidator(templateFilePath, definition, context);
      }
    }
  }

  private static writeRequestValidator(
    templateFilePath: string,
    operationResource: OperationResource,
    context: GeneratorContext
  ): void {
    const { outputDir, definition, outputRequestFileName } = operationResource;
    const { operationId, request } = definition;
    const { body, query, param, header } = request;

    const pascalCaseOperationId = Case.pascal(operationId);

    const content = context.renderTemplate(templateFilePath, {
      pascalCaseOperationId,
      operationId,
      sourcePath: Path.relative(
        outputDir,
        `${operationResource.sourceDir}/${path.relative(operationResource.sourceDir, operationResource.sourceFile).replace(/\.ts$/, "")}`
      ),
      corePath: context.coreDir,
      requestFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputRequestFileName, ".ts")}`
      ),
      body,
      query,
      param,
      header,
      z,
    });

    const relativePath = path.relative(
      context.outputDir,
      operationResource.outputRequestValidationFile
    );
    context.writeFile(relativePath, content);
  }
}
