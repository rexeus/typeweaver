import path from "path";
import Case from "case";
import { TsTypeNode, TsTypePrinter } from "./zod-to-ts-type";
import {
  type GeneratorContext,
  type OperationResource,
  Path,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RequestGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(__dirname, "templates", "Request.ejs");

    for (const [, operationResources] of Object.entries(
      context.resources.entityResources
    )) {
      for (const definition of operationResources) {
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
      `${operationResource.sourceDir}/${path.basename(operationResource.sourceFile, ".ts")}`
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
      const { statusCode, name, isShared } = response;

      if (isShared) {
        const sharedResponse = context.resources.sharedResponseResources.find(
          resource => {
            return resource.name === name;
          }
        );
        if (!sharedResponse) {
          throw new Error(
            `Shared response '${response.name}' not found in shared resources`
          );
        }

        const assembledResponse = {
          name,
          path: Path.relative(
            outputDir,
            `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
          ),
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

    const relativePath = path.relative(context.outputDir, operationResource.outputRequestFile);
    context.writeFile(relativePath, content);
  }
}
