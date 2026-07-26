import { FileSystem } from "@effect/platform";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { MainLayer } from "../src/runtime/MainLayer.js";
import { ContextBuilder } from "../src/services/ContextBuilder.js";
import { PathSafety } from "../src/services/PathSafety.js";
import { PluginRegistry } from "../src/services/PluginRegistry.js";
import { TemplateRenderer } from "../src/services/TemplateRenderer.js";

const TestMainLayer = MainLayer.pipe(Layer.provide(FileSystem.layerNoop({})));

describe("MainLayer", () => {
  it.effect("provides working gen services as one composition root", () =>
    Effect.gen(function* () {
      const templateRenderer = yield* TemplateRenderer;
      const pathSafety = yield* PathSafety;
      const pluginRegistry = yield* PluginRegistry;
      const contextBuilder = yield* ContextBuilder;

      const rendered = yield* templateRenderer.render("Hello <%= name %>!", {
        name: "Typeweaver",
      });
      const safePath = yield* pathSafety.validateGeneratedPath({
        outputDir: "/typeweaver-main-layer-test",
        requestedPath: "generated/client.ts",
      });

      const registry = yield* pluginRegistry.createInstance();
      yield* registry.register({ name: "dependent", depends: ["base"] });
      yield* registry.register({ name: "base" });
      const registrations = yield* registry.getAll;

      const pluginContext = yield* contextBuilder.buildPluginContext({
        outputDir: "/generated",
        inputDir: "/spec",
        config: { format: false },
      });

      expect(rendered).toBe("Hello Typeweaver!");
      expect(safePath.generatedPath).toBe("generated/client.ts");
      expect(registrations.map(registration => registration.name)).toEqual([
        "base",
        "dependent",
      ]);
      expect(pluginContext).toEqual({
        outputDir: "/generated",
        inputDir: "/spec",
        config: { format: false },
      });
    }).pipe(Effect.provide(TestMainLayer))
  );
});
