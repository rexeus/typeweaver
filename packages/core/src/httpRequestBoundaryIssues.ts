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
type IsBroadBaseSchema<TSchema> = [TSchema] extends [z.core.$ZodType]
  ? [z.core.$ZodType] extends [TSchema]
    ? true
    : [z.ZodType] extends [TSchema]
      ? true
      : false
  : false;
type HasReservedLiteralKeyOutput<TKey> =
  string extends z.output<TKey>
    ? false
    : "__proto__" extends z.output<TKey>
      ? true
      : false;
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
