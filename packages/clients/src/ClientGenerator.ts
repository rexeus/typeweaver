import path from "path";
import Case from "case";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ClientGenerator {
  public static generate(context: GeneratorContext): void {
    const clientTemplatePath = path.join(__dirname, "templates", "Client.ejs");
    const commandTemplatePath = path.join(
      __dirname,
      "templates",
      "RequestCommand.ejs"
    );

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      this.writeClient(clientTemplatePath, entityResource.operations, context);
      this.writeRequestCommands(
        commandTemplatePath,
        entityResource.operations,
        context
      );
    }
  }

  private static writeClient(
    templateFilePath: string,
    operationResources: OperationResource[],
    context: GeneratorContext
  ): void {
    const entityName = operationResources[0]!.entityName;
    const pascalCaseEntityName = Case.pascal(entityName);
    const outputDir = operationResources[0]!.outputDir;

    const operations: {
      operationId: string;
      pascalCaseOperationId: string;
      requestFile: string;
      responseValidatorFile: string;
      responseFile: string;
    }[] = [];
    for (const operationResource of operationResources) {
      const {
        definition,
        outputResponseFileName,
        outputResponseValidationFileName,
        outputRequestFileName,
      } = operationResource;
      const { operationId } = definition;

      const pascalCaseOperationId = Case.pascal(operationId);
      const requestFile = `./${path.basename(outputRequestFileName, ".ts")}`;
      const responseValidatorFile = `./${path.basename(outputResponseValidationFileName, ".ts")}`;
      const responseFile = `./${path.basename(outputResponseFileName, ".ts")}`;

      operations.push({
        operationId,
        pascalCaseOperationId,
        requestFile,
        responseValidatorFile,
        responseFile,
      });
    }

    const content = context.renderTemplate(templateFilePath, {
      coreDir: context.coreDir,
      pascalCaseEntityName,
      operations,
    });

    const outputClientFile = path.join(
      outputDir,
      `${pascalCaseEntityName}Client.ts`
    );
    const relativePath = path.relative(context.outputDir, outputClientFile);
    context.writeFile(relativePath, content);
  }

  private static writeRequestCommands(
    templateFilePath: string,
    operationResources: OperationResource[],
    context: GeneratorContext
  ): void {
    for (const operationResource of operationResources) {
      this.writeRequestCommand(templateFilePath, operationResource, context);
    }
  }

  private static writeRequestCommand(
    templateFilePath: string,
    operationResource: OperationResource,
    context: GeneratorContext
  ): void {
    const {
      definition,
      sourceDir,
      sourceFile,
      outputDir,
      outputResponseFileName,
      outputResponseValidationFileName,
      outputRequestFileName,
    } = operationResource;

    const { operationId, method, request, responses } = definition;
    const pascalCaseOperationId = Case.pascal(operationId);

    // Get response information
    const allResponses = responses;
    const ownSuccessResponses = allResponses.filter(
      r => r.statusCode >= 200 && r.statusCode < 300 && !r.isReference
    );
    const ownErrorResponses = allResponses.filter(
      r => (r.statusCode < 200 || r.statusCode >= 300) && !r.isReference
    );
    const sharedSuccessResponses = allResponses.filter(
      r => r.statusCode >= 200 && r.statusCode < 300 && r.isReference
    );
    const sharedErrorResponses = allResponses.filter(
      r => (r.statusCode < 200 || r.statusCode >= 300) && r.isReference
    );

    // Build request type information
    const headerTsType = request.header
      ? TsTypePrinter.print(TsTypeNode.fromZod(request.header))
      : undefined;
    const paramTsType = request.param
      ? TsTypePrinter.print(TsTypeNode.fromZod(request.param))
      : undefined;
    const queryTsType = request.query
      ? TsTypePrinter.print(TsTypeNode.fromZod(request.query))
      : undefined;
    const bodyTsType = request.body
      ? TsTypePrinter.print(TsTypeNode.fromZod(request.body))
      : undefined;

    // Helper function to determine response import path
    const successResponseImportPath = (response: {
      name: string;
      isReference?: boolean;
      path?: string;
    }) => {
      if (response.isReference && response.path) {
        return response.path;
      }
      return `./${path.basename(outputResponseFileName, ".ts")}`;
    };

    // Build relative paths
    const requestFile = `./${path.basename(outputRequestFileName, ".ts")}`;
    const responseValidatorFile = `./${path.basename(outputResponseValidationFileName, ".ts")}`;
    const relativeSourceFile = path.relative(sourceDir, sourceFile);
    const sourcePath = path.join(
      sourceDir,
      relativeSourceFile.replace(/\.ts$/, "")
    );
    const relativeSourcePath = path.relative(outputDir, sourcePath);

    const content = context.renderTemplate(templateFilePath, {
      sourcePath: relativeSourcePath,
      operationId,
      pascalCaseOperationId,
      method,
      headerTsType,
      paramTsType,
      queryTsType,
      bodyTsType,
      ownSuccessResponses,
      ownErrorResponses,
      sharedSuccessResponses,
      sharedErrorResponses,
      requestFile,
      responseValidatorFile,
      successResponseImportPath,
    });

    const outputCommandFile = path.join(
      outputDir,
      `${pascalCaseOperationId}RequestCommand.ts`
    );
    const relativePath = path.relative(context.outputDir, outputCommandFile);
    context.writeFile(relativePath, content);
  }
}
