import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { ServerRouterGenerator } from "./ServerRouterGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default class ServerPlugin extends BasePlugin {
  public name = "server";

  public override generate(context: GeneratorContext): void {
    const libSourceDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libSourceDir, this.name);

    ServerRouterGenerator.generate(context);
  }
}
