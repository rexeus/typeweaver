import path from "node:path";
import { fileURLToPath } from "node:url";
import { Path } from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class RequestGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(moduleDir, "templates", "Request.ejs");

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      for (const definition of entityResource.operations) {
        this.writeRequestType(templateFilePath, definition, context);
      }
    }
  }

  private static writeRequestType(
    templateFilePath: string,
    operationResource: OperationResource,
    context: GeneratorContext
  ): void {
    const {
      outputDir,
      definition,
      outputResponseFileName,
      outputResponseValidationFileName,
    } = operationResource;
    const { request, operationId, method, responses } = definition;
    const { header, query, param, body } = request;

    const headerTsType = header
      ? TsTypePrinter.print(TsTypeNode.fromZod(header))
      : undefined;
    const queryTsType = query
      ? TsTypePrinter.print(TsTypeNode.fromZod(query))
      : undefined;
    const paramTsType = param
      ? TsTypePrinter.print(TsTypeNode.fromZod(param))
      : undefined;
    const bodyTsType = body
      ? TsTypePrinter.print(TsTypeNode.fromZod(body))
      : undefined;

    const pascalCaseOperationId = Case.pascal(operationId);
    const sourcePath = Path.relative(
      outputDir,
      `${operationResource.sourceDir}/${path.relative(operationResource.sourceDir, operationResource.sourceFile).replace(/\.ts$/, "")}`
    );

    const ownSuccessResponses: {
      name: string;
    }[] = [];
    const ownErrorResponses: {
      name: string;
    }[] = [];
    const sharedSuccessResponses: {
      name: string;
      path: string;
    }[] = [];
    const sharedErrorResponses: {
      name: string;
      path: string;
    }[] = [];

    for (const response of responses) {
      const { statusCode, name, isReference } = response;

      if (isReference) {
        // First check in global shared resources
        const sharedResponse = context.resources.sharedResponseResources.find(
          resource => resource.name === name
        );

        let responsePath: string;

        // If not found globally, check in entity-specific responses
        if (!sharedResponse) {
          const entityResponses =
            context.resources.entityResources[operationResource.entityName]
              ?.responses;
          const entityResponse = entityResponses?.find(r => r.name === name);
          if (entityResponse) {
            responsePath = Path.relative(
              outputDir,
              `${entityResponse.outputDir}/${path.basename(entityResponse.outputFileName, ".ts")}`
            );
          } else {
            throw new Error(
              `Shared response '${response.name}' not found in shared or entity resources`
            );
          }
        } else {
          responsePath = Path.relative(
            outputDir,
            `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
          );
        }

        const assembledResponse = {
          name,
          path: responsePath,
        };

        if (statusCode >= 200 && statusCode < 300) {
          sharedSuccessResponses.push(assembledResponse);
        } else {
          sharedErrorResponses.push(assembledResponse);
        }

        continue;
      }

      const assembledResponse = {
        name,
      };

      if (statusCode >= 200 && statusCode < 300) {
        ownSuccessResponses.push(assembledResponse);
      } else {
        ownErrorResponses.push(assembledResponse);
      }
    }

    const content = context.renderTemplate(templateFilePath, {
      pascalCaseOperationId,
      operationId,
      coreDir: context.coreDir,
      sourcePath,
      headerTsType,
      queryTsType,
      paramTsType,
      bodyTsType,
      method,
      ownSuccessResponses,
      ownErrorResponses,
      sharedSuccessResponses,
      sharedErrorResponses,
      responseFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseFileName, ".ts")}`
      ),
      responseValidationFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseValidationFileName, ".ts")}`
      ),
      hasErrorResponses:
        ownErrorResponses.length > 0 || sharedErrorResponses.length > 0,
      hasSuccessResponses:
        ownSuccessResponses.length > 0 || sharedSuccessResponses.length > 0,
    });

    const relativePath = path.relative(
      context.outputDir,
      operationResource.outputRequestFile
    );
    context.writeFile(relativePath, content);
  }
}
