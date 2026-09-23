import type { ClientHttpScalar } from "./httpRequestBoundaryTypes.js";
import type { z } from "zod";

export type BoundaryPart = "request.header" | "request.param" | "request.query";
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type DefinedInput<TInput> = Exclude<TInput, undefined>;
type AcceptsRawScalar<TInput> =
  IsNever<DefinedInput<TInput>> extends true
    ? false
    : string extends DefinedInput<TInput>
      ? true
      : DefinedInput<TInput> extends string
        ? true
        : false;
type AcceptsRawArray<TInput> =
  IsNever<DefinedInput<TInput>> extends true
    ? false
    : string[] extends DefinedInput<TInput>
      ? true
      : DefinedInput<TInput> extends readonly string[]
        ? true
        : false;

/** Strips transparent public wrappers without following pipes. */
export type UnwrapTransparent<TSchema> =
  TSchema extends z.ZodOptional<infer TInner>
    ? UnwrapTransparent<TInner>
    : TSchema extends z.ZodExactOptional<infer TInner>
      ? UnwrapTransparent<TInner>
      : TSchema extends z.ZodDefault<infer TInner>
        ? UnwrapTransparent<TInner>
        : TSchema extends z.ZodCatch<infer TInner>
          ? UnwrapTransparent<TInner>
          : TSchema extends z.ZodReadonly<infer TInner>
            ? UnwrapTransparent<TInner>
            : TSchema extends z.ZodNonOptional<infer TInner>
              ? UnwrapTransparent<TInner>
              : TSchema extends z.ZodSuccess<infer TInner>
                ? UnwrapTransparent<TInner>
                : TSchema extends z.ZodPrefault<infer TInner>
                  ? UnwrapTransparent<TInner>
                  : TSchema;
/**
 * Alternates transparent public wrapper unwrapping with pipe input traversal,
 * matching the runtime cardinality helper exactly. Opaque forms (`lazy`,
 * unions, effects) are not unwrapped, so recursion always terminates.
 */
type UnwrapInputSchema<TSchema> =
  UnwrapTransparent<TSchema> extends infer TUnwrapped
    ? TUnwrapped extends z.ZodPipe<infer TIn, infer _TOut>
      ? UnwrapInputSchema<TIn>
      : TUnwrapped
    : TSchema;
type InputCardinality<TSchema> =
  UnwrapInputSchema<TSchema> extends z.ZodArray<infer _TElement>
    ? "array"
    : "scalar";
type ArrayElement<TArray> = TArray extends readonly (infer TElement)[]
  ? TElement
  : never;
type ElementKind<TElement> =
  IsAny<TElement> extends true
    ? "unsupported"
    : IsNever<TElement> extends true
      ? "unsupported"
      : [TElement] extends [ClientHttpScalar]
        ? "scalar"
        : "unsupported";
type OutputClassify<TOutput> =
  IsAny<TOutput> extends true
    ? "unsupported"
    : IsNever<Exclude<TOutput, undefined>> extends true
      ? "unsupported"
      : [Exclude<TOutput, undefined>] extends [ClientHttpScalar]
        ? "scalar"
        : Exclude<TOutput, undefined> extends readonly unknown[]
          ? ElementKind<
              ArrayElement<Exclude<TOutput, undefined>>
            > extends "scalar"
            ? "array"
            : "unsupported"
          : "unsupported";
type FieldOutputKind<TSchema> = OutputClassify<z.output<TSchema>>;
type RawTransportKind = "scalar" | "array";
/**
 * A pipe input is pass-through when it forwards the raw value unchanged: a
 * bare `z.unknown()`/`z.any()` (or a transparent wrapper around one). In that
 * case the downstream schema must accept the raw transport value itself.
 */
type IsPassThroughInput<TInput> =
  UnwrapTransparent<TInput> extends infer TUnwrapped
    ? TUnwrapped extends z.core.$ZodUnknown | z.core.$ZodAny
      ? true
      : false
    : false;
type AcceptsRawTransport<
  TSchema,
  TTransport extends RawTransportKind,
> = TTransport extends "scalar"
  ? AcceptsRawScalar<z.input<TSchema>>
  : AcceptsRawArray<z.input<TSchema>>;
/**
 * True when an opaque transform sits anywhere on the raw-input chain before a
 * schema that proves raw acceptance. `z.preprocess` always creates such a
 * transform, so an arbitrary callback is rejected rather than trusted; an
 * ordinary typed string transform keeps its typed input and stays acceptable.
 */
export type HasOpaqueTransform<TInput> =
  UnwrapTransparent<TInput> extends infer TUnwrapped
    ? TUnwrapped extends z.core.$ZodTransform<infer _TOutput, infer _TInput>
      ? true
      : TUnwrapped extends z.ZodPipe<infer TInner, infer _TOut>
        ? HasOpaqueTransform<TInner>
        : false
    : false;
/**
 * Resolves whether a field's transport input accepts a raw string (or raw
 * string array). A bare `unknown`/`any` pipe input delegates the decision to
 * the downstream schema, so `unknown.pipe(z.coerce.number())` stays valid while
 * `unknown.pipe(z.number())` is rejected. Any `z.preprocess`/transform input is
 * opaque and rejected.
 */
export type AcceptsRawInput<TSchema, TTransport extends RawTransportKind> =
  UnwrapTransparent<TSchema> extends infer TUnwrapped
    ? TUnwrapped extends z.ZodPipe<infer TIn, infer TOut>
      ? IsPassThroughInput<TIn> extends true
        ? AcceptsRawInput<TOut, TTransport>
        : HasOpaqueTransform<TIn> extends true
          ? false
          : AcceptsRawTransport<TIn, TTransport>
      : HasOpaqueTransform<TUnwrapped> extends true
        ? false
        : AcceptsRawTransport<TUnwrapped, TTransport>
    : false;
export type FieldIssue<
  TSchema,
  TPart extends BoundaryPart,
  TName extends string,
  TAllowArray extends boolean,
> =
  FieldOutputKind<TSchema> extends "scalar"
    ? InputCardinality<TSchema> extends "scalar"
      ? AcceptsRawInput<TSchema, "scalar"> extends true
        ? never
        : `${TPart}.${TName} must accept a raw HTTP string`
      : `${TPart}.${TName} must not transform an array transport input`
    : FieldOutputKind<TSchema> extends "array"
      ? TAllowArray extends true
        ? InputCardinality<TSchema> extends "array"
          ? AcceptsRawInput<TSchema, "array"> extends true
            ? never
            : `${TPart}.${TName} must accept a raw HTTP string array`
          : `${TPart}.${TName} must not transform a scalar transport input`
        : `${TPart}.${TName} must produce a scalar value`
      : `${TPart}.${TName} must produce an HTTP client scalar or scalar array`;
