import { Context, Effect, Layer } from "effect";
import { TemplateRenderError } from "../errors/TemplateRenderError.js";
import { liveTemplateRendererShape } from "./internal/pluginContextBuilder.js";
import type { TemplateData } from "../plugins/contextTypes.js";

export type TemplateRendererShape = {
  readonly render: (
    template: string,
    data: TemplateData
  ) => Effect.Effect<string, TemplateRenderError>;
};

const render: TemplateRendererShape["render"] = Effect.fn(
  "typeweaver.TemplateRenderer.render"
)((template: string, data: TemplateData) =>
  Effect.try({
    try: () => liveTemplateRendererShape.render(template, data),
    catch: cause => new TemplateRenderError({ cause }),
  })
);

/**
 * Renders an EJS-like template against a data context.
 *
 * Effect-native facade over the sync renderer core
 * (`liveTemplateRendererShape`, backed by the project's hand-rolled
 * `renderTemplate` which relies on `with(data)` sloppy mode). The same
 * core powers the sync plugin-context callbacks — this service exists for
 * Effect-native callers and surfaces malformed templates as a typed
 * `TemplateRenderError` instead of a defect. No I/O; templates are passed
 * as strings.
 */
export class TemplateRenderer extends Context.Service<
  TemplateRenderer,
  TemplateRendererShape
>()("typeweaver/TemplateRenderer") {
  static readonly make = (service: TemplateRendererShape) => service;

  static readonly Default: Layer.Layer<TemplateRenderer> = Layer.succeed(
    TemplateRenderer,
    { render }
  );

  static readonly render = (template: string, data: TemplateData) =>
    TemplateRenderer.use(service => service.render(template, data));
}
