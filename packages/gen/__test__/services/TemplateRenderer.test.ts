import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { TemplateRenderer } from "../../src/services/TemplateRenderer.js";

describe("TemplateRenderer", () => {
  it.effect("renders an escaped interpolation tag", () =>
    Effect.gen(function* () {
      const result = yield* TemplateRenderer.render("Hello <%= name %>!", {
        name: "Bob",
      });
      expect(result).toBe("Hello Bob!");
    }).pipe(Effect.provide(TemplateRenderer.Default))
  );

  it.effect("renders a raw interpolation tag without escaping", () =>
    Effect.gen(function* () {
      const result = yield* TemplateRenderer.render("<%- raw %>", {
        raw: "<b>bold</b>",
      });
      expect(result).toBe("<b>bold</b>");
    }).pipe(Effect.provide(TemplateRenderer.Default))
  );

  it.effect("escapes html in <%= %> tags", () =>
    Effect.gen(function* () {
      const result = yield* TemplateRenderer.render("<%= raw %>", {
        raw: "<b>bold</b>",
      });
      expect(result).toBe("&lt;b&gt;bold&lt;/b&gt;");
    }).pipe(Effect.provide(TemplateRenderer.Default))
  );

  it.effect("renders empty template when data is null or undefined", () =>
    Effect.gen(function* () {
      const result = yield* TemplateRenderer.render("static", undefined);
      expect(result).toBe("static");
    }).pipe(Effect.provide(TemplateRenderer.Default))
  );
});
