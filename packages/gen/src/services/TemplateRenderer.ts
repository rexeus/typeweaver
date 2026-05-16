import { Effect } from "effect";
import { renderTemplate } from "../helpers/templateEngine.js";

/**
 * Renders an EJS-like template against a data context.
 *
 * Internally calls the project's hand-rolled `renderTemplate` (which relies on
 * `with(data)` sloppy mode), wrapped in `Effect.sync` so callers get an
 * Effect-native API. No I/O; templates are passed as strings.
 */
export class TemplateRenderer extends Effect.Service<TemplateRenderer>()(
  "typeweaver/TemplateRenderer",
  {
    succeed: {
      render: (template: string, data: unknown): Effect.Effect<string> =>
        Effect.sync(() =>
          renderTemplate(template, (data ?? {}) as Record<string, unknown>)
        ),
    },
    accessors: true,
  }
) {}
