import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { HonoRouterGenerator } from "./HonoRouterGenerator";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class HonoPlugin extends BasePlugin {
  public name = "hono";

  public override generate(context: GeneratorContext): void {
    const libSourceDir = path.join(__dirname, "lib");
    this.copyLibFiles(context, libSourceDir, this.name);

    HonoRouterGenerator.generate(context);
  }
}
