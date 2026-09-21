import getPort from "get-port";
import { afterAll, beforeAll, describe } from "vitest";
import { isRuntimeAvailable, spawnRuntimeServer } from "./helpers.js";
import { registerRuntimeErrorTests } from "./runtimeContract.errors.js";
import { registerQueryAndEmptyResponseTests } from "./runtimeContract.query.js";
import { registerGeneratedRequestTests } from "./runtimeContract.requests.js";
import type { RuntimeConfig, RuntimeServer } from "./helpers.js";

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
