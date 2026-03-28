import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  NormalizedOperation,
} from "@rexeus/typeweaver-gen";
import Case from "case";
import { z } from "zod";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function generate(context: GeneratorContext): void {
  const templateFilePath = path.join(
    moduleDir,
    "templates",
    "RequestValidator.ejs"
  );

  for (const resource of context.normalizedSpec.resources) {
    resource.operations.forEach((operation, operationIndex) => {
      writeRequestValidator(
        templateFilePath,
        resource.name,
        operation,
        operationIndex,
        context
      );
    });
  }
}

function writeRequestValidator(
  templateFilePath: string,
  resourceName: string,
  operation: NormalizedOperation,
  operationIndex: number,
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
    specPath: context.getSpecImportPath({
      importerDir: outputPaths.outputDir,
    }),
    definitionAccessor: `spec.resources[${JSON.stringify(resourceName)}]!.operations[${operationIndex}]!`,
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
