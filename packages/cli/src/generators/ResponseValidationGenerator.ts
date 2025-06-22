import type { OperationResource, SharedResponseResource } from "./Resource";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import { Generator } from "./Generator";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { GetResourcesResult } from "./ResourceReader";
import Case from "case";
import { Path } from "./helpers/Path";

export class ResponseValidationGenerator {
  public static generate(resources: GetResourcesResult): void {
    const templateFilePath = path.join(
      Generator.templateDir,
      "ResponseValidator.ejs"
    );

    const template = fs.readFileSync(templateFilePath, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      resources.entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      for (const operationResource of operationResources) {
        this.writeResponseValidator(
          template,
          operationResource,
          resources.sharedResponseResources
        );
      }
    }
  }

  private static writeResponseValidator(
    template: string,
    resource: OperationResource,
    sharedResponseResources: SharedResponseResource[]
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
        const sharedResponse = sharedResponseResources.find(resource => {
          return resource.name === name;
        });
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

    const content = ejs.render(template, {
      operationId,
      pascalCaseOperationId,
      coreDir: Generator.coreDir,
      responseFile: `./${path.basename(outputResponseFileName, ".ts")}`,
      sourcePath: Path.relative(
        outputDir,
        `${sourceDir}/${path.basename(sourceFile, ".ts")}`
      ),
      sharedResponses,
      ownResponses,
      allStatusCodes,
    });

    fs.writeFileSync(outputResponseValidationFile, content);
  }
}
