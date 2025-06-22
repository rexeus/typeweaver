import fs from "fs";
import path from "path";
import ejs from "ejs";
import { Generator } from "./Generator";
import type { OperationResource, SharedResponseResource } from "./Resource";
import type { GetResourcesResult } from "./ResourceReader";
import Case from "case";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { Path } from "./helpers/Path";
import { TsTypeNode, TsTypePrinter } from "./zod-to-ts-type";

export class ResponseGenerator {
  public static generate(resources: GetResourcesResult): void {
    const templateFile = path.join(Generator.templateDir, "Response.ejs");
    const template = fs.readFileSync(templateFile, "utf8");

    for (const [entityName, operationResources] of Object.entries(
      resources.entityResources
    )) {
      fs.mkdirSync(operationResources[0]!.outputDir, { recursive: true });

      for (const definition of operationResources) {
        this.writeResponseType(
          template,
          definition,
          resources.sharedResponseResources
        );
      }
    }
  }

  private static writeResponseType(
    template: string,
    resource: OperationResource,
    sharedResponseResources: SharedResponseResource[]
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
      const { statusCode, name, isShared, body, header, statusCodeName } =
        response;

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

    const content = ejs.render(template, {
      operationId,
      pascalCaseOperationId,
      coreDir: Generator.coreDir,
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

    fs.writeFileSync(outputResponseFile, content);
  }
}
