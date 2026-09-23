import type {
  AcceptsRawInput,
  BoundaryPart,
  FieldIssue,
  UnwrapTransparent,
} from "./httpRequestBoundarySchemas.js";
import type { RequestDefinition } from "./RequestDefinition.js";
import type { z } from "zod";

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
          : AcceptsRawInput<TKey, "scalar"> extends true
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
export type HttpRequestBoundaryIssuesFor<TRequest extends RequestDefinition> =
  | ("param" extends keyof TRequest
      ? ContainerIssues<TRequest["param"], "request.param", false>
      : never)
  | ("query" extends keyof TRequest
      ? ContainerIssues<TRequest["query"], "request.query", true>
      : never)
  | ("header" extends keyof TRequest
      ? ContainerIssues<TRequest["header"], "request.header", true>
      : never);
