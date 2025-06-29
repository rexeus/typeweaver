import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { HttpApiRouterGenerator } from "./HttpApiRouterGenerator";

export default class AwsCdkPlugin extends BasePlugin {
  public name = "aws-cdk";
  public override generate(context: GeneratorContext): Promise<void> | void {
    HttpApiRouterGenerator.generate(context);
  }
}
