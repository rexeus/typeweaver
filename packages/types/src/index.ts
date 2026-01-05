import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { RequestGenerator } from "./RequestGenerator";
import { RequestValidationGenerator } from "./RequestValidationGenerator";
import { ResponseGenerator } from "./ResponseGenerator";
import { ResponseValidationGenerator } from "./ResponseValidationGenerator";
import { SharedResponseGenerator } from "./SharedResponseGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default class TypesPlugin extends BasePlugin {
  public name = "types";

  public override generate(context: GeneratorContext): void {
    // Copy lib files to lib/types/ from dist folder
    const libDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libDir, this.name);

    SharedResponseGenerator.generate(context);
    RequestGenerator.generate(context);
    RequestValidationGenerator.generate(context);
    ResponseGenerator.generate(context);
    ResponseValidationGenerator.generate(context);
  }
}
