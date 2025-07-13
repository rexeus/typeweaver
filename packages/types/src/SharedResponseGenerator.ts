import path from "path";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import Case from "case";
import type {
  GeneratorContext,
  SharedResponseResource,
} from "@rexeus/typeweaver-gen";
import { fileURLToPath } from "url";
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SharedResponseGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFile = path.join(
      __dirname,
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
