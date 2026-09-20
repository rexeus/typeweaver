import { layer as nodeChildProcessSpawnerLayer } from "@effect/platform-node/NodeChildProcessSpawner";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { layer as nodePathLayer } from "@effect/platform-node/NodePath";
import { runMain as runNodeMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeStdioLayer } from "@effect/platform-node/NodeStdio";
import { layer as nodeTerminalLayer } from "@effect/platform-node/NodeTerminal";
import { Layer } from "effect";

const nodePlatformBaseLayer = Layer.mergeAll(
  nodeFileSystemLayer,
  nodePathLayer
);

const nodeChildProcessSpawnerWithBaseLayer = nodeChildProcessSpawnerLayer.pipe(
  Layer.provide(nodePlatformBaseLayer)
);

export const nodePlatformLayer = Layer.mergeAll(
  nodePathLayer,
  nodeTerminalLayer,
  nodeStdioLayer,
  nodeChildProcessSpawnerWithBaseLayer
);

export { runNodeMain };
