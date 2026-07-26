import type { Plugin } from "../../src/plugins/Plugin.js";

export const aPluginNamed = (
  name: string,
  depends?: readonly string[]
): Plugin => ({
  name,
  ...(depends !== undefined ? { depends } : {}),
});
