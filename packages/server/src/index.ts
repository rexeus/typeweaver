import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { generate as generateRouters } from "./routerGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Typeweaver plugin that generates a lightweight, dependency-free server
 * with built-in routing and middleware support.
 *
 * Copies the runtime library files (`TypeweaverApp`, `TypeweaverRouter`, `Router`,
 * `Middleware`, etc.) and generates typed router classes for each resource.
 */
export class ServerPlugin extends BasePlugin {
  public name = "server";
  public override depends = ["types"];

  /**
   * Generates the server runtime and typed routers for all resources.
   *
   * @param context - The generator context
   */
  public override generate(context: GeneratorContext): void {
    const libSourceDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libSourceDir, this.name);

    generateRouters(context);
  }
}
