import fs from "fs";
import path from "path";
import ejs from "ejs";
import { Generator } from "./Generator";
import type { OperationResource, SharedResponseResource } from "./Resource";
import Case from "case";
import type { GetResourcesResult } from "./ResourceReader";
import { Path } from "./helpers/Path";
import { TsTypeNode, TsTypePrinter } from "./zod-to-ts-type";

export class RequestGenerator {
  public static generate(resources: GetResourcesResult): void {
    const templateFilePath = path.join(Generator.templateDir, "Request.ejs");
    const template = fs.readFileSync(templateFilePath, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      resources.entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      for (const definition of operationResources) {
        this.writeRequestType(
          template,
          definition,
          resources.sharedResponseResources
        );
      }
    }
  }

  private static writeRequestType(
    template: string,
    operationResource: OperationResource,
    sharedResponseResources: SharedResponseResource[]
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
      const { statusCode, name, isShared, body, header } = response;

      if (isShared) {
        const sharedResponse = sharedResponseResources.find(resource => {
          return resource.name === name;
        });
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

    const content = ejs.render(template, {
      pascalCaseOperationId,
      operationId,
      coreDir: Generator.coreDir,
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

    fs.writeFileSync(operationResource.outputRequestFile, content);
  }
}
