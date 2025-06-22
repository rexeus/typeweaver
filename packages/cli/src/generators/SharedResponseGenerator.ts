import type { SharedResponseResource } from "./Resource";
import { Generator } from "./Generator";
import path from "path";
import fs from "fs";
import ejs from "ejs";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { TsTypeNode, TsTypePrinter } from "./zod-to-ts-type";
import Case from "case";

export class SharedResponseGenerator {
  public static generate(
    sharedResponseResources: SharedResponseResource[]
  ): void {
    const templateFile = path.join(Generator.templateDir, "SharedResponse.ejs");
    const template = fs.readFileSync(templateFile, "utf8");

    fs.mkdirSync(Generator.sharedOutputDir, { recursive: true });

    for (const sharedResponse of sharedResponseResources) {
      this.writeSharedResponse(template, sharedResponse);
    }
  }

  public static writeSharedResponse(
    template: string,
    sharedResponse: SharedResponseResource
  ): void {
    const headerTsType = sharedResponse.header
      ? TsTypePrinter.print(TsTypeNode.fromZod(sharedResponse.header))
      : undefined;
    const bodyTsType = sharedResponse.body
      ? TsTypePrinter.print(TsTypeNode.fromZod(sharedResponse.body))
      : undefined;
    const pascalCaseName = Case.pascal(sharedResponse.name);

    const content = ejs.render(template, {
      coreDir: Generator.coreDir,
      httpStatusCode: HttpStatusCode,
      headerTsType,
      bodyTsType,
      pascalCaseName,
      sharedResponse,
    });

    fs.writeFileSync(sharedResponse.outputFile, content);
  }
}
