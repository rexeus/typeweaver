import path from "path";
import Case from "case";
import { Path } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RequestValidationGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(
      __dirname,
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
        `${operationResource.sourceDir}/${path.basename(operationResource.sourceFile, ".ts")}`
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
    });

    const relativePath = path.relative(context.outputDir, operationResource.outputRequestValidationFile);
    context.writeFile(relativePath, content);
  }
}
