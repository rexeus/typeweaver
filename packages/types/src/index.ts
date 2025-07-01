import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { SharedResponseGenerator } from "./SharedResponseGenerator";
import { RequestGenerator } from "./RequestGenerator";
import { RequestValidationGenerator } from "./RequestValidationGenerator";
import { ResponseGenerator } from "./ResponseGenerator";
import { ResponseValidationGenerator } from "./ResponseValidationGenerator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class TypesPlugin extends BasePlugin {
  public name = "types";
  public override generate(context: GeneratorContext): Promise<void> | void {
    // Copy lib files to lib/types/ from dist folder
    const libDir = path.join(__dirname, "lib");
    this.copyLibFiles(context, libDir, "types");
    
    SharedResponseGenerator.generate(context);
    RequestGenerator.generate(context);
    RequestValidationGenerator.generate(context);
    ResponseGenerator.generate(context);
    ResponseValidationGenerator.generate(context);
  }
}
