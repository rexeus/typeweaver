import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { ClientGenerator } from "./ClientGenerator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default class ClientsPlugin extends BasePlugin {
  public name = "clients";
  public override generate(context: GeneratorContext): Promise<void> | void {
    // Copy lib files to lib/clients/ from dist folder
    const libDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libDir, "clients");

    ClientGenerator.generate(context);
  }
}
