import { layer as nodeChildProcessSpawnerLayer } from "@effect/platform-node-shared/NodeChildProcessSpawner";
import { layer as nodePathLayer } from "@effect/platform-node-shared/NodePath";
import { layer as nodeStdioLayer } from "@effect/platform-node-shared/NodeStdio";
import { layer as nodeTerminalLayer } from "@effect/platform-node-shared/NodeTerminal";
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
