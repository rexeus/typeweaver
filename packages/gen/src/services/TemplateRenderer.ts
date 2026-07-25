import { Effect } from "effect";
import { TemplateRenderError } from "../errors/TemplateRenderError.js";
import { liveTemplateRendererShape } from "./internal/pluginContextBuilder.js";

const render: (
  template: string,
  data: unknown
) => Effect.Effect<string, TemplateRenderError> = Effect.fn(
  "typeweaver.TemplateRenderer.render"
)((template: string, data: unknown) =>
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
export class TemplateRenderer extends Effect.Service<TemplateRenderer>()(
  "typeweaver/TemplateRenderer",
  {
    succeed: { render },
    accessors: true,
  }
) {}
