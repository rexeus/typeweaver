import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  NormalizedOperation,
} from "@rexeus/typeweaver-gen";
import Case from "case";
import { z } from "zod";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class RequestValidationGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(
      moduleDir,
      "templates",
      "RequestValidator.ejs"
    );

    for (const resource of context.normalizedSpec.resources) {
      for (const operation of resource.operations) {
        this.writeRequestValidator(
          templateFilePath,
          resource.name,
          operation,
          context
        );
      }
    }
  }

  private static writeRequestValidator(
    templateFilePath: string,
    resourceName: string,
    operation: NormalizedOperation,
    context: GeneratorContext
  ): void {
    const { operationId, request } = operation;
    const { body, query, param, header } = request ?? {};
    const outputPaths = context.getOperationOutputPaths({
      resourceName,
      operationId,
    });

    const pascalCaseOperationId = Case.pascal(operationId);

    const content = context.renderTemplate(templateFilePath, {
      pascalCaseOperationId,
      operationId,
      sourcePath: context.getOperationDefinitionImportPath({
        importerDir: outputPaths.outputDir,
        resourceName,
        operationId,
      }),
      corePath: context.coreDir,
      requestFile: `./${path.basename(outputPaths.requestFileName, ".ts")}`,
      body,
      query,
      param,
      header,
      z,
    });

    const relativePath = path.relative(
      context.outputDir,
      outputPaths.requestValidationFile
    );
    context.writeFile(relativePath, content);
  }
}
