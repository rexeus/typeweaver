import { layer as nodeChildProcessSpawnerLayer } from "@effect/platform-node/NodeChildProcessSpawner";
import { layer as nodePathLayer } from "@effect/platform-node/NodePath";
import { runMain as runNodeMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeStdioLayer } from "@effect/platform-node/NodeStdio";
import { layer as nodeTerminalLayer } from "@effect/platform-node/NodeTerminal";
import { Layer } from "effect";

const nodeChildProcessSpawnerWithPathLayer = nodeChildProcessSpawnerLayer.pipe(
  Layer.provide(nodePathLayer)
);

export const nodePlatformLayer = Layer.mergeAll(
  nodePathLayer,
  nodeTerminalLayer,
  nodeStdioLayer,
  nodeChildProcessSpawnerWithPathLayer
);

export { runNodeMain };
