import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class RequestGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(moduleDir, "templates", "Request.ejs");

    for (const [, entityResource] of Object.entries(
      context.resources.entityResources
    )) {
      for (const definition of entityResource.operations) {
        this.writeRequestType(templateFilePath, definition, context);
      }
    }
  }

  private static writeRequestType(
    templateFilePath: string,
    operationResource: OperationResource,
    context: GeneratorContext
  ): void {
    const { request, operationId, method } = operationResource.definition;
    const { header, query, param, body } = request;

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
      operationResource.outputRequestFile
    );
    context.writeFile(relativePath, content);
  }
}
