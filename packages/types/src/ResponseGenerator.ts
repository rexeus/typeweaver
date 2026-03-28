import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
  NormalizedResponse,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

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

export class ResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(moduleDir, "templates", "Response.ejs");
    const canonicalResponseTemplateFile = path.join(
      moduleDir,
      "templates",
      "SharedResponse.ejs"
    );

    for (const response of context.normalizedSpec.responses) {
      this.writeCanonicalResponseType(
        canonicalResponseTemplateFile,
        response,
        context
      );
    }

    for (const resource of context.normalizedSpec.resources) {
      for (const operation of resource.operations) {
        this.writeResponseType(templateFile, resource, operation, context);
      }
    }
  }

  private static writeResponseType(
    templateFile: string,
    resource: NormalizedResource,
    operation: NormalizedOperation,
    context: GeneratorContext
  ): void {
    const outputPaths = context.getOperationOutputPaths({
      resourceName: resource.name,
      operationId: operation.operationId,
    });
    const pascalCaseOperationId = Case.pascal(operation.operationId);
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

      ownResponses.push(
        this.createOwnResponseTemplateData(responseUsage.response)
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
      sourcePath: context.getOperationDefinitionImportPath({
        importerDir: outputPaths.outputDir,
        resourceName: resource.name,
        operationId: operation.operationId,
      }),
    });

    const relativePath = path.relative(
      context.outputDir,
      outputPaths.responseFile
    );
    context.writeFile(relativePath, content);
  }

  private static createOwnResponseTemplateData(
    response: NormalizedResponse
  ): OwnResponseTemplateData {
    return {
      name: response.name,
      body: response.body
        ? TsTypePrinter.print(TsTypeNode.fromZod(response.body))
        : undefined,
      header: response.header
        ? TsTypePrinter.print(TsTypeNode.fromZod(response.header))
        : undefined,
      statusCode: response.statusCode,
      statusCodeKey: HttpStatusCode[response.statusCode],
    };
  }

  private static writeCanonicalResponseType(
    templateFile: string,
    response: NormalizedResponse,
    context: GeneratorContext
  ): void {
    const pascalCaseName = Case.pascal(response.name);
    const headerTsType = response.header
      ? TsTypePrinter.print(TsTypeNode.fromZod(response.header))
      : undefined;
    const bodyTsType = response.body
      ? TsTypePrinter.print(TsTypeNode.fromZod(response.body))
      : undefined;

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
}
