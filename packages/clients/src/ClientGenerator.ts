import path from "path";
import Case from "case";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ClientGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(__dirname, "templates", "Client.ejs");

    for (const [, operationResources] of Object.entries(
      context.resources.entityResources
    )) {
      this.writeClient(templateFilePath, operationResources, context);
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
}
