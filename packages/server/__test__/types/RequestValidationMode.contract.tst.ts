import { MetricRouter } from "test-utils";
import { expectTypeOf } from "vitest";
import type {
  IGetMetricRequest,
  IRawGetMetricRequest,
  ServerMetricApiHandler,
} from "test-utils";

type RequestFor<THandler> = THandler extends (
  ...arguments_: infer TArguments
) => unknown
  ? TArguments[0]
  : never;

type DefaultRequest = RequestFor<
  ServerMetricApiHandler["handleGetMetricRequest"]
>;
type ValidatedRequest = RequestFor<
  ServerMetricApiHandler<
    Record<string, unknown>,
    true
  >["handleGetMetricRequest"]
>;
type UnvalidatedRequest = RequestFor<
  ServerMetricApiHandler<
    Record<string, unknown>,
    false
  >["handleGetMetricRequest"]
>;
type DynamicRequest = RequestFor<
  ServerMetricApiHandler<
    Record<string, unknown>,
    boolean
  >["handleGetMetricRequest"]
>;

expectTypeOf<DefaultRequest>().toEqualTypeOf<IGetMetricRequest>();
expectTypeOf<ValidatedRequest>().toEqualTypeOf<IGetMetricRequest>();
expectTypeOf<UnvalidatedRequest>().toEqualTypeOf<IRawGetMetricRequest>();
expectTypeOf<DynamicRequest>().toEqualTypeOf<
  IGetMetricRequest | IRawGetMetricRequest
>();

declare const defaultModeHandlers: ServerMetricApiHandler<
  Record<string, unknown>,
  true
>;
declare const rawModeHandlers: ServerMetricApiHandler<
  Record<string, unknown>,
  false
>;
declare const dynamicModeHandlers: ServerMetricApiHandler<
  Record<string, unknown>,
  boolean
>;

/**
 * Type-only option contracts. Never executed because `*.contract.tst.ts` files
 * are typechecked but not run.
 */
export function assertValidationModeOptions(): void {
  new MetricRouter<Record<string, unknown>, true>({
    requestHandlers: defaultModeHandlers,
  });
  new MetricRouter<Record<string, unknown>, true>({
    requestHandlers: defaultModeHandlers,
    validateRequests: true,
  });
  new MetricRouter<Record<string, unknown>, true>({
    requestHandlers: defaultModeHandlers,
    // @ts-expect-error literal true mode only accepts validated requests
    validateRequests: false,
  });

  // @ts-expect-error literal false mode requires an explicit validateRequests
  new MetricRouter<Record<string, unknown>, false>({
    requestHandlers: rawModeHandlers,
  });
  new MetricRouter<Record<string, unknown>, false>({
    requestHandlers: rawModeHandlers,
    validateRequests: false,
  });
  new MetricRouter<Record<string, unknown>, false>({
    requestHandlers: rawModeHandlers,
    // @ts-expect-error literal false mode cannot request validation
    validateRequests: true,
  });

  // The handler type and option both specialize the router without explicit
  // type arguments.
  new MetricRouter({
    requestHandlers: rawModeHandlers,
    validateRequests: false,
  });
  new MetricRouter({
    requestHandlers: dynamicModeHandlers,
    validateRequests: false,
  });

  // @ts-expect-error dynamic mode requires an explicit validateRequests
  new MetricRouter<Record<string, unknown>, boolean>({
    requestHandlers: dynamicModeHandlers,
  });
  new MetricRouter<Record<string, unknown>, boolean>({
    requestHandlers: dynamicModeHandlers,
    validateRequests: false,
  });
  new MetricRouter<Record<string, unknown>, boolean>({
    requestHandlers: dynamicModeHandlers,
    validateRequests: true,
  });
}
