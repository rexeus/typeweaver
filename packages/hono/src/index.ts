import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { HonoRouterGenerator } from "./HonoRouterGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default class HonoPlugin extends BasePlugin {
  public name = "hono";

  public override generate(context: GeneratorContext): void {
    const libSourceDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libSourceDir, this.name);

    HonoRouterGenerator.generate(context);
  }
}
