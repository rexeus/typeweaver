import getPort from "get-port";
import { afterAll, beforeAll, describe } from "vitest";
import { isRuntimeAvailable, spawnRuntimeServer } from "../helpers.js";
import { registerGeneratedRequestTests } from "./generated-requests.js";
import { registerQueryAndEmptyResponseTests } from "./queries-and-empty-responses.js";
import { registerRuntimeErrorTests } from "./runtime-errors.js";
import type { RuntimeConfig, RuntimeServer } from "../helpers.js";

type RuntimeContractSuiteOptions = {
  readonly title: string;
  readonly runtime: RuntimeConfig;
  readonly skipIfUnavailable?: boolean;
};

export function describeRuntimeContractSuite(
  options: RuntimeContractSuiteOptions
): void {
  const describeRuntime = options.skipIfUnavailable
    ? describe.skipIf(!isRuntimeAvailable(options.runtime.command))
    : describe;

  describeRuntime(options.title, () => {
    const environment: { server?: RuntimeServer } = {};

    beforeAll(async () => {
      const port = await getPort();
      environment.server = await spawnRuntimeServer(options.runtime, port);
    });

    afterAll(async () => {
      await environment.server?.kill();
    });

    registerGeneratedRequestTests(environment);
    registerQueryAndEmptyResponseTests(environment);
    registerRuntimeErrorTests(environment);
  });
}
