import path from "path";
import Case from "case";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { TsTypeNode, TsTypePrinter } from "./zod-to-ts-type";
import {
  type GeneratorContext,
  type OperationResource,
  Path,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(__dirname, "templates", "Response.ejs");

    for (const [, operationResources] of Object.entries(
      context.resources.entityResources
    )) {
      for (const definition of operationResources) {
        this.writeResponseType(templateFile, definition, context);
      }
    }
  }

  private static writeResponseType(
    templateFile: string,
    resource: OperationResource,
    context: GeneratorContext
  ): void {
    const {
      definition,
      outputResponseFile,
      outputDir,
      outputResponseFileName,
      sourceDir,
      sourceFile,
    } = resource;
    const { responses, operationId } = definition;
    const pascalCaseOperationId = Case.pascal(operationId);
    const ownResponses: {
      header?: string;
      body?: string;
      statusCode: HttpStatusCode;
      name: string;
      statusCodeKey: string;
    }[] = [];
    const sharedResponses: {
      name: string;
      path: string;
    }[] = [];

    for (const response of responses) {
      const { statusCode, name, isShared, body, header } = response;

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

        sharedResponses.push({
          name,
          path: Path.relative(
            outputDir,
            `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
          ),
        });
        continue;
      }

      ownResponses.push({
        name,
        body: body ? TsTypePrinter.print(TsTypeNode.fromZod(body)) : undefined,
        header: header
          ? TsTypePrinter.print(TsTypeNode.fromZod(header))
          : undefined,
        statusCode,
        statusCodeKey: HttpStatusCode[statusCode],
      });
    }

    const content = context.renderTemplate(templateFile, {
      operationId,
      pascalCaseOperationId,
      coreDir: context.coreDir,
      ownResponses,
      sharedResponses,
      responseFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseFileName, ".ts")}`
      ),
      sourcePath: Path.relative(
        outputDir,
        `${sourceDir}/${path.basename(sourceFile, ".ts")}`
      ),
    });

    const relativePath = path.relative(context.outputDir, outputResponseFile);
    context.writeFile(relativePath, content);
  }
}
