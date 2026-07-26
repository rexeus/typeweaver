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
expectTypeOf<DynamicRequest>().toEqualTypeOf<IRawGetMetricRequest>();
