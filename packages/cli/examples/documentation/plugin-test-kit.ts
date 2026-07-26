import {
  createPluginTestKit,
  defineScopedPlugin,
} from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { Context, Effect, Layer } from "effect";

type GreetingService = {
  readonly greeting: string;
};

const GreetingService = Context.GenericTag<GreetingService>(
  "example/GreetingService"
);

const testGreetingLayer = Layer.succeed(GreetingService, {
  greeting: "hello from a public plugin test",
});

export const greetingPlugin = defineScopedPlugin({
  name: "greeting",
  layer: testGreetingLayer,
  generate: context =>
    Effect.flatMap(GreetingService, service =>
      context.writeFileEffect("greeting.txt", `${service.greeting}\n`)
    ),
});

const normalizedSpec: NormalizedSpec = {
  metadata: { title: "Plugin Fixture API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

export const pluginTestKit = createPluginTestKit({ normalizedSpec });
export const pluginTestProgram = pluginTestKit.run(greetingPlugin);
