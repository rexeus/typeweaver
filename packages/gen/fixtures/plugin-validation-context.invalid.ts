import type { PluginValidationContext } from "../src/index.js";

export const attemptValidationWrite = (
  context: PluginValidationContext
): void => {
  context.writeFile("forbidden.txt", "validation must not write");
};
