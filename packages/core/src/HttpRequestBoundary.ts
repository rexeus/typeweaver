import type { RequestDefinition } from "./RequestDefinition.js";
import type { z } from "zod";

export type ClientHttpScalar = string | number | boolean | bigint | Date;

export type ClientHttpParam =
  | Readonly<Record<string, ClientHttpScalar>>
  | undefined;

export type ClientHttpQuery =
  | Readonly<
      Record<string, ClientHttpScalar | readonly ClientHttpScalar[] | undefined>
    >
  | undefined;

export type ClientHttpHeader = ClientHttpQuery;

type BoundaryPart = "request.header" | "request.param" | "request.query";

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
type UnwrapTransparent<TSchema> =
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
type HasOpaqueTransform<TInput> =
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
type AcceptsRawInput<TSchema, TTransport extends RawTransportKind> =
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

type FieldIssue<
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

type ObjectIssues<
  TShape extends z.core.$ZodShape,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> = {
  [TName in keyof TShape & string]: FieldIssue<
    TShape[TName],
    TPart,
    TName,
    TAllowArray
  >;
}[keyof TShape & string];

/**
 * An object schema is open when its output has a string index signature with a
 * value other than `never`. That covers `z.looseObject`, `.loose()`,
 * `.passthrough()`, and `.catchall(...)`; `.catchall(z.never())` is closed.
 * The broad base `ZodObject` shape is handled before this by its index
 * signature and remains the intentional `RequestDefinition` escape.
 */
type IsOpenObjectSchema<TSchema> = string extends keyof z.output<TSchema>
  ? [z.output<TSchema>[string]] extends [never]
    ? false
    : true
  : false;

type ObjectContainerIssues<
  TSchema,
  TShape extends z.core.$ZodShape,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> = string extends keyof TShape
  ? never
  : "__proto__" extends keyof TShape & string
    ? `${TPart} must not declare the reserved key '__proto__'`
    : IsOpenObjectSchema<TSchema> extends true
      ? `${TPart} must not use an open object (loose/catchall); use z.record for undeclared keys`
      : ObjectIssues<TShape, TPart, TAllowArray>;

/**
 * True only for the exact broad base schema carried by the container defaults
 * of `RequestDefinition` (core `$ZodType` or the classic `z.ZodType` alias).
 * That unresolved value is the single intentional escape; every concrete
 * schema flows through `FieldIssue` and its output classification.
 */
type IsBroadBaseSchema<TSchema> = [TSchema] extends [z.core.$ZodType]
  ? [z.core.$ZodType] extends [TSchema]
    ? true
    : [z.ZodType] extends [TSchema]
      ? true
      : false
  : false;

/**
 * True when a record key schema has a finite string literal/union output that
 * contains the reserved `__proto__` key. Broad `string` outputs are left to the
 * runtime identity guard.
 */
type HasReservedLiteralKeyOutput<TKey> =
  string extends z.output<TKey>
    ? false
    : "__proto__" extends z.output<TKey>
      ? true
      : false;

/**
 * Record keys must preserve key identity: a transforming key schema can emit
 * reserved or colliding keys that Zod record parsing cannot round-trip.
 * Detectable pipes/transforms are rejected; statically known `__proto__`
 * outputs are rejected; non-string key inputs/outputs are rejected. The key
 * check is always evaluated, including for the broad base record value, which
 * only escapes the record-value field check. A broad key schema (`string`
 * output, including the base `$ZodRecordKey`) is left to the generated
 * validator's runtime identity guard, which also covers opaque Zod string
 * overwrites such as `.trim()`/`.toLowerCase()`.
 */
type RecordKeyIssue<TKey, TPart extends BoundaryPart> =
  UnwrapTransparent<TKey> extends z.ZodPipe<infer _TIn, infer _TOut>
    ? `${TPart} record keys must not transform key identity`
    : UnwrapTransparent<TKey> extends z.core.$ZodTransform<
          infer _TOutput,
          infer _TInput
        >
      ? `${TPart} record keys must not transform key identity`
      : HasReservedLiteralKeyOutput<TKey> extends true
        ? `${TPart} record keys must not use the reserved key '__proto__'`
        : string extends z.output<TKey>
          ? never
          : AcceptsRawScalar<z.input<TKey>> extends true
            ? z.output<TKey> extends string
              ? never
              : `${TPart} record keys must produce strings`
            : `${TPart} record keys must accept strings`;

type RecordIssues<
  TKey extends z.core.$ZodRecordKey,
  TValue,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> =
  | RecordKeyIssue<TKey, TPart>
  | (IsBroadBaseSchema<TValue> extends true
      ? never
      : FieldIssue<TValue, TPart, "<record-value>", TAllowArray>);

type ContainerIssues<
  TSchema,
  TPart extends BoundaryPart,
  TAllowArray extends boolean,
> = TSchema extends undefined
  ? never
  : TSchema extends z.ZodOptional<infer TInner>
    ? ContainerIssues<TInner, TPart, TAllowArray>
    : TSchema extends z.ZodObject<infer TShape>
      ? ObjectContainerIssues<TSchema, TShape, TPart, TAllowArray>
      : TSchema extends z.ZodRecord<infer TKey, infer TValue>
        ? RecordIssues<TKey, TValue, TPart, TAllowArray>
        : `${TPart} must be a Zod object or record schema`;

type HttpRequestBoundaryIssuesFor<TRequest extends RequestDefinition> =
  | ("param" extends keyof TRequest
      ? ContainerIssues<TRequest["param"], "request.param", false>
      : never)
  | ("query" extends keyof TRequest
      ? ContainerIssues<TRequest["query"], "request.query", true>
      : never)
  | ("header" extends keyof TRequest
      ? ContainerIssues<TRequest["header"], "request.header", true>
      : never);

export type HttpRequestBoundaryIssues<TRequest extends RequestDefinition> =
  TRequest extends RequestDefinition
    ? HttpRequestBoundaryIssuesFor<TRequest>
    : never;

export type HttpRequestBoundaryConstraint<TRequest extends RequestDefinition> =
  [HttpRequestBoundaryIssues<TRequest>] extends [never]
    ? unknown
    : {
        readonly __typeweaverHttpBoundaryError__: HttpRequestBoundaryIssues<TRequest>;
      };
