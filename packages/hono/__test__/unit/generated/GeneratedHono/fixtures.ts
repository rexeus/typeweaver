import type {
  ITypedHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import {
  createGetMetricKeyedLabelsSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricSuccessResponse,
  createTestHono,
  TodoHono,
} from "test-utils";
import {
  createTodoApiHandlers,
  prepareRequestData,
  UncheckedResponseTodoHono,
} from "../../../helpers.js";
import type { UncheckedTodoHandlers } from "../../../helpers.js";
import type {
  HonoMetricApiHandler,
  HonoTodoApiHandler,
  IGetMetricRequest,
} from "test-utils";

export type CreateTestHonoOptions = Parameters<typeof createTestHono>[0];

export type CreateTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<true>>[0],
  "requestHandlers"
>;

export type UnvalidatedTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests" | "validateResponses"
>;

export const readContextString = (
  context: { get: (key: string) => unknown },
  key: string
): string | undefined => {
  const value = context.get(key);
  return typeof value === "string" ? value : undefined;
};

export async function requestTestHono(
  url: string,
  requestData: IValidatedHttpRequest,
  options?: CreateTestHonoOptions
): Promise<Response> {
  return await createTestHono(options).request(
    url,
    prepareRequestData(requestData)
  );
}

export function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<true>>,
  options: CreateTodoHonoOptions = {}
): TodoHono<true> {
  return new TodoHono<true>({
    ...options,
    requestHandlers: createTodoApiHandlers<true>(handlers),
    validateResponses: options.validateResponses ?? false,
  });
}

export function createUnvalidatedTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options: UnvalidatedTodoHonoOptions = {}
): TodoHono<false> {
  return new TodoHono<false>({
    ...options,
    validateRequests: false,
    validateResponses: false,
    requestHandlers: createTodoApiHandlers<false>(handlers),
  });
}

export function createUnvalidatedTodoHonoWithUncheckedHandlers(
  uncheckedHandlers: UncheckedTodoHandlers
): TodoHono<false> {
  return new UncheckedResponseTodoHono<false>(
    {
      validateRequests: false,
      validateResponses: false,
      requestHandlers: createTodoApiHandlers<false>({}),
    },
    uncheckedHandlers
  );
}

export function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options: CreateTodoHonoOptions = {}
): TodoHono<true> {
  return new UncheckedResponseTodoHono<true>(
    {
      ...options,
      requestHandlers: createTodoApiHandlers<true>({}),
      validateResponses: options.validateResponses ?? false,
    },
    { CreateTodo: async () => response }
  );
}

export async function requestCreateTodoWithMalformedJson(
  app: Pick<ReturnType<typeof createTestHono>, "request">,
  initOverrides?: RequestInit
): Promise<Response> {
  const headers = new Headers(initOverrides?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return await app.request("http://localhost/todos", {
    ...initOverrides,
    method: initOverrides?.method ?? "POST",
    headers,
    body: initOverrides?.body ?? "{",
  });
}

export function aNestedJsonPrototypePollutionPayload(): string {
  return (
    '{"title":"safe title","meta":{"label":"nested","__proto__":{"polluted":true}},' +
    '"items":[{"value":"array nested","__proto__":{"polluted":true}}],' +
    '"__proto__":{"polluted":true}}'
  );
}

export function createMetricBoundaryHandlers(
  onRequest?: (request: IGetMetricRequest) => void
): HonoMetricApiHandler<true> {
  return {
    handleGetMetricRequest: async request => {
      onRequest?.(request);
      return createGetMetricSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          enabled: request.query.enabled ?? false,
        },
      });
    },
    handleGetMetricLabelsRequest: async request =>
      createGetMetricLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
          flags: request.header ?? {},
        },
      }),
    handleGetMetricSamplesRequest: async request =>
      createGetMetricSamplesSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          samples: request.query ?? {},
        },
      }),
    handleGetMetricKeyedLabelsRequest: async request =>
      createGetMetricKeyedLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
        },
      }),
  };
}
