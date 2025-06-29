import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";
import { ClientGenerator } from "./ClientGenerator";

export default class ClientsPlugin extends BasePlugin {
  public name = "clients";
  public override generate(context: GeneratorContext): Promise<void> | void {
    ClientGenerator.generate(context);
  }
}
