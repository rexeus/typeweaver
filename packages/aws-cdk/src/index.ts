import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { HttpApiRouterGenerator } from "./HttpApiRouterGenerator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class AwsCdkPlugin extends BasePlugin {
  public name = "aws-cdk";
  public override generate(context: GeneratorContext): Promise<void> | void {
    
    // Copy lib files to lib/aws-cdk/ from dist folder
    const libDir = path.join(__dirname, "lib");
    this.copyLibFiles(context, libDir, "aws-cdk");
    
    HttpApiRouterGenerator.generate(context);
  }
}
