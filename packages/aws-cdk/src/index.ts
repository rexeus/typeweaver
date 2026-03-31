import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { generate as generateHttpApiRoutes } from "./httpApiRouterGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class AwsCdkPlugin extends BasePlugin {
  public name = "aws-cdk";
  public override generate(context: GeneratorContext): Promise<void> | void {
    // Copy lib files to lib/aws-cdk/ from dist folder
    const libDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libDir, "aws-cdk");

    generateHttpApiRoutes(context);
  }
}
