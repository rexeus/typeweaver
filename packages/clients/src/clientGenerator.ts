import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJSDocComment } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";
import { pascalCase } from "polycase";
import { getRequestHeaderDefaults } from "./requestHeaderDefaults.js";
import type { RequestHeaderDefaults } from "./requestHeaderDefaults.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type RequestTypeTemplateData = {
  readonly headerTsType: string | undefined;
  readonly paramTsType: string | undefined;
  readonly queryTsType: string | undefined;
  readonly bodyTsType: string | undefined;
  readonly hasRequestInput: boolean;
};

type WriteRequestCommandOptions = {
  readonly templateFilePath: string;
  readonly resourceName: string;
  readonly operation: NormalizedOperation;
  readonly context: GeneratorContext;
};

const EMPTY_REQUEST_HEADER_DEFAULTS: RequestHeaderDefaults = {
  entries: [],
  optionalHeaderKeys: [],
  isHeaderInputOptional: false,
};

export function generate(context: GeneratorContext): void {
  const clientTemplatePath = path.join(moduleDir, "templates", "Client.ejs");
  const commandTemplatePath = path.join(
    moduleDir,
    "templates",
    "RequestCommand.ejs"
  );

  for (const resource of context.normalizedSpec.resources) {
    writeClient(clientTemplatePath, resource, context);
    writeRequestCommands(commandTemplatePath, resource, context);
  }
}

function writeClient(
  templateFilePath: string,
  resource: NormalizedResource,
  context: GeneratorContext
): void {
  const pascalCaseEntityName = pascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);

  const operations = resource.operations.map(operation => {
    const outputPaths = context.getOperationOutputPaths({
      resourceName: resource.name,
      operationId: operation.operationId,
    });

    return {
      operationId: operation.operationId,
      pascalCaseOperationId: pascalCase(operation.operationId),
      jsDoc: createJSDocComment(operation.summary, { indentation: "    " }),
      requestFile: `./${path.basename(outputPaths.requestFileName, ".ts")}.js`,
      responseValidatorFile: `./${path.basename(outputPaths.responseValidationFileName, ".ts")}.js`,
      responseFile: `./${path.basename(outputPaths.responseFileName, ".ts")}.js`,
    };
  });

  const content = context.renderTemplate(templateFilePath, {
    coreDir: context.coreDir,
    pascalCaseEntityName,
    operations,
  });

  const outputClientFile = path.join(
    outputDir,
    `${pascalCaseEntityName}Client.ts`
  );
  const relativePath = path.relative(context.outputDir, outputClientFile);
  context.writeFile(relativePath, content);
}

function writeRequestCommands(
  templateFilePath: string,
  resource: NormalizedResource,
  context: GeneratorContext
): void {
  resource.operations.forEach(operation => {
    writeRequestCommand({
      templateFilePath,
      resourceName: resource.name,
      operation,
      context,
    });
  });
}

function createRequestTypeTemplateData(
  operation: NormalizedOperation
): RequestTypeTemplateData {
  const request = operation.request;
  const headerTsType = request?.header
    ? print(fromZod(request.header))
    : undefined;
  const paramTsType = request?.param
    ? print(fromZod(request.param))
    : undefined;
  const queryTsType = request?.query
    ? print(fromZod(request.query))
    : undefined;
  const bodyTsType = request?.body
    ? print(fromZod(request.body.schema))
    : undefined;

  return {
    headerTsType,
    paramTsType,
    queryTsType,
    bodyTsType,
    hasRequestInput: [headerTsType, paramTsType, queryTsType, bodyTsType].some(
      type => type !== undefined
    ),
  };
}

function writeRequestCommand({
  templateFilePath,
  resourceName,
  operation,
  context,
}: WriteRequestCommandOptions): void {
  const outputPaths = context.getOperationOutputPaths({
    resourceName,
    operationId: operation.operationId,
  });
  const pascalCaseOperationId = pascalCase(operation.operationId);
  const requestTypeData = createRequestTypeTemplateData(operation);
  const headerDefaults = getRequestHeaderDefaults(operation.request);
  const {
    entries: headerDefaultEntries,
    optionalHeaderKeys,
    isHeaderInputOptional,
  } = headerDefaults ?? EMPTY_REQUEST_HEADER_DEFAULTS;

  const content = context.renderTemplate(templateFilePath, {
    resourceName,
    specPath: context.getSpecImportPath({
      importerDir: outputPaths.outputDir,
    }),
    operationId: operation.operationId,
    pascalCaseOperationId,
    method: operation.method,
    ...requestTypeData,
    requestJsDoc: createJSDocComment(operation.summary),
    headerDefaultEntries,
    optionalHeaderKeys,
    hasHeaderDefaults: headerDefaults !== undefined,
    isHeaderInputOptional,
    requestFile: `./${path.basename(outputPaths.requestFileName, ".ts")}.js`,
    responseValidatorFile: `./${path.basename(outputPaths.responseValidationFileName, ".ts")}.js`,
    responseFile: `./${path.basename(outputPaths.responseFileName, ".ts")}.js`,
  });

  const outputCommandFile = path.join(
    outputPaths.outputDir,
    `${pascalCaseOperationId}RequestCommand.ts`
  );
  const relativePath = path.relative(context.outputDir, outputCommandFile);
  context.writeFile(relativePath, content);
}
