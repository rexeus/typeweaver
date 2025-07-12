import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { ClientGenerator } from "./ClientGenerator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class ClientsPlugin extends BasePlugin {
  public name = "clients";
  public override generate(context: GeneratorContext): Promise<void> | void {
    // Copy lib files to lib/clients/ from dist folder
    const libDir = path.join(__dirname, "lib");
    this.copyLibFiles(context, libDir, "clients");
    
    ClientGenerator.generate(context);
  }
}
