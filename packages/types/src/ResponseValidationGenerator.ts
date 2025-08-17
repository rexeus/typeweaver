import path from "path";
import { fileURLToPath } from "url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { Path } from "@rexeus/typeweaver-gen";
import Case from "case";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ResponseValidationGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(
      __dirname,
      "templates",
      "ResponseValidator.ejs"
    );

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      for (const operationResource of entityResource.operations) {
        this.writeResponseValidator(
          templateFilePath,
          operationResource,
          context
        );
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
      const { statusCode, name, isReference, body, header, statusCodeName } =
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

      if (isReference) {
        // First check in global shared resources
        const sharedResponse = context.resources.sharedResponseResources.find(
          resource => resource.name === name
        );

        let importPath: string;

        // If not found globally, check in entity-specific responses
        if (!sharedResponse) {
          const entityResponses =
            context.resources.entityResources[resource.entityName]?.responses;
          const entityResponse = entityResponses?.find(r => r.name === name);
          if (entityResponse) {
            importPath = Path.relative(
              outputDir,
              `${entityResponse.outputDir}/${path.basename(entityResponse.outputFileName, ".ts")}`
            );
          } else {
            throw new Error(
              `Shared response '${response.name}' not found in shared or entity resources`
            );
          }
        } else {
          importPath = Path.relative(
            outputDir,
            `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
          );
        }

        sharedResponses.push({
          name,
          importPath,
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
        `${sourceDir}/${path.relative(sourceDir, sourceFile).replace(/\.ts$/, "")}`
      ),
      sharedResponses,
      ownResponses,
      allStatusCodes,
    });

    const relativePath = path.relative(
      context.outputDir,
      outputResponseValidationFile
    );
    context.writeFile(relativePath, content);
  }
}
