import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, test } from "vitest";
import { createPluginTestKit, defineScopedPlugin } from "../../src/index.js";
import type { NormalizedSpec, Plugin } from "../../src/index.js";

type Connection = {
  readonly id: number;
};

const Connection = Context.Service<Connection>(
  "typeweaver/plugin-tests/HostRuntimeConnection"
);

type Session = {
  readonly connectionId: number;
};

const Session = Context.Service<Session>(
  "typeweaver/plugin-tests/HostRuntimeSession"
);

const emptySpec: NormalizedSpec = {
  metadata: { title: "Scoped Plugin Host Runtime Test API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const makeConnectionLayer = (events: string[]) => {
  let nextId = 0;
  return Layer.effect(
    Connection,
    Effect.acquireRelease(
      Effect.sync(() => {
        nextId += 1;
        events.push(`acquire:${nextId}`);
        return { id: nextId };
      }),
      connection =>
        Effect.sync(() => {
          events.push(`release:${connection.id}`);
        })
    )
  );
};

/**
 * Runs two plugin generations inside a host runtime that already built
 * `hostLayer`, then disposes the host runtime.
 */
const runTwoGenerationsInHost = async (
  hostLayer: Layer.Layer<Connection>,
  plugin: Plugin
): Promise<Connection> => {
  const hostRuntime = ManagedRuntime.make(hostLayer);
  try {
    const hostConnection = await hostRuntime.runPromise(Connection);
    await hostRuntime.runPromise(
      createPluginTestKit({ normalizedSpec: emptySpec }).run(plugin)
    );
    await hostRuntime.runPromise(
      createPluginTestKit({ normalizedSpec: emptySpec }).run(plugin)
    );
    return hostConnection;
  } finally {
    await hostRuntime.dispose();
  }
};

const perGenerationEvents = [
  "acquire:1",
  "acquire:2",
  "generate:2",
  "release:2",
  "acquire:3",
  "generate:3",
  "release:3",
  "release:1",
];

describe("defineScopedPlugin inside a host runtime", () => {
  test("builds a Layer the host runtime already memoized fresh for every generation", async () => {
    const events: string[] = [];
    const connectionLayer = makeConnectionLayer(events);
    const plugin = defineScopedPlugin({
      name: "scoped-host-memoized",
      layer: connectionLayer,
      generate: () =>
        Effect.flatMap(Connection, connection =>
          Effect.sync(() => {
            events.push(`generate:${connection.id}`);
          })
        ),
    });

    const hostConnection = await runTwoGenerationsInHost(
      connectionLayer,
      plugin
    );

    expect(hostConnection.id).toBe(1);
    expect(events).toEqual(perGenerationEvents);
  });

  test("builds a host-memoized Layer that the plugin Layer builds internally fresh for every generation", async () => {
    const events: string[] = [];
    const connectionLayer = makeConnectionLayer(events);
    const sessionLayer = Layer.effect(
      Session,
      Effect.map(Layer.build(connectionLayer), context => ({
        connectionId: Context.get(context, Connection).id,
      }))
    );
    const plugin = defineScopedPlugin({
      name: "scoped-host-nested",
      layer: sessionLayer,
      generate: () =>
        Effect.flatMap(Session, session =>
          Effect.sync(() => {
            events.push(`generate:${session.connectionId}`);
          })
        ),
    });

    const hostConnection = await runTwoGenerationsInHost(
      connectionLayer,
      plugin
    );

    expect(hostConnection.id).toBe(1);
    expect(events).toEqual(perGenerationEvents);
  });

  test("builds a host-memoized Layer that a hook provides fresh for every generation", async () => {
    const events: string[] = [];
    const connectionLayer = makeConnectionLayer(events);
    const plugin = defineScopedPlugin({
      name: "scoped-host-hook-provided",
      layer: Layer.succeed(Session, { connectionId: 0 }),
      generate: () =>
        Effect.flatMap(Connection, connection =>
          Effect.sync(() => {
            events.push(`generate:${connection.id}`);
          })
        ).pipe(Effect.provide(connectionLayer)),
    });

    const hostConnection = await runTwoGenerationsInHost(
      connectionLayer,
      plugin
    );

    expect(hostConnection.id).toBe(1);
    expect(events).toEqual(perGenerationEvents);
  });
});
