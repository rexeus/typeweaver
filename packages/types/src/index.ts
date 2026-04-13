import path from "node:path";
import { fileURLToPath } from "node:url";
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { generate as generateRequests } from "./requestGenerator.js";
import { generate as generateRequestValidators } from "./requestValidationGenerator.js";
import { generate as generateResponses } from "./responseGenerator.js";
import { generate as generateResponseValidators } from "./responseValidationGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export class TypesPlugin extends BasePlugin {
  public name = "types";

  public override generate(context: GeneratorContext): void {
    // Copy lib files to lib/types/ from dist folder
    const libDir = path.join(moduleDir, "lib");
    this.copyLibFiles(context, libDir, this.name);

    generateRequests(context);
    generateRequestValidators(context);
    generateResponses(context);
    generateResponseValidators(context);
  }
}
