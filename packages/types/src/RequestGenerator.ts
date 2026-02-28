import path from "node:path";
import { fileURLToPath } from "node:url";
import { Path } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

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
    const entityErrorResponses: {
      name: string;
      path: string;
    }[] = [];

    let hasGlobalSharedErrors = false;

    for (const response of responses) {
      const { statusCode, name, isReference } = response;

      if (isReference) {
        const sharedResponse = context.resources.sharedResponseResources.find(
          resource => resource.name === name
        );

        if (sharedResponse) {
          if (statusCode >= 200 && statusCode < 300) {
            sharedSuccessResponses.push({
              name,
              path: Path.relative(
                outputDir,
                `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
              ),
            });
          } else {
            hasGlobalSharedErrors = true;
          }
        } else {
          const entityResponses =
            context.resources.entityResources[operationResource.entityName]
              ?.responses;
          const entityResponse = entityResponses?.find(r => r.name === name);
          if (!entityResponse) {
            throw new Error(
              `Shared response '${response.name}' not found in shared or entity resources`
            );
          }

          const responsePath = Path.relative(
            outputDir,
            `${entityResponse.outputDir}/${path.basename(entityResponse.outputFileName, ".ts")}`
          );

          if (statusCode >= 200 && statusCode < 300) {
            sharedSuccessResponses.push({ name, path: responsePath });
          } else {
            entityErrorResponses.push({ name, path: responsePath });
          }
        }

        continue;
      }

      const assembledResponse = { name };

      if (statusCode >= 200 && statusCode < 300) {
        ownSuccessResponses.push(assembledResponse);
      } else {
        ownErrorResponses.push(assembledResponse);
      }
    }

    const sharedErrorUnionPath = hasGlobalSharedErrors
      ? Path.relative(
          outputDir,
          `${context.resources.sharedResponseResources[0].outputDir}/SharedErrorResponses`
        )
      : undefined;

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
      entityErrorResponses,
      hasGlobalSharedErrors,
      sharedErrorUnionPath,
      responseFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseFileName, ".ts")}`
      ),
      responseValidationFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseValidationFileName, ".ts")}`
      ),
      hasErrorResponses:
        ownErrorResponses.length > 0 ||
        entityErrorResponses.length > 0 ||
        hasGlobalSharedErrors,
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
