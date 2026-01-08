import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { ExpressRouterGenerator } from "./ExpressRouterGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default class ExpressPlugin extends BasePlugin {
  public name = "express";

  public override generate(context: GeneratorContext): void {
    const libSourceDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libSourceDir, this.name);

    ExpressRouterGenerator.generate(context);
  }
}
