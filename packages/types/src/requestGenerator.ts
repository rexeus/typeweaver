import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  NormalizedOperation,
} from "@rexeus/typeweaver-gen";
import { toPascalCase } from "@rexeus/typeweaver-gen";
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function generate(context: GeneratorContext): void {
  const templateFilePath = path.join(moduleDir, "templates", "Request.ejs");

  for (const resource of context.normalizedSpec.resources) {
    for (const operation of resource.operations) {
      writeRequestType(templateFilePath, resource.name, operation, context);
    }
  }
}

function writeRequestType(
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
    pascalCaseOperationId: toPascalCase(operationId),
    method,
    headerTsType: header ? print(fromZod(header)) : undefined,
    queryTsType: query ? print(fromZod(query)) : undefined,
    paramTsType: param ? print(fromZod(param)) : undefined,
    bodyTsType: body ? print(fromZod(body)) : undefined,
  });

  const relativePath = path.relative(
    context.outputDir,
    outputPaths.requestFile
  );
  context.writeFile(relativePath, content);
}
