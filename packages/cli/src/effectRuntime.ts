import { MainLayer } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";
import { Formatter } from "./services/Formatter.js";

/**
 * Production runtime for the typeweaver CLI.
 *
 * Layers compose top-down: NodeContext supplies the Node-backed FileSystem,
 * Path, and Terminal implementations; MainLayer supplies the gen-side
 * services (TemplateRenderer, PathSafety, GeneratedFiles); Formatter wraps
 * the optional `oxfmt` dependency.
 *
 * Tests build their own runtime against an InMemoryFileSystem layer instead
 * of NodeContext.layer — see `packages/test-utils`.
 */
export const ProductionLayer = Layer.mergeAll(
  NodeContext.layer,
  MainLayer,
  Formatter.Default
);

export const effectRuntime = ManagedRuntime.make(ProductionLayer);
