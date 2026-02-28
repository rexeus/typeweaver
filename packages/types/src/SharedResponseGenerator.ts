import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  SharedResponseResource,
} from "@rexeus/typeweaver-gen";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import Case from "case";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class SharedResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(
      moduleDir,
      "templates",
      "SharedResponse.ejs"
    );

    for (const sharedResponse of context.resources.sharedResponseResources) {
      this.writeSharedResponse(templateFile, sharedResponse, context);
    }
  }

  public static writeSharedResponse(
    templateFile: string,
    sharedResponse: SharedResponseResource,
    context: GeneratorContext
  ): void {
    const headerTsType = sharedResponse.header
      ? TsTypePrinter.print(TsTypeNode.fromZod(sharedResponse.header))
      : undefined;
    const bodyTsType = sharedResponse.body
      ? TsTypePrinter.print(TsTypeNode.fromZod(sharedResponse.body))
      : undefined;
    const pascalCaseName = Case.pascal(sharedResponse.name);

    const content = context.renderTemplate(templateFile, {
      coreDir: context.coreDir,
      httpStatusCode: HttpStatusCode,
      headerTsType,
      bodyTsType,
      pascalCaseName,
      sharedResponse,
    });

    const relativePath = path.relative(
      context.outputDir,
      sharedResponse.outputFile
    );
    context.writeFile(relativePath, content);
  }
}
