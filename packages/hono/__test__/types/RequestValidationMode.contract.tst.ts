import { MetricHono } from "test-utils";
import { expectTypeOf } from "vitest";
import type {
  HonoMetricApiHandler,
  IGetMetricRequest,
  IRawGetMetricRequest,
} from "test-utils";

type RequestFor<THandler> = THandler extends (
  ...arguments_: infer TArguments
) => unknown
  ? TArguments[0]
  : never;

type DefaultRequest = RequestFor<
  HonoMetricApiHandler["handleGetMetricRequest"]
>;
type ValidatedRequest = RequestFor<
  HonoMetricApiHandler<true>["handleGetMetricRequest"]
>;
type UnvalidatedRequest = RequestFor<
  HonoMetricApiHandler<false>["handleGetMetricRequest"]
>;
type DynamicRequest = RequestFor<
  HonoMetricApiHandler<boolean>["handleGetMetricRequest"]
>;

expectTypeOf<DefaultRequest>().toEqualTypeOf<IGetMetricRequest>();
expectTypeOf<ValidatedRequest>().toEqualTypeOf<IGetMetricRequest>();
expectTypeOf<UnvalidatedRequest>().toEqualTypeOf<IRawGetMetricRequest>();
expectTypeOf<DynamicRequest>().toEqualTypeOf<
  IGetMetricRequest | IRawGetMetricRequest
>();

declare const defaultModeHandlers: HonoMetricApiHandler<true>;
declare const rawModeHandlers: HonoMetricApiHandler<false>;
declare const dynamicModeHandlers: HonoMetricApiHandler<boolean>;

/**
 * Type-only option contracts. Never executed because `*.contract.tst.ts` files
 * are typechecked but not run.
 */
export function assertValidationModeOptions(): void {
  new MetricHono<true>({ requestHandlers: defaultModeHandlers });
  new MetricHono<true>({
    requestHandlers: defaultModeHandlers,
    validateRequests: true,
  });
  new MetricHono<true>({
    requestHandlers: defaultModeHandlers,
    // @ts-expect-error literal true mode only accepts validated requests
    validateRequests: false,
  });

  // @ts-expect-error literal false mode requires an explicit validateRequests
  new MetricHono<false>({ requestHandlers: rawModeHandlers });
  new MetricHono<false>({
    requestHandlers: rawModeHandlers,
    validateRequests: false,
  });
  new MetricHono<false>({
    requestHandlers: rawModeHandlers,
    // @ts-expect-error literal false mode cannot request validation
    validateRequests: true,
  });

  // The handler type and option both specialize the router without explicit
  // type arguments.
  new MetricHono({
    requestHandlers: rawModeHandlers,
    validateRequests: false,
  });
  new MetricHono({
    requestHandlers: dynamicModeHandlers,
    validateRequests: false,
  });

  // @ts-expect-error dynamic mode requires an explicit validateRequests
  new MetricHono<boolean>({ requestHandlers: dynamicModeHandlers });
  new MetricHono<boolean>({
    requestHandlers: dynamicModeHandlers,
    validateRequests: false,
  });
  new MetricHono<boolean>({
    requestHandlers: dynamicModeHandlers,
    validateRequests: true,
  });
}
