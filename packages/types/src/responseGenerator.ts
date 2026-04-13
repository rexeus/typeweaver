import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
  NormalizedResponse,
} from "@rexeus/typeweaver-gen";
import { toPascalCase } from "@rexeus/typeweaver-gen";
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type OwnResponseTemplateData = {
  readonly header?: string;
  readonly body?: string;
  readonly statusCode: HttpStatusCode;
  readonly name: string;
  readonly statusCodeKey: string;
};

type ImportedResponseTemplateData = {
  readonly name: string;
  readonly path: string;
};

export function generate(context: GeneratorContext): void {
  const templateFile = path.join(moduleDir, "templates", "Response.ejs");
  const canonicalResponseTemplateFile = path.join(
    moduleDir,
    "templates",
    "SharedResponse.ejs"
  );

  for (const response of context.normalizedSpec.responses) {
    writeCanonicalResponseType(
      canonicalResponseTemplateFile,
      response,
      context
    );
  }

  for (const resource of context.normalizedSpec.resources) {
    for (const operation of resource.operations) {
      writeResponseType(templateFile, resource, operation, context);
    }
  }
}

function writeResponseType(
  templateFile: string,
  resource: NormalizedResource,
  operation: NormalizedOperation,
  context: GeneratorContext
): void {
  const outputPaths = context.getOperationOutputPaths({
    resourceName: resource.name,
    operationId: operation.operationId,
  });
  const pascalCaseOperationId = toPascalCase(operation.operationId);
  const ownResponses: OwnResponseTemplateData[] = [];
  const canonicalResponses: ImportedResponseTemplateData[] = [];

  for (const responseUsage of operation.responses) {
    if (responseUsage.source === "canonical") {
      canonicalResponses.push({
        name: responseUsage.responseName,
        path: context.getCanonicalResponseImportPath({
          importerDir: outputPaths.outputDir,
          responseName: responseUsage.responseName,
        }),
      });
      continue;
    }

    ownResponses.push(createOwnResponseTemplateData(responseUsage.response));
  }

  const content = context.renderTemplate(templateFile, {
    operationId: operation.operationId,
    pascalCaseOperationId,
    coreDir: context.coreDir,
    ownResponses,
    entityResponses: [],
    sharedResponses: canonicalResponses,
    responseFile: `./${path.basename(outputPaths.responseFileName, ".ts")}`,
  });

  const relativePath = path.relative(
    context.outputDir,
    outputPaths.responseFile
  );
  context.writeFile(relativePath, content);
}

function createOwnResponseTemplateData(
  response: NormalizedResponse
): OwnResponseTemplateData {
  return {
    name: response.name,
    body: response.body ? print(fromZod(response.body)) : undefined,
    header: response.header ? print(fromZod(response.header)) : undefined,
    statusCode: response.statusCode,
    statusCodeKey: HttpStatusCode[response.statusCode],
  };
}

function writeCanonicalResponseType(
  templateFile: string,
  response: NormalizedResponse,
  context: GeneratorContext
): void {
  const pascalCaseName = toPascalCase(response.name);
  const headerTsType = response.header
    ? print(fromZod(response.header))
    : undefined;
  const bodyTsType = response.body ? print(fromZod(response.body)) : undefined;

  const content = context.renderTemplate(templateFile, {
    coreDir: context.coreDir,
    httpStatusCode: HttpStatusCode,
    headerTsType,
    bodyTsType,
    pascalCaseName,
    sharedResponse: response,
  });

  const relativePath = path.relative(
    context.outputDir,
    context.getCanonicalResponseOutputFile(response.name)
  );
  context.writeFile(relativePath, content);
}
