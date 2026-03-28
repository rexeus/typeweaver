import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  NormalizedOperation,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class RequestGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(moduleDir, "templates", "Request.ejs");

    for (const resource of context.normalizedSpec.resources) {
      for (const operation of resource.operations) {
        this.writeRequestType(
          templateFilePath,
          resource.name,
          operation,
          context
        );
      }
    }
  }

  private static writeRequestType(
    templateFilePath: string,
    resourceName: string,
    operation: NormalizedOperation,
    context: GeneratorContext
  ): void {
    const { request, operationId, method } = operation;
    const { header, query, param, body } = request ?? {};
    const outputPaths = context.getOperationOutputPaths({
      resourceName,
      operationId,
    });

    const content = context.renderTemplate(templateFilePath, {
      pascalCaseOperationId: Case.pascal(operationId),
      method,
      headerTsType: header
        ? TsTypePrinter.print(TsTypeNode.fromZod(header))
        : undefined,
      queryTsType: query
        ? TsTypePrinter.print(TsTypeNode.fromZod(query))
        : undefined,
      paramTsType: param
        ? TsTypePrinter.print(TsTypeNode.fromZod(param))
        : undefined,
      bodyTsType: body
        ? TsTypePrinter.print(TsTypeNode.fromZod(body))
        : undefined,
    });

    const relativePath = path.relative(
      context.outputDir,
      outputPaths.requestFile
    );
    context.writeFile(relativePath, content);
  }
}
