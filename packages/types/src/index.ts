import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { SharedResponseGenerator } from "./SharedResponseGenerator";
import { RequestGenerator } from "./RequestGenerator";
import { RequestValidationGenerator } from "./RequestValidationGenerator";
import { ResponseGenerator } from "./ResponseGenerator";
import { ResponseValidationGenerator } from "./ResponseValidationGenerator";

export default class TypesPlugin extends BasePlugin {
  public name = "types";
  public override generate(context: GeneratorContext): Promise<void> | void {
    SharedResponseGenerator.generate(context);
    RequestGenerator.generate(context);
    RequestValidationGenerator.generate(context);
    ResponseGenerator.generate(context);
    ResponseValidationGenerator.generate(context);
  }
}
