import { describe, expect, test } from "vitest";
import {
  ContextBuilder,
  PathSafety,
  PluginRegistry,
  TemplateRenderer,
} from "../../src/index.js";

describe("public Effect service constructors", () => {
  test.each([
    ["ContextBuilder", ContextBuilder],
    ["PathSafety", PathSafety],
    ["PluginRegistry", PluginRegistry],
    ["TemplateRenderer", TemplateRenderer],
  ])("keeps the %s identity make constructor", (_name, service) => {
    expect(typeof service.make).toBe("function");
  });
});
