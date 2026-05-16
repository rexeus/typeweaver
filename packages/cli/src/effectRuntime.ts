import { MainLayer } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";

/**
 * Production runtime for the typeweaver CLI.
 *
 * Layers compose top-down: NodeContext supplies the Node-backed FileSystem,
 * Path, and Terminal implementations; MainLayer supplies typeweaver's own
 * services on top.
 *
 * Tests build their own runtime against an InMemoryFileSystem layer instead
 * of NodeContext.layer — see `packages/test-utils`.
 */
export const ProductionLayer = Layer.mergeAll(NodeContext.layer, MainLayer);

export const effectRuntime = ManagedRuntime.make(ProductionLayer);
