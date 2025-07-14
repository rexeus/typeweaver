import path from "path";
import Case from "case";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import {
  type GeneratorContext,
  type OperationResource,
  type EntityResponseResource,
  Path,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(__dirname, "templates", "Response.ejs");
    const sharedResponseTemplateFile = path.join(__dirname, "templates", "SharedResponse.ejs");

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      // Generate operation responses
      for (const definition of entityResource.operations) {
        this.writeResponseType(templateFile, definition, context);
      }
      
      // Generate entity-specific responses
      for (const responseResource of entityResource.responses) {
        this.writeEntityResponseType(sharedResponseTemplateFile, responseResource, context);
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
        // First check in global shared resources
        let sharedResponse = context.resources.sharedResponseResources.find(
          resource => resource.name === name
        );
        
        // If not found globally, check in entity-specific responses
        if (!sharedResponse) {
          const entityResponses = context.resources.entityResources[resource.entityName]?.responses;
          const entityResponse = entityResponses?.find(r => r.name === name);
          if (entityResponse) {
            sharedResponses.push({
              name,
              path: Path.relative(
                outputDir,
                `${entityResponse.outputDir}/${path.basename(entityResponse.outputFileName, ".ts")}`
              ),
            });
            continue;
          }
        }
        
        if (!sharedResponse) {
          throw new Error(
            `Shared response '${response.name}' not found in shared or entity resources`
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

  private static writeEntityResponseType(
    templateFile: string,
    resource: EntityResponseResource,
    context: GeneratorContext
  ): void {
    const { name, body, header, statusCode, outputFile, outputDir } = resource;
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
