import path from "path";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import Case from "case";
import {
  type GeneratorContext,
  type OperationResource,
  Path,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ResponseValidationGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(
      __dirname,
      "templates",
      "ResponseValidator.ejs"
    );

    for (const [, operationResources] of Object.entries(
      context.resources.entityResources
    )) {
      for (const operationResource of operationResources) {
        this.writeResponseValidator(templateFilePath, operationResource, context);
      }
    }
  }

  private static writeResponseValidator(
    templateFilePath: string,
    resource: OperationResource,
    context: GeneratorContext
  ): void {
    const {
      definition,
      outputDir,
      outputResponseFileName,
      sourceDir,
      sourceFile,
      outputResponseValidationFile,
    } = resource;
    const { responses, operationId } = definition;
    const pascalCaseOperationId = Case.pascal(operationId);
    const ownResponses: {
      hasHeader: boolean;
      hasBody: boolean;
      statusCode: HttpStatusCode;
      name: string;
      statusCodeKey: string;
      index: number;
    }[] = [];
    const sharedResponses: {
      name: string;
      importPath: string;
      statusCode: HttpStatusCode;
      hasHeader: boolean;
      hasBody: boolean;
      index: number;
    }[] = [];
    const allStatusCodes: {
      statusCode: HttpStatusCode;
      name: string;
    }[] = [];

    for (const response of responses) {
      const { statusCode, name, isShared, body, header, statusCodeName } =
        response;
      const index = responses.indexOf(response);

      const isStatusCodeIncluded = allStatusCodes.some(status => {
        return status.statusCode === statusCode;
      });
      if (!isStatusCodeIncluded) {
        allStatusCodes.push({
          statusCode,
          name: statusCodeName,
        });
      }

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
          importPath: Path.relative(
            outputDir,
            `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
          ),
          hasBody: !!body,
          hasHeader: !!header,
          statusCode,
          index,
        });
        continue;
      }

      ownResponses.push({
        name,
        hasBody: !!body,
        hasHeader: !!header,
        statusCode,
        statusCodeKey: HttpStatusCode[statusCode],
        index,
      });
    }

    const content = context.renderTemplate(templateFilePath, {
      operationId,
      pascalCaseOperationId,
      coreDir: context.coreDir,
      responseFile: `./${path.basename(outputResponseFileName, ".ts")}`,
      sourcePath: Path.relative(
        outputDir,
        `${sourceDir}/${path.basename(sourceFile, ".ts")}`
      ),
      sharedResponses,
      ownResponses,
      allStatusCodes,
    });

    const relativePath = path.relative(context.outputDir, outputResponseValidationFile);
    context.writeFile(relativePath, content);
  }
}
