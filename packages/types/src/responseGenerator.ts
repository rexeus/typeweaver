import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
  NormalizedResponse,
  OperationOutputPaths,
} from "@rexeus/typeweaver-gen";
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";
import { pascalCase } from "polycase";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type ResponseOperationOutputPaths = Pick<
  OperationOutputPaths,
  "outputDir" | "responseFile" | "responseFileName"
>;

export type ResponseGenerationContext = Pick<
  GeneratorContext,
  | "normalizedSpec"
  | "coreDir"
  | "outputDir"
  | "getCanonicalResponseOutputFile"
  | "getCanonicalResponseImportPath"
  | "renderTemplate"
  | "writeFile"
> & {
  readonly getOperationOutputPaths: (params: {
    readonly resourceName: string;
    readonly operationId: string;
  }) => ResponseOperationOutputPaths;
};

type OwnResponseTemplateData = {
  readonly identifierName: string;
  readonly typeValue: string;
  readonly header?: string;
  readonly body?: string;
  readonly statusCode: HttpStatusCode;
  readonly statusCodeKey: string;
  readonly hasHeader: boolean;
  readonly hasBody: boolean;
  readonly factory: string;
};

type ResponseFactoryTemplateData = {
  readonly identifierName: string;
  readonly typeValue: string;
  readonly statusCodeKey: string;
  readonly hasHeader: boolean;
  readonly hasBody: boolean;
};

type RenderResponseFactoryTemplateData = ResponseFactoryTemplateData & {
  readonly indentation: string;
};

type ImportedResponseTemplateData = {
  readonly identifierName: string;
  readonly path: string;
};

export function generate(context: ResponseGenerationContext): void {
  const templateFile = path.join(moduleDir, "templates", "Response.ejs");
  const canonicalResponseTemplateFile = path.join(
    moduleDir,
    "templates",
    "SharedResponse.ejs"
  );
  const responseFactoryTemplateFile = path.join(
    moduleDir,
    "templates",
    "ResponseFactory.ejs"
  );

  for (const response of context.normalizedSpec.responses) {
    writeCanonicalResponseType(
      canonicalResponseTemplateFile,
      responseFactoryTemplateFile,
      response,
      context
    );
  }

  for (const resource of context.normalizedSpec.resources) {
    for (const operation of resource.operations) {
      writeResponseType(
        templateFile,
        responseFactoryTemplateFile,
        resource,
        operation,
        context
      );
    }
  }
}

function writeResponseType(
  templateFile: string,
  responseFactoryTemplateFile: string,
  resource: NormalizedResource,
  operation: NormalizedOperation,
  context: ResponseGenerationContext
): void {
  const outputPaths = context.getOperationOutputPaths({
    resourceName: resource.name,
    operationId: operation.operationId,
  });
  const pascalCaseOperationId = pascalCase(operation.operationId);
  const ownResponses: OwnResponseTemplateData[] = [];
  const canonicalResponses: ImportedResponseTemplateData[] = [];

  for (const responseUsage of operation.responses) {
    if (responseUsage.source === "canonical") {
      canonicalResponses.push({
        identifierName: pascalCase(responseUsage.responseName),
        path: context.getCanonicalResponseImportPath({
          importerDir: outputPaths.outputDir,
          responseName: responseUsage.responseName,
        }),
      });
      continue;
    }

    ownResponses.push(
      createOwnResponseTemplateData(
        responseUsage.response,
        responseFactoryTemplateFile,
        context
      )
    );
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
  response: NormalizedResponse,
  responseFactoryTemplateFile: string,
  context: ResponseGenerationContext
): OwnResponseTemplateData {
  const hasHeader = response.header !== undefined;
  const hasBody = response.body !== undefined;
  const factoryData: ResponseFactoryTemplateData = {
    identifierName: pascalCase(response.name),
    typeValue: response.name,
    statusCodeKey: HttpStatusCode[response.statusCode],
    hasHeader,
    hasBody,
  };

  return {
    ...factoryData,
    body: response.body ? print(fromZod(response.body)) : undefined,
    header: response.header ? print(fromZod(response.header)) : undefined,
    statusCode: response.statusCode,
    factory: renderResponseFactory(
      responseFactoryTemplateFile,
      factoryData,
      context,
      "    "
    ),
  };
}

function writeCanonicalResponseType(
  templateFile: string,
  responseFactoryTemplateFile: string,
  response: NormalizedResponse,
  context: ResponseGenerationContext
): void {
  const pascalCaseName = pascalCase(response.name);
  const headerTsType = response.header
    ? print(fromZod(response.header))
    : undefined;
  const bodyTsType = response.body ? print(fromZod(response.body)) : undefined;
  const factoryData: ResponseFactoryTemplateData = {
    identifierName: pascalCaseName,
    typeValue: response.name,
    statusCodeKey: HttpStatusCode[response.statusCode],
    hasHeader: response.header !== undefined,
    hasBody: response.body !== undefined,
  };

  const content = context.renderTemplate(templateFile, {
    coreDir: context.coreDir,
    headerTsType,
    bodyTsType,
    ...factoryData,
    factory: renderResponseFactory(
      responseFactoryTemplateFile,
      factoryData,
      context,
      ""
    ),
  });

  const relativePath = path.relative(
    context.outputDir,
    context.getCanonicalResponseOutputFile(response.name)
  );
  context.writeFile(relativePath, content);
}

function renderResponseFactory(
  templateFile: string,
  data: ResponseFactoryTemplateData,
  context: ResponseGenerationContext,
  indentation: string
): string {
  return context.renderTemplate(templateFile, {
    ...data,
    indentation,
  } satisfies RenderResponseFactoryTemplateData);
}
