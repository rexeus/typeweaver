import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { Path } from "@rexeus/typeweaver-gen";
import type {
  EntityResponseResource,
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class ResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(moduleDir, "templates", "Response.ejs");
    const sharedResponseTemplateFile = path.join(
      moduleDir,
      "templates",
      "SharedResponse.ejs"
    );

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      // Generate operation responses
      for (const definition of entityResource.operations) {
        this.writeResponseType(templateFile, definition, context);
      }

      // Generate entity-specific responses
      for (const responseResource of entityResource.responses) {
        this.writeEntityResponseType(
          sharedResponseTemplateFile,
          responseResource,
          context
        );
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
    const entityResponses: {
      name: string;
      path: string;
    }[] = [];
    const sharedResponses: {
      name: string;
      path: string;
    }[] = [];

    for (const response of responses) {
      const { statusCode, name, body, header, isReference } = response;

      if (isReference) {
        const sharedResponse = context.resources.sharedResponseResources.find(
          resource => resource.name === name
        );

        if (sharedResponse) {
          sharedResponses.push({
            name,
            path: Path.relative(
              outputDir,
              `${sharedResponse.outputDir}/${path.basename(sharedResponse.outputFileName, ".ts")}`
            ),
          });
        } else {
          const entityResponseList =
            context.resources.entityResources[resource.entityName]?.responses;
          const entityResponse = entityResponseList?.find(r => r.name === name);

          if (!entityResponse) {
            throw new Error(
              `Response ${name} not found in shared or entity-specific responses`
            );
          }

          entityResponses.push({
            name,
            path: Path.relative(
              outputDir,
              `${entityResponse.outputDir}/${path.basename(entityResponse.outputFileName, ".ts")}`
            ),
          });
        }

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
      entityResponses,
      sharedResponses,
      responseFile: Path.relative(
        outputDir,
        `${outputDir}/${path.basename(outputResponseFileName, ".ts")}`
      ),
      sourcePath: Path.relative(
        outputDir,
        `${sourceDir}/${path.relative(sourceDir, sourceFile).replace(/\.ts$/, "")}`
      ),
    });

    const relativePath = path.relative(context.outputDir, outputResponseFile);
    context.writeFile(relativePath, content);
  }

  private static writeEntityResponseType(
    templateFile: string,
    resource: EntityResponseResource,
    context: GeneratorContext
  ): void {
    const { name, body, header, outputFile } = resource;
    const pascalCaseName = Case.pascal(name);

    const headerTsType = header
      ? TsTypePrinter.print(TsTypeNode.fromZod(header))
      : undefined;
    const bodyTsType = body
      ? TsTypePrinter.print(TsTypeNode.fromZod(body))
      : undefined;

    const content = context.renderTemplate(templateFile, {
      coreDir: context.coreDir,
      httpStatusCode: HttpStatusCode,
      headerTsType,
      bodyTsType,
      pascalCaseName,
      sharedResponse: resource, // The template expects this property name
    });

    const relativePath = path.relative(context.outputDir, outputFile);
    context.writeFile(relativePath, content);
  }
}
