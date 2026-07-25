import type { PluginConfigError } from "@rexeus/typeweaver-gen";

export type TaggedPluginConfigError = PluginConfigError & {
  readonly _tag: "PluginConfigError";
  readonly pluginName: string;
  readonly reason: string;
};

export const isPluginConfigError = (
  value: unknown
): value is TaggedPluginConfigError =>
  typeof value === "object" &&
  value !== null &&
  (value as { readonly _tag?: unknown })._tag === "PluginConfigError" &&
  typeof (value as { readonly pluginName?: unknown }).pluginName === "string" &&
  typeof (value as { readonly reason?: unknown }).reason === "string";
