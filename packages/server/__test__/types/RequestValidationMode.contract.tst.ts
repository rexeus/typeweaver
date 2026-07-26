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
expectTypeOf<DynamicRequest>().toEqualTypeOf<IRawGetMetricRequest>();
