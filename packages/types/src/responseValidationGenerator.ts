import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type ResponseTemplateData = {
  readonly name: string;
  readonly statusCode: HttpStatusCode;
  readonly index: number;
  readonly hasHeader: boolean;
  readonly hasBody: boolean;
  readonly statusCodeKey?: string;
};

export function generate(context: GeneratorContext): void {
  const templateFilePath = path.join(
    moduleDir,
    "templates",
    "ResponseValidator.ejs"
  );

  for (const resource of context.normalizedSpec.resources) {
    resource.operations.forEach((operation, operationIndex) => {
      writeResponseValidator(
        templateFilePath,
        resource,
        operation,
        operationIndex,
        context
      );
    });
  }
}

function writeResponseValidator(
  templateFilePath: string,
  resource: NormalizedResource,
  operation: NormalizedOperation,
  operationIndex: number,
  context: GeneratorContext
): void {
  const outputPaths = context.getOperationOutputPaths({
    resourceName: resource.name,
    operationId: operation.operationId,
  });
  const pascalCaseOperationId = Case.pascal(operation.operationId);
  const ownResponses: ResponseTemplateData[] = [];
  const sharedResponses: ResponseTemplateData[] = [];
  const allStatusCodes = new Map<HttpStatusCode, string>();

  operation.responses.forEach((responseUsage, index) => {
    const response =
      responseUsage.source === "canonical"
        ? context.getCanonicalResponse(responseUsage.responseName)
        : responseUsage.response;

    allStatusCodes.set(response.statusCode, response.statusCodeName);

    const templateData: ResponseTemplateData = {
      name: response.name,
      hasBody: response.body !== undefined,
      hasHeader: response.header !== undefined,
      statusCode: response.statusCode,
      index,
    };

    if (responseUsage.source === "canonical") {
      sharedResponses.push(templateData);
      return;
    }

    ownResponses.push({
      ...templateData,
      statusCodeKey: HttpStatusCode[response.statusCode],
    });
  });

  const content = context.renderTemplate(templateFilePath, {
    operationId: operation.operationId,
    pascalCaseOperationId,
    coreDir: context.coreDir,
    responseFile: `./${path.basename(outputPaths.responseFileName, ".ts")}`,
    specPath: context.getSpecImportPath({
      importerDir: outputPaths.outputDir,
    }),
    definitionAccessor: `spec.resources[${JSON.stringify(resource.name)}]!.operations[${operationIndex}]!`,
    sharedResponses,
    ownResponses,
    allStatusCodes: Array.from(allStatusCodes.entries()).map(
      ([statusCode, name]) => ({
        statusCode,
        name,
      })
    ),
  });

  const relativePath = path.relative(
    context.outputDir,
    outputPaths.responseValidationFile
  );
  context.writeFile(relativePath, content);
}
